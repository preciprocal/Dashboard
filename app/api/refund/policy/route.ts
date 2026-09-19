// app/api/refund/policy/route.ts
// The refund policy, as enforced, in machine-readable form.
//
// Task 2 item 5. This is a CONTRACT with the landing-page codebase: a separate
// session builds the pricing FAQ and policy copy against this shape. Treat the
// field names as public API. Add fields freely; renaming or removing one
// breaks the other repo silently, because nothing type-checks across the two.
//
// It exists because this exact drift already happened once. Before
// lib/config/refund.ts, the app advertised a 7-day guarantee in the pricing
// trust row, 30-day in the pricing hero, and 60-day in the Chrome extension
// manifest, with no code enforcing any of them. Serving the numbers from the
// same constants the gate reads is the only way that stays fixed.
//
// Public and uncached-by-user: contains no account data, only policy terms.
import { NextResponse } from 'next/server';
import {
  REFUND_WINDOW_DAYS,
  INTERVIEW_ELIGIBILITY_THRESHOLD_PCT,
  STRIPE_FEE_PERCENT,
  STRIPE_FEE_FIXED_CENTS,
} from '@/lib/config/refund';
import { FEATURE_COSTS, PROVISIONAL_COSTS } from '@/lib/config/feature-costs';
import { REFUNDABLE_PLANS, PLAN_PRICE_CENTS } from '@/lib/config/plan-prices';

export const runtime = 'nodejs';
// Policy changes with a deploy, not with a request. Cached hard, with
// stale-while-revalidate so a deploy propagates without a cold edge miss.
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(
    {
      version: 1,

      windowDays: REFUND_WINDOW_DAYS,

      eligibility: {
        // The single most misread part of this policy. It is NOT a
        // satisfaction guarantee: using nothing makes you ineligible.
        // Marketing copy that says "money back, no questions asked" would be
        // materially false.
        gateFeature: 'mock_interviews',
        thresholdPct: INTERVIEW_ELIGIBILITY_THRESHOLD_PCT,
        comparison: 'greater_than',
        measuredBy: 'count',
        perBillingPeriod: true,
        zeroUsageEligible: false,
        summary:
          `Refunds are available once you have used more than ` +
          `${INTERVIEW_ELIGIBILITY_THRESHOLD_PCT}% of your mock interviews for the ` +
          `current billing period. Using little or none of your plan does not qualify.`,
      },

      calculation: {
        method: 'prorated_by_unused_cost_value',
        // Weighted by per-feature cost, not by unit count, because the units
        // are not comparable - one mock interview is worth roughly 85 cover
        // letters.
        weighting: 'per_feature_cost',
        unlimitedCategoriesExcluded: true,
        retainsProcessingFee: true,
        summary:
          'We refund the share of your payment matching the value of the allowance ' +
          'you did not use, less the payment processing fee.',
      },

      processing: {
        // Stated plainly so the landing page cannot imply an instant refund.
        automaticApproval: false,
        humanReviewed: true,
        reviewSlaBusinessDays: 2,
        payoutBusinessDays: '5-7',
      },

      fee: {
        percent: STRIPE_FEE_PERCENT,
        fixedCents: STRIPE_FEE_FIXED_CENTS,
        note: 'Fallback model. The actual fee retained is the one Stripe charged on the original payment.',
      },

      plans: Object.fromEntries(
        REFUNDABLE_PLANS.map((p) => [p, { priceCents: PLAN_PRICE_CENTS[p] }]),
      ),

      featureCosts: {
        usd: FEATURE_COSTS,
        // Surfaced so the landing page never presents an unverified figure as
        // measured. `interviews` in particular is an estimate - nothing in the
        // app records real per-call Vapi cost yet.
        provisional: PROVISIONAL_COSTS,
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
