"use server";

import { createServerSupabaseClient } from "@/supabase/server";
import { supabaseAdmin } from "@/supabase/admin";
import { resolveDataUserId, toSupabaseUserId } from "@/lib/auth/verify-request";
import { tryMigrateLegacyPassword } from "@/lib/auth/legacy-password";
import { redis, RedisKeys } from "@/lib/redis/redis-client";
import { USAGE_LIMITS, normalisePlan } from "@/lib/config/usage-limits";

// Calendar-month usage period, UTC - matches lib/ai/usage-guard.ts.
function getCurrentPeriod(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_CACHE_TTL = 5 * 60; // 5 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

interface SignUpParams {
  name: string;
  email: string;
  password: string;
}

interface SignInParams {
  email: string;
  password: string;
}

interface FirebaseTimestamp {
  toDate: () => Date;
  _seconds?: number;
  _nanoseconds?: number;
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

// usage_counters rows are created lazily by the increment_usage_counter RPC
// (lib/ai/usage-guard.ts) on first use each month, so signup no longer needs
// to pre-seed a usage row. The old `limits` snapshot map is gone too -
// USAGE_LIMITS[plan] is read fresh at request time instead of being
// denormalized onto the user record, so there's nothing to drift out of
// sync and nothing to self-heal on sign-in.

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
    const supabaseUserId = await toSupabaseUserId(firebaseUser.uid);
    console.log("🔍 Validating profile for UID:", supabaseUserId);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email, name")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profile) {
      console.log("⚠️ Profile does not exist, will create");
      return false;
    }

    if (profile.email !== firebaseUser.email) {
      console.error("❌ EMAIL MISMATCH DETECTED!");
      console.error("   Postgres:", profile.email);
      console.error("   Supabase Auth:", firebaseUser.email);
      console.log("🔧 Auto-correcting profile...");

      const { error } = await supabaseAdmin.from("profiles").update({
        email: firebaseUser.email || "",
        name: firebaseUser.displayName || profile.name || "User",
        updated_at: new Date().toISOString(),
      }).eq("user_id", supabaseUserId);
      if (error) throw error;

      console.log("✅ Profile corrected");
      await invalidateUserCache(firebaseUser.uid);
      return true;
    }

    // ── Auto-expire manually-granted student trials + migrate legacy "starter" ──
    // Manually-granted trials (e.g. the student .edu offer) have no Stripe
    // subscription behind them, so nothing else downgrades them when the
    // trial ends - do it here on sign-in. USAGE_LIMITS[plan] is read fresh
    // at request time everywhere else now, so there's no snapshot to sync.
    const { data: sub, error: subError } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, trial_ends_at")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (subError) throw subError;

    if (sub?.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() < Date.now()) {
      console.log("🔧 Student trial expired, downgrading to free");
      const { error } = await supabaseAdmin.from("subscriptions").update({
        plan: "free",
        status: "expired",
        updated_at: new Date().toISOString(),
      }).eq("user_id", supabaseUserId);
      if (error) throw error;
      await invalidateUserCache(firebaseUser.uid);
    } else if (sub?.plan === "starter") {
      console.log("🔧 Migrating legacy plan: starter → free");
      const { error } = await supabaseAdmin.from("subscriptions").update({
        plan: "free",
        updated_at: new Date().toISOString(),
      }).eq("user_id", supabaseUserId);
      if (error) throw error;
      await invalidateUserCache(firebaseUser.uid);
    }

    console.log("✅ Profile is valid");
    return true;
  } catch (error) {
    console.error("❌ Error validating profile:", error);
    return false;
  }
}

// ─── Sign Up (email/password) ─────────────────────────────────────────────────

