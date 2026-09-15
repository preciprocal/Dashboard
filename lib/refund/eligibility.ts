// lib/refund/eligibility.ts
// Works out whether a refund request can be auto-approved or needs a human.
//
// The only auto-REJECT in here is "the guarantee was already used", which is a
// factual check. High usage never denies - it routes to review. That split is
// the whole point of the usage clause: it exists so someone can look, not so
// the system can say no on its own.
import { supabaseAdmin } from '@/supabase/admin';
import { USAGE_LIMITS, normalisePlan, type FeatureType } from '@/lib/config/usage-limits';
import { FEATURE_FIELD } from '@/lib/ai/usage-guard';
import { HIGH_USAGE_THRESHOLD_PCT, REFUND_WINDOW_DAYS } from '@/lib/config/refund';

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
  needsReview: boolean;
}

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
): Promise<{ snapshot: UsageSnapshot; maxUsagePct: number | null; maxUsageFeature: string | null }> {
  const { data: counterRow } = await supabaseAdmin
    .from('usage_counters')
    .select('*')
    .eq('user_id', supabaseUserId)
    .eq('period_start', periodStart)
    .maybeSingle();

  const limits = USAGE_LIMITS[normalisePlan(plan)];
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

export function evaluateEligibility(
  snapshot: UsageSnapshot,
  maxUsagePct: number | null,
  maxUsageFeature: string | null,
): EligibilityResult {
  return {
    snapshot,
    maxUsagePct,
    maxUsageFeature,
    needsReview: maxUsagePct !== null && maxUsagePct >= HIGH_USAGE_THRESHOLD_PCT,
  };
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
