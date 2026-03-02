// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";
import { redis } from "@/lib/redis/redis-client";

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache TTL for profile data (5 minutes)
const PROFILE_CACHE_TTL = 5 * 60;

interface ProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: string;
  preferredTech?: string[];
  careerGoals?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  transcript?: string;
  transcriptFileName?: string;
  resume?: string;
  resumeFileName?: string;
  provider: string;
  createdAt: string;
  lastLogin?: string;
  subscription?: {
    plan: string;
    status: string;
    interviewsUsed: number;
    interviewsLimit: number;
    createdAt: string;
    updatedAt?: string;
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

type InterviewData = Record<string, unknown>;

interface CachedProfileResponse {
  user: ProfileData;
  interviews: InterviewData[];
  cachedAt: string;
}

/**
 * Get cached profile from Redis
 */
async function getCachedProfile(userId: string): Promise<CachedProfileResponse | null> {
  if (!redis) {
    console.log('⚠️ Redis not available, skipping cache');
    return null;
  }

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
    console.error('❌ Redis get error:', error);
    return null;
  }
}

/**
 * Cache profile data in Redis
 */
async function cacheProfile(userId: string, profileData: CachedProfileResponse): Promise<void> {
  if (!redis) {
    console.log('⚠️ Redis not available, skipping cache write');
    return;
  }

  try {
    const key = `profile-complete:${userId}`;
    await redis.setex(key, PROFILE_CACHE_TTL, JSON.stringify(profileData));
    console.log(`✅ Cached complete profile for ${userId} (TTL: ${PROFILE_CACHE_TTL}s)`);
  } catch (error) {
    console.error('❌ Redis set error:', error);
  }
}

/**
 * Invalidate cached profile
 */
export async function invalidateProfileCache(userId: string): Promise<void> {
  if (!redis) {
    console.log('⚠️ Redis not available, skipping cache invalidation');
    return;
  }

  try {
    const key = `profile-complete:${userId}`;
    await redis.del(key);
    console.log(`✅ Invalidated complete profile cache for ${userId}`);
  } catch (error) {
    console.error('❌ Redis delete error:', error);
  }
}

/**
 * GET /api/profile - Retrieve user profile and interview history
 * Uses session cookie authentication (no Authorization header needed)
 * Implements Redis caching for improved performance
 */
