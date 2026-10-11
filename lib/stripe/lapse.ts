// lib/stripe/lapse.ts
// Ends subscriptions whose emailed invoice (auto pay off) is past its due
// date and still unpaid. Run once a day from the application-coaching cron.
//
// Why this is ours and not a Stripe setting: Stripe's "if an invoice is past
// due by N days, cancel the subscription" bottoms out at 30 days. The app
// tells people "pay within 7 days to keep your plan", and with only Stripe's
// rule someone who never pays would keep a paid plan for about 37 days. Keep
// Stripe's 30-day rule switched on anyway, as a backstop if this ever stops
// running.
//
// Cancelling fires customer.subscription.deleted, and the webhook moves the
// account to Free exactly as it does for any other cancellation.

import type Stripe from 'stripe';
import { subscriptionIdOfInvoice } from '@/lib/stripe/compat';
import { sendInvoiceReminderEmail, userForCustomer } from '@/lib/email/billing';

export interface LapseResult {
  checked: number;
  lapsed: string[];
  failed: string[];
}

/**
 * @param now      unix seconds; a parameter so tests can run against a Stripe
 *                 test clock instead of the wall clock
 * @param customer restricts the run to one customer, for tests
 */
export async function lapseUnpaidInvoices(
  stripe: Stripe,
  opts: { now?: number; customer?: string } = {},
): Promise<LapseResult> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const result: LapseResult = { checked: 0, lapsed: [], failed: [] };
  const done = new Set<string>();

  for await (const invoice of stripe.invoices.list({
    status: 'open',
    collection_method: 'send_invoice',
    due_date: { lt: now },
    limit: 100,
    ...(opts.customer ? { customer: opts.customer } : {}),
  })) {
    result.checked += 1;
    const subId = subscriptionIdOfInvoice(invoice);
    if (!subId || done.has(subId)) continue;
    done.add(subId);

    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      // Someone who turned auto pay back on is being charged by Stripe's own
      // retries; only invoices they were asked to pay themselves lapse here.
      if (sub.collection_method !== 'send_invoice' || ['canceled', 'incomplete_expired'].includes(sub.status)) continue;

      await stripe.subscriptions.cancel(subId, {
        cancellation_details: { comment: 'Emailed invoice unpaid past its due date (lib/stripe/lapse.ts)' },
      });
      // Close the invoice too, so it stops counting as money owed. The plan
      // it was for has ended, so it should not stay payable.
      await stripe.invoices.markUncollectible(invoice.id!).catch(() => { /* already closed by the cancel */ });
      result.lapsed.push(subId);
    } catch (err) {
      console.error('⚠️ could not lapse subscription', subId, err);
      result.failed.push(subId);
    }
  }

  if (result.lapsed.length || result.failed.length) {
    console.log(`⏳ Lapsed ${result.lapsed.length} unpaid subscription(s), ${result.failed.length} failed`);
  }
  return result;
}


/**
 * One reminder per emailed invoice, sent when it is within REMIND_DAYS of its
 * due date. Without it, someone with auto pay off got the invoice email and
 * then nothing until their plan lapsed. Marked on the invoice's own metadata
 * (reminder_sent_at) so a re-run of the daily cron never sends it twice.
 */
const REMIND_DAYS = 2;

export async function remindUnpaidInvoices(stripe: Stripe, opts: { now?: number } = {}): Promise<number> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  let sent = 0;
  for await (const invoice of stripe.invoices.list({
    status: 'open',
    collection_method: 'send_invoice',
    due_date: { gte: now, lte: now + REMIND_DAYS * 86_400 },
    limit: 100,
  })) {
    if (invoice.metadata?.reminder_sent_at || invoice.amount_due <= 0) continue;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const userId = await userForCustomer(customerId);
    if (!userId) continue;
    try {
      await sendInvoiceReminderEmail(userId, invoice);
      await stripe.invoices.update(invoice.id!, { metadata: { ...invoice.metadata, reminder_sent_at: String(now) } });
      sent += 1;
    } catch (err) {
      console.error('⚠️ invoice reminder failed:', invoice.id, err);
    }
  }
  return sent;
}
