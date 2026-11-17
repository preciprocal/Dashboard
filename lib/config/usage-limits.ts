// lib/config/usage-limits.ts

export interface UsageLimits {
  /** One job taken through the Apply flow: tailored resume, cover letter and prep. */
  applications: number;
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
  admin: UsageLimits;
}

const UNLIMITED: UsageLimits = {
  applications: -1,
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
  // Sized so a month at the full allowance still leaves at least half of the
  // price after model costs and card fees, except for mock interviews, which
  // were kept as they were (voice is most of the cost: see feature-costs.ts).
  // Free is a taste of each feature, not a working allowance.
  free: {
    applications: 1,
    coverLetters: 2,
    resumes: 2,
    studyPlans: 1,
    interviews: 1,        // 8 min per session, capped server-side - interview-limits.ts
    // Sized to a real month of interviewing rather than to cost. A debrief is
    // a DB insert with no model call (feature-costs.ts prices it at 0), so the
    // old 10/60/150 ladder was an abuse ceiling that nobody could reach - and
    // it was advertised, so Premium's card claimed 150 real interviews a month.
    interviewDebriefs: 2,
    debriefAnalyses: 1,
    linkedinOptimisations: 1,
    coldOutreach: 2,
    findContacts: 2,
    jobTracker: -1,      // unlimited on every plan: DB rows, $0 to serve
  },
  pro: {
    applications: 6,
    coverLetters: 10,
    resumes: 10,
    studyPlans: 3,
    interviews: 3,        // 10 min per session, capped server-side - interview-limits.ts
    interviewDebriefs: 5,
    debriefAnalyses: 2,
    linkedinOptimisations: 3,
    coldOutreach: 10,
    findContacts: 10,
    jobTracker: -1,       // unlimited
  },
  premium: {
    applications: 12,
    coverLetters: 20,
    resumes: 20,
    studyPlans: 5,
    interviews: 5,        // 12 min per session, capped server-side - interview-limits.ts
    interviewDebriefs: 10,
    debriefAnalyses: 4,
    linkedinOptimisations: 5,
    coldOutreach: 20,
    findContacts: 20,
    jobTracker: -1,       // unlimited
  },
};

export type FeatureType =
  | 'applications'
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
  applications: 'Job Applications',
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
 * normalisePlan() alone cannot answer this: admin status lives on
 * profiles.is_admin rather than on the subscription at all. Anything that gates
 * or displays quota should call this rather than normalisePlan() directly.
 */
export function resolvePlanKey(
  plan: string | null | undefined,
  opts: { isAdmin?: boolean } = {},
): keyof PlanLimits {
  if (opts.isAdmin) return 'admin';
  return normalisePlan(plan ?? 'free');
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