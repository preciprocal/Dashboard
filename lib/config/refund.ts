// lib/config/refund.ts
// Terms of the money-back guarantee, in one place so the enforced policy and
// the advertised policy cannot drift apart again.
//
// They HAD drifted, three ways: the app advertised 7-day (pricing trust row,
// help FAQ #57), 30-day (pricing hero and trust signals) and 60-day (the
// Chrome extension manifest, which is also the public Web Store listing)
// simultaneously, with no code enforcing any of them - refunds were handled
// entirely by hand. 30 days is the real policy and all four now say so.
//
// If this constant changes, those four strings have to change with it:
//   app/(root)/pricing/page.tsx  (hero + trust row + trust signals)
//   app/(root)/help/page.tsx     (FAQ #57)
//   extension/manifest.json      (needs a Web Store resubmission to go live)

export const REFUND_WINDOW_DAYS = 30;

/**
 * Usage share, in any single quota category, above which a request is routed
 * to human review instead of being auto-approved.
 *
 * 80% is a judgement call, not a derived number. The intent is to catch
 * "used the whole month's allowance, then asked for the money back" while
 * leaving genuine early-abandonment refunds untouched. Tune it once there is
 * real data in refund_requests.max_usage_pct showing where actual claims land.
 */
export const HIGH_USAGE_THRESHOLD_PCT = 80;

/**
 * Unlimited categories (limit = -1) can't produce a percentage, so they are
 * excluded from the threshold check entirely rather than counted as 0% - a
 * Premium user with unlimited cover letters shouldn't have that category
 * dilute their maximum. Documented here because it is easy to misread the
 * snapshot as "every category was under threshold".
 */
export const REFUND_STATUSES = {
  pending:  'pending',
  flagged:  'flagged',
  approved: 'approved',
  denied:   'denied',
  refunded: 'refunded',
} as const;

export type RefundStatus = (typeof REFUND_STATUSES)[keyof typeof REFUND_STATUSES];
