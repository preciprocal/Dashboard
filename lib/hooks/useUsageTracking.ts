// lib/hooks/useUsageTracking.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import {
  FeatureType,
  getFeatureLimit,
  hasReachedLimit,
  getRemainingUsage,
  isUnlimited,
} from '@/lib/config/usage-limits';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsageData {
  coverLettersUsed: number;
  resumesUsed: number;
  studyPlansUsed: number;
  interviewsUsed: number;
  interviewDebriefsUsed: number;
  debriefAnalysesUsed: number;
  linkedinOptimisationsUsed: number;
  coldOutreachUsed: number;
  findContactsUsed: number;
  jobTrackerUsed: number;
  plan: string;
}

interface UsageTrackingResult {
  loading: boolean;
  canUseFeature: (feature: FeatureType) => boolean;
  getRemainingCount: (feature: FeatureType) => number;
  getUsedCount: (feature: FeatureType) => number;
  getLimit: (feature: FeatureType) => number;
  checkAndShowSurvey: (feature: FeatureType) => boolean;
  usageData: UsageData | null;
  error: string | null;
  refetch: () => Promise<void>;
}

// ─── Field map ────────────────────────────────────────────────────────────────

const FEATURE_TO_FIELD_MAP: Record<FeatureType, keyof UsageData> = {
  coverLetters:          'coverLettersUsed',
  resumes:               'resumesUsed',
  studyPlans:            'studyPlansUsed',
  interviews:            'interviewsUsed',
  interviewDebriefs:     'interviewDebriefsUsed',
  debriefAnalyses:       'debriefAnalysesUsed',
  linkedinOptimisations: 'linkedinOptimisationsUsed',
  coldOutreach:          'coldOutreachUsed',
  findContacts:          'findContactsUsed',
  jobTracker:            'jobTrackerUsed',
};

const DEFAULT_USAGE: UsageData = {
  coverLettersUsed: 0,
  resumesUsed: 0,
  studyPlansUsed: 0,
  interviewsUsed: 0,
  interviewDebriefsUsed: 0,
  debriefAnalysesUsed: 0,
  linkedinOptimisationsUsed: 0,
  coldOutreachUsed: 0,
  findContactsUsed: 0,
  jobTrackerUsed: 0,
  plan: 'free',
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
//
// Reads the current month's usage from Postgres via GET /api/usage. Actual
// increments happen server-side (lib/ai/usage-guard.ts) inside whichever
// route performs the gated action, so this hook is read-only - callers
// should invoke `refetch()` after their own request succeeds to pick up the
// server-side increment, rather than incrementing anything client-side.

export function useUsageTracking(): UsageTrackingResult {
  const [user] = useSupabaseUser();
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setUsageData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/usage');
      if (!res.ok) throw new Error(`Usage fetch failed: ${res.status}`);
      const data = await res.json();

      setUsageData({ ...data.usage, plan: data.plan || 'free' });
    } catch (err) {
      console.error('❌ Error fetching usage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
      setUsageData({ ...DEFAULT_USAGE });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  const canUseFeature = useCallback((feature: FeatureType): boolean => {
    if (!usageData) return false;
    const used = usageData[FEATURE_TO_FIELD_MAP[feature]] as number;
    const limit = getFeatureLimit(usageData.plan, feature);
    if (isUnlimited(limit)) return true;
    return !hasReachedLimit(used, limit);
  }, [usageData]);

  const getRemainingCount = useCallback((feature: FeatureType): number => {
    if (!usageData) return 0;
    const used = usageData[FEATURE_TO_FIELD_MAP[feature]] as number;
    const limit = getFeatureLimit(usageData.plan, feature);
    return getRemainingUsage(used, limit);
  }, [usageData]);

  const getUsedCount = useCallback((feature: FeatureType): number => {
    if (!usageData) return 0;
    return usageData[FEATURE_TO_FIELD_MAP[feature]] as number;
  }, [usageData]);

  const getLimit = useCallback((feature: FeatureType): number => {
    if (!usageData) return 0;
    return getFeatureLimit(usageData.plan, feature);
  }, [usageData]);

  const checkAndShowSurvey = useCallback((feature: FeatureType): boolean => {
    if (!usageData) return false;
    const used = usageData[FEATURE_TO_FIELD_MAP[feature]] as number;
    const limit = getFeatureLimit(usageData.plan, feature);
    if (isUnlimited(limit)) return false;
    return used === limit;
  }, [usageData]);

  const refetch = useCallback(async () => {
    await fetchUsageData();
  }, [fetchUsageData]);

  return {
    loading,
    canUseFeature,
    getRemainingCount,
    getUsedCount,
    getLimit,
    checkAndShowSurvey,
    usageData,
    error,
    refetch,
  };
}
