// lib/attribution.ts
// Where a visitor came from, kept in this browser until they have an account.
//
// Two ways in:
//   1. From preciprocal.com. The marketing site tags every app link with its
//      analytics session (pr_sid) and, with consent, visitor id (pr_vid). That
//      session row already knows the source, channel, UTM tags and entry page,
//      so the ids are all we need.
//   2. Straight to the app: a shared link, an ad, a search result. Then the
//      referrer and any utm_* / click-id params are the only record.
//
// First touch wins: once something is stored it is only replaced when the
// stored arrival had no signal at all ("direct") and a later one does. The
// record is sent once after sign-up (AttributionReporter) and then removed.

export const ATTRIBUTION_KEY = "pp_signup_attribution";

export interface Attribution {
  sid?: string;
  vid?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  click_id?: string;
  landing?: string;
  at?: string;
  direct?: boolean;
}

const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const CLICK_IDS = ["gclid", "gbraid", "wbraid", "msclkid", "fbclid", "li_fat_id", "ttclid"];
const UUID = /^[0-9a-f-]{36}$/i;

// Hosts a sign-in or payment round-trip comes back from. Returning from Google
// sign-in must not record the visitor as "came from Google".
const NOT_A_SOURCE = /(^|\.)preciprocal\.com$|(^|\.)supabase\.co$|^accounts\.google\.|^accounts\.youtube\.|^login\.microsoftonline\.com$|^login\.live\.com$|^appleid\.apple\.com$|^(checkout|billing|hooks)\.stripe\.com$|^github\.com$|^localhost$/;

const clip = (v: string | null | undefined, n = 200) => (v ? v.trim().slice(0, n) || undefined : undefined);

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/** What this page load says about where the visitor came from. */
function fromThisVisit(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const a: Attribution = { landing: clip(window.location.pathname, 120), at: new Date().toISOString() };

  const sid = params.get("pr_sid"), vid = params.get("pr_vid");
  if (sid && UUID.test(sid)) a.sid = sid;
  if (vid && UUID.test(vid)) a.vid = vid;

  for (const k of UTM) { const v = clip(params.get(k), 120); if (v) a[k] = v; }
  const click = CLICK_IDS.find(k => params.has(k));
  if (click) a.click_id = click;

  // Host and path only: a referrer's query string can carry search terms or
  // tokens that are none of our business.
  if (!a.sid && document.referrer) {
    try {
      const r = new URL(document.referrer);
      const host = r.hostname.replace(/^www\./, "");
      if (!NOT_A_SOURCE.test(host)) a.referrer = clip(`${r.protocol}//${r.hostname}${r.pathname}`, 300);
    } catch { /* not a URL */ }
  }

  if (!a.sid && !a.referrer && !a.click_id && !UTM.some(k => a[k])) a.direct = true;
  return a;
}

/** Records this arrival unless an earlier one with a real source is already kept. */
export function captureAttribution(): void {
  try {
    const now = fromThisVisit();
    const kept = read();
    if (kept && !(kept.direct && !now.direct)) return;
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(now));
  } catch {
    /* storage blocked: attribution is best-effort */
  }
}

export function takeAttribution(): Attribution | null {
  return read();
}

export function clearAttribution(): void {
  try { localStorage.removeItem(ATTRIBUTION_KEY); } catch { /* ignore */ }
}
