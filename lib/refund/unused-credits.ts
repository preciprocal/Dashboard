// lib/refund/unused-credits.ts
// The unused-credits refund: at any point during the current billing month,
// on request, a refund of the unused part of THIS month's payment.
//
//   amount  = this month's payment x the share of the plan not used, where
//             every feature is weighted by what it costs to provide
//             (lib/refund/proration.ts). No card fee is deducted.
//   effect  = processed at once; the paid plan ends and the account moves to
//             Free through the webhook, as for any cancellation
//   limit   = once every UNUSED_REFUND_EVERY_DAYS per account, card and device,
//             so subscribe, use a little, refund, repeat is not a way to pay
//             per use. Any refund in that time counts, including the
//             first-payment refund.
//
// Last month cannot be refunded once a new month starts: only the payment for
// the period the subscription is currently in qualifies.
//
// One request per billing month is guaranteed by refund_requests_period_key
// (user_id, billing_period_start), so two clicks cannot refund twice; the
// Stripe call also carries an idempotency key.

import type Stripe from 'stripe';
import { supabaseAdmin } from '@/supabase/admin';
import { stripe } from '@/lib/stripe/billing';
import { periodOf } from '@/lib/stripe/compat';
import { buildUsageSnapshot } from '@/lib/refund/eligibility';
import { prorateRefund } from '@/lib/refund/proration';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';
import { USAGE_LIMITS, resolvePlanKey } from '@/lib/config/usage-limits';
import { UNUSED_REFUND_EVERY_DAYS, UNUSED_REFUND_MIN_CENTS, REFUND_STATUSES } from '@/lib/config/refund';

const DAY_MS = 86_400_000;

export type UnusedRefundAssessment =
  | { eligible: false; code: string; reason: string; nextEligibleAt?: string | null; planUsedPct?: number }
  | {
      eligible: true;
      amountCents: number;
      amountPaidCents: number;
      currency: string;
      planUsedPct: number;
      periodEndsAt: string;
      _paymentIntentId: string;
      _cardFingerprint: string | null;
      _subscriptionId: string;
      _periodStart: string;
    };

const no = (code: string, reason: string, extra: { nextEligibleAt?: string | null; planUsedPct?: number } = {}): UnusedRefundAssessment =>
  ({ eligible: false, code, reason, ...extra });

/** The most recent refund of any kind for this person within the limit window. */
async function recentRefund(
  supabaseUserId: string, deviceFingerprint: string | null, cardFingerprint: string | null,
): Promise<string | null> {
  const since = new Date(Date.now() - UNUSED_REFUND_EVERY_DAYS * DAY_MS).toISOString();
  const queries = [
    supabaseAdmin.from('refund_requests').select('refunded_at').eq('user_id', supabaseUserId),
    ...(deviceFingerprint ? [supabaseAdmin.from('refund_requests').select('refunded_at').eq('device_fingerprint', deviceFingerprint)] : []),
    ...(cardFingerprint ? [supabaseAdmin.from('refund_requests').select('refunded_at').eq('card_fingerprint', cardFingerprint)] : []),
  ].map(q => q.eq('status', REFUND_STATUSES.refunded).gte('refunded_at', since).order('refunded_at', { ascending: false }).limit(1));
  const results = await Promise.all(queries);
  const dates = results.flatMap(r => (r.data ?? []).map(x => x.refunded_at as string)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export async function assessUnusedCreditsRefund(
  supabaseUserId: string,
  deviceFingerprint: string | null,
): Promise<UnusedRefundAssessment> {
  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, stripe_customer_id, stripe_subscription_id, subscription_started_at, current_period_start')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  if (!sub?.stripe_subscription_id || !['pro', 'premium'].includes(String(sub.plan))) {
    return no('not_a_paid_plan', 'Refunds apply to paid Pro and Premium subscriptions.');
  }

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
  if (!['active', 'past_due'].includes(stripeSub.status)) {
    return no('not_active', stripeSub.status === 'trialing'
      ? 'You are on a free trial, so there is no payment to refund yet. You can cancel any time before it ends and you will not be charged.'
      : 'This subscription has no current payment to refund.');
  }
  const { start: periodStart, end: periodEnd } = periodOf(stripeSub);
  if (!periodStart || !periodEnd) return no('no_period', 'We could not find your current billing month. Please contact support.');

  // ── This month's payment ────────────────────────────────────────────────
  const invoices = await stripe.invoices.list({ subscription: stripeSub.id, status: 'paid', limit: 12 });
  const current = invoices.data.find(inv => {
    const s = inv.lines.data[0]?.period?.start ?? inv.period_start;
    return inv.amount_paid > 0 && Math.abs(s - periodStart) <= 36 * 3600;
  });
  if (!current) return no('no_payment', 'There is no payment for this billing month to refund.');

  const payments = await stripe.invoicePayments.list({ invoice: current.id!, limit: 5 });
  const piRef = payments.data.find(p => p.payment?.payment_intent)?.payment?.payment_intent;
  const piId = typeof piRef === 'string' ? piRef : piRef?.id;
  if (!piId) return no('no_payment', 'We could not find this month\'s payment. Please contact support.');
  const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['latest_charge'] });
  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? (pi.latest_charge as Stripe.Charge) : null;
  const refundable = (charge?.amount ?? pi.amount_received) - (charge?.amount_refunded ?? 0);
  if (refundable <= 0) return no('already_refunded', 'This month\'s payment has already been refunded.');
  const cardFingerprint = charge?.payment_method_details?.card?.fingerprint ?? null;

  // ── Frequency limit ─────────────────────────────────────────────────────
  const last = await recentRefund(supabaseUserId, deviceFingerprint, cardFingerprint);
  if (last) {
    const next = new Date(new Date(last).getTime() + UNUSED_REFUND_EVERY_DAYS * DAY_MS);
    return no('too_soon',
      `Unused-credit refunds are available once every ${Math.round(UNUSED_REFUND_EVERY_DAYS / 30)} months, and you had one recently. You can ask again from ${next.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}. You can still cancel any time and keep your plan to the end of the month.`,
      { nextEligibleAt: next.toISOString() });
  }

  // ── Unused share ────────────────────────────────────────────────────────
  const { periodStart: usageStart } = computeUsagePeriod(pickAnchor(sub.subscription_started_at, sub.current_period_start, undefined));
  const { snapshot } = await buildUsageSnapshot(supabaseUserId, String(sub.plan), usageStart);
  const planKey = resolvePlanKey(String(sub.plan));
  const { unusedShare } = prorateRefund(snapshot, USAGE_LIMITS[planKey], 100, 0, planKey);
  const share = unusedShare ?? 1;
  const planUsedPct = Math.round((1 - share) * 100);
  const amountPaid = current.amount_paid;
  const amount = Math.min(refundable, Math.floor(amountPaid * share));

  if (amount < UNUSED_REFUND_MIN_CENTS) {
    return no('nothing_unused',
      `You have used about ${planUsedPct}% of your plan this month, so there is nothing meaningful left to refund. You can cancel any time and keep your plan to the end of the month.`,
      { planUsedPct });
  }

  return {
    eligible: true,
    amountCents: amount,
    amountPaidCents: amountPaid,
    currency: current.currency,
    planUsedPct,
    periodEndsAt: new Date(periodEnd * 1000).toISOString(),
    _paymentIntentId: piId,
    _cardFingerprint: cardFingerprint,
    _subscriptionId: stripeSub.id,
    _periodStart: new Date(periodStart * 1000).toISOString(),
  };
}

