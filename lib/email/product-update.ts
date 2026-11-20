// lib/email/product-update.ts
//
// The occasional "what's new" email, sent once per campaign by
// app/api/cron/product-update. Gated by the productUpdates preference
// (lib/notifications/preferences.ts): on unless the user switched it off in
// Settings or through the link in one of these emails.
//
// One campaign at a time lives here. To send the next one, replace CAMPAIGN's
// id and copy; the id is the email_sends.email_type that stops a rerun from
// emailing anyone twice, so never reuse one.

import { Resend } from 'resend';
import { renderEmail, renderText } from '@/lib/email/layout';
import { SENDER_FROM, SENDER_REPLY_TO, senderSignature } from '@/lib/email/sender';
import { emailAppUrl } from '@/lib/email/app-url';
import { unsubscribeFooterHtml, unsubscribeFooterText, unsubscribeHeaders } from '@/lib/email/unsubscribe';
import { recordEmailSend } from '@/lib/email/track';

export const CAMPAIGN = {
  id: 'product_update_2026_11' as const,
  subject: 'New in Preciprocal: your fit on every LinkedIn job, and Easy Apply in one click',
  preheader: 'Skill match, E-Verify and H-1B right on LinkedIn, Easy Apply filled for you, and a tracker that only logs what you sent.',
  heading: 'See your fit on every LinkedIn job',
  paragraphs: [
    'Hi there,',
    'We have shipped a set of updates built around one goal: helping you spend your time on jobs that fit you and can hire you. Here is what is new.',
  ],
  rows: [
    { label: 'Your fit, right on LinkedIn', value: 'Open any job on LinkedIn and the Preciprocal extension shows which of the skills it names are on your resume and which are missing, the employer\'s E-Verify status and H-1B history from USCIS data, and any line about no sponsorship, citizens only or clearance.' },
    { label: 'Easy Apply, filled for you', value: 'Press Auto Apply on an Easy Apply job and the extension fills each step from your profile. You review it and press Submit on LinkedIn yourself.' },
    { label: 'A tracker that only logs what you sent', value: 'After you apply, the extension asks whether you submitted. Only a yes adds the job to your tracker as Applied, and Save keeps a job in Wishlist.' },
    { label: 'Set up once, apply faster', value: 'Tell us the roles you want, your work authorization and your resume once. New accounts do it on sign-up; everyone else can find it under Settings, Job setup.' },
    { label: 'Smoother applications', value: 'Approve all suggested resume changes in one click, reach recruiters and hiring managers with an editable drafted note, and see a cleaner tracker with no duplicate cards.' },
    { label: 'Unlimited tracking and journaling', value: 'Job tracking and your interview journal are now unlimited on every plan, including Free.' },
    { label: 'Share with friends', value: 'Group packs give up to four people their own full set of credits for less than four separate packs, and you can now send unused pack credits to a friend.' },
  ],
  // Older extension builds stored Save as Applied, and the server cannot tell
  // those apart from real applications, so users have to move them.
  check: { label: 'One thing to check', value: 'Before this update, pressing Save on a LinkedIn job in the extension added it to your tracker as Applied. If you used Save, move those jobs back to Wishlist.' },
  closing: 'As always, AI suggestions only reword what is already on your resume, and you review every answer before anything is submitted. Chrome updates the extension on its own, so there is nothing to install.',
};

export type ProductUpdateEmail = { subject: string; html: string; text: string };

export function buildProductUpdateEmail(unsubscribeUrl: string): ProductUpdateEmail {
  const url = emailAppUrl();
  const c = CAMPAIGN;
  const paragraphs = [...c.paragraphs];
  const signature = senderSignature('Questions or feedback? Just reply to this email. We read every message.');
  const footerNote = 'You are receiving this because you have a Preciprocal account. We send these only when something new ships.';
  const html = renderEmail({
    preheader: c.preheader,
    eyebrow: 'What is new',
    heading: c.heading,
    paragraphs,
    panel: { title: 'New this month', rows: [...c.rows, c.check] },
    closing: c.closing,
    cta: { label: 'Open Preciprocal', url },
    signature,
    footerNote,
    footerExtraHtml: unsubscribeFooterHtml(unsubscribeUrl, 'productUpdates'),
    campaign: c.id,
  });
  const text = renderText({
    heading: c.heading,
    paragraphs,
    panel: { title: 'New this month', lines: [...c.rows, c.check].map(r => `${r.label}: ${r.value}`) },
    closing: c.closing,
    cta: { label: 'Open Preciprocal', url },
    signature,
    footerNote: `${footerNote}\n${unsubscribeFooterText(unsubscribeUrl, 'productUpdates')}`,
    campaign: c.id,
  });
  return { subject: c.subject, html, text };
}

const resend = new Resend(process.env.RESEND_API_KEY);

/** True when Resend accepted it. Logs to email_sends so a rerun skips this user. */
export async function sendProductUpdateEmail(
  to: string,
  userId: string | null,
  email: ProductUpdateEmail,
  unsubscribeUrl: string,
  opts: { test?: boolean } = {},
): Promise<boolean> {
  const subject = opts.test ? `[Test] ${email.subject}` : email.subject;
  const { data, error } = await resend.emails.send({
    from: SENDER_FROM,
    to,
    replyTo: SENDER_REPLY_TO,
    subject,
    html: email.html,
    text: email.text,
    headers: unsubscribeHeaders(unsubscribeUrl),
  });
  if (error) {
    console.error('❌ product update not sent:', error.message);
    return false;
  }
  // A test is logged under its own type, so it never counts as the real send.
  await recordEmailSend({ resendId: data?.id, userId, emailType: opts.test ? `${CAMPAIGN.id}_test` : CAMPAIGN.id, subject });
  return true;
}
