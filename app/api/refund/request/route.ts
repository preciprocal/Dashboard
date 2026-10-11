// app/api/refund/request/route.ts
// The customer-facing subscription refund, under the policy in
// lib/config/refund.ts. Every refund is on request; nothing is automatic.
//
//   GET   the refund available right now, if any: the amount, what it is, and
//         by when. Reads only.
//   POST  { fingerprint? }  takes it. Processed immediately: money back, paid
//         plan ends, refund email sent by the webhook.
//
// Two kinds, offered in this order:
//   full    first payment, within 7 days, plan essentially unused
//           (lib/refund/first-payment.ts)
//   unused  any time in the current billing month: the unused part of this
//           month's payment (lib/refund/unused-credits.ts)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { assessFirstPaymentRefund, executeFirstPaymentRefund, FirstRefundError } from '@/lib/refund/first-payment';
import { assessUnusedCreditsRefund, executeUnusedCreditsRefund, UnusedRefundError } from '@/lib/refund/unused-credits';
import {
  FIRST_REFUND_WINDOW_DAYS,
  FIRST_REFUND_MAX_PLAN_USED_PCT,
  UNUSED_REFUND_EVERY_DAYS,
} from '@/lib/config/refund';

export const runtime = 'nodejs';

const fingerprintOf = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 128 ? v : null);

const policy = {
  fullRefundWindowDays: FIRST_REFUND_WINDOW_DAYS,
  fullRefundMaxPlanUsedPct: FIRST_REFUND_MAX_PLAN_USED_PCT,
  unusedRefundEveryMonths: Math.round(UNUSED_REFUND_EVERY_DAYS / 30),
};

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const fp = fingerprintOf(req.nextUrl.searchParams.get('fp'));

  try {
    const full = await assessFirstPaymentRefund(user.supabaseUserId, fp);
    if (full.eligible) {
      return NextResponse.json({
        eligible: true,
        type: 'full',
        refundCents: full.amountCents,
        amountPaidCents: full.paidCents,
        grossCents: full.paidCents,
        feeCents: full.feeCents,
        currency: full.currency,
        planUsedPct: full.planUsedPct,
        availableUntil: full.requestBy,
        policy,
      });
    }

    const unused = await assessUnusedCreditsRefund(user.supabaseUserId, fp);
    if (unused.eligible) {
      return NextResponse.json({
        eligible: true,
        type: 'unused',
        refundCents: unused.amountCents,
        amountPaidCents: unused.amountPaidCents,
        grossCents: unused.unusedCents,
        feeCents: unused.feeCents,
        currency: unused.currency,
        planUsedPct: unused.planUsedPct,
        availableUntil: unused.periodEndsAt,
        policy,
      });
    }
    return NextResponse.json({
      eligible: false,
      code: unused.code,
      reason: unused.reason,
      planUsedPct: unused.planUsedPct ?? null,
      nextEligibleAt: unused.nextEligibleAt ?? null,
      policy,
    });
  } catch (err) {
    console.error('❌ refund preview error:', err);
    return NextResponse.json({ error: 'Could not check your refund right now.' }, { status: 500 });
  }
}

const bodySchema = z.object({
  fingerprint: z.string().max(128).optional(),
  reason: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limited = await applyRateLimit(req, user.userId, 'light');
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const fp = fingerprintOf(parsed.data.fingerprint);

  try {
    // Re-assessed here, never trusted from the preview: usage may have moved.
    const full = await assessFirstPaymentRefund(user.supabaseUserId, fp);
    const done = full.eligible
      ? { ...(await executeFirstPaymentRefund(user.supabaseUserId, fp, parsed.data.reason)), type: 'full' as const }
      : { ...(await executeUnusedCreditsRefund(user.supabaseUserId, fp, parsed.data.reason)), type: 'unused' as const };
    return NextResponse.json({ refunded: true, type: done.type, amountCents: done.amountCents, currency: done.currency, refundId: done.refundId });
  } catch (err) {
    if (err instanceof FirstRefundError || err instanceof UnusedRefundError) {
      return NextResponse.json({ refunded: false, reason: err.message }, { status: 409 });
    }
    console.error('❌ refund request error:', err);
    return NextResponse.json({ refunded: false, reason: 'We could not process the refund right now. Please try again.' }, { status: 500 });
  }
}
