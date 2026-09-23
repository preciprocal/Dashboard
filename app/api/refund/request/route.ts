// app/api/refund/request/route.ts
// User-facing refund request under the usage-gated policy.
//
// GET  - preview. Returns eligibility and, when eligible, the exact amount.
//        Reads only; creates nothing. Task 2 requires the user sees the figure
//        before they confirm, and requires a clear reason when they cannot.
// POST - submit. Freezes the quote and queues it for a human.
//
// What this route does NOT do: move money. Every request, eligible or not,
// lands in the admin queue and the Stripe refund is issued there. Nothing
// auto-approves. That is deliberate under the new policy, not caution left
// over from the old one: the gate now REQUIRES heavy usage to qualify, so the
// requests reaching this route are exactly the ones worth a human glance.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { flagAccount } from '@/lib/abuse/flag-account';
import { FLAG_REASONS } from '@/lib/config/abuse-guard';
import {
  buildUsageSnapshot,
  evaluateEligibility,
  explainIneligibility,
  isWithinRefundWindow,
} from '@/lib/refund/eligibility';
import { prorateRefund } from '@/lib/refund/proration';
import {
  REFUND_STATUSES,
  REFUND_WINDOW_DAYS,
  HIGH_USAGE_THRESHOLD_PCT,
  INTERVIEW_ELIGIBILITY_THRESHOLD_PCT,
  estimateStripeFeeCents,
} from '@/lib/config/refund';
import { PLAN_PRICE_CENTS, isRefundablePlan } from '@/lib/config/plan-prices';
import { USAGE_LIMITS, resolvePlanKey } from '@/lib/config/usage-limits';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  reason: z.string().max(2000).optional(),
  /** Echo of the figure the user was shown, so a moved quote is caught. */
  acknowledgedCents: z.number().int().nonnegative().optional(),
});

// Explicit row type + cast. Supabase's generic can only infer columns from a
// single string literal, so a concatenated select() degrades every field to
// GenericStringError.
interface SubscriptionRow {
  plan: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  subscription_started_at: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
}

type Assessment =
  | { ok: false; status: number; error: string; code: string }
  | {
      ok: true;
      sub: SubscriptionRow;
      planKey: ReturnType<typeof resolvePlanKey>;
      periodStart: string;
      snapshot: Awaited<ReturnType<typeof buildUsageSnapshot>>['snapshot'];
      maxUsagePct: number | null;
      maxUsageFeature: string | null;
      eligibility: ReturnType<typeof evaluateEligibility>;
      proration: ReturnType<typeof prorateRefund>;
    };

/**
 * Everything both GET and POST need, computed once.
 *
 * Shared rather than duplicated because a preview that disagrees with the
 * submit it precedes is worse than having no preview: the user would agree to
 * one number and be recorded as claiming another.
 */
