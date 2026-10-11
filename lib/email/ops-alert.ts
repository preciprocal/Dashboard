// lib/email/ops-alert.ts
// One alert email to the team (ADMIN_EMAIL) for things that happen to a
// customer's account without anyone on the team seeing them: refunds,
// cancellations, failed payments, auto pay switched off. Same branded shell as
// every other email, with the details in a panel.
//
// Set NOTIFY_ADMIN_ON_BILLING=false to stop them. Never throws: the event has
// already happened, and an alert must not fail the request that caused it.

import { Resend } from 'resend';
import { supabaseAdmin } from '@/supabase/admin';
import { renderEmail, renderText, escapeHtml } from '@/lib/email/layout';
import { SENDER_FROM } from '@/lib/email/sender';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@preciprocal.com';
const FROM = process.env.ADMIN_ALERT_FROM ?? SENDER_FROM;
const ENABLED = process.env.NOTIFY_ADMIN_ON_BILLING !== 'false';
const ERP_URL = 'https://erp.preciprocal.com';

export interface OpsAlert {
  /** Short, e.g. "Refund issued". Also the email's eyebrow. */
  kind: string;
  /** The account it is about, looked up for name and email. */
  supabaseUserId?: string | null;
  /** Used when there is no user id, e.g. a Stripe customer we cannot map. */
  fallbackEmail?: string | null;
  /** One sentence: what happened. Plain text. */
  summary: string;
  details?: [string, string][];
  /** Marks it as needing someone to act, in the subject and the heading. */
  actionNeeded?: boolean;
}

export async function sendOpsAlert(a: OpsAlert): Promise<void> {
  if (!ENABLED || !process.env.RESEND_API_KEY) return;
  try {
    const { data: profile } = a.supabaseUserId
      ? await supabaseAdmin.from('profiles').select('name,email').eq('user_id', a.supabaseUserId).maybeSingle()
      : { data: null };
    const name = profile?.name?.trim() || null;
    const email = profile?.email ?? a.fallbackEmail ?? 'unknown address';
    const who = name ? `${name} (${email})` : email;

    const rows: [string, string][] = [
      ['Account', who],
      ...(a.details ?? []),
      ['When', new Date().toUTCString()],
      ...(a.supabaseUserId ? [['User ID', a.supabaseUserId] as [string, string]] : []),
    ];
    const heading = `${a.actionNeeded ? 'Action needed: ' : ''}${a.kind}`;

    const html = renderEmail({
      preheader: a.summary,
      eyebrow: a.actionNeeded ? 'Action needed' : a.kind,
      heading,
      paragraphs: [escapeHtml(a.summary)],
      panel: { title: 'Details', rows: rows.map(([label, value]) => ({ label, value: escapeHtml(value) })) },
      cta: { label: 'Open the ERP', url: ERP_URL },
      signature: { name: 'Preciprocal', title: 'Operator alert' },
      footerNote: 'You are receiving this because you are the operator on this Preciprocal deployment. Set NOTIFY_ADMIN_ON_BILLING=false to stop these.',
    });
    const text = renderText({
      heading,
      paragraphs: [a.summary],
      panel: { title: 'Details', lines: rows.map(([k, v]) => `${k}: ${v}`) },
      cta: { label: 'Open the ERP', url: ERP_URL },
      signoff: 'Preciprocal',
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM, to: ADMIN_EMAIL,
      subject: `${a.actionNeeded ? '[Action needed] ' : ''}${a.kind}: ${email}`,
      html, text,
    });
  } catch (err) {
    console.error('⚠️ ops alert failed:', a.kind, err);
  }
}
