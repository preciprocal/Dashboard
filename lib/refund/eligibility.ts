// lib/refund/eligibility.ts
// Works out whether a refund request can be auto-approved or needs a human.
//
// The only auto-REJECT in here is "the guarantee was already used", which is a
// factual check. High usage never denies - it routes to review. That split is
// the whole point of the usage clause: it exists so someone can look, not so
// the system can say no on its own.
import { supabaseAdmin } from '@/supabase/admin';
import { USAGE_LIMITS, resolvePlanKey, type FeatureType } from '@/lib/config/usage-limits';
import { FEATURE_FIELD } from '@/lib/ai/usage-guard';
import {
  HIGH_USAGE_THRESHOLD_PCT,
  REFUND_WINDOW_DAYS,
  INTERVIEW_ELIGIBILITY_THRESHOLD_PCT,
  ELIGIBILITY_GATE_FEATURE,
} from '@/lib/config/refund';

export interface FeatureUsage {
  used: number;
  limit: number;   // -1 = unlimited
  pct: number | null;  // null for unlimited - see REFUND_STATUSES note in config
}

export type UsageSnapshot = Record<string, FeatureUsage>;

export interface EligibilityResult {
  snapshot: UsageSnapshot;
  /** Highest usage share across all *limited* categories. Null if every
   *  category on this plan is unlimited. */
  maxUsagePct: number | null;
  /** The category that produced maxUsagePct, for the review queue payload. */
  maxUsageFeature: string | null;
  /**
   * Within the refund queue this is a TRIAGE SORT SIGNAL only, not a suspicion
   * marker. Task 2 routes every request to a human regardless, and the
   * interview gate below already requires heavy usage to be eligible at all -
   * so most eligible requests trip this by construction. It orders the queue;
   * it does not judge.
   *
   * HIGH_USAGE_THRESHOLD_PCT keeps its original meaning everywhere else it is
   * used.
   */
  needsReview: boolean;
  /** Did interview usage clear INTERVIEW_ELIGIBILITY_THRESHOLD_PCT? */
  eligible: boolean;
  /** Machine-readable denial reason. Null when eligible. */
  ineligibleReason: IneligibleReason | null;
  /** Interview usage share for the period. Null when unlimited or unset. */
  interviewUsagePct: number | null;
}

export type IneligibleReason =
  | 'interview_usage_below_threshold'
  | 'no_interview_quota';

/**
 * Freeze what the account has consumed this period.
 *
 * Reads the CALENDAR-month counter row, matching how quotas are currently
 * tracked everywhere else (lib/ai/usage-guard.ts getCurrentPeriod). Once
 * Task 4 moves resets to a rolling window anchored on the subscription start
 * date, this function inherits that automatically - it asks for the period it
 * is given rather than computing its own.
 */
export async function buildUsageSnapshot(
  supabaseUserId: string,
  plan: string,
  periodStart: string,
  opts: { isAdmin?: boolean; legacyQuotas?: boolean } = {},
): Promise<{ snapshot: UsageSnapshot; maxUsagePct: number | null; maxUsageFeature: string | null }> {
  const { data: counterRow } = await supabaseAdmin
    .from('usage_counters')
    .select('*')
    .eq('user_id', supabaseUserId)
    .eq('period_start', periodStart)
    .maybeSingle();

  const limits = USAGE_LIMITS[resolvePlanKey(plan, opts)];
  const snapshot: UsageSnapshot = {};

  let maxUsagePct: number | null = null;
  let maxUsageFeature: string | null = null;

  for (const [feature, column] of Object.entries(FEATURE_FIELD)) {
    const limit = limits[feature as FeatureType] ?? 0;
    const used  = (counterRow?.[column] as number | undefined) ?? 0;

    // Unlimited categories produce no percentage at all rather than 0 - see
    // the note in lib/config/refund.ts. Counting them as 0 would drag a
    // Premium account's maximum down and hide real consumption.
    const pct = limit === -1 ? null : limit === 0 ? null : Math.round((used / limit) * 100);

    snapshot[feature] = { used, limit, pct };

    if (pct !== null && (maxUsagePct === null || pct > maxUsagePct)) {
      maxUsagePct     = pct;
      maxUsageFeature = feature;
    }
  }

  return { snapshot, maxUsagePct, maxUsageFeature };
}

/**
 * Apply the usage gate.
 *
 * The rule is narrow on purpose: eligibility keys on mock-interview usage
 * ALONE. How little of every other category was consumed is irrelevant, so a
 * user who touched nothing at all is denied while one who used most of their
 * interviews is not. That inverts a conventional satisfaction guarantee and is
 * the intended policy, not an oversight.
 *
 * Keyed on interview COUNT rather than minutes. Task 1 specifies minutes, but
 * nothing in the app records call duration today - interviews.duration is a
 * template label like "45 minutes", and Number("45 minutes") is NaN. Once Task
 * 6 lands real per-call duration logging this can move to minutes without the
 * gate's shape changing.
 */
export function evaluateEligibility(
  snapshot: UsageSnapshot,
  maxUsagePct: number | null,
  maxUsageFeature: string | null,
): EligibilityResult {
  const interviews = snapshot[ELIGIBILITY_GATE_FEATURE];
  const interviewUsagePct = interviews?.pct ?? null;

  // pct is null for unlimited (admin) and for a zero limit. Neither can produce
  // a usage share, so neither can clear a threshold expressed as one.
  const eligible =
    interviewUsagePct !== null && interviewUsagePct > INTERVIEW_ELIGIBILITY_THRESHOLD_PCT;

  const ineligibleReason: IneligibleReason | null = eligible
    ? null
    : interviewUsagePct === null
      ? 'no_interview_quota'
      : 'interview_usage_below_threshold';

  return {
    snapshot,
    maxUsagePct,
    maxUsageFeature,
    needsReview: maxUsagePct !== null && maxUsagePct >= HIGH_USAGE_THRESHOLD_PCT,
    eligible,
    ineligibleReason,
    interviewUsagePct,
  };
}

/** User-facing explanation. Task 2 requires a clear reason, not a silent denial. */
export function explainIneligibility(
  reason: IneligibleReason,
  interviewUsagePct: number | null,
  interviewLimit: number,
): string {
  switch (reason) {
    case 'interview_usage_below_threshold':
      return (
        `Refunds are available once you have used more than ` +
        `${INTERVIEW_ELIGIBILITY_THRESHOLD_PCT}% of your mock interviews for this billing period. ` +
        `You have used ${interviewUsagePct ?? 0}% (${interviewLimit === -1 ? 'unlimited' : interviewLimit} included). ` +
        `Try a mock interview first - it is the part of Preciprocal most likely to change your result.`
      );
    case 'no_interview_quota':
      return 'This plan has no mock interview allowance to measure a refund against.';
  }
}

/**
 * Is the purchase still inside the guarantee window?
 *
 * Anchored on when the CURRENT billing period started, not on when the account
 * was created - otherwise a user who subscribed eleven months ago would be
 * permanently outside the window, and someone who signed up for a free account
 * a year before paying would never be inside it.
 */
export function isWithinRefundWindow(periodStart: string | null): boolean {
  if (!periodStart) return false;
  const elapsedMs = Date.now() - new Date(periodStart).getTime();
  return elapsedMs <= REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000 && elapsedMs >= 0;
}