async function assess(supabaseUserId: string): Promise<Assessment> {
  const { data: subData, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select(
      'plan, status, stripe_subscription_id, stripe_customer_id, ' +
      'current_period_start, subscription_started_at, current_period_end, last_payment_at',
    )
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  if (subError) throw subError;
  const sub = subData as SubscriptionRow | null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('created_at, is_admin')
    .eq('user_id', supabaseUserId)
    .maybeSingle();

  const planKey = resolvePlanKey(sub?.plan, {
    isAdmin: profile?.is_admin === true,
  });

  if (!sub || !isRefundablePlan(planKey)) {
    return {
      ok: false, status: 400, code: 'not_a_paid_plan',
      error: 'Refunds apply to paid Pro and Premium subscriptions.',
    };
  }

  // Refund WINDOW anchors on when they paid. The USAGE period anchors on
  // pickAnchor, which is a different question - "which counter row are they
  // in" rather than "when did money change hands". Conflating them would read
  // a period with no counter row and report zero usage, which under the new
  // gate would deny every genuine claim rather than approve it.
  const windowAnchor = sub.current_period_start ?? sub.last_payment_at;
  if (!isWithinRefundWindow(windowAnchor)) {
    return {
      ok: false, status: 400, code: 'outside_window',
      error:
        `The ${REFUND_WINDOW_DAYS}-day refund window has closed for this billing period. ` +
        'Email support@preciprocal.com if you think that is wrong.',
    };
  }

  const { periodStart } = computeUsagePeriod(
    pickAnchor(sub.subscription_started_at, sub.current_period_start, profile?.created_at as string | undefined),
  );

  const { snapshot, maxUsagePct, maxUsageFeature } = await buildUsageSnapshot(
    supabaseUserId,
    sub.plan ?? 'free',
    periodStart,
    { isAdmin: profile?.is_admin === true },
  );

  const eligibility = evaluateEligibility(snapshot, maxUsagePct, maxUsageFeature);

  const amountPaidCents = PLAN_PRICE_CENTS[planKey];
  const proration = prorateRefund(
    snapshot,
    USAGE_LIMITS[planKey],
    amountPaidCents,
    estimateStripeFeeCents(amountPaidCents),
    planKey,
  );

  return {
    ok: true, sub, planKey, periodStart,
    snapshot, maxUsagePct, maxUsageFeature, eligibility, proration,
  };
}

// ─── GET: preview, creates nothing ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { supabaseUserId } = authedUser;

    const a = await assess(supabaseUserId);
    if (!a.ok) {
      return NextResponse.json({ eligible: false, code: a.code, reason: a.error }, { status: 200 });
    }

    const { data: existing } = await supabaseAdmin
      .from('refund_requests')
      .select('id, status, created_at')
      .eq('user_id', supabaseUserId)
      .eq('billing_period_start', a.sub.current_period_start ?? a.periodStart)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        eligible: false, code: 'already_claimed',
        reason: 'You have already requested a refund for this billing period.',
        existingRequest: { id: existing.id, status: existing.status, createdAt: existing.created_at },
      });
    }

    if (!a.eligibility.eligible) {
      return NextResponse.json({
        eligible: false,
        code: a.eligibility.ineligibleReason,
        // Explains rather than denies silently, per Task 2 item 1.
        reason: explainIneligibility(
          a.eligibility.ineligibleReason!,
          a.eligibility.interviewUsagePct,
          USAGE_LIMITS[a.planKey].interviews,
        ),
        interviewUsagePct: a.eligibility.interviewUsagePct,
        thresholdPct: INTERVIEW_ELIGIBILITY_THRESHOLD_PCT,
      });
    }

    return NextResponse.json({
      eligible: true,
      plan: a.planKey,
      amountPaidCents: a.proration.amountPaidCents,
      refundCents: a.proration.netRefundCents,
      grossCents: a.proration.grossRefundCents,
      feeCents: a.proration.stripeFeeCents,
      unusedShare: a.proration.unusedShare,
      lines: a.proration.lines,
      interviewUsagePct: a.eligibility.interviewUsagePct,
      // Every request goes to a person. Said plainly here so the confirm step
      // does not imply the money moves on submit.
      note: 'Refund requests are reviewed by a person before any money is returned.',
    });
  } catch (err) {
    console.error('❌ refund preview error:', err);
    return NextResponse.json({ error: 'Could not check your refund eligibility.' }, { status: 500 });
  }
}

