// lib/refund/execute.ts
// Carries out an approved subscription refund, end to end, so no step is left
// to someone remembering it in the Stripe dashboard:
//
//   1. claim the request (pending/flagged -> approved), so two admins clicking
//      at once cannot both refund
//   2. refund exactly the quoted amount on the payment for that period, capped
//      at what is still refundable, with an idempotency key so a retry can
//      never refund twice
//   3. end the subscription now, so the account moves to Free through the
//      webhook as for any cancellation. The refund is for the unused part of
//      the allowance; keeping the plan would let them use it anyway.
//   4. record the Stripe refund id on the request (status refunded)
//
// The customer's refund email is sent by the charge.refunded webhook, the same
// path as every other refund, so it cannot be skipped or sent twice.
//
// If Stripe refuses at step 2, the request goes back to its previous status
// with the error recorded, and nothing else changes.

import { sendOpsAlert } from '@/lib/email/ops-alert';
import { supabaseAdmin } from '@/supabase/admin';
import { stripe } from '@/lib/stripe/billing';
import { REFUND_STATUSES } from '@/lib/config/refund';

export class RefundExecutionError extends Error {}

interface RequestRow {
  id: string;
  user_id: string;
  status: string;
  quoted_refund_cents: number | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_refund_id: string | null;
  billing_period_start: string | null;
}

/**
 * The payment for the billing period the customer asked about. A request can
 * be approved days after it was made, possibly after the next renewal; taking
 * simply the newest payment would then refund the wrong month. Matches on the
 * invoice's period start (within 36 hours, to absorb timezone and proration
 * edges), and only falls back to the newest refundable payment when the
 * request has no period on record.
 */
async function refundablePayment(subscriptionId: string, periodStart: string | null): Promise<{ paymentIntentId: string; refundableCents: number }> {
  const target = periodStart ? Math.floor(new Date(periodStart).getTime() / 1000) : null;
  const invoices = await stripe.invoices.list({ subscription: subscriptionId, status: 'paid', limit: 24 });
  const candidates = invoices.data.filter(inv => inv.amount_paid > 0);
  const ordered = target === null
    ? candidates
    : candidates.filter(inv => {
        const start = inv.lines.data[0]?.period?.start ?? inv.period_start;
        return Math.abs(start - target) <= 36 * 3600;
      });
  if (target !== null && ordered.length === 0) {
    throw new RefundExecutionError('No paid invoice matches the billing period this request was made for.');
  }

  for (const inv of ordered) {
    const payments = await stripe.invoicePayments.list({ invoice: inv.id!, limit: 5 });
    for (const p of payments.data) {
      const piRef = p.payment?.payment_intent;
      const piId = typeof piRef === 'string' ? piRef : piRef?.id;
      if (!piId) continue;
      const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
      const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
      const refundable = (charge?.amount ?? pi.amount_received) - (charge?.amount_refunded ?? 0);
      if (refundable > 0) return { paymentIntentId: piId, refundableCents: refundable };
    }
  }
  throw new RefundExecutionError('The payment for this billing period has already been fully refunded.');
}

export async function approveAndRefund(requestId: string, adminId: string, note: string | null): Promise<{
  refundId: string; amountCents: number;
}> {
  const now = new Date().toISOString();

  const { data: before } = await supabaseAdmin.from('refund_requests').select('status').eq('id', requestId).maybeSingle();
  const previousStatus = (before?.status as string | undefined) ?? REFUND_STATUSES.pending;

  // 1. Claim
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from('refund_requests')
    .update({ status: REFUND_STATUSES.approved, decided_by: adminId, decided_at: now, decision_note: note, refund_error: null, updated_at: now })
    .eq('id', requestId)
    .in('status', [REFUND_STATUSES.pending, REFUND_STATUSES.flagged])
    .select('id, user_id, status, quoted_refund_cents, stripe_subscription_id, stripe_customer_id, stripe_refund_id, billing_period_start')
    .maybeSingle();
  if (claimErr) throw claimErr;
  if (!claimed) throw new RefundExecutionError('This request has already been decided.');
  const req = claimed as RequestRow;

  const restore = async (message: string) => {
    await supabaseAdmin.from('refund_requests')
      .update({ status: previousStatus, decided_by: null, decided_at: null, refund_error: message.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('id', requestId);
  };

  try {
    if (!req.stripe_subscription_id) throw new RefundExecutionError('The request has no subscription on record.');
    const quoted = req.quoted_refund_cents ?? 0;
    if (quoted <= 0) throw new RefundExecutionError('The quoted refund is zero, so there is nothing to refund.');

    // 2. Refund
    const { paymentIntentId, refundableCents } = await refundablePayment(req.stripe_subscription_id, req.billing_period_start);
    const amount = Math.min(quoted, refundableCents);
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount,
        reason: 'requested_by_customer',
        metadata: { refundRequestId: requestId, userId: req.user_id, kind: 'subscription' },
      },
      { idempotencyKey: `refund-request-${requestId}` },
    );
    if (refund.status === 'failed' || refund.status === 'canceled') {
      throw new RefundExecutionError(`Stripe ${refund.status} the refund.`);
    }

    // 4 before 3: once money has moved, record it before anything else can fail.
    await supabaseAdmin.from('refund_requests')
      .update({ status: REFUND_STATUSES.refunded, stripe_refund_id: refund.id, refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', requestId);

    // 3. End the plan. A failure here is logged, not thrown: the refund is done
    // and recorded, and the subscription can be ended by hand from the log.
    try {
      const sub = await stripe.subscriptions.retrieve(req.stripe_subscription_id);
      if (!['canceled', 'incomplete_expired'].includes(sub.status)) {
        await stripe.subscriptions.cancel(req.stripe_subscription_id, {
          prorate: false,
          cancellation_details: { comment: `Refunded via refund request ${requestId}` },
        });
      }
    } catch (err) {
      console.error(`🚨 REFUNDED BUT NOT CANCELLED: request=${requestId} sub=${req.stripe_subscription_id}`, err);
      await supabaseAdmin.from('refund_requests').update({
        refund_error: `Refunded, but cancelling ${req.stripe_subscription_id} failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500),
      }).eq('id', requestId);
      await sendOpsAlert({
        kind: 'Refunded but not cancelled', supabaseUserId: req.user_id, actionNeeded: true,
        summary: 'An approved refund went through, but cancelling the subscription failed. Cancel it in Stripe now, or the customer will be charged again at renewal.',
        details: [['Subscription', String(req.stripe_subscription_id)], ['Refund', refund.id], ['Request', requestId]],
      });
    }

    return { refundId: refund.id, amountCents: amount };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Refund failed';
    // Only roll back if no refund was recorded; a recorded refund is final.
    const { data: now2 } = await supabaseAdmin.from('refund_requests').select('stripe_refund_id').eq('id', requestId).maybeSingle();
    if (!now2?.stripe_refund_id) await restore(message);
    if (err instanceof RefundExecutionError) throw err;
    throw new RefundExecutionError(`Stripe refused the refund: ${message}`);
  }
}
