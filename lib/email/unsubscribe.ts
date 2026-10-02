// lib/email/unsubscribe.ts
//
// Unsubscribe links for every email a user can opt out of, and the writes that
// honour them.
//
// ─── What can be unsubscribed from ──────────────────────────────────────────
// Scopes map onto the preferences in lib/notifications/preferences.ts, which
// is the authority on what is optional:
//
//   weeklyDigest    the Monday summary
//   supportReplies  the email copy of a staff reply (the in-app notification
//                   is still written, so nothing is lost)
//   activation      the Monday next-step emails after signup
//   coaching        the emails about each stage of a tracked application
//   all             every optional email at once, plus product updates
//
// Security notices, verification codes, data exports and billing receipts are
// deliberately NOT unsubscribable and never carry a link. See the note at the
// top of preferences.ts for why.
//
// ─── Why the links are signed ───────────────────────────────────────────────
// Unsubscribing never asks for a login - that is the pattern that sends people
// to "report spam" instead. The HMAC over scope and user id is what stops the
// link being edited to unsubscribe somebody else, or widened from one scope to
// "all". The scope is inside the signed message for exactly that reason.
//
// The secret is CRON_SECRET, which the digest links already used. Rotating it
// invalidates every unsubscribe link already sitting in an inbox, so the
// confirmation page always offers Settings as the fallback.

import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { emailAppUrl } from '@/lib/email/app-url';

export type UnsubscribeScope = 'weeklyDigest' | 'supportReplies' | 'activation' | 'coaching' | 'all';

export const UNSUBSCRIBE_SCOPES: readonly UnsubscribeScope[] = ['weeklyDigest', 'supportReplies', 'activation', 'coaching', 'all'];

export function isUnsubscribeScope(value: string | null): value is UnsubscribeScope {
  return value !== null && (UNSUBSCRIBE_SCOPES as readonly string[]).includes(value);
}

/** Link text, and what the confirmation page says was switched off. */
export const SCOPE_COPY: Record<UnsubscribeScope, { link: string; done: string }> = {
  weeklyDigest: {
    link: 'Turn off weekly summaries',
    done: "You won't get weekly summaries any more.",
  },
  supportReplies: {
    link: 'Stop emailing me support replies',
    done: "Support replies won't be emailed to you any more. They will still appear under notifications in the app.",
  },
  activation: {
    link: 'Stop next-step suggestions',
    done: "You won't get any more next-step suggestions.",
  },
  coaching: {
    link: 'Stop application coaching emails',
    done: "You won't get coaching emails when your applications change stage any more. Your tracker works exactly as before.",
  },
  all: {
    link: 'Unsubscribe from all optional emails',
    done: "You won't get weekly summaries, next-step suggestions, application coaching, product updates or emailed support replies any more. Support replies still appear in the app, and security and account emails, such as new sign-in alerts, will still reach you.",
  },
};

function secret(): string | null {
  return process.env.CRON_SECRET || null;
}

function sign(userId: string, scope: UnsubscribeScope, key: string): string {
  return createHmac('sha256', key).update(`unsubscribe:${scope}:${userId}`).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, scope: UnsubscribeScope, token: string): boolean {
  const key = secret();
  if (!key) return false;
  const a = Buffer.from(sign(userId, scope, key));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Signed one-click link for this user and scope.
 *
 * Falls back to the Settings page when no secret is configured, so an email
 * never goes out without SOME way to opt out. That fallback needs a login and
 * cannot back the List-Unsubscribe header, which is why `unsubscribeHeaders`
 * returns nothing for it.
 */
export function unsubscribeUrl(userId: string, scope: UnsubscribeScope): string {
  const key = secret();
  if (!key) return `${emailAppUrl()}/settings?section=notifications`;
  const params = new URLSearchParams({ u: userId, s: scope, t: sign(userId, scope, key) });
  return `${emailAppUrl()}/api/email/unsubscribe?${params}`;
}

/**
 * Gmail and Outlook's native unsubscribe button (RFC 8058). Without it,
 * recipients use "report spam" as the unsubscribe button, which damages
 * deliverability for every email we send. Gmail and Yahoo also require it
 * from bulk senders.
 */
export function unsubscribeHeaders(url: string): Record<string, string> {
  if (!url.includes('/api/email/unsubscribe') && !url.includes('/api/digest/unsubscribe')) return {};
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

/** Footer link markup for renderEmail's footerExtraHtml. */
export function unsubscribeFooterHtml(url: string, scope: UnsubscribeScope): string {
  return `<div style="margin:10px 0 0 0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;"><a href="${url}" class="t-dim" style="color:#64748b;text-decoration:underline;">${SCOPE_COPY[scope].link}</a></div>`;
}

/** Plain-text equivalent, for renderText's footerNote. */
export function unsubscribeFooterText(url: string, scope: UnsubscribeScope): string {
  return `${SCOPE_COPY[scope].link}: ${url}`;
}

// ─── The writes ─────────────────────────────────────────────────────────────

async function optOutOfDigest(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ weekly_digest_opt_out: true })
    .eq('user_id', userId);
  if (error) console.error('❌ unsubscribe (weeklyDigest) failed:', error.message);
  return !error;
}