// ─── POST: submit ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const a = await assess(supabaseUserId);
    if (!a.ok) return NextResponse.json({ error: a.error, code: a.code }, { status: a.status });

    if (!a.eligibility.eligible) {
      return NextResponse.json(
        {
          error: explainIneligibility(
            a.eligibility.ineligibleReason!,
            a.eligibility.interviewUsagePct,
            USAGE_LIMITS[a.planKey].interviews,
          ),
          code: a.eligibility.ineligibleReason,
          interviewUsagePct: a.eligibility.interviewUsagePct,
          thresholdPct: INTERVIEW_ELIGIBILITY_THRESHOLD_PCT,
        },
        { status: 403 },
      );
    }

    // If the user was quoted a figure and usage moved between preview and
    // submit, stop rather than silently recording a different number than the
    // one they agreed to.
    const quoted = a.proration.netRefundCents;
    if (
      parsed.data.acknowledgedCents !== undefined &&
      parsed.data.acknowledgedCents !== quoted
    ) {
      return NextResponse.json(
        {
          error: 'Your usage changed since this amount was calculated. Please review the new figure.',
          code: 'quote_stale',
          refundCents: quoted,
        },
        { status: 409 },
      );
    }

    // Always queued, never auto-approved. `flagged` only sorts the queue.
    const status = a.eligibility.needsReview
      ? REFUND_STATUSES.flagged
      : REFUND_STATUSES.pending;

    const { data: requestId, error: claimError } = await supabaseAdmin.rpc('claim_period_refund', {
      p_user_id: supabaseUserId,
      p_billing_period_start: a.sub.current_period_start ?? a.periodStart,
      p_billing_period_end: a.sub.current_period_end,
      p_stripe_subscription_id: a.sub.stripe_subscription_id,
      p_stripe_customer_id: a.sub.stripe_customer_id,
      p_usage_snapshot: a.snapshot,
      p_max_usage_pct: a.maxUsagePct,
      p_status: status,
      p_user_reason: parsed.data.reason ?? null,
    });
    if (claimError) throw claimError;

    if (!requestId) {
      // claim_period_refund returns null for two different reasons, and they
      // need different messages. refund_requests_period_key means this period
      // is already claimed; refund_requests_open_key (from 0024) means an
      // earlier request is still open, which blocks a NEW period too. Reporting
      // "already claimed for this period" in the second case is simply wrong -
      // the user is looking at a period they have never claimed.
      const { data: open } = await supabaseAdmin
        .from('refund_requests')
        .select('id, status, billing_period_start')
        .eq('user_id', supabaseUserId)
        .in('status', [REFUND_STATUSES.pending, REFUND_STATUSES.flagged])
        .maybeSingle();

      const thisPeriod = a.sub.current_period_start ?? a.periodStart;
      const blockedByOpenRequest =
        !!open && open.billing_period_start !== thisPeriod;

      return NextResponse.json(
        blockedByOpenRequest
          ? {
              error:
                'You already have a refund request being reviewed. We will come back to ' +
                'you on that one before you can raise another.',
              code: 'request_in_progress',
              existingRequest: { id: open!.id, status: open!.status },
            }
          : {
              error: 'You have already requested a refund for this billing period.',
              code: 'already_claimed',
            },
        { status: 409 },
      );
    }

    // Freeze the quote. Stored separately from the insert because the RPC's
    // job is the atomic claim; widening its signature for every display field
    // would mean a migration every time the quote shape changes.
    await supabaseAdmin
      .from('refund_requests')
      .update({
        quoted_refund_cents: quoted,
        quoted_gross_cents: a.proration.grossRefundCents,
        quoted_fee_cents: a.proration.stripeFeeCents,
        amount_paid_cents: a.proration.amountPaidCents,
        proration_lines: a.proration.lines,
      })
      .eq('id', requestId);

    if (a.eligibility.needsReview) {
      await flagAccount(supabaseUserId, FLAG_REASONS.refundHighUsage, {
        refundRequestId: requestId,
        maxUsagePct: a.maxUsagePct,
        maxUsageFeature: a.maxUsageFeature,
        thresholdPct: HIGH_USAGE_THRESHOLD_PCT,
        plan: a.planKey,
        // Triage signal only under the usage-gated policy - the gate requires
        // heavy interview use to qualify at all, so this trips by construction
        // on most eligible requests. It orders the queue, it does not accuse.
        triageOnly: true,
        quotedRefundCents: quoted,
      });
    }

    console.log(
      `💸 Refund request ${requestId} user=${userId} status=${status} ` +
      `interviews=${a.eligibility.interviewUsagePct}% quote=${quoted}c`,
    );

    return NextResponse.json({
      success: true,
      requestId,
      status,
      refundCents: quoted,
      message:
        'Thanks - your request is in. A person reviews every refund, and we will ' +
        'email you within 2 business days.',
    });
  } catch (err) {
    console.error('❌ refund request error:', err);
    return NextResponse.json(
      { error: 'Could not submit your refund request. Please try again or email support@preciprocal.com.' },
      { status: 500 },
    );
  }
}
