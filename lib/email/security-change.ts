// lib/email/security-change.ts
// "Your password was changed" and "your email is being changed" notices.
// Sent to the address the account had before the change, so whoever owns the
// account hears about it even if someone else made the change. Security
// notices cannot be turned off.

import { Resend } from 'resend';
import { SITE } from '@/lib/seo';
import { renderEmail, renderText, escapeHtml } from '@/lib/email/layout';
import { recordEmailSend } from '@/lib/email/track';
import { SENDER_FROM as FROM, SENDER_REPLY_TO as REPLY_TO, senderSignature } from '@/lib/email/sender';

const resend = new Resend(process.env.RESEND_API_KEY);
const NOTE = 'If this was you, there is nothing to do. If not, reply to this email straight away and we will lock the account.';

export async function sendSecurityChangeEmail(a: {
  userId: string;
  /** The address before the change. */
  email: string;
  kind: 'password' | 'email';
  /** For an email change: the address it is changing to. */
  newEmail?: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const when = new Date().toUTCString();
    const password = a.kind === 'password';
    const heading = password ? 'Your password was changed' : 'Your email address is being changed';
    const lines = password
      ? [`The password for your ${SITE.name} account was just changed.`]
      : [`Someone asked to change the email address on your ${SITE.name} account to ${a.newEmail ?? 'a new address'}. The change finishes when the link sent to that address is clicked.`];
    const rows = [
      { label: 'What changed', value: password ? 'Password' : `Email address, to ${a.newEmail ?? 'a new address'}` },
      { label: 'When', value: when },
    ];

    const html = renderEmail({
      campaign: password ? 'security_password_changed' : 'security_email_change',
      preheader: heading,
      eyebrow: 'Security notice',
      heading,
      paragraphs: [...lines.map(escapeHtml), 'If you did not make this change, your account may be at risk. Change your password now and remove any devices you do not recognise.'],
      panel: { title: 'Details', rows: rows.map(r => ({ label: r.label, value: escapeHtml(r.value) })) },
      cta: { label: 'Review my security settings', url: `${SITE.app}/settings?section=security` },
      signature: senderSignature(NOTE),
      footerNote: 'You are receiving this because a security setting on your account changed. Security notices cannot be turned off.',
    });
    const text = renderText({
      campaign: password ? 'security_password_changed' : 'security_email_change',
      heading,
      paragraphs: [...lines, 'If you did not make this change, change your password now and remove any devices you do not recognise.'],
      panel: { title: 'Details', lines: rows.map(r => `${r.label}: ${r.value}`) },
      cta: { label: 'Review my security settings', url: `${SITE.app}/settings?section=security` },
      signature: senderSignature(NOTE),
    });

    const subject = password ? 'Your Preciprocal password was changed' : 'Your Preciprocal email address is being changed';
    const { data: sent, error } = await resend.emails.send({ from: FROM, to: a.email, replyTo: REPLY_TO, subject, html, text });
    if (error) throw error;
    await recordEmailSend({ resendId: sent?.id, userId: a.userId, emailType: password ? 'security_password_changed' : 'security_email_change', subject });
  } catch (err) {
    console.error('⚠️ security change email failed (non-fatal):', err);
  }
}
