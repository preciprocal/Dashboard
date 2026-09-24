// lib/email/new-device.ts
// Sent when a new login evicts the oldest session because the account hit its
// concurrent-session cap.
//
// Chrome comes from lib/email/layout.ts; this file only decides what it says.
// Written as a factual notice rather than a warning: the overwhelmingly common
// case is the account's real owner logging in somewhere new, and leading with
// an accusation would be wrong for almost everyone who receives it.
import { Resend } from 'resend';
import { SITE } from '@/lib/seo';
import { MAX_CONCURRENT_SESSIONS } from '@/lib/config/session-guard';
import { renderEmail, renderText, escapeHtml } from '@/lib/email/layout';

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_NAME = process.env.WELCOME_EMAIL_SENDER_NAME ?? 'Francesca';
const FROM = process.env.WELCOME_EMAIL_FROM ?? `${SENDER_NAME} from Preciprocal <francesca@preciprocal.com>`;
const REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO ?? 'francesca@preciprocal.com';

interface NewDeviceEmailParams {
  email: string;
  /** Coarse "City, Country" of the NEW login, or null if the edge gave none. */
  location: string | null;
  userAgent: string | null;
}

/** "Chrome on macOS"-ish, from a user agent. Best effort, never throws. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'a new device';

  const browser =
    /edg\//i.test(userAgent)          ? 'Edge'
    : /chrome|crios/i.test(userAgent) ? 'Chrome'
    : /firefox|fxios/i.test(userAgent) ? 'Firefox'
    : /safari/i.test(userAgent)       ? 'Safari'
    : null;

  const os =
    /windows/i.test(userAgent)            ? 'Windows'
    : /mac os|macintosh/i.test(userAgent) ? 'macOS'
    : /android/i.test(userAgent)          ? 'Android'
    : /iphone|ipad|ios/i.test(userAgent)  ? 'iOS'
    : /linux/i.test(userAgent)            ? 'Linux'
    : null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'a new device';
}

/**
 * Never throws. An email failure must not roll back the eviction that
 * triggered it: the session is already gone either way, and a thrown error
 * here would surface as a failed page load for the person signing in.
 */
export async function sendNewDeviceEmail({ email, location, userAgent }: NewDeviceEmailParams) {
  try {
    const device = describeDevice(userAgent);
    const where = location ?? 'an unrecognised location';

    const html = renderEmail({
      preheader: `New sign-in on ${device}`,
      eyebrow: 'Security notice',
      heading: 'A new device signed in',
      paragraphs: [
        `Your ${escapeHtml(SITE.name)} account was just signed in to on <span class="t-fg" style="color:#ffffff;">${escapeHtml(device)}</span>.`,
        `Preciprocal keeps you signed in on up to ${MAX_CONCURRENT_SESSIONS} devices at once, so your oldest session was signed out to make room. If that was you, there is nothing to do.`,
        'If it was not, change your password now and every other session will be signed out with it.',
      ],
      panel: {
        title: 'Sign-in details',
        rows: [
          { label: 'Device', value: escapeHtml(device) },
          { label: 'Location', value: escapeHtml(where) },
        ],
      },
      cta: { label: 'Review account settings', url: `${SITE.app}/settings` },
      signoff: `Reply to this email if anything looks wrong and I will take a look.<br />${escapeHtml(SENDER_NAME)}`,
      footerNote: 'You are receiving this because a new device signed in to your account. Security notices cannot be turned off.',
    });

    const text = renderText({
      heading: 'A new device signed in',
      paragraphs: [
        `Your ${SITE.name} account was just signed in to on ${device}${location ? ` from ${location}` : ''}.`,
        `Preciprocal keeps you signed in on up to ${MAX_CONCURRENT_SESSIONS} devices at once, so your oldest session was signed out to make room. If that was you, there is nothing to do.`,
        'If it was not, change your password now and every other session will be signed out with it.',
      ],
      panel: { title: 'Sign-in details', lines: [`Device: ${device}`, `Location: ${where}`] },
      cta: { label: 'Review account settings', url: `${SITE.app}/settings` },
      signoff: `Reply if anything looks wrong.\n${SENDER_NAME}`,
      footerNote: 'You are receiving this because a new device signed in to your account.',
    });

    await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: 'A new device signed in to your Preciprocal account',
      html,
      text,
    });
  } catch (err) {
    console.error('⚠️ Failed to send new-device email (non-fatal):', err);
  }
}
