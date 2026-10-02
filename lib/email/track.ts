// lib/email/track.ts
// Logs each email we send to email_sends (migration 0046), keyed by Resend's
// message id, so the delivery, open and click events Resend reports later
// (app/api/webhooks/resend) can be tied back to a user and an email type.
//
// email_type doubles as the utm_campaign on the email's links (see
// lib/email/layout.ts), which is how in-app activity after a click is
// attributed to the email that caused it. Keep the two identical.

import { supabaseAdmin } from '@/supabase/admin';

export type EmailType =
  | 'welcome'
  | 'weekly_digest'
  | 'new_device'
  | 'support_reply'
  | 'ticket_received'
  | 'data_export'
  | 'student_verification'
  | `activation_${string}`
  | `coaching_${string}`;

/**
 * Best effort and never throws: the email has already gone, and losing its
 * analytics row must never turn a successful send into a reported failure.
 */
export async function recordEmailSend(args: {
  resendId: string | undefined | null;
  userId: string | null;
  emailType: EmailType;
  subject: string;
}): Promise<void> {
  if (!args.resendId) return;
  try {
    const { error } = await supabaseAdmin.from('email_sends').insert({
      resend_id: args.resendId,
      user_id: args.userId,
      email_type: args.emailType,
      subject: args.subject.slice(0, 200),
    });
    if (error) console.error('⚠️ email send not logged:', error.message);
  } catch (err) {
    console.error('⚠️ email send not logged:', err);
  }
}
