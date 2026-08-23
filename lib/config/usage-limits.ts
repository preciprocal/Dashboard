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
    coverLetters: 3,
    resumes: 2,
    studyPlans: 1,
    interviews: 1,
    interviewDebriefs: 1,
    debriefAnalyses: 1,
    linkedinOptimisations: 1,
    coldOutreach: 1,
    findContacts: 1,
    jobTracker: 5,
  },
  pro: {
    coverLetters: 20,
    resumes: 10,
    studyPlans: 3,
    interviews: 5,
    interviewDebriefs: 3,
    debriefAnalyses: 3,
    linkedinOptimisations: 3,
    coldOutreach: 5,
    findContacts: 10,
    jobTracker: -1,       // unlimited
  },
  premium: {
    coverLetters: -1,     // unlimited
    resumes: 30,
    studyPlans: 15,
    interviews: 30,
    interviewDebriefs: 20,
    debriefAnalyses: 20,
    linkedinOptimisations: 15,
    coldOutreach: -1,     // unlimited
    findContacts: 30,
    jobTracker: -1,       // unlimited
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

export const FEATURE_NAMES: Record<FeatureType, string> = {
  coverLetters: 'Cover Letters',
  resumes: 'Resume Analyses',
  studyPlans: 'Study Plans',
  interviews: 'Interview Sessions',
  interviewDebriefs: 'Interview Debriefs',
  debriefAnalyses: 'AI Debrief Insights',
  linkedinOptimisations: 'LinkedIn Optimisations',
  coldOutreach: 'Outreach Messages',
  findContacts: 'Find Contacts',
  jobTracker: 'Job Tracker',
};

export function getFeatureLimit(plan: string, feature: FeatureType): number {
  const normalised = normalisePlan(plan);
  return USAGE_LIMITS[normalised][feature];
}

export function normalisePlan(plan: string): keyof PlanLimits {
  const p = plan.toLowerCase();
  if (p === 'admin')   return 'admin';
  if (p === 'pro')     return 'pro';
  if (p === 'premium') return 'premium';
  return 'free'; // covers "free", "starter", unknown
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