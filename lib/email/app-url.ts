// lib/email/app-url.ts
//
// Origins for links that go inside an email.
//
// NEXT_PUBLIC_APP_URL is http://localhost:3000 in local dev, and a localhost
// link in a real inbox is dead on arrival - it resolves to the recipient's own
// machine. Every email sender needs the same guard, and four of the five did
// not have it:
//
//   lib/email/welcome.ts                    guarded
//   app/api/cron/weekly-digest/route.ts     `?? 'https://app.preciprocal.com'`
//   app/api/firebase/emails/route.ts        `?? 'https://preciprocal.com'`
//   app/api/firebase/emails/reply/route.ts  `?? 'https://preciprocal.com'`
//
// `??` only fires when the variable is UNSET. It cannot help when the variable
// is set to something that is simply wrong for an email, which is exactly the
// local-dev case - so those three shipped localhost links whenever mail was
// sent from a dev run, and pointed at the marketing domain for app routes even
// when they worked.

import { SITE } from "@/lib/seo";

function externallyReachable(value: string | undefined): value is string {
  if (!value) return false;
  return !value.includes("localhost") && !value.includes("127.0.0.1");
}

/**
 * Origin for links to the signed-in product: /help, /interview, /settings.
 *
 * Falls back to the canonical app origin rather than the marketing site,
 * because `https://preciprocal.com/help?section=tickets` is not a page.
 */
export function emailAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  return externallyReachable(configured) ? configured.replace(/\/$/, "") : SITE.app;
}

/**
 * Origin for public pages: terms, privacy, pricing.
 *
 * These live on the marketing site and have no route in this app - /terms and
 * /privacy both 404 here - so they are never derived from NEXT_PUBLIC_APP_URL.
 */
export const EMAIL_MARKETING_URL = SITE.marketing;
