// lib/config/usage-limits.ts

export interface UsageLimits {
  coverLetters: number;
  resumes: number;
  studyPlans: number;
  interviews: number;
  interviewDebriefs: number;
  debriefAnalyses: number;
  linkedinOptimisations: number;
  coldOutreach: number;
  findContacts: number;
  jobTracker: number;
}

export interface PlanLimits {
  free: UsageLimits;
  pro: UsageLimits;
  premium: UsageLimits;
  /**
   * Premium subscribers who were on the pre-resize quotas, which had unlimited
   * coverLetters and coldOutreach. Not purchasable and not stored in
   * subscriptions.plan - those rows still say 'premium'. The distinction is
   * the subscriptions.legacy_quotas boolean, resolved by resolvePlanKey().
   *
   * Time-boxed on purpose: the renewal path in the Stripe webhook clears
   * legacy_quotas, so a legacy subscriber moves to the capped premium table at
   * their next renewal rather than keeping unlimited forever. Indefinite
   * unlimited would reopen the abuse vector the resize exists to close.
   */
  premium_legacy: UsageLimits;
  admin: UsageLimits;
}

const UNLIMITED: UsageLimits = {
  coverLetters: -1,
  resumes: -1,
  studyPlans: -1,
  interviews: -1,
  interviewDebriefs: -1,
  debriefAnalyses: -1,
  linkedinOptimisations: -1,
  coldOutreach: -1,
  findContacts: -1,
  jobTracker: -1,
};

export const USAGE_LIMITS: PlanLimits = {
  // Granted via profiles.is_admin, not a purchasable plan - see
  // lib/ai/usage-guard.ts, which forces this plan for admin accounts
  // regardless of what's in the subscriptions table.
  admin: UNLIMITED,
  free: {
    coverLetters: 5,
    resumes: 3,
    studyPlans: 2,
    interviews: 1,        // 8 min per session, capped server-side - interview-limits.ts
    interviewDebriefs: 10, // DB insert, no model call - see feature-costs.ts
    debriefAnalyses: 1,
    linkedinOptimisations: 2,
    coldOutreach: 3,
    findContacts: 3,
    jobTracker: 8,
  },
  pro: {
    coverLetters: 30,
    resumes: 20,
    studyPlans: 10,
    interviews: 2,        // 10 min per session, capped server-side - interview-limits.ts
    interviewDebriefs: 60,
    debriefAnalyses: 4,
    linkedinOptimisations: 5,
    coldOutreach: 20,
    findContacts: 15,
    jobTracker: -1,       // unlimited
  },
  premium: {
    coverLetters: 80,
    resumes: 50,
    studyPlans: 25,
    interviews: 5,        // 12 min per session, capped server-side - interview-limits.ts
    interviewDebriefs: 150,
    debriefAnalyses: 12,
    linkedinOptimisations: 15,
    coldOutreach: 60,
    findContacts: 50,
    jobTracker: -1,       // unlimited
  },
  // Identical to `premium` except the two categories that were unlimited
  // before the resize. Everything else takes the new, higher caps, so a legacy
  // subscriber is never worse off than a new one mid-transition.
  premium_legacy: {
    coverLetters: -1,     // unlimited (pre-resize)
    resumes: 50,
    studyPlans: 25,
    interviews: 5,
    interviewDebriefs: 150,
    debriefAnalyses: 12,
    linkedinOptimisations: 15,
    coldOutreach: -1,     // unlimited (pre-resize)
    findContacts: 50,
    jobTracker: -1,
  },
};

export type FeatureType =
  | 'coverLetters'
  | 'resumes'
  | 'studyPlans'
  | 'interviews'
  | 'interviewDebriefs'
  | 'debriefAnalyses'
  | 'linkedinOptimisations'
  | 'coldOutreach'
  | 'findContacts'
  | 'jobTracker';

/**
 * User-facing names. These appear in quota-limit messages, so they have to
 * distinguish three things that all sound alike and are genuinely different:
 *
 *   interviews         - MOCK interviews we host, voice sessions with the AI
 *   interviewDebriefs  - journal entries for REAL interviews the user sat
 *                        elsewhere (company, role, stage, outcome, how it felt)
 *   debriefAnalyses    - AI analysis ACROSS that real-interview journal:
 *                        readiness score, recurring patterns, blind spots,
 *                        a 4-week plan
 *
 * The previous labels were "Interview Sessions", "Interview Debriefs" and
 * "AI Debrief Insights", which read as three names for one feature. A user
 * told they had run out of "Interview Sessions" had no way to know whether
 * that meant practice or their own journal.
 */
export const FEATURE_NAMES: Record<FeatureType, string> = {
  coverLetters: 'Cover Letters',
  resumes: 'Resume Analyses',
  studyPlans: 'Study Plans',
  interviews: 'Mock Interviews',
  interviewDebriefs: 'Interview Journal Entries',
  debriefAnalyses: 'AI Interview Analyses',
  linkedinOptimisations: 'LinkedIn Optimisations',
  coldOutreach: 'Outreach Messages',
  findContacts: 'Contact Searches',
  jobTracker: 'Job Tracker',
};

export function getFeatureLimit(plan: string, feature: FeatureType): number {
  const normalised = normalisePlan(plan);
  return USAGE_LIMITS[normalised][feature];
}

export function normalisePlan(plan: string): keyof PlanLimits {
  const p = plan.toLowerCase().trim();
  if (p === 'admin')   return 'admin';
  if (p === 'pro')     return 'pro';
  if (p === 'premium') return 'premium';
  return 'free'; // covers "free", "starter", unknown
}

/**
 * The plan key a user's quotas should actually be read from.
 *
 * normalisePlan() alone cannot answer this: a grandfathered Premium subscriber
 * still has plan = 'premium' in the database, and admin status lives on
 * profiles.is_admin rather than on the subscription at all. Anything that gates
 * or displays quota should call this rather than normalisePlan() directly.
 */
export function resolvePlanKey(
  plan: string | null | undefined,
  opts: { isAdmin?: boolean; legacyQuotas?: boolean } = {},
): keyof PlanLimits {
  if (opts.isAdmin) return 'admin';
  const key = normalisePlan(plan ?? 'free');
  if (key === 'premium' && opts.legacyQuotas) return 'premium_legacy';
  return key;
}

/** True for plan keys that are grandfathered rather than purchasable. */
export function isLegacyPlanKey(key: keyof PlanLimits): boolean {
  return key === 'premium_legacy';
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}

export function hasReachedLimit(used: number, limit: number): boolean {
  if (isUnlimited(limit)) return false;
  return used >= limit;
}

export function getRemainingUsage(used: number, limit: number): number {
  if (isUnlimited(limit)) return -1;
  return Math.max(0, limit - used);
}