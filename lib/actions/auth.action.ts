"use server";

import { cookies } from "next/headers";
import { auth, db } from "@/firebase/admin";
import { redis, RedisKeys } from "@/lib/redis/redis-client";
import { USAGE_LIMITS, normalisePlan } from "@/lib/config/usage-limits";

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds
const USER_CACHE_TTL   = 5 * 60;            // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  provider?: string;
}

interface SignInParams {
  email: string;
  idToken: string;
  provider: string;
}

interface FirebaseTimestamp {
  toDate: () => Date;
  _seconds?: number;
  _nanoseconds?: number;
}

interface FirebaseError extends Error {
  code?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  isAdmin?: boolean;
  subscription?: {
    plan: string;
    status: string;
    interviewsUsed: number;
    interviewsLimit: number;
    createdAt: string;
    updatedAt: string;
    trialEndsAt: string | null;
    subscriptionEndsAt: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    canceledAt: string | null;
    lastPaymentAt: string | null;
    studentVerified?: boolean;
    studentEduEmail?: string | null;
    studentVerifiedAt?: string | null;
  };
  usage?: {
    coverLettersUsed: number;
    resumesUsed: number;
    studyPlansUsed: number;
    interviewsUsed: number;
    interviewDebriefsUsed: number;
    linkedinOptimisationsUsed: number;
    coldOutreachUsed: number;
    findContactsUsed: number;
    jobTrackerUsed: number;
    lastReset: string;
    lastUpdated?: string;
  };
}

// ─── Plan helpers ─────────────────────────────────────────────────────────────

/**
 * Builds a fresh subscription object for a given plan.
 * Limits are always read from usage-limits.ts — never hardcoded.
 */
function buildSubscription(plan: "free" | "pro" | "premium" = "free") {
  const limits = USAGE_LIMITS[plan];
  return {
    plan,
    status:               "active",
    interviewsUsed:       0,
    interviewsLimit:      limits.interviews === -1 ? 999999 : limits.interviews,
    createdAt:            new Date().toISOString(),
    updatedAt:            new Date().toISOString(),
    trialEndsAt:          null,
    subscriptionEndsAt:   null,
    stripeCustomerId:     null,
    stripeSubscriptionId: null,
    currentPeriodStart:   null,
    currentPeriodEnd:     null,
    canceledAt:           null,
    lastPaymentAt:        null,
    studentVerified:      false,
    studentEduEmail:      null,
    studentVerifiedAt:    null,
  };
}

/**
 * Builds a fresh usage object. All counters start at 0.
 * Matches every feature in usage-limits.ts.
 */
