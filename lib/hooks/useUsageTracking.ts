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

// ─── Shared cache ─────────────────────────────────────────────────────────────
//
// One copy of the user's usage for the life of the page, shared by every
// component that calls the hook. Moving between pages used to start each one
// from "no data", which rendered "0 left" and the limit-reached gate for a
// moment before the real numbers arrived.

let usageCache: { userId: string; data: UsageData } | null = null;
let inflight: { userId: string; promise: Promise<UsageData> } | null = null;

function requestUsage(userId: string, fresh: boolean): Promise<UsageData> {
  // Mounts share one request; a refetch after an action must not reuse a
  // request that started before the server counted that action.
  if (!fresh && inflight?.userId === userId) return inflight.promise;
  const promise = fetch('/api/usage').then(async res => {
    if (!res.ok) throw new Error(`Usage fetch failed: ${res.status}`);
    const data = await res.json();
    const usage: UsageData = { ...data.usage, plan: data.plan || 'free' };
    usageCache = { userId, data: usage };
    return usage;
  });
  inflight = { userId, promise };
  promise.catch(() => {}).finally(() => { if (inflight?.promise === promise) inflight = null; });
  return promise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
//
// Reads the current month's usage from Postgres via GET /api/usage. Actual
// increments happen server-side (lib/ai/usage-guard.ts) inside whichever
// route performs the gated action, so this hook is read-only - callers
// should invoke `refetch()` after their own request succeeds to pick up the
// server-side increment, rather than incrementing anything client-side.
//
// `loading` is true only while the numbers are genuinely unknown: auth still
// resolving, or the first fetch for this user. A refetch keeps the numbers on
// screen and updates them in place instead of going back to loading.

export function useUsageTracking(): UsageTrackingResult {
  const [user, authLoading] = useSupabaseUser();
  const userId = user?.id ?? null;
  const [usageData, setUsageData] = useState<UsageData | null>(
    () => (userId && usageCache?.userId === userId ? usageCache.data : null),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchUsageData = useCallback(async (fresh: boolean) => {
    if (!userId) {
      setUsageData(null);
      return;
    }
    if (usageCache?.userId === userId) setUsageData(prev => prev ?? usageCache!.data);

    try {
      setError(null);
      setUsageData(await requestUsage(userId, fresh));
    } catch (err) {
      console.error('❌ Error fetching usage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
      setUsageData(prev => prev ?? { ...DEFAULT_USAGE });
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    fetchUsageData(false);
  }, [authLoading, fetchUsageData]);

  const loading = usageData === null && (authLoading || userId !== null);

  const canUseFeature = useCallback((feature: FeatureType): boolean => {
    // Unknown is not the same as used up. Answering false here showed brand
    // new users the limit-reached gate until their numbers loaded. The
    // server enforces the real limit on every gated request regardless.
    if (!usageData) return true;
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
    await fetchUsageData(true);
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
