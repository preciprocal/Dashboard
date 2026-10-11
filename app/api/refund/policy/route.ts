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
      // Version 2: the first-payment refund (migration 0049). Version 1 was
      // the usage-gated prorated refund, which refused light users.
      version: 2,
      windowDays: FIRST_REFUND_WINDOW_DAYS,
      eligibility: {
        firstPaymentOnly: true,
        // Share of the plan's value used, across every feature, each weighted
        // by what it costs to provide.
        maxPlanUsedPct: FIRST_REFUND_MAX_PLAN_USED_PCT,
        measuredBy: 'cost_weighted_share_of_plan',
        oncePerCustomer: true,
        onRequestOnly: true,
        summary:
          `A full refund of your first payment, on request, within ${FIRST_REFUND_WINDOW_DAYS} days ` +
          `of paying, if you have used less than ${FIRST_REFUND_MAX_PLAN_USED_PCT}% of your plan. ` +
          'Once per customer. The Free plan is there to try Preciprocal first.',
      },
      calculation: {
        method: 'full_refund_of_first_payment',
        retainsProcessingFee: false,
        summary: 'The whole first payment is refunded.',
      },
      afterWindow: {
        partialRefunds: false,
        cancelAnytime: true,
        accessUntilPeriodEnd: true,
        summary:
          'After that, you can cancel any time and keep your plan until the end of the month ' +
          'you paid for. Payments are not refunded, and nothing is refunded unless you ask.',
      },
      processing: {
        // On request only; when the conditions are met it is processed at once.
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
