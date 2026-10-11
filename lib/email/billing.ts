// lib/email/billing.ts
// Every billing email a customer gets, sent by us instead of Stripe:
//
//   invoice          an invoice to pay (auto pay off)          invoice.finalized
//   receipt          a subscription payment went through       invoice.payment_succeeded
//   pack receipt     a pack was bought                         checkout.session.completed
//   refund           money was returned                        charge.refunded
//   trial ending     the free month is about to end            customer.subscription.trial_will_end
//   renewal          the plan renews soon                      invoice.upcoming
//   payment failed   an automatic charge was declined          invoice.payment_failed
//   action required  the bank wants the customer to approve    invoice.payment_action_required
//   card expiring    the saved card expires this month         daily cron (lib/stripe/card-expiry.ts)
//
// With these live, every customer email in Stripe's settings is switched off,
// so all billing mail comes from preciprocal.com in our own design.
//
// Transactional: no unsubscribe link, like the other billing and security mail.
// Every sender here never throws: a failed email must not fail the webhook,
// which Stripe would then retry, re-running the work that triggered it.

import { Resend } from 'resend';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/supabase/admin';
import { renderEmail, renderText, escapeHtml, firstName } from '@/lib/email/layout';
import { emailAppUrl } from '@/lib/email/app-url';
import { recordEmailSend, type EmailType } from '@/lib/email/track';
import { money } from '@/lib/stripe/billing';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.BILLING_EMAIL_FROM ?? 'Preciprocal Billing <billing@preciprocal.com>';
const REPLY_TO = 'support@preciprocal.com';

const day = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

const billingUrl = () => `${emailAppUrl()}/settings?section=billing`;
const invoiceUrl = (id: string) => `${emailAppUrl()}/billing/invoice/${id}`;

/** Tax inside an invoice's total, from Stripe Tax. 0 when none applied. */
function taxOf(invoice: Stripe.Invoice): number {
  return (invoice.total_taxes ?? []).reduce((n, t) => n + (t.amount ?? 0), 0);
}

function describe(invoice: Stripe.Invoice): string {
  return invoice.lines.data[0]?.description?.replace(/^1 × /, '') ?? 'Preciprocal subscription';
}

async function recipient(supabaseUserId: string): Promise<{ email: string; name: string | null } | null> {
  const { data } = await supabaseAdmin.from('profiles').select('email, name').eq('user_id', supabaseUserId).maybeSingle();
  return data?.email ? { email: data.email as string, name: (data.name as string | null) ?? null } : null;
}

/** Our user for a Stripe customer, via the subscriptions row. */
export async function userForCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await supabaseAdmin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

interface BillingEmail {
  type: EmailType;
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  /** After "Hi <name>,". Plain text. */
  paragraphs: string[];
  panelTitle: string;
  rows: { label: string; value: string }[];
  cta: { label: string; url: string };
  footerNote: string;
}

async function send(supabaseUserId: string, e: BillingEmail): Promise<boolean> {
  try {
    const to = await recipient(supabaseUserId);
    if (!to) return false;
    const paragraphs = [`Hi ${firstName(to.name)},`, ...e.paragraphs];
    const rows = e.rows.map(r => ({ label: r.label, value: escapeHtml(r.value) }));

    const html = renderEmail({
      campaign: e.type,
      preheader: e.preheader,
      eyebrow: e.eyebrow,
      heading: e.heading,
      paragraphs: paragraphs.map(escapeHtml),
      panel: { title: e.panelTitle, rows },
      cta: e.cta,
      signoff: 'Questions? Just reply to this email.<br />Preciprocal Billing',
      footerNote: e.footerNote,
    });
    const text = renderText({
      campaign: e.type,
      heading: e.heading,
      paragraphs,
      panel: { title: e.panelTitle, lines: e.rows.map(r => `${r.label}: ${r.value}`) },
      cta: e.cta,
      signoff: 'Questions? Just reply.\nPreciprocal Billing',
      footerNote: e.footerNote,
    });

    const { data, error } = await resend.emails.send({ from: FROM, to: to.email, replyTo: REPLY_TO, subject: e.subject, html, text });
    if (error) throw error;
    await recordEmailSend({ resendId: data?.id, userId: supabaseUserId, emailType: e.type, subject: e.subject });
    return true;
  } catch (err) {
    console.error(`⚠️ ${e.type} email failed (non-fatal):`, err);
    return false;
  }
}

