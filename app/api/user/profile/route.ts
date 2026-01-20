// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redis, RedisKeys } from "@/lib/redis/redis-client";

// Cache TTL for user profile (5 minutes - profiles can change with subscriptions)
const USER_PROFILE_CACHE_TTL = 5 * 60;

interface UserSubscription {
  plan: string;
  status: string;
  interviewsUsed: number;
  interviewsLimit: number;
  createdAt: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  subscription: UserSubscription;
}

interface CachedUserProfile {
  profile: UserProfile;
  cachedAt: string;
}

/**
 * Get cached user profile
 */
async function getCachedUserProfile(userId: string): Promise<UserProfile | null> {
  if (!redis) return null;

  try {
    const key = RedisKeys.userPrefs(userId);
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - User profile ${userId} found`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedUserProfile).profile;
    }

    console.log(`❌ Cache MISS - User profile ${userId} not found`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache user profile
 */
async function cacheUserProfile(userId: string, profile: UserProfile): Promise<void> {
  if (!redis) return;

  try {
    const key = RedisKeys.userPrefs(userId);
    const data: CachedUserProfile = {
      profile,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, USER_PROFILE_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached user profile ${userId} for ${USER_PROFILE_CACHE_TTL / 60} minutes`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Invalidate user profile cache
 */
export async function invalidateUserProfileCache(userId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = RedisKeys.userPrefs(userId);
    await redis.del(key);
    console.log(`✅ Invalidated cache for user profile ${userId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

export async function GET() {
  const startTime = Date.now();

  try {
    console.log('👤 Fetching user profile');
    console.log('   Redis available:', !!redis);

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`📋 User authenticated: ${user.id}`);

    // Check cache first
    const cachedProfile = await getCachedUserProfile(user.id);

    if (cachedProfile) {
      const responseTime = Date.now() - startTime;
      console.log(`⚡ Returning cached user profile in ${responseTime}ms`);

      return NextResponse.json({
        ...cachedProfile,
        _metadata: {
          cached: true,
          responseTime
        }
      });
    }

    // Fetch from Firestore
    console.log('🔍 Fetching user profile from Firestore...');
    const userDoc = await db.collection("users").doc(user.id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();

    // Construct user object with subscription data
    const userWithSubscription: UserProfile = {
      id: user.id,
      name: userData?.name || user.name,
      email: userData?.email || user.email,
      subscription: {
        plan: userData?.subscription?.plan || "starter",
        status: userData?.subscription?.status || "active",
        interviewsUsed: userData?.subscription?.interviewsUsed || 0,
        interviewsLimit: userData?.subscription?.interviewsLimit || 10,
        createdAt:
          userData?.subscription?.createdAt ||
          userData?.createdAt ||
          new Date().toISOString(),
        trialEndsAt: userData?.subscription?.trialEndsAt || null,
        subscriptionEndsAt: userData?.subscription?.subscriptionEndsAt || null,
        stripeCustomerId: userData?.subscription?.stripeCustomerId || null,
        stripeSubscriptionId:
          userData?.subscription?.stripeSubscriptionId || null,
      },
    };

    // Cache the profile
    await cacheUserProfile(user.id, userWithSubscription);

    const responseTime = Date.now() - startTime;
    console.log(`✅ User profile fetched from Firestore in ${responseTime}ms`);

    return NextResponse.json({
      ...userWithSubscription,
      _metadata: {
        cached: false,
        responseTime
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

/**
 * Update user profile (invalidates cache)
 */
export async function PATCH() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Invalidate cache when profile is updated
    await invalidateUserProfileCache(user.id);
    console.log('🔄 Cache invalidated after profile update');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 }
    );
  }
}