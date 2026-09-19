// lib/refund/proration.ts
// Value-weighted proration for the usage-gated refund.
//
// Deliberately pure: no database, no Stripe, no clock. Everything it needs is
// passed in, so the arithmetic can be reasoned about and tested on its own.
// The side-effectful parts (reading counters, fetching the real Stripe fee,
// issuing the refund) live in the route and the admin queue.
//
// The model, in one line: refund the share of the period price corresponding to
// the COST VALUE of the allowance the user did not consume.
//
//   allowanceValue(f) = limit(f)             x cost(f)
//   unusedValue(f)    = max(0, limit - used) x cost(f)
//   unusedShare       = SUM(unusedValue) / SUM(allowanceValue)
//   gross             = amountPaid x unusedShare
//   net               = max(0, gross - stripeFee)
//
// Weighting by cost rather than by unit count matters because the units are not
// comparable: one unconsumed mock interview is worth roughly 85 unconsumed
// cover letters. A naive "percent of units unused" average would let someone
// who burned every interview but no cover letters look barely used.
//
// Excluded from BOTH sums:
//   - unlimited categories (limit -1), which have no finite value to prorate
//     and would otherwise divide by infinity
//   - zero-cost categories (interviewDebriefs, jobTracker), which contribute
//     nothing either way; refunding for unused free actions would be
//     arbitrary. They fall out naturally rather than being special-cased.

import { FEATURE_COSTS } from "@/lib/config/feature-costs";
import type { FeatureType, UsageLimits } from "@/lib/config/usage-limits";
import type { UsageSnapshot } from "@/lib/refund/eligibility";

export interface ProrationLine {
  feature: FeatureType;
  limit: number;
  used: number;
  unitCostUsd: number;
  allowanceValueUsd: number;
  unusedValueUsd: number;
}

export interface ProrationResult {
  /** Per-feature breakdown, for the admin queue and the user-facing preview. */
  lines: ProrationLine[];
  totalAllowanceValueUsd: number;
  totalUnusedValueUsd: number;
  /** 0..1. Null when nothing on this plan can be costed. */
  unusedShare: number | null;
  amountPaidCents: number;
  grossRefundCents: number;
  stripeFeeCents: number;
  /** What to actually pass to Stripe. Never negative, never above amountPaid. */
  netRefundCents: number;
}

/**
 * @param snapshot        frozen usage for the period
 * @param limits          the plan's limits (already resolved, including legacy)
 * @param amountPaidCents what the user actually paid for THIS period
 * @param stripeFeeCents  real fee where known, else estimateStripeFeeCents()
 */
export function prorateRefund(
  snapshot: UsageSnapshot,
  limits: UsageLimits,
  amountPaidCents: number,
  stripeFeeCents: number,
): ProrationResult {
  const lines: ProrationLine[] = [];
  let totalAllowanceValueUsd = 0;
  let totalUnusedValueUsd = 0;

  for (const [feature, cost] of Object.entries(FEATURE_COSTS) as [FeatureType, number][]) {
    const limit = limits[feature];
    const used = snapshot[feature]?.used ?? 0;

    // Unlimited or free: contributes to neither side. See header.
    if (limit < 0 || cost <= 0) continue;

    const allowanceValueUsd = limit * cost;
    const unusedValueUsd = Math.max(0, limit - used) * cost;

    totalAllowanceValueUsd += allowanceValueUsd;
    totalUnusedValueUsd += unusedValueUsd;

    lines.push({
      feature,
      limit,
      used,
      unitCostUsd: cost,
      allowanceValueUsd: round4(allowanceValueUsd),
      unusedValueUsd: round4(unusedValueUsd),
    });
  }

  // Largest value first, so the admin queue leads with what actually moved the
  // number rather than with alphabetical noise.
  lines.sort((a, b) => b.allowanceValueUsd - a.allowanceValueUsd);

  const unusedShare =
    totalAllowanceValueUsd > 0 ? totalUnusedValueUsd / totalAllowanceValueUsd : null;

  const grossRefundCents =
    unusedShare === null ? 0 : Math.round(amountPaidCents * unusedShare);

  // Clamp twice: never negative after the fee, and never more than was paid.
  // The second clamp is defensive rather than reachable - unusedShare cannot
  // exceed 1 - but a bad cost table or a future unlimited-handling change
  // should not be able to over-refund a real card.
  const netRefundCents = Math.max(
    0,
    Math.min(amountPaidCents, grossRefundCents - stripeFeeCents),
  );

  return {
    lines,
    totalAllowanceValueUsd: round4(totalAllowanceValueUsd),
    totalUnusedValueUsd: round4(totalUnusedValueUsd),
    unusedShare: unusedShare === null ? null : round4(unusedShare),
    amountPaidCents,
    grossRefundCents,
    stripeFeeCents,
    netRefundCents,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Cents to a display string, e.g. 332 -> "$3.32". */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
