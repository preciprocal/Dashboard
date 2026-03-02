"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";
import { redis, RedisKeys } from "@/lib/redis/redis-client";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Cache TTL for user data (5 minutes)
const USER_CACHE_TTL = 5 * 60;

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  provider?: string;
}

interface SignInParams {
  email: string;
  idToken: string;
  provider?: string;
}

interface Subscription {
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
}

interface Usage {
  coverLettersUsed: number;
  resumesUsed: number;
  studyPlansUsed: number;
  interviewsUsed: number;
  lastReset: string;
  lastUpdated?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  subscription?: Subscription;
  usage?: Usage;
}

interface CachedData<T> {
  data: T;
  cachedAt: string;
}

interface FirebaseTimestamp {
  toDate?: () => Date;
  _seconds?: number;
  _nanoseconds?: number;
}

interface FirebaseError extends Error {
  code?: string;
}

// ============ CACHE HELPER FUNCTIONS ============

async function getCachedUser(userId: string): Promise<User | null> {
  if (!redis) return null;

  try {
    const key = `user:${userId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - User ${userId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedData<User>).data;
    }

    console.log(`❌ Cache MISS - User ${userId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

async function cacheUser(user: User): Promise<void> {
  if (!redis) return;

  try {
    const key = `user:${user.id}`;
    const data: CachedData<User> = {
      data: user,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, USER_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached user ${user.id}`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

async function invalidateUserCache(userId: string): Promise<void> {
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

    await Promise.all(keys.map(key => redis!.del(key)));
    console.log(`✅ Invalidated all caches for user ${userId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

function convertTimestampToISO(timestamp: FirebaseTimestamp | Date | string | null | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  if (typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }

  if (typeof timestamp === 'object' && '_seconds' in timestamp && timestamp._seconds !== undefined) {
    const milliseconds = timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000;
    return new Date(milliseconds).toISOString();
  }

  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  if (typeof timestamp === 'string') {
    return new Date(timestamp).toISOString();
  }

  return new Date().toISOString();
}

// ============ VALIDATION HELPER ============

/**
 * CRITICAL: Validates that Firestore document matches Firebase Auth user
 * This prevents data corruption and ensures consistency
 */
async function validateAndFixUserDocument(firebaseUser: { uid: string; email?: string | null; displayName?: string | null }): Promise<boolean> {
  try {
    console.log('🔍 Validating user document for UID:', firebaseUser.uid);
    
    const userDoc = await db.collection("users").doc(firebaseUser.uid).get();
    
    if (!userDoc.exists) {
      console.log('⚠️ User document does not exist, will create');
      return false;
    }

    const userData = userDoc.data();
    
    // Check if email matches
    if (userData?.email !== firebaseUser.email) {
      console.error('❌ EMAIL MISMATCH DETECTED!');
      console.error('   Firestore email:', userData?.email);
      console.error('   Firebase Auth email:', firebaseUser.email);
      console.log('🔧 Auto-correcting Firestore document...');
      
      // Fix the document
      await db.collection("users").doc(firebaseUser.uid).update({
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || userData?.name || 'User',
        updatedAt: new Date().toISOString(),
      });
      
      console.log('✅ Document corrected');
      
      // Invalidate cache
      await invalidateUserCache(firebaseUser.uid);
      
      return true;
    }
    
    console.log('✅ User document is valid');
    return true;
  } catch (error) {
    console.error('❌ Error validating user document:', error);
    return false;
  }
}

// ============ MAIN FUNCTIONS ============

export async function setSessionCookie(idToken: string) {
  const cookieStore = await cookies();

  try {
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION * 1000,
    });

    cookieStore.set("session", sessionCookie, {
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return { success: true };
  } catch (error) {
    console.error("Error setting session cookie:", error);
    return { success: false, error: "Failed to set session cookie" };
  }
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email, provider } = params;

  try {
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    const userData = {
      name,
      email,
      provider: provider || "email",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subscription: {
        plan: "starter",
        status: "active",
        interviewsUsed: 0,
        interviewsLimit: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        trialEndsAt: null,
        subscriptionEndsAt: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canceledAt: null,
        lastPaymentAt: null,
      },
      usage: {
        coverLettersUsed: 0,
        resumesUsed: 0,
        studyPlansUsed: 0,
        interviewsUsed: 0,
        lastReset: new Date().toISOString(),
      },
    };

    await db.collection("users").doc(uid).set(userData);

    console.log('✅ New user created with UID:', uid, 'Email:', email);

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error: unknown) {
    console.error("Error creating user:", error);

    const firebaseError = error as FirebaseError;
    if (firebaseError.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken, provider } = params;

  console.log("🔐 Sign in attempt:", { email, provider });

  try {
    // Step 1: Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    if (!decodedToken) {
      console.error("❌ Failed to decode ID token");
      return {
        success: false,
        message: "Invalid authentication token.",
      };
    }

    console.log("✅ Token verified for UID:", decodedToken.uid);

    // Step 2: Get Firebase Auth user details
    const firebaseUser = await auth.getUser(decodedToken.uid);

    // Step 3: Clear old session cookie FIRST
    const cookieStore = await cookies();
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
        // Old session was invalid, continue
      }
    }

    // Step 4: Invalidate cache for new user
    console.log("🧹 Invalidating cache for:", decodedToken.uid);
    await invalidateUserCache(decodedToken.uid);

    // Step 5: Check if user exists in Firestore
    const userRecord = await db.collection("users").doc(decodedToken.uid).get();

    if (!userRecord.exists) {
      // User doesn't exist - create for OAuth, reject for email
      if (provider === "google" || provider === "facebook") {
        console.log("Creating new OAuth user");
        
        const userData = {
          name: firebaseUser.displayName || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
          email: firebaseUser.email!,
          provider: provider,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          subscription: {
            plan: "starter",
            status: "active",
            interviewsUsed: 0,
            interviewsLimit: 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            trialEndsAt: null,
            subscriptionEndsAt: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            canceledAt: null,
            lastPaymentAt: null,
          },
          usage: {
            coverLettersUsed: 0,
            resumesUsed: 0,
            studyPlansUsed: 0,
            interviewsUsed: 0,
            lastReset: new Date().toISOString(),
          },
        };

        await db.collection("users").doc(decodedToken.uid).set(userData);
        console.log("✅ OAuth user created with UID:", decodedToken.uid, "Email:", firebaseUser.email);
      } else {
        return {
          success: false,
          message: "User does not exist. Create an account.",
        };
      }
    } else {
      // User exists - VALIDATE DOCUMENT
      console.log("✅ User exists, validating document...");
      await validateAndFixUserDocument(firebaseUser);
      
      // Check if usage exists
      const existingData = userRecord.data();
      if (!existingData?.usage) {
        console.log("⚠️ Initializing usage tracking");
        await db.collection("users").doc(decodedToken.uid).update({
          usage: {
            coverLettersUsed: 0,
            resumesUsed: 0,
            studyPlansUsed: 0,
            interviewsUsed: 0,
            lastReset: new Date().toISOString(),
          },
        });
        await invalidateUserCache(decodedToken.uid);
      }
    }

    // Step 6: Set NEW session cookie
    console.log("🔐 Setting NEW session cookie");
    const sessionResult = await setSessionCookie(idToken);
    if (!sessionResult.success) {
      console.error("❌ Failed to set session cookie");
      return {
        success: false,
        message: "Failed to create session. Please try again.",
      };
    }

    // Step 7: Final cache invalidation
    console.log("🧹 Final cache invalidation");
    await invalidateUserCache(decodedToken.uid);

    console.log("✅ Sign in successful for:", email);
    return {
      success: true,
      message: "Successfully signed in.",
    };
  } catch (error: unknown) {
    console.error("❌ Error during sign in:", error);

    const firebaseError = error as FirebaseError;
    if (firebaseError.code === "auth/id-token-expired") {
      return {
        success: false,
        message: "Authentication token expired. Please try again.",
      };
    }

    if (firebaseError.code === "auth/invalid-id-token") {
      return {
        success: false,
        message: "Invalid authentication token. Please try again.",
      };
    }

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  
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

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // Check cache first
    const cached = await getCachedUser(decodedClaims.uid);
    if (cached) return cached;

    // Get from Firestore
    const userRecord = await db.collection("users").doc(decodedClaims.uid).get();
    
    if (!userRecord.exists) return null;

    const userData = userRecord.data();
    if (!userData) return null;

    // ⭐ CRITICAL VALIDATION: Verify email matches
    const firebaseUser = await auth.getUser(decodedClaims.uid);
    if (userData.email !== firebaseUser.email) {
      console.error('❌ EMAIL MISMATCH in getCurrentUser!');
      console.error('   Firestore:', userData.email);
      console.error('   Firebase Auth:', firebaseUser.email);
      
      // Auto-fix
      await validateAndFixUserDocument(firebaseUser);
      
      // Recursively call to get corrected data
      return getCurrentUser();
    }

    // Initialize usage if missing
    if (!userData.usage) {
      const initialUsage = {
        coverLettersUsed: 0,
        resumesUsed: 0,
        studyPlansUsed: 0,
        interviewsUsed: 0,
        lastReset: new Date().toISOString(),
      };
      
      await db.collection("users").doc(decodedClaims.uid).update({
        usage: initialUsage,
      });
      
      userData.usage = initialUsage;
    }

    const serializedUser: User = {
      id: userRecord.id,
      name: userData.name || '',
      email: userData.email || '',
      provider: userData.provider || 'email',
      createdAt: convertTimestampToISO(userData.createdAt),
      updatedAt: convertTimestampToISO(userData.updatedAt),
      lastLogin: userData.lastLogin ? convertTimestampToISO(userData.lastLogin) : undefined,
      subscription: userData.subscription ? {
        plan: userData.subscription.plan || 'starter',
        status: userData.subscription.status || 'active',
        interviewsUsed: userData.subscription.interviewsUsed || 0,
        interviewsLimit: userData.subscription.interviewsLimit || 10,
        createdAt: convertTimestampToISO(userData.subscription.createdAt),
        updatedAt: convertTimestampToISO(userData.subscription.updatedAt),
        trialEndsAt: userData.subscription.trialEndsAt ? convertTimestampToISO(userData.subscription.trialEndsAt) : null,
        subscriptionEndsAt: userData.subscription.subscriptionEndsAt ? convertTimestampToISO(userData.subscription.subscriptionEndsAt) : null,
        stripeCustomerId: userData.subscription.stripeCustomerId || null,
        stripeSubscriptionId: userData.subscription.stripeSubscriptionId || null,
        currentPeriodStart: userData.subscription.currentPeriodStart ? convertTimestampToISO(userData.subscription.currentPeriodStart) : null,
        currentPeriodEnd: userData.subscription.currentPeriodEnd ? convertTimestampToISO(userData.subscription.currentPeriodEnd) : null,
        canceledAt: userData.subscription.canceledAt ? convertTimestampToISO(userData.subscription.canceledAt) : null,
        lastPaymentAt: userData.subscription.lastPaymentAt ? convertTimestampToISO(userData.subscription.lastPaymentAt) : null,
      } : undefined,
      usage: userData.usage ? {
        coverLettersUsed: userData.usage.coverLettersUsed || 0,
        resumesUsed: userData.usage.resumesUsed || 0,
        studyPlansUsed: userData.usage.studyPlansUsed || 0,
        interviewsUsed: userData.usage.interviewsUsed || 0,
        lastReset: convertTimestampToISO(userData.usage.lastReset),
        lastUpdated: userData.usage.lastUpdated ? convertTimestampToISO(userData.usage.lastUpdated) : undefined,
      } : {
        coverLettersUsed: 0,
        resumesUsed: 0,
        studyPlansUsed: 0,
        interviewsUsed: 0,
        lastReset: new Date().toISOString(),
      },
    };

    await cacheUser(serializedUser);

    return serializedUser;
  } catch (error) {
    console.log("Error verifying session:", error);
    return null;
  }
}

export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}

export async function updateUserProfile(
  userId: string,
  profileData: Partial<User> & { 
    currentResume?: string; 
    resumeUrl?: string;
    currentTranscript?: string;
    transcriptUrl?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    phone?: string;
    bio?: string;
    targetRole?: string;
    experienceLevel?: string;
    preferredTech?: string[];
    careerGoals?: string;
    linkedIn?: string;
    github?: string;
    website?: string;
  }
) {
  try {
    console.log('📝 Updating user profile for:', userId);
    
    // ⭐ CRITICAL: Never allow email or provider to be changed via profile update
    const { id, createdAt, subscription, usage, email, provider, ...updateData } = profileData;
    
    void id;
    void createdAt;
    void subscription;
    void usage;
    void email; // Email can only be changed through Firebase Auth
    void provider; // Provider is immutable

    const dataToUpdate = {
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("users").doc(userId).update(dataToUpdate);

    await invalidateUserCache(userId);

    console.log('✅ Profile updated successfully');

    return {
      success: true,
      message: "Profile updated successfully.",
    };
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    return {
      success: false,
      message: "Failed to update profile. Please try again.",
    };
  }
}

export async function getUserProfile(userId: string): Promise<User | null> {
  try {
    const cached = await getCachedUser(userId);
    if (cached) return cached;

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return null;
    }

    const userData = userDoc.data();
    if (!userData) return null;

    const serializedUser: User = {
      id: userDoc.id,
      name: userData.name || '',
      email: userData.email || '',
      provider: userData.provider || 'email',
      createdAt: convertTimestampToISO(userData.createdAt),
      updatedAt: convertTimestampToISO(userData.updatedAt),
      lastLogin: userData.lastLogin ? convertTimestampToISO(userData.lastLogin) : undefined,
      subscription: userData.subscription ? {
        plan: userData.subscription.plan || 'starter',
        status: userData.subscription.status || 'active',
        interviewsUsed: userData.subscription.interviewsUsed || 0,
        interviewsLimit: userData.subscription.interviewsLimit || 10,
        createdAt: convertTimestampToISO(userData.subscription.createdAt),
        updatedAt: convertTimestampToISO(userData.subscription.updatedAt),
        trialEndsAt: userData.subscription.trialEndsAt ? convertTimestampToISO(userData.subscription.trialEndsAt) : null,
        subscriptionEndsAt: userData.subscription.subscriptionEndsAt ? convertTimestampToISO(userData.subscription.subscriptionEndsAt) : null,
        stripeCustomerId: userData.subscription.stripeCustomerId || null,
        stripeSubscriptionId: userData.subscription.stripeSubscriptionId || null,
        currentPeriodStart: userData.subscription.currentPeriodStart ? convertTimestampToISO(userData.subscription.currentPeriodStart) : null,
        currentPeriodEnd: userData.subscription.currentPeriodEnd ? convertTimestampToISO(userData.subscription.currentPeriodEnd) : null,
        canceledAt: userData.subscription.canceledAt ? convertTimestampToISO(userData.subscription.canceledAt) : null,
        lastPaymentAt: userData.subscription.lastPaymentAt ? convertTimestampToISO(userData.subscription.lastPaymentAt) : null,
      } : undefined,
      usage: userData.usage ? {
        coverLettersUsed: userData.usage.coverLettersUsed || 0,
        resumesUsed: userData.usage.resumesUsed || 0,
        studyPlansUsed: userData.usage.studyPlansUsed || 0,
        interviewsUsed: userData.usage.interviewsUsed || 0,
        lastReset: convertTimestampToISO(userData.usage.lastReset),
        lastUpdated: userData.usage.lastUpdated ? convertTimestampToISO(userData.usage.lastUpdated) : undefined,
      } : {
        coverLettersUsed: 0,
        resumesUsed: 0,
        studyPlansUsed: 0,
        interviewsUsed: 0,
        lastReset: new Date().toISOString(),
      },
    };

    await cacheUser(serializedUser);

    return serializedUser;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

export async function resetUserPassword(
  email: string,
  _currentPassword: string,
  newPassword: string
) {
  void _currentPassword;
  
  try {
    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) {
      return {
        success: false,
        message: "User not found.",
      };
    }

    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    await invalidateUserCache(userRecord.uid);

    return {
      success: true,
      message: "Password updated successfully.",
    };
  } catch (error: unknown) {
    console.error("Error resetting password:", error);

    const firebaseError = error as FirebaseError;
    if (firebaseError.code === "auth/user-not-found") {
      return {
        success: false,
        message: "User not found.",
      };
    }

    if (firebaseError.code === "auth/weak-password") {
      return {
        success: false,
        message: "New password is too weak. Password should be at least 6 characters.",
      };
    }

    return {
      success: false,
      message: "Failed to update password. Please try again.",
    };
  }
}

export async function deleteUserAccount(userId: string) {
  try {
    const batch = db.batch();

    const userRef = db.collection("users").doc(userId);
    batch.delete(userRef);

    const interviewsSnapshot = await db.collection("interviews").where("userId", "==", userId).get();
    interviewsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const feedbackSnapshot = await db.collection("feedback").where("userId", "==", userId).get();
    feedbackSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const resumesSnapshot = await db.collection("resumes").where("userId", "==", userId).get();
    resumesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const transcriptsSnapshot = await db.collection("transcripts").where("userId", "==", userId).get();
    transcriptsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    try {
      await auth.deleteUser(userId);
    } catch (authError) {
      console.error("Error deleting user from Firebase Auth:", authError);
    }

    await invalidateUserCache(userId);

    const cookieStore = await cookies();
    cookieStore.delete("session");

    console.log('✅ User deleted, all caches cleared');

    return {
      success: true,
      message: "Account deleted successfully.",
    };
  } catch (error) {
    console.error("Error deleting user account:", error);
    return {
      success: false,
      message: "Failed to delete account. Please try again.",
    };
  }
}

export async function updateUserSubscription(
  userId: string,
  subscriptionData: Partial<Subscription>
) {
  try {
    await db.collection("users").doc(userId).update({
      subscription: {
        ...subscriptionData,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });

    await invalidateUserCache(userId);

    console.log('✅ Subscription updated');

    return {
      success: true,
      message: "Subscription updated successfully.",
    };
  } catch (error) {
    console.error("Error updating subscription:", error);
    return {
      success: false,
      message: "Failed to update subscription.",
    };
  }
}

export { invalidateUserCache };