// lib/refund/fees.ts
// What a payment cost us in fees, so a refund never costs us money.
//
// Stripe keeps its fees when a payment is refunded, so every refund deducts:
//
//   processing  the card fee Stripe actually charged on that payment, read
//               from its balance transaction (2.9% + 30c on a US card, more
//               on international cards and currency conversion). Falls back
//               to the standard estimate only if Stripe has not recorded it.
//   billing     for subscription payments only: Stripe Billing's usage fee
//               (STRIPE_BILLING_FEE_PERCENT of the payment). It is invoiced
//               to us separately each month, so it never appears on the
//               payment itself.
//
// Result: a full refund leaves us at zero rather than below it, and a
// partial one keeps exactly the value the customer used.

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe/billing';
import { estimateStripeFeeCents, STRIPE_BILLING_FEE_PERCENT } from '@/lib/config/refund';

export interface FeeBreakdown {
  processingCents: number;
  billingCents: number;
  totalCents: number;
}

async function processingFee(charge: Stripe.Charge): Promise<number> {
  let bt = charge.balance_transaction;
  if (typeof bt === 'string') {
    bt = await stripe.balanceTransactions.retrieve(bt).catch(() => null) as Stripe.BalanceTransaction | null;
  }
  if (bt && typeof bt === 'object' && typeof bt.fee === 'number') return bt.fee;
  return estimateStripeFeeCents(charge.amount);
}

export async function feesFor(charge: Stripe.Charge, kind: 'subscription' | 'pack'): Promise<FeeBreakdown> {
  const processingCents = await processingFee(charge);
  const billingCents = kind === 'subscription' ? Math.ceil(charge.amount * STRIPE_BILLING_FEE_PERCENT) : 0;
  return { processingCents, billingCents, totalCents: processingCents + billingCents };
}
