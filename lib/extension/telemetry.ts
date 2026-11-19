// lib/extension/telemetry.ts — server only.
// One row in extension_events (migration 0072) per thing the Chrome extension
// did, and the install it came from kept current in extension_installs.
//
// Called from every /api/extension/* route, so the numbers do not depend on
// the extension reporting itself: an extension build from before 1.14.0 is
// still counted, just without an install id or version. From 1.14.0 the
// background worker sends three headers on every Dashboard request:
//   x-extension-version  chrome.runtime.getManifest().version
//   x-extension-install  a random uuid made on first run (chrome.storage.local)
//   x-extension-host     the hostname of the tab that asked, when there is one
//
// Best effort, like lib/account-events.ts: the write runs after the response
// (next/server after()), never throws, and a missing table (0072 not applied
// yet) costs one log line per server instance. Nothing typed by the user goes
// in here; callers pass counts, scores and states, never text from the page.

import { after, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { describeDevice } from '@/lib/session/describe-device';

export type ExtensionEvent =
  | 'installed' | 'updated' | 'uninstalled' | 'startup' | 'popup_opened' | 'signed_in' | 'signed_out'
  | 'job_analyzed' | 'job_fit' | 'job_signals' | 'everify_checked' | 'autofill' | 'job_tracked'
  | 'upsell_shown' | 'upsell_dismissed' | 'upsell_clicked';

/** Small, non-sensitive facts only: ok, error, fields_filled, fit_score, previous_version... */
export type ExtensionEventDetail = Record<string, string | number | boolean | null | undefined>;

export interface ExtensionEventOptions {
  /** 'LinkedIn', 'Greenhouse'... Worked out from the host when left out. */
  platform?: string | null;
  /** The page's hostname. Read from the request when left out. */
  host?: string | null;
  detail?: ExtensionEventDetail;
  /** Overrides x-extension-install, for /api/extension/uninstalled (a link, so no headers). */
  installId?: string | null;
  /** Overrides x-extension-version, same reason. */
  version?: string | null;
  /** Install row stamps: 'installed' sets installed_at, 'uninstalled' sets uninstalled_at. */
  stamp?: 'installed' | 'uninstalled';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION = /^\d{1,5}(\.\d{1,5}){0,3}$/;
const HOSTNAME = /^[a-z0-9.-]{1,253}$/;

export const cleanInstallId = (v: string | null | undefined): string | null =>
  v && UUID.test(v.trim()) ? v.trim().toLowerCase() : null;

export const cleanVersion = (v: string | null | undefined): string | null =>
  v && VERSION.test(v.trim()) ? v.trim() : null;

function cleanHost(v: string | null | undefined): string | null {
  const h = v?.trim().toLowerCase().replace(/^www\./, '') ?? '';
  return h && HOSTNAME.test(h) ? h : null;
}

/**
 * The page's hostname: the background worker's x-extension-host, else the
 * Origin of a content-script fetch (external-apply.js asks for the autofill
 * profile directly, so its Origin is the application portal). The
 * extension's own origin and our own domains are not a page the user was on.
 */
function hostFrom(req: NextRequest): string | null {
  const header = cleanHost(req.headers.get('x-extension-host'));
  if (header) return header;
  const origin = req.headers.get('origin');
  if (!origin || !/^https?:\/\//i.test(origin)) return null;
  try {
    const host = cleanHost(new URL(origin).hostname);
    return host && !/(^|\.)preciprocal\.com$|^localhost$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

// Same names as job_applications.source (the extension's PLATFORM_NAMES),
// so the two can be read side by side.
const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)greenhouse\.io$/, 'Greenhouse'],
  [/(^|\.)lever\.co$/, 'Lever'],
  [/(^|\.)(myworkdayjobs|myworkdaysite|workday)\.com$/, 'Workday'],
  [/(^|\.)indeed\.com$/, 'Indeed'],
  [/(^|\.)ashbyhq\.com$/, 'Ashby'],
  [/(^|\.)icims\.com$/, 'iCIMS'],
  [/(^|\.)jobvite\.com$/, 'Jobvite'],
  [/(^|\.)smartrecruiters\.com$/, 'SmartRecruiters'],
  [/(^|\.)taleo\.net$/, 'Taleo'],
  [/(^|\.)bamboohr\.com$/, 'BambooHR'],
  [/(^|\.)recruitee\.com$/, 'Recruitee'],
  [/(^|\.)(wellfound\.com|angel\.co)$/, 'Wellfound'],
  [/(^|\.)workable\.com$/, 'Workable'],
  [/(^|\.)breezy\.hr$/, 'Breezy'],
  [/(^|\.)teamtailor\.com$/, 'Teamtailor'],
  [/(^|\.)personio\.(de|com)$/, 'Personio'],
  [/(^|\.)rippling\.com$/, 'Rippling'],
  [/(^|\.)successfactors\.(com|eu)$/, 'SuccessFactors'],
  [/(^|\.)oraclecloud\.com$/, 'Oracle'],
];

export function platformFromHost(host: string | null): string | null {
  if (!host) return null;
  return PLATFORMS.find(([re]) => re.test(host))?.[1] ?? null;
}

const clamp = (v: string | null | undefined, max: number) => (v ? v.trim().slice(0, max) || null : null);

/** Scalars only, strings clamped, at most 12 keys: a detail is a fact, never a payload. */
function cleanDetail(detail: ExtensionEventDetail | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(detail ?? {}).slice(0, 12)) {
    if (value === undefined) continue;
    if (typeof value === 'string') out[key.slice(0, 40)] = value.slice(0, 120);
    else if (typeof value === 'number') { if (Number.isFinite(value)) out[key.slice(0, 40)] = value; }
    else out[key.slice(0, 40)] = value;
  }
  return out;
}

/** Postgres undefined_table, or PostgREST's schema-cache miss for a table. */
const isMissingTable = (err: { code?: string; message?: string }) =>
  err.code === '42P01' || err.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(err.message ?? '');

let warnedMissing = false;
function logFailure(what: string, err: { code?: string; message?: string }) {
  if (isMissingTable(err)) {
    if (!warnedMissing) console.warn('⚠️ extension telemetry: migration 0072 not applied, events are not being recorded');
    warnedMissing = true;
    return;
  }
  console.error(`⚠️ extension telemetry ${what} failed (non-fatal):`, err.message ?? err);
}

/**
 * Record one extension event. Returns at once: the headers are read now and
 * the two writes run after the response is sent. Never throws.
 */
export function recordExtensionEvent(
  req: NextRequest,
  userId: string | null,
  event: ExtensionEvent,
  opts: ExtensionEventOptions = {},
): void {
  try {
    const installId = opts.installId !== undefined ? cleanInstallId(opts.installId) : cleanInstallId(req.headers.get('x-extension-install'));
    const version = opts.version !== undefined ? cleanVersion(opts.version) : cleanVersion(req.headers.get('x-extension-version'));
    const host = opts.host !== undefined ? cleanHost(opts.host) : hostFrom(req);
    const platform = clamp(opts.platform, 40) ?? platformFromHost(host);
    const userAgent = req.headers.get('user-agent');
    const now = new Date().toISOString();

    const write = async () => {
      try {
        const { error } = await supabaseAdmin.from('extension_events').insert({
          install_id: installId,
          user_id: userId,
          event,
          version,
          platform,
          host,
          detail: cleanDetail(opts.detail),
        });
        if (error) logFailure('event insert', error);

        if (!installId) return;
        const device = describeDevice(userAgent);
        // Only the columns this request knows. A signed-out request must not
        // clear the user an earlier signed-in one attached to this install,
        // and installed_at / uninstalled_at are set by their own events only.
        const row: Record<string, string | null> = { install_id: installId, last_seen_at: now };
        if (userId) row.user_id = userId;
        if (version) row.version = version;
        if (device.browser) row.browser = device.browser;
        if (device.os) row.os = device.os;
        if (opts.stamp === 'installed') row.installed_at = now;
        if (opts.stamp === 'uninstalled') row.uninstalled_at = now;
        const { error: upErr } = await supabaseAdmin.from('extension_installs').upsert(row, { onConflict: 'install_id' });
        if (upErr) logFailure('install upsert', upErr);
      } catch (err) {
        console.error('⚠️ extension telemetry failed (non-fatal):', err);
      }
    };

    try {
      after(write);
    } catch {
      // Outside a request scope (a script, a test): just run it.
      void write();
    }
  } catch (err) {
    console.error('⚠️ extension telemetry failed (non-fatal):', err);
  }
}