// ─── Invoices and receipts ───────────────────────────────────────────────────

export async function sendInvoiceEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  if (invoice.amount_due <= 0) return;
  const amount = money(invoice.amount_due, invoice.currency);
  const due = day(invoice.due_date);
  await send(supabaseUserId, {
    type: 'billing_invoice',
    subject: `Your Preciprocal invoice for ${amount}${due ? `, due ${due}` : ''}`,
    preheader: `${amount}${due ? ` due ${due}` : ''}. Pay in a couple of clicks.`,
    eyebrow: 'Invoice',
    heading: `${amount} for your next month`,
    paragraphs: [
      'Your next month of Preciprocal is ready. You have auto pay turned off, so here is the invoice to pay yourself.',
      `Pay it${due ? ` by ${due}` : ''} to keep your plan. If it is not paid by then, your account moves to the Free plan. You can turn auto pay on any time in Settings.`,
    ],
    panelTitle: 'Invoice details',
    rows: [
      { label: 'For', value: describe(invoice) },
      { label: 'Amount', value: amount },
      ...(taxOf(invoice) > 0 ? [{ label: 'Includes tax', value: money(taxOf(invoice), invoice.currency) }] : []),
      ...(due ? [{ label: 'Due', value: due }] : []),
      ...(invoice.number ? [{ label: 'Invoice', value: invoice.number }] : []),
    ],
    cta: { label: `Pay ${amount}`, url: invoiceUrl(invoice.id!) },
    footerNote: 'You are receiving this because you have a Preciprocal subscription with auto pay turned off.',
  });
}

/** Two days before an emailed invoice is due: the only nudge before the plan lapses. */
export async function sendInvoiceReminderEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  if (invoice.amount_due <= 0) return;
  const amount = money(invoice.amount_due, invoice.currency);
  const due = day(invoice.due_date);
  await send(supabaseUserId, {
    type: 'billing_invoice_reminder',
    subject: `Reminder: your Preciprocal invoice for ${amount} is due${due ? ` ${due}` : ' soon'}`,
    preheader: `Pay ${amount}${due ? ` by ${due}` : ''} to keep your plan.`,
    eyebrow: 'Payment reminder',
    heading: `${amount} due${due ? ` ${due}` : ' soon'}`,
    paragraphs: [
      'A quick reminder that your Preciprocal invoice is still open.',
      `Pay it${due ? ` by ${due}` : ''} to keep your plan. If it is not paid by then, your account moves to the Free plan and your saved work stays where it is. To stop these reminders, turn auto pay on in Settings.`,
    ],
    panelTitle: 'Invoice details',
    rows: [
      { label: 'For', value: describe(invoice) },
      { label: 'Amount', value: amount },
      ...(due ? [{ label: 'Due', value: due }] : []),
      ...(invoice.number ? [{ label: 'Invoice', value: invoice.number }] : []),
    ],
    cta: { label: `Pay ${amount}`, url: invoiceUrl(invoice.id!) },
    footerNote: 'You are receiving this because you have a Preciprocal subscription with auto pay turned off.',
  });
}

