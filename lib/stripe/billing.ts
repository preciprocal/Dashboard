// lib/stripe/billing.ts
// Shared pieces for the in-app billing pages (Settings > Plan & Billing and
// /billing/invoice/[id]), which replace Stripe's hosted customer portal.
//
// The rule every billing route follows: the Stripe customer comes from the
// caller's own subscriptions row, never from the request. An invoice, card or
// subscription id in a request is only acted on after checking it belongs to
// that customer. Two routes that skipped this (the old portal and cancel
// endpoints) let any signed-in user reach any customer's billing.

import Stripe from 'stripe';
import { supabaseAdmin } from '@/supabase/admin';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export interface BillingContext {
  customerId: string | null;
  subscriptionId: string | null;
}

export async function billingContext(supabaseUserId: string): Promise<BillingContext> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return {
    customerId: (data?.stripe_customer_id as string | null) ?? null,
    subscriptionId: (data?.stripe_subscription_id as string | null) ?? null,
  };
}

/** The invoice, only if it belongs to this customer. Null otherwise, so callers answer 404. */
export async function ownedInvoice(invoiceId: string, customerId: string | null): Promise<Stripe.Invoice | null> {
  if (!customerId || !/^in_[A-Za-z0-9]+$/.test(invoiceId)) return null;
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const owner = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    return owner === customerId ? invoice : null;
  } catch {
    return null;
  }
}

export interface CardSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** The card future payments use: the subscription's default, else the customer's. */
export async function defaultCard(customerId: string, subscriptionId: string | null): Promise<CardSummary | null> {
  let pmId: string | null = null;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      pmId = typeof sub.default_payment_method === 'string' ? sub.default_payment_method : sub.default_payment_method?.id ?? null;
    } catch { /* fall through to the customer default */ }
  }
  if (!pmId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer && customer.deleted)) {
      const d = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
      pmId = typeof d === 'string' ? d : d?.id ?? null;
    }
  }
  if (!pmId) return null;
  const pm = await stripe.paymentMethods.retrieve(pmId);
  if (!pm.card) return null;
  return { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
}

/** Display form, e.g. "Visa ending 4242". */
export function cardLabel(c: CardSummary): string {
  const brand = c.brand === 'amex' ? 'Amex' : c.brand.charAt(0).toUpperCase() + c.brand.slice(1);
  return `${brand} ending ${c.last4}`;
}

export function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}