export async function GET() {
  const startTime = Date.now();

  try {
    console.log('👤 /api/profile GET called');

    // Get current user from session cookie (NOT from Authorization header)
    const user = await getCurrentUser();

    if (!user) {
      console.log('❌ No user session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

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
          responseTime,
          cacheAge: new Date().getTime() - new Date(cachedProfile.cachedAt).getTime()
        }
      });
    }

    // Fetch from Firestore
    console.log('🔍 Fetching profile from Firestore...');
    const userDoc = await db.collection("users").doc(user.id).get();

    if (!userDoc.exists) {
      console.log('❌ User document not found in Firestore');
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    console.log('📄 Firestore data retrieved:', {
      hasData: !!userData,
      email: userData?.email,
      name: userData?.name,
      fieldsCount: userData ? Object.keys(userData).length : 0,
      fields: userData ? Object.keys(userData) : []
    });

    // Fetch interviews
    console.log('📊 Fetching interviews...');
    const interviews = await getInterviewsByUserId(user.id);
    console.log(`📊 Found ${interviews?.length || 0} interviews`);

    // Construct complete user object with all fields
    const completeUser: ProfileData = {
      id: user.id,
      name: userData?.name || user.name || "User",
      email: userData?.email || user.email || "",
      phone: userData?.phone || "",
      
      // Separate address fields
      streetAddress: userData?.streetAddress || "",
      city: userData?.city || "",
      state: userData?.state || "",
      
      bio: userData?.bio || "",
      targetRole: userData?.targetRole || "",
      experienceLevel: userData?.experienceLevel || "mid",
      preferredTech: Array.isArray(userData?.preferredTech) ? userData.preferredTech : [],
      careerGoals: userData?.careerGoals || "",
      linkedIn: userData?.linkedIn || "",
      github: userData?.github || "",
      website: userData?.website || "",
      
      // File uploads - Resume and Transcript
      transcript: userData?.transcript || "",
      transcriptFileName: userData?.transcriptFileName || "",
      resume: userData?.resume || "",
      resumeFileName: userData?.resumeFileName || "",
      
      provider: userData?.provider || user.provider || "email",
      createdAt: userData?.createdAt || user.createdAt || new Date().toISOString(),
      lastLogin: userData?.lastLogin || new Date().toISOString(),
      
      subscription: {
        plan: userData?.subscription?.plan || "starter",
        status: userData?.subscription?.status || "active",
        interviewsUsed: userData?.subscription?.interviewsUsed || 0,
        interviewsLimit: userData?.subscription?.interviewsLimit || 10,
        createdAt: userData?.subscription?.createdAt || userData?.createdAt || new Date().toISOString(),
        updatedAt: userData?.subscription?.updatedAt || new Date().toISOString(),
        trialEndsAt: userData?.subscription?.trialEndsAt || null,
        subscriptionEndsAt: userData?.subscription?.subscriptionEndsAt || null,
        currentPeriodStart: userData?.subscription?.currentPeriodStart || null,
        currentPeriodEnd: userData?.subscription?.currentPeriodEnd || null,
        stripeCustomerId: userData?.subscription?.stripeCustomerId || null,
        stripeSubscriptionId: userData?.subscription?.stripeSubscriptionId || null,
        canceledAt: userData?.subscription?.canceledAt || null,
        lastPaymentAt: userData?.subscription?.lastPaymentAt || null,
      },
    };

    console.log('✅ Complete user object constructed:', {
      id: completeUser.id,
      email: completeUser.email,
      name: completeUser.name,
      hasAddress: !!(completeUser.streetAddress || completeUser.city || completeUser.state),
      hasResume: !!completeUser.resume,
      hasTranscript: !!completeUser.transcript,
      hasPhone: !!completeUser.phone,
      hasLinkedIn: !!completeUser.linkedIn,
      hasGitHub: !!completeUser.github,
      hasWebsite: !!completeUser.website
    });

    const interviewsData = (interviews || []) as unknown as InterviewData[];

    const responseData: CachedProfileResponse = {
      user: completeUser,
      interviews: interviewsData,
      cachedAt: new Date().toISOString()
    };

    // Cache the complete profile
    await cacheProfile(user.id, responseData);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Profile fetched and cached in ${responseTime}ms`);

    return NextResponse.json({
      user: completeUser,
      interviews: interviews || [],
      _metadata: {
        cached: false,
        responseTime,
        source: 'firestore'
      }
    });
  } catch (error) {
    console.error("❌ Error fetching profile data:", error);
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
        _metadata: {
          responseTime,
          failed: true
        }
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile - Update user profile
 * Supports updating all profile fields including resume and transcript URLs
 * Automatically invalidates cache after successful update
 */
export async function PUT(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔄 /api/profile PUT called');

    // Get current user from session cookie
    const user = await getCurrentUser();

    if (!user) {
      console.log('❌ No user session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

    // Parse request body
    const body = await request.json();
    console.log('📝 Update request received with fields:', Object.keys(body));
    
    // Log file-related updates
    if (body.resume || body.transcript) {
      console.log('📎 File updates:', {
        resume: body.resume ? '✅ Updated' : '❌ Not changed',
        resumeFileName: body.resumeFileName || 'N/A',
        transcript: body.transcript ? '✅ Updated' : '❌ Not changed',
        transcriptFileName: body.transcriptFileName || 'N/A'
      });
    }
    
    // ✅ Fix: use void to explicitly discard fields that are intentionally
    // stripped from the update payload (protected / immutable fields)
    const { 
      id: _id,
      createdAt: _createdAt,
      subscription: _subscription,
      provider: _provider,
      ...updateData 
    } = body;
    void _id;
    void _createdAt;
    void _subscription;
    void _provider;

    // Add updatedAt timestamp
    updateData.updatedAt = new Date().toISOString();

    // Validate required fields if present
    if (updateData.email && !updateData.email.includes('@')) {
      return NextResponse.json(
        { 
          success: false,
          error: "Invalid email format" 
        },
        { status: 400 }
      );
    }

    console.log('💾 Updating Firestore with fields:', {
      userId: user.id,
      fieldsToUpdate: Object.keys(updateData),
      hasResume: !!updateData.resume,
      hasTranscript: !!updateData.transcript,
      hasPhone: !!updateData.phone,
      hasAddress: !!(updateData.streetAddress || updateData.city || updateData.state)
    });

    // Update user document in Firestore
    await db.collection('users').doc(user.id).update(updateData);
    console.log('✅ Firestore document updated successfully');

    // Invalidate cache after update
    await invalidateProfileCache(user.id);
    console.log('🗑️ Cache invalidated after profile update');

    const responseTime = Date.now() - startTime;
    console.log(`✅ Profile updated successfully in ${responseTime}ms`);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      _metadata: {
        responseTime,
        fieldsUpdated: Object.keys(updateData).length,
        cacheInvalidated: true
      }
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    const responseTime = Date.now() - startTime;
    
    // Handle specific Firestore errors
    let errorMessage = "Failed to update profile";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('NOT_FOUND')) {
        errorMessage = "User profile not found";
        statusCode = 404;
      } else if (error.message.includes('PERMISSION_DENIED')) {
        errorMessage = "Permission denied";
        statusCode = 403;
      } else if (error.message.includes('INVALID_ARGUMENT')) {
        errorMessage = "Invalid data format";
        statusCode = 400;
      }
    }

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage, 
        message: error instanceof Error ? error.message : "Unknown error",
        _metadata: {
          responseTime,
          failed: true
        }
      },
      { status: statusCode }
    );
  }
}

/**
 * PATCH /api/profile - Legacy endpoint for cache invalidation
 * Kept for backwards compatibility
 */
export async function PATCH() {
  try {
    console.log('🔄 /api/profile PATCH called (legacy endpoint)');
    
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Invalidate cache when profile is updated
    await invalidateProfileCache(user.id);
    console.log('🔄 Cache invalidated via PATCH endpoint');

    return NextResponse.json({ 
      success: true,
      message: 'Cache invalidated successfully'
    });
  } catch (error) {
    console.error("❌ Error in PATCH endpoint:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to invalidate cache" 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile - Delete user profile (optional)
 * Completely removes user data from Firestore
 */
export async function DELETE() {
  try {
    console.log('🗑️ /api/profile DELETE called');
    
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`⚠️ Deleting profile for user: ${user.id}`);

    // Delete user document
    await db.collection('users').doc(user.id).delete();
    console.log('✅ User document deleted from Firestore');

    // Invalidate cache
    await invalidateProfileCache(user.id);
    console.log('✅ Cache invalidated after deletion');

    return NextResponse.json({ 
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error("❌ Error deleting profile:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to delete profile",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}