export async function sendReceiptEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  if (invoice.amount_paid <= 0) return;
  const amount = money(invoice.amount_paid, invoice.currency);
  const line = invoice.lines.data[0];
  const period = line?.period ? `${day(line.period.start)} to ${day(line.period.end)}` : null;
  await send(supabaseUserId, {
    type: 'billing_receipt',
    subject: `Receipt for your Preciprocal payment of ${amount}`,
    preheader: `${amount} received. Thank you.`,
    eyebrow: 'Receipt',
    heading: 'Payment received',
    paragraphs: ['Thanks, your payment went through. Here is your receipt.'],
    panelTitle: 'Receipt',
    rows: [
      { label: 'For', value: describe(invoice) },
      { label: 'Amount paid', value: amount },
      ...(taxOf(invoice) > 0 ? [{ label: 'Includes tax', value: money(taxOf(invoice), invoice.currency) }] : []),
      ...(day(invoice.status_transitions?.paid_at ?? invoice.created) ? [{ label: 'Paid on', value: day(invoice.status_transitions?.paid_at ?? invoice.created)! }] : []),
      ...(period ? [{ label: 'Covers', value: period }] : []),
      ...(invoice.number ? [{ label: 'Invoice', value: invoice.number }] : []),
    ],
    cta: { label: 'View or download invoice', url: invoiceUrl(invoice.id!) },
    footerNote: 'You are receiving this because a payment was made on your Preciprocal account.',
  });
}

export async function sendPackReceiptEmail(
  supabaseUserId: string,
  args: { packName: string; amountCents: number; currency: string; paidAt: number; reference: string; taxCents?: number },
): Promise<void> {
  if (args.amountCents <= 0) return;
  const amount = money(args.amountCents, args.currency);
  await send(supabaseUserId, {
    type: 'billing_pack_receipt',
    subject: `Receipt for your ${args.packName}`,
    preheader: `${amount} received. Your extra credits are ready to use.`,
    eyebrow: 'Receipt',
    heading: `${args.packName} added`,
    paragraphs: [
      'Thanks, your payment went through and the credits are already on your account. They never expire, and they are only used once your monthly allowance runs out.',
    ],
    panelTitle: 'Receipt',
    rows: [
      { label: 'For', value: args.packName },
      { label: 'Amount paid', value: amount },
      ...(args.taxCents ? [{ label: 'Includes tax', value: money(args.taxCents, args.currency) }] : []),
      { label: 'Paid on', value: day(args.paidAt) ?? '' },
      { label: 'Reference', value: args.reference },
    ],
    cta: { label: 'See your credits', url: billingUrl() },
    footerNote: 'You are receiving this because you bought a credit pack on Preciprocal.',
  });
}

export async function sendRefundEmail(
  supabaseUserId: string,
  args: { amountCents: number; currency: string; forWhat: string; refundedAt: number; full: boolean; planEnded?: boolean },
): Promise<void> {
  const amount = money(args.amountCents, args.currency);
  await send(supabaseUserId, {
    type: 'billing_refund',
    subject: `Your refund of ${amount} is on its way`,
    preheader: `${amount} back to your original payment method.`,
    eyebrow: 'Refund',
    heading: `${amount} refunded`,
    paragraphs: [
      `We have refunded ${amount} to the card you paid with. Banks usually take 5 to 10 business days to show it, depending on your card.`,
      ...(args.full ? [] : ['This is a partial refund of the original payment.']),
      ...(args.planEnded ? ['As part of the refund, your paid plan has ended and your account is now on the Free plan. You can subscribe again any time.'] : []),
    ],
    panelTitle: 'Refund details',
    rows: [
      { label: 'For', value: args.forWhat },
      { label: 'Amount', value: amount },
      { label: 'Refunded on', value: day(args.refundedAt) ?? '' },
    ],
    cta: { label: 'View billing', url: billingUrl() },
    footerNote: 'You are receiving this because a refund was issued on your Preciprocal account.',
  });
}

// ─── Heads-ups before money moves ────────────────────────────────────────────

