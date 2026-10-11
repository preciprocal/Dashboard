// lib/refund/first-payment.ts
// The first-payment refund: a full refund of someone's FIRST payment, on
// request, within FIRST_REFUND_WINDOW_DAYS, if they used less than
// FIRST_REFUND_MAX_PLAN_USED_PCT of the plan, measured across every feature
// by cost. See lib/config/refund.ts for the whole policy.
//
// Always on request, never automatic. It is processed the moment it is asked
// for, without waiting on a person, because every condition is a fact the code
// can check:
//
//   - it is the customer's first ever paid subscription invoice (a renewal,
//     or a second subscription after an earlier one, does not qualify)
//   - it was paid within the window
//   - less than the cap of the plan is used, across every feature
//   - neither this account, nor the card that paid, nor the device asking has
//     had a first-payment refund before (migration 0049)
//
// When granted: the refund row is claimed first (a unique index makes a
// double-click impossible), then the full amount is refunded with an
// idempotency key, then the subscription ends so the account moves to Free.

import type Stripe from 'stripe';
import { supabaseAdmin } from '@/supabase/admin';
import { stripe } from '@/lib/stripe/billing';
import { subscriptionIdOfInvoice } from '@/lib/stripe/compat';
import { buildUsageSnapshot } from '@/lib/refund/eligibility';
import { prorateRefund } from '@/lib/refund/proration';
import { feesFor } from '@/lib/refund/fees';
import { USAGE_LIMITS, resolvePlanKey } from '@/lib/config/usage-limits';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';
import { FIRST_REFUND_WINDOW_DAYS, FIRST_REFUND_MAX_PLAN_USED_PCT, FIRST_REFUND_MAX_FEATURE_USED_PCT, REFUND_STATUSES } from '@/lib/config/refund';

const DAY_MS = 86_400_000;

const FEATURE_LABEL: Record<string, string> = {
  interviews: 'mock interviews', resumes: 'resume analyses', coverLetters: 'cover letters',
  studyPlans: 'study plans', linkedinOptimisations: 'LinkedIn optimisations', coldOutreach: 'outreach messages',
  findContacts: 'contact searches', debriefAnalyses: 'debrief analyses', interviewDebriefs: 'interview debriefs',
  jobTracker: 'job tracker slots',
};

export type FirstRefundAssessment =
  | { eligible: false; code: string; reason: string; requestBy?: string | null; planUsedPct?: number }
  | {
      eligible: true;
      amountCents: number;
      paidCents: number;
      feeCents: number;
      currency: string;
      requestBy: string;
      planUsedPct: number;
      // Internal, for execution; not sent to the browser.
      _invoiceId: string;
      _paymentIntentId: string;
      _cardFingerprint: string | null;
      _subscriptionId: string;
      _periodStart: string;
    };

const no = (code: string, reason: string, requestBy?: string | null, planUsedPct?: number): FirstRefundAssessment =>
  ({ eligible: false, code, reason, requestBy, planUsedPct });

