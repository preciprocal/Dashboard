// lib/config/usage-limits.ts

export interface UsageLimits {
  coverLetters: number;
  resumes: number;
  studyPlans: number;
  interviews: number;
}

export interface PlanLimits {
  free: UsageLimits;
  starter: UsageLimits;
  pro: UsageLimits;
  premium: UsageLimits;
}

export const USAGE_LIMITS: PlanLimits = {
  free: {
    coverLetters: 5,
    resumes: 5,
    studyPlans: 2,
    interviews: 2,
  },
  starter: {
    coverLetters: 5,
    resumes: 5,
    studyPlans: 2,
    interviews: 2,
  },
  pro: {
    coverLetters: -1, // unlimited
    resumes: -1,
    studyPlans: -1,
    interviews: -1,
  },
  premium: {
    coverLetters: -1, // unlimited
    resumes: -1,
    studyPlans: -1,
    interviews: -1,
  },
};

export type FeatureType = 'coverLetters' | 'resumes' | 'studyPlans' | 'interviews';

export const FEATURE_NAMES: Record<FeatureType, string> = {
  coverLetters: 'Cover Letters',
  resumes: 'Resume Analyses',
  studyPlans: 'Study Plans',
  interviews: 'Interview Sessions',
};

export function getFeatureLimit(plan: string, feature: FeatureType): number {
  const planKey = (plan.toLowerCase() as keyof PlanLimits) || 'free';
  return USAGE_LIMITS[planKey]?.[feature] ?? USAGE_LIMITS.free[feature];
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