export async function signUp(params: SignUpParams) {
  const { name, email, password } = params;

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered") || error.code === "user_already_exists")
        return { success: false, message: "This email is already in use" };
      return { success: false, message: error.message || "Failed to create account. Please try again." };
    }
    if (!data.user) return { success: false, message: "Failed to create account. Please try again." };

    // Brand-new signup: the Supabase uuid is the real, authoritative id -
    // no legacy mapping needed.
    const userId = data.user.id;

    // Atomic: profile + subscription (defaults to plan:'free', status:
    // 'active') in one transaction. usage_counters rows are created lazily
    // on first use.
    const { error: createError } = await supabaseAdmin.rpc("create_user_account", {
      p_user_id: userId,
      p_name: name,
      p_email: email,
      p_provider: "email",
    });
    if (createError) throw createError;

    console.log(
      `✅ New user created - UID: ${userId} | Email: ${email} | Plan: free`,
      `| Limits: resumes=${USAGE_LIMITS.free.resumes} coverLetters=${USAGE_LIMITS.free.coverLetters}`,
      `studyPlans=${USAGE_LIMITS.free.studyPlans} interviews=${USAGE_LIMITS.free.interviews}`
    );

    return {
      success: true,
      message: data.session ? "Account created successfully." : "Account created - check your email to confirm.",
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: "Failed to create account. Please try again." };
  }
}

// ─── OAuth user provisioning (called from app/auth/callback/route.ts) ────────