export async function sendTrialEndingEmail(
  supabaseUserId: string,
  args: { trialEnd: number; amountCents: number; currency: string; autoPay: boolean },
): Promise<void> {
  const amount = money(args.amountCents, args.currency);
  const end = day(args.trialEnd) ?? 'soon';
  await send(supabaseUserId, {
    type: 'billing_trial_ending',
    subject: `Your free month ends on ${end}`,
    preheader: args.autoPay ? `Your card will be charged ${amount} on ${end}.` : `We will email you an invoice for ${amount} on ${end}.`,
    eyebrow: 'Free trial',
    heading: 'Your free month is almost up',
    paragraphs: [
      args.autoPay
        ? `Your free month of Pro ends on ${end}. After that, your card is charged ${amount} a month automatically.`
        : `Your free month of Pro ends on ${end}. Auto pay is off, so we will email you an invoice for ${amount} to pay yourself.`,
      'Not ready to continue? Cancel from Settings before then and you will not be charged anything.',
    ],
    panelTitle: 'What happens next',
    rows: [
      { label: 'Trial ends', value: end },
      { label: 'Then', value: `${amount} a month` },
      { label: 'Payment', value: args.autoPay ? 'Charged automatically' : 'Invoice by email' },
    ],
    cta: { label: 'Manage billing', url: billingUrl() },
    footerNote: 'You are receiving this because your Preciprocal free trial is ending.',
  });
}

export async function sendRenewalReminderEmail(
  supabaseUserId: string,
  args: { renewsAt: number; amountCents: number; currency: string; autoPay: boolean },
): Promise<void> {
  if (args.amountCents <= 0) return;
  const amount = money(args.amountCents, args.currency);
  const on = day(args.renewsAt) ?? 'soon';
  await send(supabaseUserId, {
    type: 'billing_renewal',
    subject: `Your Preciprocal plan renews on ${on}`,
    preheader: args.autoPay ? `${amount} will be charged to your saved card.` : `We will email you an invoice for ${amount}.`,
    eyebrow: 'Upcoming renewal',
    heading: `Renewing on ${on}`,
    paragraphs: [
      args.autoPay
        ? `Your plan renews on ${on}, and ${amount} will be charged to your saved card automatically.`
        : `Your plan renews on ${on}. Auto pay is off, so we will email you an invoice for ${amount} that day.`,
      'Nothing to do if that is what you want. To change your card, switch auto pay, or cancel, go to Settings.',
    ],
    panelTitle: 'Renewal',
    rows: [
      { label: 'Renews on', value: on },
      { label: 'Amount', value: amount },
      { label: 'Payment', value: args.autoPay ? 'Charged automatically' : 'Invoice by email' },
    ],
    cta: { label: 'Manage billing', url: billingUrl() },
    footerNote: 'You are receiving this because you have a Preciprocal subscription.',
  });
}

// ─── When a payment needs the customer ───────────────────────────────────────

export async function sendPaymentFailedEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  const amount = money(invoice.amount_due, invoice.currency);
  await send(supabaseUserId, {
    type: 'billing_payment_failed',
    subject: `Your Preciprocal payment of ${amount} did not go through`,
    preheader: 'Update your card or pay now to keep your plan.',
    eyebrow: 'Payment failed',
    heading: 'Your payment did not go through',
    paragraphs: [
      `We tried to charge ${amount} for your Preciprocal plan, but your bank declined it. That is often a card that has expired or reached its limit.`,
      'We will try again over the next few days. To sort it now, pay with your card or a different one in a couple of clicks.',
    ],
    panelTitle: 'Payment',
    rows: [
      { label: 'For', value: describe(invoice) },
      { label: 'Amount', value: amount },
      ...(invoice.number ? [{ label: 'Invoice', value: invoice.number }] : []),
    ],
    cta: { label: 'Pay now or change card', url: invoiceUrl(invoice.id!) },
    footerNote: 'You are receiving this because a payment on your Preciprocal account failed.',
  });
}

