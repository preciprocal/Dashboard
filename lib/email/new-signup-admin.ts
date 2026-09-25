// lib/email/new-signup-admin.ts
// Internal heads-up when an account is created.
//
// Goes to the operator, not the user. Deliberately the same shell as every
// other email so a forwarded copy still looks like it came from the product,
// but the content is operational rather than marketing.
//
// ─── This will not scale, and that is fine for now ──────────────────────────
// One email per signup is exactly right at a few a week and unbearable at a
// few hundred a day. When it becomes noise, the fix is to fold it into the
// weekly digest cron as a daily or weekly roll-up rather than to delete it -
// knowing who signed up is genuinely useful early on. NOTIFY_ADMIN_ON_SIGNUP
// turns it off without a deploy in the meantime.
import { Resend } from 'resend';
import { SITE } from '@/lib/seo';
import { renderEmail, renderText, escapeHtml } from '@/lib/email/layout';

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@preciprocal.com';

// Same sender identity as every other email. It previously came from
// `Preciprocal <noreply@...>`, which renders as a different sender in the
// inbox row and makes an otherwise identical email look like it is from
// somewhere else before it is even opened.
const SENDER_NAME = process.env.WELCOME_EMAIL_SENDER_NAME ?? 'Francesca';
const FROM = process.env.ADMIN_ALERT_FROM
  ?? process.env.WELCOME_EMAIL_FROM
  ?? `${SENDER_NAME} from Preciprocal <francesca@preciprocal.com>`;

/** Set to "false" to silence these without a deploy. Any other value keeps them on. */
const ENABLED = process.env.NOTIFY_ADMIN_ON_SIGNUP !== 'false';

export interface NewSignupAlert {
  userId: string;
  email: string;
  name?: string | null;
  /** "email", "google", and so on. */
  provider: string;
  signupIp?: string | null;
  /** Whether a device fingerprint was captured. The value itself is not sent. */
  hasFingerprint?: boolean;
}

/**
 * Never throws, and never blocks the caller.
 *
 * An operator notification must not be able to fail a signup the user has
 * already completed - the account exists either way, and an exception here
 * would surface to them as a failed registration.
 */
export async function sendNewSignupAlert(alert: NewSignupAlert): Promise<void> {
  if (!ENABLED) return;
  if (!process.env.RESEND_API_KEY) return;

  try {
    const when = new Date().toUTCString();
    const displayName = alert.name?.trim() || 'Not provided';

    const rows = [
      { label: 'Name', value: escapeHtml(displayName) },
      { label: 'Email', value: escapeHtml(alert.email) },
      { label: 'Signed up with', value: escapeHtml(alert.provider) },
      { label: 'When', value: escapeHtml(when) },
      // Useful precisely because the signup guard keys on it: two accounts
      // from one address in a week is the first thing worth looking at.
      { label: 'IP', value: escapeHtml(alert.signupIp ?? 'Unknown') },
      {
        // The fingerprint itself is deliberately not included. It is an
        // anti-abuse identifier, and scattering it through an inbox is how it
        // ends up somewhere it should not be. Whether one was captured is the
        // only part that is operationally interesting.
        label: 'Device fingerprint',
        value: alert.hasFingerprint ? 'Captured' : 'Not captured',
      },
      { label: 'User ID', value: escapeHtml(alert.userId) },
    ];

    const html = renderEmail({
      preheader: `${displayName} just signed up`,
      eyebrow: 'New signup',
      heading: 'Someone just created an account',
      paragraphs: [
        `<span class="t-fg" style="color:#ffffff;">${escapeHtml(displayName)}</span> signed up with ${escapeHtml(alert.provider)}.`,
      ],
      panel: { title: 'Account details', rows },
      cta: { label: 'Open the review queue', url: `${SITE.app}/admin/review` },
      // The same signature treatment as every other email rather than a bare
      // one-line signoff, which was the only structural difference between
      // this and the rest and the reason it read as off-brand.
      //
      // The address shown is the NEW USER's, not a support inbox: on an alert
      // about a person, the useful contact is that person, and it matches the
      // replyTo below so the block and the reply button agree.
      signature: {
        name: displayName,
        title: `New ${alert.provider} signup`,
        email: alert.email,
      },
      footerNote:
        'You are receiving this because you are the operator on this Preciprocal deployment. ' +
        'Set NOTIFY_ADMIN_ON_SIGNUP=false to stop these.',
    });

    const text = renderText({
      heading: 'Someone just created an account',
      paragraphs: [`${displayName} signed up with ${alert.provider}.`],
      panel: {
        title: 'Account details',
        lines: [
          `Name: ${displayName}`,
          `Email: ${alert.email}`,
          `Signed up with: ${alert.provider}`,
          `When: ${when}`,
          `IP: ${alert.signupIp ?? 'Unknown'}`,
          `Device fingerprint: ${alert.hasFingerprint ? 'Captured' : 'Not captured'}`,
          `User ID: ${alert.userId}`,
        ],
      },
      cta: { label: 'Open the review queue', url: `${SITE.app}/admin/review` },
      // The same signature treatment as every other email rather than a bare
      // one-line signoff, which was the only structural difference between
      // this and the rest and the reason it read as off-brand.
      //
      // The address shown is the NEW USER's, not a support inbox: on an alert
      // about a person, the useful contact is that person, and it matches the
      // replyTo below so the block and the reply button agree.
      signature: {
        name: displayName,
        title: `New ${alert.provider} signup`,
        email: alert.email,
      },
      footerNote: 'Set NOTIFY_ADMIN_ON_SIGNUP=false to stop these.',
    });

    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      // Replying to an alert should reach the person it is about, which is
      // almost always what you actually want to do next.
      replyTo: alert.email,
      subject: `New signup: ${displayName} (${alert.email})`,
      html,
      text,
    });

    console.log(`📨 Admin notified of signup: ${alert.email}`);
  } catch (err) {
    console.error('⚠️ Could not send new-signup alert (non-fatal):', err);
  }
}
