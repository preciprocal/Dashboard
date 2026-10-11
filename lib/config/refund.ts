// lib/config/refund.ts
// The refund policy's terms, in one place so the enforced policy and every
// place that describes it cannot drift apart.
//
// If these change, the descriptions have to change with them:
//   app/(root)/pricing/page.tsx    (hero + trust badges)
//   app/(root)/help/page.tsx       (refund FAQ)
//   app/api/refund/policy/route.ts (machine-readable, read by the landing page)

/** Window of the pre-0049 prorated policy, still used to decide queued requests. */
export const REFUND_WINDOW_DAYS = 30;

// ─── The refund policy, as of migration 0049 ────────────────────────────────
//
//   1. A full refund of a customer's FIRST payment, on request, within
//      FIRST_REFUND_WINDOW_DAYS of paying, if they used less than
//      FIRST_REFUND_MAX_PLAN_USED_PCT of the plan. Processed instantly by
//      lib/refund/first-payment.ts, once per account, card and device.
//   2. Otherwise, at any point in the current billing month: a refund of the
//      unused part of THIS month's payment, weighted by what each feature
//      costs, with no card fee deducted. Processed instantly by
//      lib/refund/unused-credits.ts; the plan ends. Once every
//      UNUSED_REFUND_EVERY_DAYS per account, card and device.
//   3. Last month's payment cannot be refunded once a new month starts.
//
// Every refund is on request. Nothing is ever refunded automatically.
//
// The prorated, usage-gated constants below are kept only so requests already
// in the admin queue from before 0049 can still be decided.

/** Days after the first payment in which the full refund can be requested. */
export const FIRST_REFUND_WINDOW_DAYS = 7;

/**
 * How much of the plan can have been used and still get the full refund, as a
 * share of the plan's value: every feature counts, each weighted by what it
 * costs us to provide (lib/refund/proration.ts, lib/config/feature-costs.ts).
 *
 * Counting mock interviews alone let someone use every other feature in full
 * and still get everything back (35% of a Pro plan's value, 42% of Premium).
 * The Free plan is where people try the product; this refund is for a
 * purchase made by mistake or regretted straight away, so the bar is
 * "essentially unused". For scale: one mock interview is 22% of Pro and 12%
 * of Premium; all resumes and cover letters with no interviews is 12-14%.
 */
export const FIRST_REFUND_MAX_PLAN_USED_PCT = 10;

/**
 * And no single feature may be more than this far through its monthly
 * allowance. The value share above weights by cost, and the cheap features
 * barely move it: half of all resumes and cover letters is only 6% of a Pro
 * plan's value. This catches "used half or more of something" directly.
 */
export const FIRST_REFUND_MAX_FEATURE_USED_PCT = 50;

/**
 * How often one person can get an unused-credits refund. Six months is
 * generous for genuine cases and stops subscribe, use a little, refund,
 * repeat from turning the plan into pay-per-use. Any refund counts.
 */
export const UNUSED_REFUND_EVERY_DAYS = 183;

/** Below this there is nothing meaningful left to refund. */
export const UNUSED_REFUND_MIN_CENTS = 50;

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