export async function assessFirstPaymentRefund(
  supabaseUserId: string,
  deviceFingerprint: string | null,
): Promise<FirstRefundAssessment> {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_started_at, current_period_start')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  if (!sub?.stripe_customer_id || !sub.stripe_subscription_id || !['pro', 'premium'].includes(String(sub.plan))) {
    return no('not_a_paid_plan', 'Refunds apply to paid Pro and Premium subscriptions.');
  }

  // ── Already had one? Account, then device. (Card is checked below.) ─────
  const { data: own } = await supabaseAdmin.from('refund_requests')
    .select('id').eq('user_id', supabaseUserId).eq('kind', 'first_payment').limit(1);
  if (own?.length) return no('already_used', 'The first-payment refund has already been used on this account.');
  if (deviceFingerprint) {
    const { data: dev } = await supabaseAdmin.from('refund_requests')
      .select('id').eq('device_fingerprint', deviceFingerprint).eq('kind', 'first_payment').limit(1);
    if (dev?.length) return no('already_used', 'The first-payment refund has already been used.');
  }

  // ── Is this their first ever payment? ───────────────────────────────────
  const paid: Stripe.Invoice[] = [];
  for await (const inv of stripe.invoices.list({ customer: sub.stripe_customer_id, status: 'paid', limit: 100 })) {
    if (inv.amount_paid > 0 && subscriptionIdOfInvoice(inv)) paid.push(inv);
  }
  if (paid.length === 0) return no('no_payment', 'There is no payment on this account to refund yet.');
  paid.sort((a, b) => (a.status_transitions?.paid_at ?? a.created) - (b.status_transitions?.paid_at ?? b.created));
  const first = paid[0];
  const paidAt = (first.status_transitions?.paid_at ?? first.created) * 1000;
  const requestBy = new Date(paidAt + FIRST_REFUND_WINDOW_DAYS * DAY_MS).toISOString();

  if (paid.length > 1 || subscriptionIdOfInvoice(first) !== sub.stripe_subscription_id) {
    return no('not_first_payment',
      'The full refund only applies to your first payment. You can cancel any time from Billing, and your plan runs to the end of the month you paid for.');
  }
  if (Date.now() > paidAt + FIRST_REFUND_WINDOW_DAYS * DAY_MS) {
    return no('outside_window',
      `The full refund had to be requested within ${FIRST_REFUND_WINDOW_DAYS} days of your first payment. You can still cancel any time, and your plan runs to the end of the month you paid for.`,
      requestBy);
  }

  // ── Usage ───────────────────────────────────────────────────────────────
  const { periodStart } = computeUsagePeriod(pickAnchor(sub.subscription_started_at, sub.current_period_start, undefined));
  const { snapshot, maxUsagePct, maxUsageFeature } = await buildUsageSnapshot(supabaseUserId, String(sub.plan), periodStart);
  // Share of the plan's value used, across every feature, each weighted by
  // what it costs to provide. The amount passed is irrelevant to the share.
  const planKey = resolvePlanKey(String(sub.plan));
  const { unusedShare } = prorateRefund(snapshot, USAGE_LIMITS[planKey], 100, 0, planKey);
  // Null only when nothing on the plan has a finite, costed allowance.
  const planUsedPct = Math.round((1 - (unusedShare ?? 1)) * 100);
  if (planUsedPct >= FIRST_REFUND_MAX_PLAN_USED_PCT) {
    return no('used_too_much',
      `The full refund is for a plan that has barely been used: under ${FIRST_REFUND_MAX_PLAN_USED_PCT}% of it. You have used about ${planUsedPct}% this month, so it no longer applies. You can cancel any time, and your plan runs to the end of the month you paid for.`,
      requestBy, planUsedPct);
  }
  if (maxUsagePct !== null && maxUsagePct > FIRST_REFUND_MAX_FEATURE_USED_PCT) {
    const label = FEATURE_LABEL[maxUsageFeature ?? ''] ?? 'one feature';
    return no('used_too_much',
      `The full refund is for a plan that has barely been used. You have used ${maxUsagePct}% of this month's ${label}, so it no longer applies. You can cancel any time, and your plan runs to the end of the month you paid for.`,
      requestBy, planUsedPct);
  }

  // ── The payment, and the card behind it ─────────────────────────────────
  const payments = await stripe.invoicePayments.list({ invoice: first.id!, limit: 5 });
  const piRef = payments.data.find(p => p.payment?.payment_intent)?.payment?.payment_intent;
  const piId = typeof piRef === 'string' ? piRef : piRef?.id;
  if (!piId) return no('no_payment', 'We could not find the payment to refund. Please contact support.');
  const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const refundable = (charge?.amount ?? pi.amount_received) - (charge?.amount_refunded ?? 0);
  if (refundable <= 0 || !charge) return no('already_refunded', 'This payment has already been refunded.');
  const cardFingerprint = charge.payment_method_details?.card?.fingerprint ?? null;
  // Stripe keeps its fees on a refund, so they come out of it (lib/refund/fees.ts).
  const fees = await feesFor(charge, 'subscription');
  const amountCents = refundable - fees.totalCents;
  if (amountCents <= 0) return no('nothing_unused', 'After card processing fees there is nothing left to refund on this payment.');

  if (cardFingerprint) {
    const { data: card } = await supabaseAdmin.from('refund_requests')
      .select('id').eq('card_fingerprint', cardFingerprint).eq('kind', 'first_payment').limit(1);
    if (card?.length) return no('already_used', 'The first-payment refund has already been used with this card.');
  }

  return {
    eligible: true,
    amountCents,
    paidCents: refundable,
    feeCents: fees.totalCents,
    currency: first.currency,
    requestBy,
    planUsedPct,
    _invoiceId: first.id!,
    _paymentIntentId: piId,
    _cardFingerprint: cardFingerprint,
    _subscriptionId: sub.stripe_subscription_id as string,
    _periodStart: new Date(paidAt).toISOString(),
  };
}