async function optOutOfActivation(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ activation_email_opt_out: true })
    .eq('user_id', userId);
  if (error) console.error('❌ unsubscribe (activation) failed:', error.message);
  return !error;
}

async function optOutOfCoaching(userId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ application_email_opt_out: true })
    .eq('user_id', userId);
  if (error) console.error('❌ unsubscribe (coaching) failed:', error.message);
  return !error;
}

/**
 * Read-modify-write of the settings blob, because supportReplies lives inside
 * it. A missing row is fine: GET /api/settings fills any absent section from
 * its defaults.
 */
async function optOutOfSupportReplies(userId: string): Promise<boolean> {
  const { data, error: readErr } = await supabaseAdmin
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle();
  if (readErr) {
    console.error('❌ unsubscribe (supportReplies) read failed:', readErr.message);
    return false;
  }

  const settings = (data?.settings as Record<string, unknown> | null) ?? {};
  const notifications = (settings.notifications as Record<string, unknown> | undefined) ?? {};

  const { error } = await supabaseAdmin
    .from('user_settings')
    .upsert({
      user_id: userId,
      settings: { ...settings, notifications: { ...notifications, supportReplies: false } },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) console.error('❌ unsubscribe (supportReplies) failed:', error.message);
  return !error;
}

/** Only flips an existing row. Not being on the list already means "no". */
async function optOutOfProductUpdates(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('email').eq('user_id', userId).maybeSingle();
  if (!profile?.email) return true;

  const { error } = await supabaseAdmin
    .from('newsletter_subscribers')
    .update({ subscribed: false })
    .eq('email', String(profile.email).toLowerCase().trim());
  if (error) console.error('❌ unsubscribe (productUpdates) failed:', error.message);
  return !error;
}

/** Applies the opt-out. True only when every write for the scope landed. */
export async function applyUnsubscribe(userId: string, scope: UnsubscribeScope): Promise<boolean> {
  let results: boolean[];
  if (scope === 'weeklyDigest') results = [await optOutOfDigest(userId)];
  else if (scope === 'supportReplies') results = [await optOutOfSupportReplies(userId)];
  else if (scope === 'activation') results = [await optOutOfActivation(userId)];
  else if (scope === 'coaching') results = [await optOutOfCoaching(userId)];
  else {
    results = await Promise.all([
      optOutOfDigest(userId),
      optOutOfSupportReplies(userId),
      optOutOfActivation(userId),
      optOutOfCoaching(userId),
      optOutOfProductUpdates(userId),
    ]);
  }

  const ok = results.every(Boolean);
  if (ok) console.log(`📭 Unsubscribed (${scope}): ${userId}`);
  return ok;
}

// ─── The page ───────────────────────────────────────────────────────────────

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type UnsubscribePageState = 'confirm' | 'done' | 'invalid' | 'failed';

/**
 * Standalone HTML, because this is reached from an inbox by someone who may
 * not be signed in, and should not have to load the app shell to opt out.
 *
 * `confirm` posts back to the same URL. That extra click is what stops a
 * corporate link scanner, which prefetches every URL in an email with a GET,
 * from unsubscribing people who never asked to be.
 */
export function renderUnsubscribePage(state: UnsubscribePageState, scope: UnsubscribeScope, actionUrl = ''): string {
  const title = {
    confirm: 'Unsubscribe?',
    done: 'Unsubscribed',
    invalid: "That link didn't work",
    failed: 'Something went wrong',
  }[state];

  const body = {
    confirm: `${escape(SCOPE_COPY[scope].link)}. You can turn anything back on in Settings whenever you like.`,
    done: `${escape(SCOPE_COPY[scope].done)} Everything else about your account is unchanged, and you can turn these back on in Settings.`,
    invalid: 'The link may have expired or been altered. You can turn emails off in Settings, or reply to any of our emails and we will do it for you.',
    failed: 'We could not save that just now. Please try again in a minute, turn emails off in Settings, or reply to any of our emails and we will do it for you.',
  }[state];

  const button = 'display:inline-block;border:0;cursor:pointer;background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:600;font-size:14px;font-family:inherit;';
  const secondary = 'display:inline-block;color:#94a3b8;text-decoration:underline;font-size:13px;margin-top:14px;';

  const actions = state === 'confirm'
    ? `<form method="post" action="${escape(actionUrl)}" style="margin:0;">
         <input type="hidden" name="confirm" value="1" />
         <button type="submit" style="${button}">Yes, unsubscribe me</button>
       </form>
       <a href="/settings?section=notifications" style="${secondary}">Manage all email settings</a>`
    : `<a href="/settings?section=notifications" style="${button}">Open settings</a>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Preciprocal</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0c12;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;">
  <div style="max-width:420px;text-align:center;">
    <h1 style="font-size:18px;margin:0 0 10px;color:#fff;">${title}</h1>
    <p style="font-size:14px;line-height:1.6;color:#94a3b8;margin:0 0 20px;">${body}</p>
    ${actions}
  </div>
</body></html>`;
}
