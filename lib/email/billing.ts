// lib/email/billing.ts
// Our own invoice and receipt emails, replacing Stripe's. Sent from the
// Stripe webhook:
//
//   invoice.finalized        an invoice to pay (auto pay off), with a button
//                            to the in-app pay page /billing/invoice/[id]
//   invoice.payment_succeeded  a receipt, for every payment that took money
//
// Once these are live, turn OFF in Stripe: "Send finalized invoices to
// customers" and the successful-payment receipt emails, or people get both.
//
// Transactional: no unsubscribe link, like the other billing and security mail.

import { Resend } from 'resend';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/supabase/admin';
import { renderEmail, renderText, escapeHtml, firstName } from '@/lib/email/layout';
import { emailAppUrl } from '@/lib/email/app-url';
import { recordEmailSend } from '@/lib/email/track';
import { money } from '@/lib/stripe/billing';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.BILLING_EMAIL_FROM ?? 'Preciprocal Billing <billing@preciprocal.com>';
const REPLY_TO = 'support@preciprocal.com';

const day = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

function describe(invoice: Stripe.Invoice): string {
  return invoice.lines.data[0]?.description?.replace(/^1 × /, '') ?? 'Preciprocal subscription';
}

async function recipient(supabaseUserId: string): Promise<{ email: string; name: string | null } | null> {
  const { data } = await supabaseAdmin.from('profiles').select('email, name').eq('user_id', supabaseUserId).maybeSingle();
  return data?.email ? { email: data.email as string, name: (data.name as string | null) ?? null } : null;
}

/** Never throws: a failed email must not fail the webhook, which Stripe would retry. */
export async function sendInvoiceEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  try {
    const to = await recipient(supabaseUserId);
    if (!to || invoice.amount_due <= 0) return;

    const amount = money(invoice.amount_due, invoice.currency);
    const due = day(invoice.due_date);
    const payUrl = `${emailAppUrl()}/billing/invoice/${invoice.id}`;
    const subject = `Your Preciprocal invoice for ${amount}${due ? `, due ${due}` : ''}`;
    const rows = [
      { label: 'For', value: escapeHtml(describe(invoice)) },
      { label: 'Amount', value: escapeHtml(amount) },
      ...(due ? [{ label: 'Due', value: escapeHtml(due) }] : []),
      ...(invoice.number ? [{ label: 'Invoice', value: escapeHtml(invoice.number) }] : []),
    ];
    const paragraphs = [
      `Hi ${firstName(to.name)},`,
      `Your next month of Preciprocal is ready. You have auto pay turned off, so here is the invoice to pay yourself.`,
      `Pay it${due ? ` by ${due}` : ''} to keep your plan. If it is not paid by then, your account moves to the Free plan. You can turn auto pay on any time in Settings.`,
    ];

    const html = renderEmail({
      campaign: 'billing_invoice',
      preheader: `${amount}${due ? ` due ${due}` : ''}. Pay in a couple of clicks.`,
      eyebrow: 'Invoice',
      heading: `${amount} for your next month`,
      paragraphs: paragraphs.map(escapeHtml),
      panel: { title: 'Invoice details', rows },
      cta: { label: `Pay ${amount}`, url: payUrl },
      signoff: 'Questions about this invoice? Just reply to this email.<br />Preciprocal Billing',
      footerNote: 'You are receiving this because you have a Preciprocal subscription with auto pay turned off.',
    });
    const text = renderText({
      campaign: 'billing_invoice',
      heading: `${amount} for your next month`,
      paragraphs,
      panel: { title: 'Invoice details', lines: rows.map(r => `${r.label}: ${r.value.replace(/&amp;/g, '&')}`) },
      cta: { label: `Pay ${amount}`, url: payUrl },
      signoff: 'Questions about this invoice? Just reply.\nPreciprocal Billing',
      footerNote: 'You have a Preciprocal subscription with auto pay turned off.',
    });

    const { data, error } = await resend.emails.send({ from: FROM, to: to.email, replyTo: REPLY_TO, subject, html, text });
    if (error) throw error;
    await recordEmailSend({ resendId: data?.id, userId: supabaseUserId, emailType: 'billing_invoice', subject });
  } catch (err) {
    console.error('⚠️ Invoice email failed (non-fatal):', invoice.id, err);
  }
}

export async function sendReceiptEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  try {
    const to = await recipient(supabaseUserId);
    if (!to || invoice.amount_paid <= 0) return;

    const amount = money(invoice.amount_paid, invoice.currency);
    const paidOn = day(invoice.status_transitions?.paid_at ?? invoice.created);
    const line = invoice.lines.data[0];
    const period = line?.period ? `${day(line.period.start)} to ${day(line.period.end)}` : null;
    const viewUrl = `${emailAppUrl()}/billing/invoice/${invoice.id}`;
    const subject = `Receipt for your Preciprocal payment of ${amount}`;
    const rows = [
      { label: 'For', value: escapeHtml(describe(invoice)) },
      { label: 'Amount paid', value: escapeHtml(amount) },
      ...(paidOn ? [{ label: 'Paid on', value: escapeHtml(paidOn) }] : []),
      ...(period ? [{ label: 'Covers', value: escapeHtml(period) }] : []),
      ...(invoice.number ? [{ label: 'Invoice', value: escapeHtml(invoice.number) }] : []),
    ];
    const paragraphs = [`Hi ${firstName(to.name)},`, 'Thanks, your payment went through. Here is your receipt.'];

    const html = renderEmail({
      campaign: 'billing_receipt',
      preheader: `${amount} received. Thank you.`,
      eyebrow: 'Receipt',
      heading: 'Payment received',
      paragraphs: paragraphs.map(escapeHtml),
      panel: { title: 'Receipt', rows },
      cta: { label: 'View or download invoice', url: viewUrl },
      signoff: 'Questions about this payment? Just reply to this email.<br />Preciprocal Billing',
      footerNote: 'You are receiving this because a payment was made on your Preciprocal account.',
    });
    const text = renderText({
      campaign: 'billing_receipt',
      heading: 'Payment received',
      paragraphs,
      panel: { title: 'Receipt', lines: rows.map(r => `${r.label}: ${r.value.replace(/&amp;/g, '&')}`) },
      cta: { label: 'View or download invoice', url: viewUrl },
      signoff: 'Questions about this payment? Just reply.\nPreciprocal Billing',
      footerNote: 'A payment was made on your Preciprocal account.',
    });

    const { data, error } = await resend.emails.send({ from: FROM, to: to.email, replyTo: REPLY_TO, subject, html, text });
    if (error) throw error;
    await recordEmailSend({ resendId: data?.id, userId: supabaseUserId, emailType: 'billing_receipt', subject });
  } catch (err) {
    console.error('⚠️ Receipt email failed (non-fatal):', invoice.id, err);
  }
}
