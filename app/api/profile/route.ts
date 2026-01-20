// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";
import { redis } from "@/lib/redis/redis-client";

// Cache TTL for profile data (5 minutes)
const PROFILE_CACHE_TTL = 5 * 60;

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  bio: string;
  targetRole: string;
  experienceLevel: string;
  preferredTech: string[];
  careerGoals: string;
  linkedIn: string;
  github: string;
  website: string;
  provider: string;
  createdAt: string;
  lastLogin: string;
  subscription: {
    plan: string;
    status: string;
    interviewsUsed: number;
    interviewsLimit: number;
    createdAt: string;
    trialEndsAt: string | null;
    subscriptionEndsAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    canceledAt: string | null;
    lastPaymentAt: string | null;
  };
}

// Use generic type for interviews to avoid type conflicts
type InterviewData = Record<string, unknown>;

interface CachedProfileResponse {
  user: ProfileData;
  interviews: InterviewData[];
  cachedAt: string;
}

/**
 * Get cached profile data
 */
async function getCachedProfile(userId: string): Promise<CachedProfileResponse | null> {
  if (!redis) return null;

  try {
    const key = `profile-complete:${userId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - Complete profile for ${userId}`);
      return typeof cached === 'string' ? JSON.parse(cached) : (cached as CachedProfileResponse);
    }

    console.log(`❌ Cache MISS - Complete profile for ${userId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache profile data
 */
async function cacheProfile(userId: string, profileData: CachedProfileResponse): Promise<void> {
  if (!redis) return;

  try {
    const key = `profile-complete:${userId}`;
    await redis.setex(key, PROFILE_CACHE_TTL, JSON.stringify(profileData));
    console.log(`✅ Cached complete profile for ${userId} (${PROFILE_CACHE_TTL / 60} minutes)`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Invalidate profile cache
 */
export async function invalidateProfileCache(userId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `profile-complete:${userId}`;
    await redis.del(key);
    console.log(`✅ Invalidated complete profile cache for ${userId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

export async function GET() {
  const startTime = Date.now();

  try {
    console.log('👤 Fetching complete profile data');
    console.log('   Redis available:', !!redis);

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`📋 User authenticated: ${user.id}`);

    // Check cache first
    const cachedProfile = await getCachedProfile(user.id);
    
    if (cachedProfile) {
      const responseTime = Date.now() - startTime;
      console.log(`⚡ Returning cached profile in ${responseTime}ms`);

      return NextResponse.json({
        user: cachedProfile.user,
        interviews: cachedProfile.interviews,
        _metadata: {
          cached: true,
          responseTime
        }
      });
    }

    // Fetch from database
    console.log('🔍 Fetching profile from Firestore...');

    // Get user's full data from Firestore
    const userDoc = await db.collection("users").doc(user.id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const interviews = await getInterviewsByUserId(user.id);

    // Construct complete user object with all profile fields
    const completeUser: ProfileData = {
      id: user.id,
      name: userData?.name || user.name || "",
      email: userData?.email || user.email || "",
      phone: userData?.phone || "",
      
      // New separate address fields
      streetAddress: userData?.streetAddress || "",
      city: userData?.city || "",
      state: userData?.state || "",
      
      bio: userData?.bio || "",
      targetRole: userData?.targetRole || "",
      experienceLevel: userData?.experienceLevel || "mid",
      preferredTech: userData?.preferredTech || [],
      careerGoals: userData?.careerGoals || "",
      linkedIn: userData?.linkedIn || "",
      github: userData?.github || "",
      website: userData?.website || "",
      provider: userData?.provider || "email",
      createdAt: userData?.createdAt || new Date().toISOString(),
      lastLogin: userData?.lastLogin || new Date().toISOString(),
      
      subscription: {
        plan: userData?.subscription?.plan || "free",
        status: userData?.subscription?.status || "active",
        interviewsUsed: userData?.subscription?.interviewsUsed || 0,
        interviewsLimit: userData?.subscription?.interviewsLimit || 1,
        createdAt:
          userData?.subscription?.createdAt ||
          userData?.createdAt ||
          new Date().toISOString(),
        trialEndsAt: userData?.subscription?.trialEndsAt || null,
        subscriptionEndsAt: userData?.subscription?.subscriptionEndsAt || null,
        currentPeriodStart: userData?.subscription?.currentPeriodStart || null,
        currentPeriodEnd: userData?.subscription?.currentPeriodEnd || null,
        stripeCustomerId: userData?.subscription?.stripeCustomerId || null,
        stripeSubscriptionId:
          userData?.subscription?.stripeSubscriptionId || null,
        canceledAt: userData?.subscription?.canceledAt || null,
        lastPaymentAt: userData?.subscription?.lastPaymentAt || null,
      },
    };

    // Convert interviews to generic type to avoid type conflicts
    const interviewsData = (interviews || []) as unknown as InterviewData[];

    const responseData: CachedProfileResponse = {
      user: completeUser,
      interviews: interviewsData,
      cachedAt: new Date().toISOString()
    };

    // Cache the complete profile
    await cacheProfile(user.id, responseData);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Profile fetched from Firestore in ${responseTime}ms`);

    return NextResponse.json({
      user: completeUser,
      interviews: interviews || [],
      _metadata: {
        cached: false,
        responseTime
      }
    });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Update profile (also invalidates cache)
 */
export async function PATCH() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Invalidate cache when profile is updated
    await invalidateProfileCache(user.id);
    console.log('🔄 Cache invalidated after profile update');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}