export async function ensureOAuthUserDocument(
  userId: string,
  email: string,
  name: string | null,
  provider: string
) {
  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (existing) {
      await validateAndFixUserDocument({ uid: userId, email, displayName: name });
      await invalidateUserCache(userId);
      return;
    }

    const { error: createError } = await supabaseAdmin.rpc("create_user_account", {
      p_user_id: userId,
      p_name: name || `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
      p_email: email,
      p_provider: provider,
    });
    if (createError) throw createError;

    console.log(`✅ OAuth user created - UID: ${userId} | Provider: ${provider}`);
  } catch (error) {
    console.error("Error ensuring OAuth user document:", error);
  }
}

// ─── Sign In (email/password) ─────────────────────────────────────────────────

export async function signIn(params: SignInParams) {
  const { email, password } = params;

  console.log("🔐 Sign in attempt:", { email });

  try {
    const supabase = await createServerSupabaseClient();
    let result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      // Bridge for Firebase-migrated users: they have no usable Supabase
      // password yet. Verify against their legacy scrypt hash and, on
      // success, a real Supabase password gets set - then retry once.
      const { data: mapRow } = await supabaseAdmin
        .from("legacy_user_id_map")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();

      if (mapRow?.user_id) {
        const migrated = await tryMigrateLegacyPassword(mapRow.user_id as string, password);
        if (migrated) result = await supabase.auth.signInWithPassword({ email, password });
      }
    }

    const { data, error } = result;
    if (error || !data.user) {
      console.error("❌ Sign in failed:", error?.message);
      return { success: false, message: "Invalid email or password." };
    }

    const userId = await resolveDataUserId(data.user.id);
    console.log("✅ Signed in as:", userId);

    await invalidateUserCache(userId);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      console.error("❌ No profile row for:", userId);
      return { success: false, message: "Account setup incomplete. Please contact support." };
    }

    // Validate existing profile (email match, trial expiry, legacy plan migration)
    await validateAndFixUserDocument({ uid: userId, email: data.user.email ?? email, displayName: null });

    await invalidateUserCache(userId);
    console.log("✅ Sign in successful for:", email);
    return { success: true, message: "Successfully signed in." };
  } catch (error) {
    console.error("❌ Error during sign in:", error);
    return { success: false, message: "Failed to log into account. Please try again." };
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const userId = await resolveDataUserId(user.id);
      await invalidateUserCache(userId);
    }
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Error during sign out:", error);
  }
}

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) return null;

    const userId = await resolveDataUserId(supabaseUser.id);

    // Check cache first
    const cached = await getCachedUser(userId);
    if (cached) return cached;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", supabaseUser.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return null;

    // ⭐ CRITICAL: verify email matches the Supabase Auth account
    if (profile.email !== supabaseUser.email) {
      console.error("❌ EMAIL MISMATCH in getCurrentUser!");
      console.error("   Postgres:", profile.email);
      console.error("   Supabase Auth:", supabaseUser.email);
      await validateAndFixUserDocument({ uid: userId, email: supabaseUser.email ?? null, displayName: null });
      return getCurrentUser();
    }

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", supabaseUser.id)
      .maybeSingle();

    const periodStart = getCurrentPeriod();
    const { data: usageRow } = await supabaseAdmin
      .from("usage_counters")
      .select("*")
      .eq("user_id", supabaseUser.id)
      .eq("period_start", periodStart)
      .maybeSingle();

    // Resolve plan and limits dynamically from usage-limits.ts. Admin
    // accounts always resolve to unlimited, regardless of subscriptions.plan
    // - mirrors the override in lib/ai/usage-guard.ts.
    const rawPlan  = sub?.plan || "free";
    const planKey  = profile.is_admin === true ? "admin" : normalisePlan(rawPlan);
    const limits   = USAGE_LIMITS[planKey];
    const ivLimit  = limits.interviews === -1 ? 999999 : limits.interviews;

    const serializedUser: User = {
      id:        userId,
      name:      profile.name  || "",
      email:     profile.email || "",
      provider:  profile.provider || "email",
      isAdmin:   profile.is_admin === true,
      createdAt: convertTimestampToISO(profile.created_at),
      updatedAt: convertTimestampToISO(profile.updated_at),
      lastLogin: profile.last_login ? convertTimestampToISO(profile.last_login) : undefined,
      subscription: sub
        ? {
            plan:   planKey,
            status: sub.status || "active",
            interviewsUsed:       usageRow?.interviews_used || 0,
            interviewsLimit:      ivLimit,
            createdAt:            convertTimestampToISO(sub.created_at),
            updatedAt:            convertTimestampToISO(sub.updated_at),
            trialEndsAt:          sub.trial_ends_at        ? convertTimestampToISO(sub.trial_ends_at)        : null,
            subscriptionEndsAt:   sub.subscription_ends_at ? convertTimestampToISO(sub.subscription_ends_at) : null,
            stripeCustomerId:     sub.stripe_customer_id     || null,
            stripeSubscriptionId: sub.stripe_subscription_id || null,
            currentPeriodStart:   sub.current_period_start ? convertTimestampToISO(sub.current_period_start) : null,
            currentPeriodEnd:     sub.current_period_end   ? convertTimestampToISO(sub.current_period_end)   : null,
            canceledAt:           sub.canceled_at    ? convertTimestampToISO(sub.canceled_at)    : null,
            lastPaymentAt:        sub.last_payment_at ? convertTimestampToISO(sub.last_payment_at) : null,
            studentVerified:      sub.student_verified  || false,
            studentEduEmail:      sub.student_edu_email || null,
            studentVerifiedAt:    sub.student_verified_at || null,
          }
        : undefined,
      usage: {
        coverLettersUsed:          usageRow?.cover_letters_used          || 0,
        resumesUsed:               usageRow?.resumes_used                || 0,
        studyPlansUsed:            usageRow?.study_plans_used            || 0,
        interviewsUsed:            usageRow?.interviews_used             || 0,
        interviewDebriefsUsed:     usageRow?.interview_debriefs_used     || 0,
        linkedinOptimisationsUsed: usageRow?.linkedin_optimisations_used || 0,
        coldOutreachUsed:          usageRow?.cold_outreach_used          || 0,
        findContactsUsed:          usageRow?.find_contacts_used          || 0,
        jobTrackerUsed:            usageRow?.job_tracker_used            || 0,
        lastReset:                 periodStart,
        lastUpdated:               usageRow?.updated_at ? convertTimestampToISO(usageRow.updated_at) : undefined,
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

