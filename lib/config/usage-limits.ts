// lib/config/usage-limits.ts

export interface UsageLimits {
  coverLetters: number;
  resumes: number;
  studyPlans: number;
  interviews: number;
  interviewDebriefs: number;
  linkedinOptimisations: number;
  coldOutreach: number;
  findContacts: number;
  jobTracker: number;
}

export interface PlanLimits {
  free: UsageLimits;
  pro: UsageLimits;
  premium: UsageLimits;
}

export const USAGE_LIMITS: PlanLimits = {
  free: {
    coverLetters: 5,
    resumes: 5,
    studyPlans: 2,
    interviews: 2,
    interviewDebriefs: 1,
    linkedinOptimisations: 2,
    coldOutreach: 2,
    findContacts: 2,
    jobTracker: 10,
  },
  pro: {
    coverLetters: -1,
    resumes: -1,
    studyPlans: -1,
    interviews: -1,
    interviewDebriefs: -1,
    linkedinOptimisations: 5,
    coldOutreach: -1,
    findContacts: 10,
    jobTracker: -1,
  },
  premium: {
    coverLetters: -1,
    resumes: -1,
    studyPlans: -1,
    interviews: -1,
    interviewDebriefs: -1,
    linkedinOptimisations: -1,
    coldOutreach: -1,
    findContacts: -1,
    jobTracker: -1,
  },
};

export type FeatureType =
  | 'coverLetters'
  | 'resumes'
  | 'studyPlans'
  | 'interviews'
  | 'interviewDebriefs'
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