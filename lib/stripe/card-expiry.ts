// lib/stripe/card-expiry.ts
// Emails people on auto pay whose saved card expires this month, so the next
// charge does not fail. Replaces Stripe's "expiring card" email. Runs daily
// from the application-coaching cron; each subscription is emailed once per
// month, recorded in its metadata as cardExpiryNotified = "YYYY-MM".

import type Stripe from 'stripe';
import { sendCardExpiringEmail } from '@/lib/email/billing';

export async function notifyExpiringCards(
  stripe: Stripe,
  opts: { now?: Date; customer?: string } = {},
): Promise<{ checked: number; notified: number }> {
  const now = opts.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const stamp = `${year}-${String(month).padStart(2, '0')}`;
  let checked = 0, notified = 0;

  for (const status of ['active', 'trialing'] as const) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      expand: ['data.default_payment_method', 'data.customer.invoice_settings.default_payment_method'],
      ...(opts.customer ? { customer: opts.customer } : {}),
    })) {
      checked += 1;
      if (sub.collection_method !== 'charge_automatically' || sub.cancel_at_period_end) continue;
      if (sub.metadata?.cardExpiryNotified === stamp) continue;
      const userId = sub.metadata?.userId;
      if (!userId) continue;

      const customer = sub.customer as Stripe.Customer;
      const pm = (sub.default_payment_method ?? customer?.invoice_settings?.default_payment_method) as Stripe.PaymentMethod | null;
      const card = pm && typeof pm === 'object' ? pm.card : null;
      if (!card || card.exp_year !== year || card.exp_month !== month) continue;

      const sent = await sendCardExpiringEmail(userId, {
        brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year,
      });
      if (sent) {
        await stripe.subscriptions.update(sub.id, { metadata: { ...sub.metadata, cardExpiryNotified: stamp } });
        notified += 1;
      }
    }
  }
  return { checked, notified };
}
