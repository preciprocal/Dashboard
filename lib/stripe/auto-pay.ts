// lib/stripe/auto-pay.ts
// Auto pay on or off for a subscription, and the one place that knows what
// each means in Stripe.
//
//   on   collection_method = charge_automatically
//        Stripe charges the saved card every month.
//   off  collection_method = send_invoice, days_until_due = 7
//        Stripe emails an invoice every month instead. The customer pays it
//        from the email, with the saved card or another one. If it is still
//        unpaid 7 days later the subscription goes past due, and Stripe's
//        "manage invoices sent to customers" setting cancels it, which the
//        webhook turns into a downgrade to Free.
//
// Off is the default everywhere a subscription is created: people opt in at
// checkout, and can flip it in Settings > Plan & Billing at any time.
//
// The first payment at checkout is always taken immediately, whichever is
// chosen. Auto pay only decides how month two onwards is collected.

import type Stripe from 'stripe';

/** Days a customer has to pay an emailed invoice before the plan lapses. */
export const INVOICE_DAYS_UNTIL_DUE = 7;

/** Fields to spread into subscriptions.create or subscriptions.update. */
export function collectionParams(autoPay: boolean): Pick<Stripe.SubscriptionCreateParams, 'collection_method' | 'days_until_due'> {
  return autoPay
    ? { collection_method: 'charge_automatically' }
    : { collection_method: 'send_invoice', days_until_due: INVOICE_DAYS_UNTIL_DUE };
}

/**
 * Stamped on the subscription whenever the choice changes, so there is a
 * record in Stripe of what the customer agreed to and when.
 */
export function consentMetadata(autoPay: boolean, source: string): Record<string, string> {
  return {
    autoPay: autoPay ? 'on' : 'off',
    autoPayChangedAt: new Date().toISOString(),
    autoPayChangedVia: source,
  };
}

export interface AutoPayState {
  autoPay: boolean;
  /** A card Stripe can charge without the customer present. */
  hasPaymentMethod: boolean;
  status: Stripe.Subscription.Status;
  /** Unix seconds of the next charge or invoice, if Stripe knows it. */
  nextBillingAt: number | null;
  cancelAtPeriodEnd: boolean;
}

function hasDefaultPaymentMethod(sub: Stripe.Subscription): boolean {
  if (sub.default_payment_method) return true;
  const customer = sub.customer;
  if (customer && typeof customer === 'object' && !('deleted' in customer && customer.deleted)) {
    return Boolean((customer as Stripe.Customer).invoice_settings?.default_payment_method);
  }
  return false;
}

export async function readAutoPay(stripe: Stripe, subscriptionId: string): Promise<AutoPayState> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] });
  const periodEnd = (sub.items.data[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end
    ?? (sub as unknown as { current_period_end?: number }).current_period_end
    ?? null;
  return {
    autoPay: sub.collection_method === 'charge_automatically',
    hasPaymentMethod: hasDefaultPaymentMethod(sub),
    status: sub.status,
    nextBillingAt: sub.trial_end && sub.status === 'trialing' ? sub.trial_end : periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

export class AutoPayError extends Error {}

/**
 * Switch auto pay. Turning it on needs a saved card; without one Stripe would
 * accept the change and then fail the next charge, so it is refused up front.
 *
 * Turning it on also tries to settle an invoice already waiting for payment,
 * so the customer is not left with an open invoice that would still lapse
 * their plan.
 */
export async function setAutoPay(
  stripe: Stripe,
  subscriptionId: string,
  autoPay: boolean,
  source: string,
): Promise<AutoPayState> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer', 'latest_invoice'] });

  if (['canceled', 'incomplete_expired'].includes(sub.status)) {
    throw new AutoPayError('This subscription has ended, so there is nothing to change.');
  }
  if (autoPay && !hasDefaultPaymentMethod(sub)) {
    throw new AutoPayError('Add a card under Payment and invoices first, then turn auto pay on.');
  }

  await stripe.subscriptions.update(subscriptionId, {
    ...collectionParams(autoPay),
    metadata: { ...sub.metadata, ...consentMetadata(autoPay, source) },
  });

  if (autoPay) {
    const invoice = sub.latest_invoice;
    if (invoice && typeof invoice === 'object' && invoice.status === 'open' && invoice.id) {
      try {
        await stripe.invoices.pay(invoice.id);
      } catch (err) {
        // The switch itself succeeded. The invoice stays open and payable
        // from its email link, and Stripe will retry on the saved card.
        console.error('⚠️ auto pay on, but the open invoice could not be paid now:', err);
      }
    }
  }

  return readAutoPay(stripe, subscriptionId);
}