export class FirstRefundError extends Error {}

export async function executeFirstPaymentRefund(
  supabaseUserId: string,
  deviceFingerprint: string | null,
): Promise<{ refundId: string; amountCents: number; currency: string }> {
  const a = await assessFirstPaymentRefund(supabaseUserId, deviceFingerprint);
  if (!a.eligible) throw new FirstRefundError(a.reason);

  // Claim. The unique index on (user_id) where kind = 'first_payment' makes a
  // second simultaneous request fail here, before any money moves.
  const { data: row, error: claimErr } = await supabaseAdmin.from('refund_requests').insert({
    user_id: supabaseUserId,
    kind: 'first_payment',
    status: REFUND_STATUSES.approved,
    stripe_subscription_id: a._subscriptionId,
    billing_period_start: a._periodStart,
    quoted_refund_cents: a.amountCents,
    amount_paid_cents: a.paidCents,
    quoted_fee_cents: a.feeCents,
    card_fingerprint: a._cardFingerprint,
    device_fingerprint: deviceFingerprint,
    usage_snapshot: { planUsedPct: a.planUsedPct },
    max_usage_pct: a.planUsedPct,
    decided_at: new Date().toISOString(),
  }).select('id').single();
  if (claimErr || !row) throw new FirstRefundError('This refund has already been requested.');

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: a._paymentIntentId,
        amount: a.amountCents,
        reason: 'requested_by_customer',
        metadata: { userId: supabaseUserId, kind: 'subscription', refundType: 'first_payment', refundRequestId: row.id },
      },
      { idempotencyKey: `first-payment-refund-${supabaseUserId}` },
    );
    if (refund.status === 'failed' || refund.status === 'canceled') throw new Error(`Stripe ${refund.status} the refund`);
  } catch (err) {
    // Nothing moved: release the claim so they can try again.
    await supabaseAdmin.from('refund_requests').delete().eq('id', row.id);
    console.error('❌ first-payment refund failed:', err);
    throw new FirstRefundError('We could not process the refund right now. Nothing was charged or changed; please try again in a minute.');
  }

  await supabaseAdmin.from('refund_requests').update({
    status: REFUND_STATUSES.refunded,
    stripe_refund_id: refund.id,
    refunded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', row.id);

  try {
    await stripe.subscriptions.cancel(a._subscriptionId, {
      prorate: false,
      cancellation_details: { comment: 'First-payment refund' },
    });
  } catch (err) {
    console.error(`🚨 REFUNDED BUT NOT CANCELLED: user=${supabaseUserId} sub=${a._subscriptionId}`, err);
  }

  console.log(`💸 First-payment refund ${refund.id} for ${supabaseUserId}: ${a.amountCents}`);
  return { refundId: refund.id, amountCents: a.amountCents, currency: a.currency };
}
