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
  FIRST_REFUND_WINDOW_DAYS,
  FIRST_REFUND_MAX_PLAN_USED_PCT,
  FIRST_REFUND_MAX_FEATURE_USED_PCT,
  UNUSED_REFUND_EVERY_DAYS,
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
      // Version 3: unused-credits refunds any time in the billing month, plus
      // the first-payment full refund. v2 had only the first-payment refund;
      // v1 was the usage-gated prorated refund.
      version: 3,
      windowDays: FIRST_REFUND_WINDOW_DAYS,
      onRequestOnly: true,
      eligibility: {
        firstPaymentOnly: true,
        maxPlanUsedPct: FIRST_REFUND_MAX_PLAN_USED_PCT,
        maxFeatureUsedPct: FIRST_REFUND_MAX_FEATURE_USED_PCT,
        measuredBy: 'cost_weighted_share_of_plan',
        oncePerCustomer: true,
        onRequestOnly: true,
        summary:
          `In your first ${FIRST_REFUND_WINDOW_DAYS} days, if you have used less than ` +
          `${FIRST_REFUND_MAX_PLAN_USED_PCT}% of your plan and no feature more than ` +
          `${FIRST_REFUND_MAX_FEATURE_USED_PCT}%, your whole first payment back.`,
      },
      unusedCredits: {
        availableDuring: 'current_billing_month',
        previousMonthsRefundable: false,
        measuredBy: 'cost_weighted_share_of_plan',
        retainsProcessingFee: false,
        everyMonths: Math.round(UNUSED_REFUND_EVERY_DAYS / 30),
        endsPlan: true,
        summary:
          'Any time in your billing month, on request, a refund of the part of that ' +
          "month's payment you have not used, with no card fee deducted. Once every " +
          `${Math.round(UNUSED_REFUND_EVERY_DAYS / 30)} months.`,
      },
      calculation: {
        method: 'full_first_payment_or_unused_share',
        retainsProcessingFee: false,
        summary: "Either the whole first payment, or the unused share of this month's payment.",
      },
      processing: {
        automaticApproval: true,
        humanReviewed: false,
        payoutBusinessDays: '5-10',
      },
      packs: { windowDays: 7, unusedOnly: true, fullRefund: true },

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
