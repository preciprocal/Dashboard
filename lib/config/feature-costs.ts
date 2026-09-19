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
  // Provisional and the largest single unknown. Assumes an 8 minute call at
  // Vapi's bundled rate (Deepgram STT + gpt-4o-mini + vapi TTS). Nothing in
  // the app records real call duration or cost yet, so this is unverified.
  // A "mixed" interview currently dials two calls back to back, so a single
  // quota unit can cost twice this.
  interviews: 1.20,
} as const;

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
