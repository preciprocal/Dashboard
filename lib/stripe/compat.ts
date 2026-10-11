// lib/stripe/compat.ts
// Fields that moved in Stripe's "basil" API (2025-03-31 onward), which every
// Stripe client in this app is pinned to.
//
//   subscription.current_period_start/end  ->  subscription.items[n].current_period_*
//   invoice.subscription                   ->  invoice.parent.subscription_details.subscription
//
// The code was written against the old shape and read both as undefined,
// silently. Confirmed against real test-mode objects: the webhook ignored
// every renewal and every failed payment (it returned early on the missing
// invoice.subscription), and wrote a null period end on every subscription
// update. These helpers read the new location and fall back to the old one.

import type Stripe from 'stripe';

export function periodOf(sub: Stripe.Subscription): { start: number | null; end: number | null } {
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  return {
    start: item?.current_period_start ?? legacy.current_period_start ?? null,
    end: item?.current_period_end ?? legacy.current_period_end ?? null,
  };
}

export function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (fromParent) return typeof fromParent === 'string' ? fromParent : fromParent.id;
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (!legacy) return null;
  return typeof legacy === 'string' ? legacy : legacy.id;
}
