// app/api/refund/request/route.ts
// User-facing refund request against the 30-day money-back guarantee.
//
// What this route does NOT do: move money. An approved request is a decision
// record; the Stripe refund itself is still issued by hand from the admin
// queue. Auto-refunding on a rule this new, against a guarantee that has never
// been enforced in code before, is not something to switch on blind.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { flagAccount } from '@/lib/abuse/flag-account';
import { FLAG_REASONS } from '@/lib/config/abuse-guard';
import {
  buildUsageSnapshot,
  evaluateEligibility,
  isWithinRefundWindow,
} from '@/lib/refund/eligibility';
import { REFUND_STATUSES, REFUND_WINDOW_DAYS, HIGH_USAGE_THRESHOLD_PCT } from '@/lib/config/refund';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  reason: z.string().max(2000).optional(),
});

// Explicit row type + cast, matching SubscriptionRow in lib/ai/usage-guard.ts.
// Supabase's generic can only infer columns from a single string literal, so a
// concatenated select() degrades every field to GenericStringError.
interface SubscriptionRow {
  plan: string | null;
  status: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  last_payment_at: string | null;
  refund_guarantee_used: boolean | null;
}


export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    const body   = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const userReason = parsed.data.reason ?? null;

    // ── Subscription state ──────────────────────────────────────────────────
    const { data: subData, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select(
        'plan, status, stripe_subscription_id, stripe_customer_id, ' +
        'current_period_start, current_period_end, last_payment_at, refund_guarantee_used',
      )
      .eq('user_id', supabaseUserId)
      .maybeSingle();
    if (subError) throw subError;
    const sub = subData as SubscriptionRow | null;

    if (!sub || !['pro', 'premium'].includes((sub.plan ?? '').toLowerCase())) {
      return NextResponse.json(
        { error: 'The money-back guarantee applies to paid Pro and Premium subscriptions.' },
        { status: 400 },
      );
    }

    // ── Already has a live request? ─────────────────────────────────────────
    // Checked explicitly so the user gets a clear message rather than a
    // constraint violation from refund_requests_open_key.
    const { data: openRequest } = await supabaseAdmin
      .from('refund_requests')
      .select('id, status')
      .eq('user_id', supabaseUserId)
      .in('status', [REFUND_STATUSES.pending, REFUND_STATUSES.flagged])
      .maybeSingle();
    if (openRequest) {
      return NextResponse.json(
        { error: "You already have a refund request in progress. We'll be in touch shortly." },
        { status: 409 },
      );
    }

    // ── Window ──────────────────────────────────────────────────────────────
    // Anchored on the current billing period, falling back to last_payment_at
    // for rows predating current_period_start being populated.
    const periodStart = sub.current_period_start ?? sub.last_payment_at;

    if (!isWithinRefundWindow(periodStart)) {
      return NextResponse.json(
        {
          error:
            `The ${REFUND_WINDOW_DAYS}-day money-back guarantee has expired for this billing period. ` +
            'Email support@preciprocal.com if you think this is wrong and we\'ll take a look.',
        },
        { status: 400 },
      );
    }

    // ── One guarantee per account ───────────────────────────────────────────
    // Claimed atomically at SUBMIT time, not at approval, so two concurrent
    // requests can't both pass the check. Released again below if the request
    // is later denied - see release_refund_guarantee in 0024.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .rpc('claim_refund_guarantee', { p_user_id: supabaseUserId });
    if (claimError) throw claimError;

    if (claimed !== true) {
      return NextResponse.json(
        {
          error:
            'The money-back guarantee has already been used on this account. ' +
            'It applies to your first Pro or Premium subscription only.',
        },
        { status: 409 },
      );
    }

    // ── Usage snapshot ──────────────────────────────────────────────────────
    // The snapshot MUST resolve the same window lib/ai/usage-guard.ts writes
    // against, or it reads a period with no counter row and reports zeros -
    // which would auto-approve exactly the heavy-usage requests this clause
    // exists to catch. So it uses pickAnchor with profiles.created_at, not the
    // last_payment_at fallback above: that fallback answers "when did they pay"
    // for the refund window, which is a different question from "which usage
    // period are they in".
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('user_id', supabaseUserId)
      .maybeSingle();

    const { snapshot, maxUsagePct, maxUsageFeature } = await buildUsageSnapshot(
      supabaseUserId,
      sub.plan ?? 'free',
      computeUsagePeriod(
        pickAnchor(sub.current_period_start, profile?.created_at as string | undefined),
      ).periodStart,
    );
    const eligibility = evaluateEligibility(snapshot, maxUsagePct, maxUsageFeature);

    const status = eligibility.needsReview
      ? REFUND_STATUSES.flagged
      : REFUND_STATUSES.approved;

    const { data: created, error: insertError } = await supabaseAdmin
      .from('refund_requests')
      .insert({
        user_id:                supabaseUserId,
        stripe_subscription_id: sub.stripe_subscription_id,
        stripe_customer_id:     sub.stripe_customer_id,
        billing_period_start:   periodStart,
        billing_period_end:     sub.current_period_end,
        usage_snapshot:         snapshot,
        max_usage_pct:          maxUsagePct,
        status,
        user_reason:            userReason,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    // ── Route high usage to a human ─────────────────────────────────────────
    // Never an auto-deny. The account lands in the same queue as the Task 2
    // duplicate-resume flags so there is one place to work through.
    if (eligibility.needsReview) {
      await flagAccount(supabaseUserId, FLAG_REASONS.refundHighUsage, {
        refundRequestId: created.id,
        maxUsagePct,
        maxUsageFeature,
        thresholdPct: HIGH_USAGE_THRESHOLD_PCT,
        plan: sub.plan,
        usageSnapshot: snapshot,
      });
    }

    console.log(
      `💸 Refund request ${created.id} user=${userId} status=${status} ` +
      `maxUsage=${maxUsagePct ?? 'n/a'}% (${maxUsageFeature ?? 'n/a'})`,
    );

    return NextResponse.json({
      success: true,
      requestId: created.id,
      status,
      message: eligibility.needsReview
        ? "Thanks - your request is in. Because you've used a large share of this " +
          "month's allowance, a person is reviewing it personally. We'll email you " +
          'within 2 business days.'
        : "Thanks - your refund request is approved. You'll see the money back on " +
          'your original payment method within 5-7 business days.',
    });
  } catch (err) {
    console.error('❌ refund request error:', err);
    return NextResponse.json(
      { error: 'Could not submit your refund request. Please try again or email support@preciprocal.com.' },
      { status: 500 },
    );
  }
}