export class UnusedRefundError extends Error {}

export async function executeUnusedCreditsRefund(
  supabaseUserId: string,
  deviceFingerprint: string | null,
): Promise<{ refundId: string; amountCents: number; currency: string }> {
  const a = await assessUnusedCreditsRefund(supabaseUserId, deviceFingerprint);
  if (!a.eligible) throw new UnusedRefundError(a.reason);

  // Claim: one request per user per billing period (refund_requests_period_key).
  const { data: row, error: claimErr } = await supabaseAdmin.from('refund_requests').insert({
    user_id: supabaseUserId,
    kind: 'unused_credits',
    status: REFUND_STATUSES.approved,
    stripe_subscription_id: a._subscriptionId,
    billing_period_start: a._periodStart,
    quoted_refund_cents: a.amountCents,
    amount_paid_cents: a.amountPaidCents,
    max_usage_pct: a.planUsedPct,
    card_fingerprint: a._cardFingerprint,
    device_fingerprint: deviceFingerprint,
    usage_snapshot: { planUsedPct: a.planUsedPct },
    decided_at: new Date().toISOString(),
  }).select('id').single();
  if (claimErr || !row) throw new UnusedRefundError('A refund has already been requested for this billing month.');

  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: a._paymentIntentId,
        amount: a.amountCents,
        reason: 'requested_by_customer',
        metadata: { userId: supabaseUserId, kind: 'subscription', refundType: 'unused_credits', refundRequestId: row.id },
      },
      { idempotencyKey: `unused-refund-${supabaseUserId}-${a._periodStart}` },
    );
    if (refund.status === 'failed' || refund.status === 'canceled') throw new Error(`Stripe ${refund.status} the refund`);
  } catch (err) {
    await supabaseAdmin.from('refund_requests').delete().eq('id', row.id);
    console.error('❌ unused-credits refund failed:', err);
    throw new UnusedRefundError('We could not process the refund right now. Nothing was charged or changed; please try again in a minute.');
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
      cancellation_details: { comment: 'Unused-credits refund' },
    });
  } catch (err) {
    console.error(`🚨 REFUNDED BUT NOT CANCELLED: user=${supabaseUserId} sub=${a._subscriptionId}`, err);
  }

  console.log(`💸 Unused-credits refund ${refund.id} for ${supabaseUserId}: ${a.amountCents}`);
  return { refundId: refund.id, amountCents: a.amountCents, currency: a.currency };
}
