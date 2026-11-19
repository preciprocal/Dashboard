// lib/billing/renewal-gate.ts
//
// A paid period's allowance starts when that period is paid for.
//
// With auto pay off, a renewal is an emailed invoice due in 7 days
// (lib/stripe/auto-pay.ts), and the subscription stays active while it is
// open. The quota window (lib/usage/period.ts) rolls with the billing period
// whether or not the invoice is paid, so without this someone could use a
// fresh month of Pro for up to 7 days, never pay, and drop to Free: the
// loophole the owner asked to close.
//
// So while the current period's renewal is unpaid, Free limits apply; the
// moment invoice.payment_succeeded records last_payment_at, Pro is back.
// Paying on day one gives Pro on day one. Auto pay charges as the period
// starts, so it is unaffected apart from the seconds before the charge lands.
//
// Applies only to a Stripe-billed paid plan that is active. Trials (the
// student month, card trials) and admin or manually granted plans have their
// own rules.

/** Slack for the webhook order on a first payment, where the payment can be stamped a moment before the period start. */
const SLACK_MS = 24 * 60 * 60 * 1000;

export interface RenewalGateRow {
  plan?: string | null;
  status?: string | null;
  stripe_subscription_id?: string | null;
  current_period_start?: string | null;
  last_payment_at?: string | null;
}

/** True when this billing period has begun but has not been paid for yet. */
export function renewalUnpaid(sub: RenewalGateRow | null | undefined): boolean {
  if (!sub?.stripe_subscription_id || sub.status !== 'active') return false;
  if (!sub.plan || sub.plan === 'free') return false;
  const start = sub.current_period_start ? Date.parse(sub.current_period_start) : NaN;
  if (!Number.isFinite(start)) return false;
  const paid = sub.last_payment_at ? Date.parse(sub.last_payment_at) : NaN;
  return !Number.isFinite(paid) || paid < start - SLACK_MS;
}

export const RENEWAL_UNPAID_MESSAGE =
  'Your renewal invoice is not paid yet, so your plan is on Free limits for now. Pay it in Settings, Plan & Billing, and your plan is back right away.';
