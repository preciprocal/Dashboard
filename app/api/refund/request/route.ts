// app/api/refund/request/route.ts
// The customer-facing subscription refund, under the policy in
// lib/config/refund.ts:
//
//   GET   whether the first-payment refund is available, the exact amount,
//         and the date it must be requested by. Reads only.
//   POST  { fingerprint? }  requests it. Processed immediately when eligible:
//         full refund, plan ends, refund email sent by the webhook.
//
// Every refund is on request. If it is not requested in time, it is gone.
// After the first payment there are no partial refunds: cancel any time and
// the plan runs to the end of the paid month. Exceptions are handled by
// support.
//
// Replaces the usage-gated prorated request (refunds only after heavy use),
// which turned away the customers most likely to dispute a charge instead.
// Requests from that policy already in the admin queue are still decided
// there (lib/refund/execute.ts).
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import {
  assessFirstPaymentRefund,
  executeFirstPaymentRefund,
  FirstRefundError,
} from '@/lib/refund/first-payment';
import { FIRST_REFUND_WINDOW_DAYS, FIRST_REFUND_MAX_PLAN_USED_PCT } from '@/lib/config/refund';

export const runtime = 'nodejs';

const fingerprintOf = (v: unknown) => (typeof v === 'string' && v.length <= 128 ? v : null);

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const a = await assessFirstPaymentRefund(user.supabaseUserId, fingerprintOf(req.nextUrl.searchParams.get('fp')));
    const policy = { windowDays: FIRST_REFUND_WINDOW_DAYS, maxPlanUsedPct: FIRST_REFUND_MAX_PLAN_USED_PCT };
    if (!a.eligible) {
      return NextResponse.json({ eligible: false, code: a.code, reason: a.reason, requestBy: a.requestBy ?? null, planUsedPct: a.planUsedPct ?? null, policy });
    }
    return NextResponse.json({
      eligible: true,
      refundCents: a.amountCents,
      amountPaidCents: a.amountCents,
      currency: a.currency,
      requestBy: a.requestBy,
      planUsedPct: a.planUsedPct,
      policy,
      note: 'The full payment goes back to your card straight away, and your paid plan ends.',
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

  try {
    const done = await executeFirstPaymentRefund(user.supabaseUserId, parsed.data.fingerprint ?? null);
    return NextResponse.json({ refunded: true, amountCents: done.amountCents, currency: done.currency, refundId: done.refundId });
  } catch (err) {
    if (err instanceof FirstRefundError) return NextResponse.json({ refunded: false, reason: err.message }, { status: 409 });
    console.error('❌ refund request error:', err);
    return NextResponse.json({ refunded: false, reason: 'We could not process the refund right now. Please try again.' }, { status: 500 });
  }
}
