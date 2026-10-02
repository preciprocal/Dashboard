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
import { describeDevice as describeUserAgent } from '@/lib/session/describe-device';
import { recordEmailSend } from '@/lib/email/track';
import { SENDER_FROM as FROM, SENDER_REPLY_TO as REPLY_TO, senderSignature } from '@/lib/email/sender';

const resend = new Resend(process.env.RESEND_API_KEY);

const SIGN_NOTE = 'Reply to this email if anything looks wrong and I will take a look.';

interface NewDeviceEmailParams {
  userId: string;
  email: string;
  /** Coarse "City, Country" of the NEW login, or null if the edge gave none. */
  location: string | null;
  userAgent: string | null;
}

/**
 * Never throws. An email failure must not roll back the eviction that
 * triggered it: the session is already gone either way, and a thrown error
 * here would surface as a failed page load for the person signing in.
 */
export async function sendNewDeviceEmail({ userId, email, location, userAgent }: NewDeviceEmailParams) {
  try {
    const parsed = describeUserAgent(userAgent);
    const device = parsed.label === 'Unknown device' ? 'a new device' : parsed.label;
    const where = location ?? 'an unrecognised location';

    const html = renderEmail({
      campaign: 'new_device',
      preheader: `New sign-in on ${device}`,
      eyebrow: 'Security notice',
      heading: 'A new device signed in',
      paragraphs: [
        `Your ${escapeHtml(SITE.name)} account was just signed in to on <span class="t-fg" style="color:#ffffff;">${escapeHtml(device)}</span>.`,
        `Preciprocal keeps you signed in on up to ${MAX_CONCURRENT_SESSIONS} devices at once, so your oldest session was signed out to make room. If that was you, there is nothing to do.`,
        'If it was not, remove it under Devices in your settings, which ends its access straight away, then change your password.',
      ],
      panel: {
        title: 'Sign-in details',
        rows: [
          { label: 'Device', value: escapeHtml(device) },
          { label: 'Location', value: escapeHtml(where) },
        ],
      },
      cta: { label: 'Review my devices', url: `${SITE.app}/settings?section=devices` },
      signature: senderSignature(SIGN_NOTE),
      footerNote: 'You are receiving this because a new device signed in to your account. Security notices cannot be turned off.',
    });

    const text = renderText({
      campaign: 'new_device',
      heading: 'A new device signed in',
      paragraphs: [
        `Your ${SITE.name} account was just signed in to on ${device}${location ? ` from ${location}` : ''}.`,
        `Preciprocal keeps you signed in on up to ${MAX_CONCURRENT_SESSIONS} devices at once, so your oldest session was signed out to make room. If that was you, there is nothing to do.`,
        'If it was not, remove it under Devices in your settings, which ends its access straight away, then change your password.',
      ],
      panel: { title: 'Sign-in details', lines: [`Device: ${device}`, `Location: ${where}`] },
      cta: { label: 'Review my devices', url: `${SITE.app}/settings?section=devices` },
      signature: senderSignature(SIGN_NOTE),
      footerNote: 'You are receiving this because a new device signed in to your account.',
    });

    const subject = 'A new device signed in to your Preciprocal account';
    const { data: sent, error } = await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject,
      html,
      text,
    });
    // Resend reports failure in the return value, not by throwing.
    if (error) throw error;
    await recordEmailSend({ resendId: sent?.id, userId, emailType: 'new_device', subject });
  } catch (err) {
    console.error('⚠️ Failed to send new-device email (non-fatal):', err);
  }
}
