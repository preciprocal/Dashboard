// lib/config/plan-prices.ts
// What each plan costs per billing period, in cents.
//
// Needed by the refund proration, which has to know what the user actually
// paid before it can return a share of it.
//
// This is a FIFTH copy of plan pricing information in this repo, and it exists
// under protest. The existing four are all price-id-to-plan maps rather than
// plan-to-amount, so none of them answers this question:
//
//   app/api/webhooks/stripe/route.ts     getPlanFromPriceId  (unknown -> 'free')
//   app/api/subscription/activate/route.ts  PRICE_TO_PLAN    (unknown -> 'pro')
//   app/(root)/pricing/page.tsx          PRICE_IDS + hardcoded display strings
//   components/StripePaymentForm.tsx     (dead code, never imported)
//
// Note those first two disagree: the same unknown price id resolves to a
// different plan depending on which path runs. Consolidating all five behind
// one module is worth doing, but it touches the live billing path and belongs
// in its own change rather than riding along with the refund work.
//
// The authoritative amount is on the Stripe invoice. Prefer reading it from
// there when the charge is available; these are the fallback for quoting a
// refund before any Stripe call is made.

import type { PlanLimits } from "@/lib/config/usage-limits";

/** Monthly price in cents, by resolved plan key. */
export const PLAN_PRICE_CENTS: Record<keyof PlanLimits, number> = {
  free: 0,
  pro: 999,
  premium: 2499,
  // Grandfathered Premium subscribers pay the same price; only their quotas
  // differ. Refunds must prorate against what they actually paid.
  premium_legacy: 2499,
  // Not purchasable. Present so the Record stays exhaustive and adding a plan
  // without a price is a compile error rather than an undefined at runtime.
  admin: 0,
};

/** Plans a refund can apply to at all. */
export const REFUNDABLE_PLANS: readonly (keyof PlanLimits)[] = [
  "pro",
  "premium",
  "premium_legacy",
] as const;

export function isRefundablePlan(key: keyof PlanLimits): boolean {
  return REFUNDABLE_PLANS.includes(key);
}
