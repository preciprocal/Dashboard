// lib/email/unsubscribe-alert.ts
// What happens after someone unsubscribes, beyond the opt-out itself
// (lib/email/unsubscribe.ts): a row in email_unsubscribes for the ERP, and an
// alert email to ADMIN_EMAIL so the team knows as it happens.
//
// Set NOTIFY_ADMIN_ON_UNSUBSCRIBE=false to stop the alert emails; the record
// is always kept. Never throws: the person has already been unsubscribed, and
// nothing here may undo that or show them an error.

import { Resend } from 'resend';
import { supabaseAdmin } from '@/supabase/admin';
import { renderEmail, renderText, escapeHtml } from '@/lib/email/layout';
import { SENDER_FROM } from '@/lib/email/sender';
import { SCOPE_COPY, type UnsubscribeScope } from '@/lib/email/unsubscribe';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@preciprocal.com';
const FROM = process.env.ADMIN_ALERT_FROM ?? SENDER_FROM;
const ENABLED = process.env.NOTIFY_ADMIN_ON_UNSUBSCRIBE !== 'false';
const ERP_URL = 'https://erp.preciprocal.com';

const SCOPE_NAME: Record<UnsubscribeScope, string> = {
  weeklyDigest: 'Weekly summaries',
  supportReplies: 'Emailed support replies',
  activation: 'Next-step suggestions',
  coaching: 'Application coaching',
  all: 'All optional emails',
};

/** "erp_check_in" -> "ERP: check in", "weekly_digest" -> "weekly digest". */
const emailTypeName = (t: string) => (t.startsWith('erp_') ? `ERP: ${t.slice(4)}` : t).replace(/[_-]/g, ' ');

export type UnsubscribeMethod = 'link' | 'one_click' | 'settings' | 'spam_complaint';

const HOW: Record<UnsubscribeMethod, string> = {
  link: 'the link in an email',
  one_click: "their email app's unsubscribe button",
  settings: 'a toggle in their Settings',
  spam_complaint: 'marking our email as spam (all optional emails are now off for them)',
};

export async function recordUnsubscribe(userId: string, scope: UnsubscribeScope, method: UnsubscribeMethod): Promise<void> {
  try {
    const [{ data: profile }, { data: last }] = await Promise.all([
      supabaseAdmin.from('profiles').select('name,email').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('email_sends').select('email_type,subject,sent_at').eq('user_id', userId)
        .lte('sent_at', new Date().toISOString()).order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    const { error } = await supabaseAdmin.from('email_unsubscribes').insert({
      user_id: userId, scope, method, last_email_type: last?.email_type ?? null,
    });
    // Missing table (migration 0050 not applied yet) is logged, not fatal.
    if (error) console.error('⚠️ email_unsubscribes insert failed:', error.message);

    if (!ENABLED || !process.env.RESEND_API_KEY) return;

    const name = profile?.name?.trim() || 'Someone';
    const email = profile?.email ?? 'unknown address';
    const what = SCOPE_NAME[scope];
    const how = HOW[method];
    const lastLine = last
      ? `${emailTypeName(String(last.email_type))}${last.subject ? `, "${last.subject}"` : ''}`
      : 'None on record';

    const rows = [
      { label: 'Person', value: `${escapeHtml(name)}<br />${escapeHtml(email)}` },
      { label: 'Turned off', value: escapeHtml(what) },
      { label: 'How', value: escapeHtml(how) },
      { label: 'Last email they got', value: escapeHtml(lastLine) },
      { label: 'When', value: escapeHtml(new Date().toUTCString()) },
    ];

    const heading = `${name} unsubscribed`;
    const html = renderEmail({
      preheader: `${what} turned off by ${email}`,
      eyebrow: 'Unsubscribe',
      heading,
      paragraphs: [
        `${escapeHtml(name)} turned off <span class="t-fg" style="color:#ffffff;">${escapeHtml(what.toLowerCase())}</span>. ${escapeHtml(SCOPE_COPY[scope].done)}`,
      ],
      panel: { title: 'Details', rows },
      cta: { label: 'Open the ERP', url: ERP_URL },
      signature: { name: 'Preciprocal', title: 'Operator alert' },
      footerNote: 'You are receiving this because you are the operator on this Preciprocal deployment. Set NOTIFY_ADMIN_ON_UNSUBSCRIBE=false to stop these.',
    });
    const text = renderText({
      heading,
      paragraphs: [`${name} turned off ${what.toLowerCase()}.`],
      panel: { title: 'Details', lines: [`Person: ${name} <${email}>`, `Turned off: ${what}`, `How: ${how}`, `Last email they got: ${lastLine}`] },
      cta: { label: 'Open the ERP', url: ERP_URL },
      signoff: 'Preciprocal',
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to: ADMIN_EMAIL, subject: `Unsubscribed: ${email} (${what})`, html, text });
  } catch (err) {
    console.error('⚠️ recordUnsubscribe failed:', err);
  }
}
