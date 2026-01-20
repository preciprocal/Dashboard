// lib/usage-tracker.ts
import { redis, RedisKeys, TTL } from './redis-client';

export type FeatureType = 'resume-analysis' | 'cover-letter' | 'mock-interview' | 'study-plan';
export type UserTier = 'free' | 'pro' | 'premium';

interface UsageLimits {
  'resume-analysis': number;
  'cover-letter': number;
  'mock-interview': number;
  'study-plan': number;
}

const FREE_LIMITS: UsageLimits = {
  'resume-analysis': 5,
  'cover-letter': 3,
  'mock-interview': 2,
  'study-plan': 3,
};

/**
 * Check if user can use feature and increment usage counter
 */
export async function checkAndIncrementUsage(
  userId: string,
  feature: FeatureType,
  tier: UserTier = 'free'
): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  current: number;
}> {
  // Pro/Premium users have unlimited access
  if (tier === 'pro' || tier === 'premium') {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      current: 0
    };
  }

  // If Redis is not available, allow request (fail open)
  if (!redis) {
    console.warn('⚠️ Redis unavailable - allowing request without tracking');
    return {
      allowed: true,
      remaining: FREE_LIMITS[feature],
      limit: FREE_LIMITS[feature],
      current: 0
    };
  }

  try {
    const key = RedisKeys.usage(userId, feature);
    
    // Increment counter
    const currentUsage = await redis.incr(key);
    
    // Set expiry on first use (30 days + 2 days buffer)
    if (currentUsage === 1) {
      await redis.expire(key, TTL.USAGE_COUNTER);
    }

    const limit = FREE_LIMITS[feature];
    const allowed = currentUsage <= limit;
    const remaining = Math.max(0, limit - currentUsage + 1);

    console.log(`📊 Usage check for ${userId}/${feature}: ${currentUsage}/${limit} (${allowed ? 'ALLOWED' : 'BLOCKED'})`);

    return {
      allowed,
      remaining,
      limit,
      current: currentUsage
    };
  } catch (error) {
    console.error('❌ Usage tracking error:', error);
    // Fail open - allow request if Redis fails
    return {
      allowed: true,
      remaining: FREE_LIMITS[feature],
      limit: FREE_LIMITS[feature],
      current: 0
    };
  }
}

/**
 * Get current usage without incrementing
 */
export async function getCurrentUsage(
  userId: string,
  feature: FeatureType
): Promise<{
  current: number;
  limit: number;
  remaining: number;
}> {
  if (!redis) {
    return {
      current: 0,
      limit: FREE_LIMITS[feature],
      remaining: FREE_LIMITS[feature]
    };
  }

  try {
    const key = RedisKeys.usage(userId, feature);
    const current = await redis.get(key);
    const currentNum = current ? Number(current) : 0;
    const limit = FREE_LIMITS[feature];
    
    return {
      current: currentNum,
      limit,
      remaining: Math.max(0, limit - currentNum)
    };
  } catch (error) {
    console.error('❌ Get usage error:', error);
    return {
      current: 0,
      limit: FREE_LIMITS[feature],
      remaining: FREE_LIMITS[feature]
    };
  }
}

/**
 * Reset usage for a user/feature (admin function)
 */
export async function resetUsage(userId: string, feature: FeatureType): Promise<boolean> {
  if (!redis) return false;

  try {
    const key = RedisKeys.usage(userId, feature);
    await redis.del(key);
    console.log(`✅ Reset usage for ${userId}/${feature}`);
    return true;
  } catch (error) {
    console.error('❌ Reset usage error:', error);
    return false;
  }
}

/**
 * Get all usage stats for a user
 */
export async function getAllUsageStats(userId: string): Promise<Record<FeatureType, {
  current: number;
  limit: number;
  remaining: number;
}>> {
  const features: FeatureType[] = ['resume-analysis', 'cover-letter', 'mock-interview', 'study-plan'];
  
  const stats = await Promise.all(
    features.map(feature => getCurrentUsage(userId, feature))
  );

  return features.reduce((acc, feature, index) => {
    acc[feature] = stats[index];
    return acc;
  }, {} as Record<FeatureType, { current: number; limit: number; remaining: number; }>);
}