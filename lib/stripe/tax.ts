// lib/stripe/tax.ts
// Sales tax and VAT, calculated by Stripe Tax on every payment: subscriptions,
// the student trial, credit packs, and the invoices that follow.
//
// ─── How it behaves ─────────────────────────────────────────────────────────
// Prices are tax-INCLUSIVE (Stripe Tax default tax behavior, set in the
// dashboard): a customer always pays exactly the listed price, and where tax
// applies it is carried inside that price. That is also what EU and UK rules
// require for prices shown to consumers.
//
// Stripe only charges tax where the business is registered. With no
// registrations it calculates $0 everywhere, so switching this on changes no
// amount. Adding a registration in the Stripe dashboard (say UK VAT) starts
// collecting there with no code change.
//
// ─── The switch ─────────────────────────────────────────────────────────────
// STRIPE_AUTOMATIC_TAX=true turns it on. Off by default because Stripe refuses
// automatic_tax until Stripe Tax is activated (head office address saved in
// Settings > Tax); turning it on first would make checkout fail.
//
// Stripe Tax needs to know where the customer is, so every subscription path
// records it first (ensureTaxLocation), from the billing country and postcode
// and, failing that, the customer's IP address.

import type Stripe from 'stripe';

export function automaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX === 'true';
}

/** Spread into subscriptions.create / checkout.sessions.create. Empty when off. */
export function automaticTaxParams(): { automatic_tax?: { enabled: true } } {
  return automaticTaxEnabled() ? { automatic_tax: { enabled: true } } : {};
}

function cleanIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const first = ip.split(',')[0].trim();
  // Local and private addresses tell Stripe nothing about where someone is.
  if (!first || first === '::1' || first.startsWith('127.') || first.startsWith('10.') || first.startsWith('192.168.')) return undefined;
  return first;
}

/**
 * Give Stripe what it needs to place the customer, without overwriting a
 * fuller address it already holds. Never throws: a customer Stripe cannot
 * place is reported by Stripe when the subscription is created, which is the
 * moment the caller can tell the user.
 */
export async function ensureTaxLocation(
  stripe: Stripe,
  customerId: string,
  hints: { country?: string | null; postalCode?: string | null; ip?: string | null; paymentMethod?: Stripe.PaymentMethod | null },
): Promise<void> {
  if (!automaticTaxEnabled()) return;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ('deleted' in customer && customer.deleted) return;
    const existing = (customer as Stripe.Customer).address;

    const fromCard = hints.paymentMethod?.billing_details?.address;
    const country = hints.country || fromCard?.country || existing?.country || undefined;
    const postal = hints.postalCode || fromCard?.postal_code || existing?.postal_code || undefined;
    const ip = cleanIp(hints.ip);

    const update: Stripe.CustomerUpdateParams = {};
    // A postcode Stripe does not have yet is worth writing even when the
    // country is unchanged: US and Canadian tax needs it.
    const newPostal = !!postal && postal !== existing?.postal_code;
    if (country && (!existing?.country || hints.country || newPostal)) {
      update.address = { ...(existing ?? {}), country, ...(postal ? { postal_code: postal } : {}) } as Stripe.AddressParam;
    }
    if (ip) update.tax = { ip_address: ip };
    if (Object.keys(update).length) await stripe.customers.update(customerId, update);
  } catch (err) {
    console.error('⚠️ could not record tax location for', customerId, err);
  }
}