function buildUsage() {
  return {
    coverLettersUsed:          0,
    resumesUsed:               0,
    studyPlansUsed:            0,
    interviewsUsed:            0,
    interviewDebriefsUsed:     0,
    linkedinOptimisationsUsed: 0,
    coldOutreachUsed:          0,
    findContactsUsed:          0,
    jobTrackerUsed:            0,
    lastReset:                 new Date().toISOString(),
  };
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

interface CachedData<T> {
  data: T;
  cachedAt: string;
}

async function getCachedUser(userId: string): Promise<User | null> {
  if (!redis) return null;
  try {
    const key    = `user:${userId}`;
    const cached = await redis.get(key);
    if (cached) {
      console.log(`✅ Cache HIT - User ${userId}`);
      const data = typeof cached === "string" ? JSON.parse(cached) : cached;
      return (data as CachedData<User>).data;
    }
    console.log(`❌ Cache MISS - User ${userId}`);
    return null;
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}

async function cacheUser(user: User): Promise<void> {
  if (!redis) return;
  try {
    const key  = `user:${user.id}`;
    const data: CachedData<User> = { data: user, cachedAt: new Date().toISOString() };
    await redis.setex(key, USER_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached user ${user.id}`);
  } catch (error) {
    console.error("Redis set error:", error);
  }
}

export async function invalidateUserCache(userId: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = [
      `user:${userId}`,
      RedisKeys.userPrefs(userId),
      `user-stats:${userId}`,
      `interviews:${userId}`,
      `resumes-list:${userId}`,
      `transcripts-list:${userId}`,
      `profile-complete:${userId}`,
    ];
    await Promise.all(keys.map((k) => redis!.del(k)));
    console.log(`✅ Invalidated all caches for user ${userId}`);
  } catch (error) {
    console.error("Redis delete error:", error);
  }
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function convertTimestampToISO(
  timestamp: FirebaseTimestamp | Date | string | null | undefined
): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === "object" && "toDate" in timestamp && typeof timestamp.toDate === "function")
    return timestamp.toDate().toISOString();
  if (typeof timestamp === "object" && "_seconds" in timestamp && timestamp._seconds !== undefined)
    return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1_000_000).toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === "string") return new Date(timestamp).toISOString();
  return new Date().toISOString();
}

// ─── Document validation ──────────────────────────────────────────────────────

async function validateAndFixUserDocument(firebaseUser: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<boolean> {
  try {
    console.log("🔍 Validating user document for UID:", firebaseUser.uid);
    const userDoc = await db.collection("users").doc(firebaseUser.uid).get();

    if (!userDoc.exists) {
      console.log("⚠️ User document does not exist, will create");
      return false;
    }

    const userData = userDoc.data();

    if (userData?.email !== firebaseUser.email) {
      console.error("❌ EMAIL MISMATCH DETECTED!");
      console.error("   Firestore email:", userData?.email);
      console.error("   Firebase Auth email:", firebaseUser.email);
      console.log("🔧 Auto-correcting Firestore document...");

      await db.collection("users").doc(firebaseUser.uid).update({
        email:     firebaseUser.email || "",
        name:      firebaseUser.displayName || userData?.name || "User",
        updatedAt: new Date().toISOString(),
      });

      console.log("✅ Document corrected");
      await invalidateUserCache(firebaseUser.uid);
      return true;
    }

    // ── Auto-migrate legacy "starter" → "free" ─────────────────────────────
    if (userData?.subscription?.plan === "starter") {
      console.log("🔧 Migrating legacy plan: starter → free");
      await db.collection("users").doc(firebaseUser.uid).update({
        "subscription.plan":      "free",
        "subscription.updatedAt": new Date().toISOString(),
      });
      await invalidateUserCache(firebaseUser.uid);
    }

    // ── Ensure subscription limits match current pricing config ──────────────
    if (userData?.subscription) {
      const planKey  = normalisePlan(userData.subscription.plan || "free");
      const limits   = USAGE_LIMITS[planKey];
      const expected = limits.interviews === -1 ? 999999 : limits.interviews;

      if (userData.subscription.interviewsLimit !== expected) {
        console.log(`🔧 Correcting interviewsLimit: ${userData.subscription.interviewsLimit} → ${expected}`);
        await db.collection("users").doc(firebaseUser.uid).update({
          "subscription.interviewsLimit": expected,
          "subscription.updatedAt":       new Date().toISOString(),
        });
        await invalidateUserCache(firebaseUser.uid);
      }
    }

    // ── Backfill missing usage fields for existing users ─────────────────────
    if (userData?.usage) {
      const newFields: Record<string, number> = {};
      if (userData.usage.interviewDebriefsUsed === undefined)     newFields["usage.interviewDebriefsUsed"]     = 0;
      if (userData.usage.linkedinOptimisationsUsed === undefined) newFields["usage.linkedinOptimisationsUsed"] = 0;
      if (userData.usage.coldOutreachUsed === undefined)          newFields["usage.coldOutreachUsed"]          = 0;
      if (userData.usage.findContactsUsed === undefined)          newFields["usage.findContactsUsed"]          = 0;
      if (userData.usage.jobTrackerUsed === undefined)            newFields["usage.jobTrackerUsed"]            = 0;

      if (Object.keys(newFields).length > 0) {
        console.log("🔧 Backfilling missing usage fields:", Object.keys(newFields));
        await db.collection("users").doc(firebaseUser.uid).update(newFields);
        await invalidateUserCache(firebaseUser.uid);
      }
    }

    console.log("✅ User document is valid");
    return true;
  } catch (error) {
    console.error("❌ Error validating user document:", error);
    return false;
  }
}

// ─── Session cookie ───────────────────────────────────────────────────────────

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();
  try {
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION * 1000,
    });

    cookieStore.set("session", sessionCookie, {
      maxAge:   SESSION_DURATION,
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      path:     "/",
      sameSite: "lax",
    });

    return { success: true };
  } catch (error) {
    console.error("Error setting session cookie:", error);
    return { success: false, error: "Failed to set session cookie" };
  }
}

// ─── Sign Up ──────────────────────────────────────────────────────────────────

export async function signUp(params: SignUpParams) {
  const { uid, name, email, provider } = params;

  try {
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return { success: false, message: "User already exists. Please sign in." };

    const userData = {
      name,
      email,
      provider:     provider || "email",
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
      isAdmin:      false,
      subscription: buildSubscription("free"),
      usage:        buildUsage(),
    };

    await db.collection("users").doc(uid).set(userData);
    console.log(
      `✅ New user created — UID: ${uid} | Email: ${email} | Plan: free`,
      `| Limits: resumes=${USAGE_LIMITS.free.resumes} coverLetters=${USAGE_LIMITS.free.coverLetters}`,
      `studyPlans=${USAGE_LIMITS.free.studyPlans} interviews=${USAGE_LIMITS.free.interviews}`
    );

    return { success: true, message: "Account created successfully. Please sign in." };
  } catch (error: unknown) {
    console.error("Error creating user:", error);
    const firebaseError = error as FirebaseError;
    if (firebaseError.code === "auth/email-already-exists")
      return { success: false, message: "This email is already in use" };
    return { success: false, message: "Failed to create account. Please try again." };
  }
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

export async function signIn(params: SignInParams) {
  const { email, idToken, provider } = params;

  console.log("🔐 Sign in attempt:", { email, provider });

  try {
    // 1. Verify token
    const decodedToken = await auth.verifyIdToken(idToken);
    if (!decodedToken) {
      console.error("❌ Failed to decode ID token");
      return { success: false, message: "Invalid authentication token." };
    }
    console.log("✅ Token verified for UID:", decodedToken.uid);

    // 2. Get Firebase Auth user details
    const firebaseUser = await auth.getUser(decodedToken.uid);

    // 3. Clear old session cookie
    const cookieStore     = await cookies();
    const existingSession = cookieStore.get("session");
    if (existingSession) {
      console.log("🧹 Clearing existing session cookie");
      cookieStore.delete("session");
      try {
        const oldClaims = await auth.verifySessionCookie(existingSession.value, false);
        if (oldClaims.uid !== decodedToken.uid) {
          console.log("🧹 Invalidating old user cache:", oldClaims.uid);
          await invalidateUserCache(oldClaims.uid);
        }
      } catch {
        // Old session was invalid — continue
      }
    }

    // 4. Invalidate cache for incoming user
    console.log("🧹 Invalidating cache for:", decodedToken.uid);
    await invalidateUserCache(decodedToken.uid);

    // 5. Check / create Firestore document
    const userRecord = await db.collection("users").doc(decodedToken.uid).get();

    if (!userRecord.exists) {
      if (provider === "google" || provider === "facebook") {
        console.log(`Creating new OAuth user via ${provider}`);

        const userData = {
          name:      firebaseUser.displayName || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
          email:     firebaseUser.email!,
          provider,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isAdmin:   false,
          subscription: buildSubscription("free"),
          usage:        buildUsage(),
        };

        await db.collection("users").doc(decodedToken.uid).set(userData);
        console.log(
          `✅ OAuth user created — UID: ${decodedToken.uid} | Provider: ${provider}`,
          `| Limits: resumes=${USAGE_LIMITS.free.resumes} coverLetters=${USAGE_LIMITS.free.coverLetters}`,
          `studyPlans=${USAGE_LIMITS.free.studyPlans} interviews=${USAGE_LIMITS.free.interviews}`
        );
      } else {
        return { success: false, message: "User does not exist. Create an account." };
      }
    } else {
      // Validate existing document (also corrects stale limits + backfills usage)
      console.log("✅ User exists, validating document...");
      await validateAndFixUserDocument(firebaseUser);

      // Initialise usage if completely missing
      const existingData = userRecord.data();
      if (!existingData?.usage) {
        console.log("⚠️ Initializing usage tracking");
        await db.collection("users").doc(decodedToken.uid).update({
          usage: buildUsage(),
        });
        await invalidateUserCache(decodedToken.uid);
      }

      // ── Sync interviewsLimit if the plan has changed since last login ──────
      if (existingData?.subscription) {
        const planKey  = normalisePlan(existingData.subscription.plan || "free");
        const limits   = USAGE_LIMITS[planKey];
        const expected = limits.interviews === -1 ? 999999 : limits.interviews;

        if (existingData.subscription.interviewsLimit !== expected) {
          console.log(`🔧 Updating stale interviewsLimit on sign-in: ${existingData.subscription.interviewsLimit} → ${expected}`);
          await db.collection("users").doc(decodedToken.uid).update({
            "subscription.interviewsLimit": expected,
            "subscription.updatedAt":       new Date().toISOString(),
          });
          await invalidateUserCache(decodedToken.uid);
        }
      }
    }

    // 6. Set new session cookie
    console.log("🔐 Setting NEW session cookie");
    const sessionResult = await setSessionCookie(idToken);
    if (!sessionResult.success) {
      console.error("❌ Failed to set session cookie");
      return { success: false, message: "Failed to create session. Please try again." };
    }

    // 7. Final cache invalidation
    console.log("🧹 Final cache invalidation");
    await invalidateUserCache(decodedToken.uid);

    console.log("✅ Sign in successful for:", email);
    return { success: true, message: "Successfully signed in." };
  } catch (error: unknown) {
    console.error("❌ Error during sign in:", error);
    const firebaseError = error as FirebaseError;
    if (firebaseError.code === "auth/id-token-expired")
      return { success: false, message: "Authentication token expired. Please try again." };
    if (firebaseError.code === "auth/invalid-id-token")
      return { success: false, message: "Invalid authentication token. Please try again." };
    return { success: false, message: "Failed to log into account. Please try again." };
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut() {
  const cookieStore   = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (sessionCookie) {
    try {
      const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
      await invalidateUserCache(decodedClaims.uid);
    } catch (error) {
      console.error("Error invalidating cache on sign out:", error);
    }
  }

  cookieStore.delete("session");
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore   = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // Check cache first
    const cached = await getCachedUser(decodedClaims.uid);
    if (cached) return cached;

    // Fetch from Firestore
    const userRecord = await db.collection("users").doc(decodedClaims.uid).get();
    if (!userRecord.exists) return null;

    const userData = userRecord.data();
    if (!userData) return null;

    // ⭐ CRITICAL: verify email matches Firebase Auth
    const firebaseUser = await auth.getUser(decodedClaims.uid);
    if (userData.email !== firebaseUser.email) {
      console.error("❌ EMAIL MISMATCH in getCurrentUser!");
      console.error("   Firestore:", userData.email);
      console.error("   Firebase Auth:", firebaseUser.email);
      await validateAndFixUserDocument(firebaseUser);
      return getCurrentUser();
    }

    // Initialise usage if missing
    if (!userData.usage) {
      const initialUsage = buildUsage();
      await db.collection("users").doc(decodedClaims.uid).update({ usage: initialUsage });
      userData.usage = initialUsage;
    }

    // Resolve plan and limits dynamically from usage-limits.ts
    const rawPlan  = userData.subscription?.plan || "free";
    const planKey  = normalisePlan(rawPlan);
    const limits   = USAGE_LIMITS[planKey];
    const ivLimit  = limits.interviews === -1 ? 999999 : limits.interviews;

    const serializedUser: User = {
      id:        userRecord.id,
      name:      userData.name     || "",
      email:     userData.email    || "",
      provider:  userData.provider || "email",
      isAdmin:   userData.isAdmin  === true,
      createdAt: convertTimestampToISO(userData.createdAt),
      updatedAt: convertTimestampToISO(userData.updatedAt),
      lastLogin: userData.lastLogin ? convertTimestampToISO(userData.lastLogin) : undefined,
      subscription: userData.subscription
        ? {
            plan:   planKey,
            status: userData.subscription.status || "active",
            interviewsUsed:       userData.subscription.interviewsUsed  || 0,
            interviewsLimit:      ivLimit,
            createdAt:            convertTimestampToISO(userData.subscription.createdAt),
            updatedAt:            convertTimestampToISO(userData.subscription.updatedAt),
            trialEndsAt:          userData.subscription.trialEndsAt        ? convertTimestampToISO(userData.subscription.trialEndsAt)        : null,
            subscriptionEndsAt:   userData.subscription.subscriptionEndsAt ? convertTimestampToISO(userData.subscription.subscriptionEndsAt) : null,
            stripeCustomerId:     userData.subscription.stripeCustomerId     || null,
            stripeSubscriptionId: userData.subscription.stripeSubscriptionId || null,
            currentPeriodStart:   userData.subscription.currentPeriodStart ? convertTimestampToISO(userData.subscription.currentPeriodStart) : null,
            currentPeriodEnd:     userData.subscription.currentPeriodEnd   ? convertTimestampToISO(userData.subscription.currentPeriodEnd)   : null,
            canceledAt:           userData.subscription.canceledAt    ? convertTimestampToISO(userData.subscription.canceledAt)    : null,
            lastPaymentAt:        userData.subscription.lastPaymentAt ? convertTimestampToISO(userData.subscription.lastPaymentAt) : null,
            studentVerified:      userData.subscription.studentVerified  || false,
            studentEduEmail:      userData.subscription.studentEduEmail  || null,
            studentVerifiedAt:    userData.subscription.studentVerifiedAt || null,
          }
        : undefined,
      usage: {
        coverLettersUsed:          userData.usage?.coverLettersUsed          || 0,
        resumesUsed:               userData.usage?.resumesUsed               || 0,
        studyPlansUsed:            userData.usage?.studyPlansUsed            || 0,
        interviewsUsed:            userData.usage?.interviewsUsed            || 0,
        interviewDebriefsUsed:     userData.usage?.interviewDebriefsUsed     || 0,
        linkedinOptimisationsUsed: userData.usage?.linkedinOptimisationsUsed || 0,
        coldOutreachUsed:          userData.usage?.coldOutreachUsed          || 0,
        findContactsUsed:          userData.usage?.findContactsUsed          || 0,
        jobTrackerUsed:            userData.usage?.jobTrackerUsed            || 0,
        lastReset:                 userData.usage?.lastReset ? convertTimestampToISO(userData.usage.lastReset) : new Date().toISOString(),
        lastUpdated:               userData.usage?.lastUpdated ? convertTimestampToISO(userData.usage.lastUpdated) : undefined,
      },
    };

    await cacheUser(serializedUser);
    return serializedUser;
  } catch (error) {
    console.log("Error verifying session:", error);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

export async function updateUserProfile(
  userId: string,
  profileData: Partial<User> & {
    currentResume?:     string;
    resumeUrl?:         string;
    currentTranscript?: string;
    transcriptUrl?:     string;
    streetAddress?:     string;
    city?:              string;
    state?:             string;
    phone?:             string;
    bio?:               string;
    targetRole?:        string;
    experienceLevel?:   string;
    preferredTech?:     string[];
    careerGoals?:       string;
    linkedIn?:          string;
    github?:            string;
    website?:           string;
  }
) {
  try {
    await db.collection("users").doc(userId).update({
      ...profileData,
      updatedAt: new Date().toISOString(),
    });
    await invalidateUserCache(userId);
    return { success: true };
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, message: "Failed to update profile." };
  }
}