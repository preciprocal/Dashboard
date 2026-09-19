// lib/config/refund.ts
// Terms of the money-back guarantee, in one place so the enforced policy and
// the advertised policy cannot drift apart again.
//
// They HAD drifted, three ways: the app advertised 7-day (pricing trust row,
// help FAQ #57), 30-day (pricing hero and trust signals) and 60-day (the
// Chrome extension manifest, which is also the public Web Store listing)
// simultaneously, with no code enforcing any of them - refunds were handled
// entirely by hand. 30 days is the real policy and all four now say so.
//
// If this constant changes, those four strings have to change with it:
//   app/(root)/pricing/page.tsx  (hero + trust row + trust signals)
//   app/(root)/help/page.tsx     (FAQ #57)
//   extension/manifest.json      (needs a Web Store resubmission to go live)

export const REFUND_WINDOW_DAYS = 30;

/**
 * Usage share, in any single quota category, above which a request is routed
 * to human review instead of being auto-approved.
 *
 * 80% is a judgement call, not a derived number. The intent is to catch
 * "used the whole month's allowance, then asked for the money back" while
 * leaving genuine early-abandonment refunds untouched. Tune it once there is
 * real data in refund_requests.max_usage_pct showing where actual claims land.
 */
export const HIGH_USAGE_THRESHOLD_PCT = 80;

/**
 * Mock-interview usage share a period must EXCEED for a refund to be available
 * at all. Below this the request is ineligible regardless of how little of
 * every other category was consumed.
 *
 * This is deliberately not a satisfaction guarantee. The rule is "prove you
 * engaged with the core feature before claiming it did not work for you", so a
 * zero-usage account is denied by design rather than by oversight. Note the
 * consequence: interviews carry the largest per-unit cost in
 * lib/config/feature-costs.ts and dominate the allowance value, so any request
 * that clears this gate has already consumed most of what the subscription is
 * worth. Refunds therefore cap out around 40% of the period price. Intended.
 *
 * Strictly greater than, not >=: "above 50%" in the policy means 51% and up.
 */
export const INTERVIEW_ELIGIBILITY_THRESHOLD_PCT = 50;

/** Feature the eligibility gate keys on. */
export const ELIGIBILITY_GATE_FEATURE = 'interviews' as const;

/**
 * Fallback Stripe fee model, used only when the real figure cannot be read off
 * the charge's balance transaction. Standard US card pricing.
 *
 * Prefer the real number: promotional rates, international cards and disputes
 * all move it, and this refund is calculated to the cent.
 */
export const STRIPE_FEE_PERCENT = 0.029;
export const STRIPE_FEE_FIXED_CENTS = 30;

/** Stripe's fee on a charge, in cents, from the standard model. */
export function estimateStripeFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * STRIPE_FEE_PERCENT) + STRIPE_FEE_FIXED_CENTS;
}

/**
 * Unlimited categories (limit = -1) can't produce a percentage, so they are
 * excluded from the threshold check entirely rather than counted as 0% - a
 * Premium user with unlimited cover letters shouldn't have that category
 * dilute their maximum. Documented here because it is easy to misread the
 * snapshot as "every category was under threshold".
 */
export const REFUND_STATUSES = {
  pending:  'pending',
  flagged:  'flagged',
  approved: 'approved',
  denied:   'denied',
  refunded: 'refunded',
} as const;

export type RefundStatus = (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES];
