// hooks/useUsageTracking.ts - UPDATED WITH BETTER LOGGING AND ERROR HANDLING
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { 
  FeatureType, 
  getFeatureLimit, 
  hasReachedLimit, 
  getRemainingUsage,
  isUnlimited
} from '@/lib/config/usage-limits';

interface UsageData {
  coverLettersUsed: number;
  resumesUsed: number;
  studyPlansUsed: number;
  interviewsUsed: number;
  plan: string;
  lastReset: Date;
}

interface UsageTrackingResult {
  loading: boolean;
  canUseFeature: (feature: FeatureType) => boolean;
  getRemainingCount: (feature: FeatureType) => number;
  getUsedCount: (feature: FeatureType) => number;
  getLimit: (feature: FeatureType) => number;
  incrementUsage: (feature: FeatureType) => Promise<void>;
  checkAndShowSurvey: (feature: FeatureType) => boolean;
  usageData: UsageData | null;
  error: string | null;
  refetch: () => Promise<void>;
}

const FEATURE_TO_FIELD_MAP: Record<FeatureType, keyof UsageData> = {
  coverLetters: 'coverLettersUsed',
  resumes: 'resumesUsed',
  studyPlans: 'studyPlansUsed',
  interviews: 'interviewsUsed',
};

export function useUsageTracking(): UsageTrackingResult {
  const [user] = useAuthState(auth);
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch usage data from Firestore
  const fetchUsageData = useCallback(async () => {
    if (!user) {
      console.log('⚠️ No user, skipping usage fetch');
      setLoading(false);
      setUsageData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching usage data for user:', user.uid);
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log('📝 User document does not exist, creating initial data...');
        
        const initialData: UsageData = {
          coverLettersUsed: 0,
          resumesUsed: 0,
          studyPlansUsed: 0,
          interviewsUsed: 0,
          plan: 'free',
          lastReset: new Date(),
        };
        
        await setDoc(userDocRef, {
          usage: initialData,
          email: user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
        
        setUsageData(initialData);
        console.log('✅ Initialized usage data for new user:', initialData);
      } else {
        const data = userDoc.data();
        console.log('📊 Raw Firestore data:', data);
        
        const usage = data?.usage || {};
        const subscription = data?.subscription || {};
        
        console.log('📦 Usage object:', usage);
        console.log('💳 Subscription:', subscription);
        
        const parsedData: UsageData = {
          coverLettersUsed: usage.coverLettersUsed || 0,
          resumesUsed: usage.resumesUsed || 0,
          studyPlansUsed: usage.studyPlansUsed || 0,
          interviewsUsed: usage.interviewsUsed || 0,
          plan: subscription.plan || 'free',
          lastReset: usage.lastReset?.toDate?.() 
            || (usage.lastReset ? new Date(usage.lastReset) : new Date()),
        };
        
        // If usage object doesn't exist, initialize it
        if (!data.usage) {
          console.log('⚠️ Usage object missing, initializing...');
          await updateDoc(userDocRef, {
            'usage.coverLettersUsed': 0,
            'usage.resumesUsed': 0,
            'usage.studyPlansUsed': 0,
            'usage.interviewsUsed': 0,
            'usage.lastReset': serverTimestamp(),
          });
        }
        
        setUsageData(parsedData);
        console.log('✅ Fetched usage data:', parsedData);
      }
    } catch (err) {
      console.error('❌ Error fetching usage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
      
      // Set default data on error to prevent blocking user
      setUsageData({
        coverLettersUsed: 0,
        resumesUsed: 0,
        studyPlansUsed: 0,
        interviewsUsed: 0,
        plan: 'free',
        lastReset: new Date(),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch on mount and when user changes
  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Check if user can use a feature
  const canUseFeature = useCallback((feature: FeatureType): boolean => {
    if (!usageData) {
      console.warn('⚠️ No usage data available');
      return false;
    }
    
    const fieldName = FEATURE_TO_FIELD_MAP[feature];
    const used = usageData[fieldName] as number;
    const limit = getFeatureLimit(usageData.plan, feature);
    
    console.log(`🔍 Checking ${feature}:`, { used, limit, plan: usageData.plan });
    
    // If unlimited, always return true
    if (isUnlimited(limit)) {
      console.log(`✅ ${feature} is unlimited`);
      return true;
    }
    
    const canUse = !hasReachedLimit(used, limit);
    console.log(`${canUse ? '✅' : '❌'} Can use ${feature}?`, { used, limit, canUse });
    
    return canUse;
  }, [usageData]);

  // Get remaining count for a feature
  const getRemainingCount = useCallback((feature: FeatureType): number => {
    if (!usageData) {
      return 0;
    }
    
    const fieldName = FEATURE_TO_FIELD_MAP[feature];
    const used = usageData[fieldName] as number;
    const limit = getFeatureLimit(usageData.plan, feature);
    
    return getRemainingUsage(used, limit);
  }, [usageData]);

  // Get used count for a feature
  const getUsedCount = useCallback((feature: FeatureType): number => {
    if (!usageData) {
      return 0;
    }
    
    const fieldName = FEATURE_TO_FIELD_MAP[feature];
    return usageData[fieldName] as number;
  }, [usageData]);

  // Get limit for a feature
  const getLimit = useCallback((feature: FeatureType): number => {
    if (!usageData) {
      return 0;
    }
    
    return getFeatureLimit(usageData.plan, feature);
  }, [usageData]);

  // Increment usage for a feature
  const incrementUsage = useCallback(async (feature: FeatureType): Promise<void> => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const fieldName = FEATURE_TO_FIELD_MAP[feature];
    
    try {
      console.log(`⬆️ Incrementing usage for ${feature}...`);
      
      const userDocRef = doc(db, 'users', user.uid);
      
      // First, ensure the usage object exists
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists() || !userDoc.data()?.usage) {
        console.log('📝 Creating usage object before increment');
        await setDoc(userDocRef, {
          usage: {
            coverLettersUsed: 0,
            resumesUsed: 0,
            studyPlansUsed: 0,
            interviewsUsed: 0,
            lastReset: serverTimestamp(),
          }
        }, { merge: true });
      }
      
      // Now increment
      await updateDoc(userDocRef, {
        [`usage.${fieldName}`]: increment(1),
        'usage.lastUpdated': serverTimestamp(),
      });
      
      console.log(`✅ Incremented ${feature} in Firestore`);
      
      // Update local state optimistically
      setUsageData(prev => {
        if (!prev) return prev;
        
        const newData = {
          ...prev,
          [fieldName]: (prev[fieldName] as number) + 1,
        };
        
        console.log(`✅ Updated local state for ${feature}:`, newData);
        return newData;
      });
      
      // Refetch to ensure consistency
      setTimeout(() => {
        console.log('🔄 Refetching to verify increment...');
        fetchUsageData();
      }, 1000);
      
    } catch (err) {
      console.error(`❌ Error incrementing usage for ${feature}:`, err);
      throw err;
    }
  }, [user, fetchUsageData]);

  // Check if should show survey (when limit is exactly reached)
  const checkAndShowSurvey = useCallback((feature: FeatureType): boolean => {
    if (!usageData) {
      return false;
    }
    
    const fieldName = FEATURE_TO_FIELD_MAP[feature];
    const used = usageData[fieldName] as number;
    const limit = getFeatureLimit(usageData.plan, feature);
    
    // Don't show survey for unlimited plans
    if (isUnlimited(limit)) {
      return false;
    }
    
    // Show survey when limit is exactly reached (not exceeded)
    const shouldShow = used === limit;
    
    console.log(`🔔 Should show survey for ${feature}?`, { used, limit, shouldShow });
    
    return shouldShow;
  }, [usageData]);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    await fetchUsageData();
  }, [fetchUsageData]);

  return {
    loading,
    canUseFeature,
    getRemainingCount,
    getUsedCount,
    getLimit,
    incrementUsage,
    checkAndShowSurvey,
    usageData,
    error,
    refetch,
  };
}