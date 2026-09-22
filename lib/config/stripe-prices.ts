// lib/config/stripe-prices.ts
// The single mapping between Stripe Price ids and plans.
//
// ─── Why this file exists ───────────────────────────────────────────────────
//
// There were four copies of this data, and two of them disagreed about the
// most important case. Given a price id absent from the map:
//
//   app/api/webhooks/stripe/route.ts   defaulted to "free"
//   app/api/subscription/activate      defaulted to "pro"
//
// So the same unmapped price produced opposite outcomes depending on which
// code path ran first. A new Stripe product, a renamed price, a test price
// leaking into production - any of those would silently grant Pro on one path
// and downgrade the same customer to free on the other, with only a console
// warning. That is a billing correctness bug, not a tidiness problem.
//
// ─── The rule here ──────────────────────────────────────────────────────────
//
// planFromPriceId() returns null for anything it does not recognise. It does
// NOT guess. Callers decide what an unknown price means in their context, and
// they now have to decide explicitly rather than inheriting whichever default
// their file happened to have.
//
// Env-overridable per entry so a test-mode catalog can be pointed at without a
// code change, falling back to the live ids that were previously hardcoded in
// four places.

export type PaidPlan = "pro" | "premium";
export type CatalogPlan = "free" | PaidPlan;

/**
 * Monthly only. Annual was removed as a product.
 *
 * Kept as a named type with one member rather than deleted outright, because
 * `cycle` is written into Stripe subscription metadata and read back by the
 * webhook. A union of one keeps those call sites honest and makes re-adding a
 * cycle a type change rather than a search for every string literal.
 *
 * The two annual Price objects did not exist in the test-mode account at all -
 * verify:price-catalog flagged both as unresolvable - so annual checkout would
 * have failed outright had anyone reached it.
 */
export type BillingCycle = "monthly";

interface PriceEntry {
  plan: CatalogPlan;
  cycle: BillingCycle;
  /** Display amount in cents. The invoice is authoritative; this is for UI. */
  amountCents: number;
}

const id = (envVar: string, fallback: string) => process.env[envVar] ?? fallback;

/** Price id -> what it means. The only copy of this mapping. */
export const PRICE_CATALOG: Record<string, PriceEntry> = {
  [id("STRIPE_FREE_PRICE_ID", "price_1TFjvAQSkS83MGF9XlLXgu5H")]: {
    plan: "free", cycle: "monthly", amountCents: 0,
  },
  [id("STRIPE_PRO_MONTHLY_PRICE_ID", "price_1TFjwCQSkS83MGF9xH1bdc1o")]: {
    plan: "pro", cycle: "monthly", amountCents: 999,
  },
  [id("STRIPE_PREMIUM_MONTHLY_PRICE_ID", "price_1TFjzWQSkS83MGF9YCP7CBk3")]: {
    plan: "premium", cycle: "monthly", amountCents: 2499,
  },
  // The pro and premium ANNUAL entries were removed with the annual product.
  // Their price ids did not resolve in the test-mode Stripe account anyway.
  //
  // If an old subscription is still on one of them, planFromPriceId returns
  // null and the two callers diverge on purpose - activate keeps them paid,
  // the webhook does not grant. Check for live annual subscriptions before
  // assuming that is theoretical: at the time of removal the account had one
  // subscription total, cancelled, on pro monthly.
};

/**
 * Plan for a Stripe price id, or null if unrecognised.
 *
 * Returning null rather than a default is the whole point of this module.
 * Callers must handle the unknown case deliberately - see the call sites in
 * the Stripe webhook and subscription/activate, which now agree.
 */
export function planFromPriceId(priceId: string | null | undefined): CatalogPlan | null {
  if (!priceId) return null;
  return PRICE_CATALOG[priceId]?.plan ?? null;
}

/** Full catalog entry for a price id, or null. */
export function priceEntry(priceId: string | null | undefined): PriceEntry | null {
  if (!priceId) return null;
  return PRICE_CATALOG[priceId] ?? null;
}

/** Price id for a plan and cycle, or null if that combination is not sold. */
export function priceIdFor(plan: PaidPlan, cycle: BillingCycle): string | null {
  const found = Object.entries(PRICE_CATALOG).find(
    ([, e]) => e.plan === plan && e.cycle === cycle,
  );
  return found?.[0] ?? null;
}

/**
 * Log an unrecognised price id consistently wherever one shows up.
 *
 * Worth a single helper because the two original call sites logged it
 * differently and then silently diverged on what to do about it. Now they log
 * the same way and each states its own fallback at the call site, where it is
 * visible in review.
 */
export function warnUnknownPrice(priceId: string | null | undefined, context: string, fallback: string) {
  console.warn(
    `⚠️ Unknown Stripe price id "${priceId ?? "(none)"}" in ${context}. ` +
    `Falling back to "${fallback}". If this is a real product, add it to ` +
    `lib/config/stripe-prices.ts - an unmapped price is how a customer ends up ` +
    `on the wrong plan.`,
  );
}
