// lib/config/feature-costs.ts
// Estimated marginal cost in USD of one unit of each gated feature. Used for
// refund proration (lib/refund/*) and for margin checks when quotas are
// resized in lib/config/usage-limits.ts.
//
// These are ESTIMATES. Anything marked provisional below has not been measured
// against a real invoice yet. Replace them with logged figures rather than
// tuning quotas around a guess.
//
// The two debrief entries are deliberately NOT the same number, which is the
// correction this file exists to record:
//
//   interviewDebriefs - app/api/debrief POST. A plain insert into
//     interview_debriefs. No model call at all, so the marginal cost is a
//     Postgres row. Priced at 0.
//   debriefAnalyses   - app/api/debrief/analyze. A Claude call at
//     MAX_TOKENS 3500 with the user's full AI context plus every prior debrief
//     entry as input. The single most expensive text feature in the product.
//
// They were previously carried as one "interview debrief ~$0.020" line, which
// both overpriced the free one and underpriced the expensive one by roughly
// 3.5x. supabase/migrations/0020_debrief_analyses_quota.sql split the counters;
// this splits the cost model to match.

import type { FeatureType } from "@/lib/config/usage-limits";

/** Per-unit marginal cost in USD. */
export const FEATURE_COSTS: Record<FeatureType, number> = {
  // ── Text features, Claude ────────────────────────────────────────────────
  resumes: 0.014,
  coverLetters: 0.010,
  linkedinOptimisations: 0.014,
  coldOutreach: 0.010, // provisional: priced alongside coverLetters, same shape
  studyPlans: 0.050, // provisional: long structured generation, closer to a debrief analysis
  debriefAnalyses: 0.070, // ~3.5k output tokens + large context

  // ── Non-AI ───────────────────────────────────────────────────────────────
  interviewDebriefs: 0, // DB insert only
  findContacts: 0.005,
  jobTracker: 0, // DB rows; note there is no server-side enforcement today

  // ── Voice ────────────────────────────────────────────────────────────────
  // Provisional and the largest single unknown. See VAPI_COST_PER_MINUTE and
  // INTERVIEW_COST_BY_PLAN below - session length now varies by tier, so this
  // flat entry is the FREE tier figure and exists only to keep the Record
  // exhaustive. Anything costing a real interview should use
  // interviewCostForPlan() instead.
  interviews: 1.20,
} as const;

/**
 * Blended Vapi cost per minute: Deepgram STT + gpt-4o-mini + Vapi-native TTS.
 *
 * MEASURED from a real call: 723.652s costing $1.2907, which is $0.1070/min.
 * The previous $0.15 was back-solved from an unverified estimate and ran
 * roughly 40% high.
 *
 * Caveat worth keeping: this is ONE call. A session where the candidate talks
 * more shifts the STT and TTS shares, so treat it as a first measurement
 * rather than a settled figure, and re-derive from the interview_cost_summary
 * view once there is a spread of real sessions.
 *
 * Observed breakdown on that call:
 *
 *   vapi platform   $0.603   47%    roughly $0.05/min, flat
 *   tts             $0.533   41%
 *   stt             $0.119    9%
 *   llm             $0.022    2%    gpt-4o-mini is close to free here
 *   transport       $0.014    1%
 *
 * Note what that implies for optimisation: the LLM is already negligible, so
 * switching models saves nothing worth having. Platform fee and TTS are 88% of
 * the bill, and the only real lever on either is shorter calls - which is what
 * the tiered caps and the wrap-up are for.
 */
export const VAPI_COST_PER_MINUTE = 0.107;

/**
 * Cost of one mock interview, by plan.
 *
 * Session length is tiered (lib/config/interview-limits.ts): Free 8 minutes,
 * Pro 10, Premium 12. A single flat number would either under-price Premium by
 * 50% or over-price Free by a third, and interviews dominate the allowance
 * value in the refund proration - so getting this wrong skews every refund
 * quote, not just the margin model.
 *
 * Mixed interviews are pre-split across two calls whose durations sum to the
 * same tier budget, so they cost the same as a single-phase interview. That is
 * the point of the split: before it, a mixed interview dialled two full-length
 * calls and cost twice this.
 */
export const INTERVIEW_COST_BY_PLAN = {
  free: 8 * VAPI_COST_PER_MINUTE, // $1.20
  pro: 10 * VAPI_COST_PER_MINUTE, // $1.50
  premium: 12 * VAPI_COST_PER_MINUTE, // $1.80
  premium_legacy: 12 * VAPI_COST_PER_MINUTE,
  admin: 12 * VAPI_COST_PER_MINUTE,
} as const;

/** Per-unit cost of `feature` for `planKey`. Only interviews vary by plan. */
export function costForPlan(
  feature: FeatureType,
  planKey: keyof typeof INTERVIEW_COST_BY_PLAN,
): number {
  if (feature === "interviews") return INTERVIEW_COST_BY_PLAN[planKey];
  return FEATURE_COSTS[feature];
}

/** Features whose cost is dominated by a model call rather than a DB write. */
export const AI_BACKED_FEATURES: readonly FeatureType[] = [
  "resumes",
  "coverLetters",
  "linkedinOptimisations",
  "coldOutreach",
  "studyPlans",
  "debriefAnalyses",
  "interviews",
] as const;

/**
 * Costs that have not been validated against a real invoice. Surfaced so the
 * margin tooling can mark derived figures as estimates rather than presenting
 * them as measured.
 */
export const PROVISIONAL_COSTS: readonly FeatureType[] = [
  "coldOutreach",
  "studyPlans",
  "interviews",
] as const;

/** Total cost of a full month's allowance for a set of limits. -1 is skipped. */
export function costOfAllowance(limits: Record<FeatureType, number>): number {
  return (Object.keys(FEATURE_COSTS) as FeatureType[]).reduce((total, feature) => {
    const limit = limits[feature];
    if (limit < 0) return total; // unlimited cannot be costed
    return total + limit * FEATURE_COSTS[feature];
  }, 0);
}