export async function sendActionRequiredEmail(supabaseUserId: string, invoice: Stripe.Invoice): Promise<void> {
  const amount = money(invoice.amount_due, invoice.currency);
  await send(supabaseUserId, {
    type: 'billing_action_required',
    subject: `Approve your Preciprocal payment of ${amount}`,
    preheader: 'Your bank needs you to confirm this payment.',
    eyebrow: 'Action needed',
    heading: 'Your bank needs your approval',
    paragraphs: [
      `Your bank asked you to confirm the payment of ${amount} for your Preciprocal plan before it goes through. It takes a few seconds.`,
      'Open the payment, then approve it in your banking app or with the code your bank sends you.',
    ],
    panelTitle: 'Payment',
    rows: [
      { label: 'For', value: describe(invoice) },
      { label: 'Amount', value: amount },
    ],
    cta: { label: 'Approve payment', url: invoiceUrl(invoice.id!) },
    footerNote: 'You are receiving this because a payment on your Preciprocal account needs your approval.',
  });
}

export async function sendCardExpiringEmail(
  supabaseUserId: string,
  args: { brand: string; last4: string; expMonth: number; expYear: number },
): Promise<boolean> {
  const brand = args.brand === 'amex' ? 'Amex' : args.brand.charAt(0).toUpperCase() + args.brand.slice(1);
  const expiry = `${String(args.expMonth).padStart(2, '0')}/${args.expYear}`;
  return send(supabaseUserId, {
    type: 'billing_card_expiring',
    subject: `Your ${brand} ending ${args.last4} expires soon`,
    preheader: 'Update it so your plan carries on without a break.',
    eyebrow: 'Card expiring',
    heading: 'Your card expires this month',
    paragraphs: [
      `The ${brand} ending ${args.last4} that pays for your Preciprocal plan expires at the end of this month.`,
      'Add your new card now so your next payment goes through without a break.',
    ],
    panelTitle: 'Card',
    rows: [
      { label: 'Card', value: `${brand} ending ${args.last4}` },
      { label: 'Expires', value: expiry },
    ],
    cta: { label: 'Update card', url: billingUrl() },
    footerNote: 'You are receiving this because the card on your Preciprocal account is about to expire.',
  });
}

export async function sendRefundDeniedEmail(supabaseUserId: string): Promise<void> {
  await send(supabaseUserId, {
    type: 'billing_refund_denied',
    subject: 'About your Preciprocal refund request',
    preheader: 'We have reviewed your request.',
    eyebrow: 'Refund request',
    heading: 'We reviewed your refund request',
    paragraphs: [
      'Thanks for your patience. We looked at your refund request carefully, and we are not able to approve it under our refund policy for this billing period.',
      'Your plan carries on as normal and nothing has been charged. If you think we got this wrong, reply to this email and a person will look at it again.',
    ],
    panelTitle: 'Your request',
    rows: [{ label: 'Decision', value: 'Not approved' }, { label: 'Your plan', value: 'Unchanged' }],
    cta: { label: 'View billing', url: billingUrl() },
    footerNote: 'You are receiving this because you asked for a refund on your Preciprocal account.',
  });
}

/**
 * To the admin inbox, not the customer: a chargeback has a response deadline,
 * and the only way to win one is to answer it in the Stripe dashboard in time.
 */
export async function sendDisputeAlert(args: {
  amountCents: number; currency: string; reason: string; chargeId: string; dueBy: number | null;
  customerEmail: string | null; what: string;
}): Promise<void> {
  try {
    const amount = money(args.amountCents, args.currency);
    const due = day(args.dueBy);
    const subject = `Chargeback opened: ${amount} (${args.reason})`;
    const lines = [
      `A customer disputed a payment of ${amount} with their bank.`,
      `For: ${args.what}`,
      `Customer: ${args.customerEmail ?? 'unknown'}`,
      `Reason: ${args.reason}`,
      `Respond in Stripe by: ${due ?? 'see Stripe'}`,
      `Charge: ${args.chargeId}`,
      'Open Stripe > Payments > Disputes to submit evidence. If this was a pack, its unused credits have been voided.',
    ];
    const { error } = await resend.emails.send({
      from: FROM,
      to: process.env.ADMIN_EMAIL ?? 'admin@preciprocal.com',
      subject,
      text: lines.join('\n'),
    });
    if (error) throw error;
  } catch (err) {
    console.error('⚠️ Dispute alert failed (non-fatal):', err);
  }
}
