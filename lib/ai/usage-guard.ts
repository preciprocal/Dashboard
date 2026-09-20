// lib/ai/usage-guard.ts
// Server-side usage gate - checks and increments Postgres usage counters.
// Shared across all API routes that consume AI credits.
import { supabaseAdmin } from '@/supabase/admin';
import { toSupabaseUserId } from '@/lib/auth/verify-request';
import { USAGE_LIMITS, resolvePlanKey } from '@/lib/config/usage-limits';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';
import { PHONE_VERIFICATION_ENABLED } from '@/lib/config/phone-verification';
import { consumeHourlyQuota, HOURLY_LIMITED_FEATURES } from '@/lib/ai/hourly-quota-limit';

export type GatedFeature =
  | 'resumes'
  | 'coverLetters'
  | 'studyPlans'
  | 'interviews'
  | 'interviewDebriefs'
  | 'debriefAnalyses'
  | 'linkedinOptimisations'
  | 'coldOutreach'
  | 'findContacts'
  | 'jobTracker';

// GatedFeature -> usage_counters column name.
// Exported so the refund usage snapshot (lib/refund/eligibility.ts) reads the
// same mapping rather than keeping a second copy that could drift when a new
// gated feature is added.
export const FEATURE_FIELD: Record<GatedFeature, string> = {
  resumes:               'resumes_used',
  coverLetters:          'cover_letters_used',
  studyPlans:            'study_plans_used',
  interviews:            'interviews_used',
  interviewDebriefs:     'interview_debriefs_used',
  debriefAnalyses:       'debrief_analyses_used',
  linkedinOptimisations: 'linkedin_optimisations_used',
  coldOutreach:          'cold_outreach_used',
  findContacts:          'find_contacts_used',
  jobTracker:            'job_tracker_used',
};

const FEATURE_NAMES: Record<GatedFeature, string> = {
  resumes:               'Resume Analyses',
  coverLetters:          'Cover Letters',
  studyPlans:            'Study Plans',
  interviews:            'Mock Interviews',
  interviewDebriefs:     'Interview Debriefs',
  debriefAnalyses:       'AI Debrief Insights',
  linkedinOptimisations: 'LinkedIn Optimisations',
  coldOutreach:          'Cold Outreach',
  findContacts:          'Find Contacts',
  jobTracker:            'Job Tracker',
};

export interface UsageCheckResult {
  /** Which bucket satisfied the request. Absent on failures. */
  source?: 'subscription' | 'pack';
  /** Blocked pending phone verification rather than by quota. */
  requiresPhoneVerification?: boolean;
  allowed: boolean;
  used: number;
  limit: number;        // -1 = unlimited
  remaining: number;    // -1 = unlimited
  plan: string;
  feature: GatedFeature;
  message?: string;
}

interface SubscriptionRow {
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  subscription_started_at: string | null;
  legacy_quotas: boolean | null;
}

// Manually-granted trials (e.g. the student .edu offer) have no Stripe subscription
// behind them, so nothing else in the app ever expires them - this is the check.
function isTrialExpired(sub: SubscriptionRow | null): boolean {
  if (!sub || sub.status !== 'trialing' || !sub.trial_ends_at) return false;
  return new Date(sub.trial_ends_at).getTime() < Date.now();
}

async function getSubscription(supabaseUserId: string): Promise<SubscriptionRow | null> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, trial_ends_at, current_period_start, subscription_started_at, legacy_quotas')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return data as SubscriptionRow | null;
}

interface ProfileRow {
  /** Anchor for free accounts, which have no Stripe billing period to key off. */
  created_at: string | null;
  /**
   * Admin accounts get unlimited access regardless of the subscriptions table.
   * Granted separately from billing so a Stripe webhook or trial-expiry sync
   * cannot clobber it.
   */
  is_admin: boolean | null;
  /** Written only by app/api/phone/verify-code. See requirePhoneVerification. */
  phone_verified: boolean | null;
}

// One read, three fields. These were previously three separate round trips to
// the same row (created_at, is_admin, and nothing for phone) on every single
// gated request.
async function getProfile(supabaseUserId: string): Promise<ProfileRow | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('created_at, is_admin, phone_verified')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return data as ProfileRow | null;
}

/**
 * Phone verification gate, scoped to quota consumption on Free accounts.
 *
 * Placement is deliberate and was previously wrong. The gate used to live in
 * middleware.ts across the entire app, which blocked `/`, `/pricing` and every
 * Stripe route - so an unverified user could not upgrade off the free tier.
 * An anti-free-farming measure that blocks the exit from the free tier defeats
 * itself. The spec's wording is "required to activate a Free account's usage
 * quotas", and this function is that boundary: every gated route calls
 * checkUsage before doing any work.
 *
 * Free only. A paid account has a card on file, which is a stronger identity
 * signal than an SMS, and admins are exempt by virtue of not being 'free'.
 *
 * Reads profiles.phone_verified rather than the app_metadata JWT claim. The
 * claim existed so middleware could check at zero cost; this path is already
 * reading the profile row, and profiles.phone_verified ships in 0023 whereas
 * the claim path also needs 0029.
 *
 * Returns null when allowed, or a blocking result when not.
 */
function requirePhoneVerification(
  plan: keyof typeof USAGE_LIMITS,
  profile: ProfileRow | null,
  feature: GatedFeature,
): UsageCheckResult | null {
  if (!PHONE_VERIFICATION_ENABLED) return null;
  if (plan !== 'free') return null;
  if (profile?.phone_verified === true) return null;

  return {
    allowed: false, used: 0, limit: 0, remaining: 0, plan, feature,
    message:
      'Verify your phone number to start using Preciprocal. It takes a few seconds ' +
      'and keeps free accounts genuine.',
    requiresPhoneVerification: true,
  };
}

// ─── One-time credit packs ────────────────────────────────────────────────────
//
// Packs stack on top of the subscription allowance and never reset, so they are
// drawn from only once the monthly counter has refused. consume_pack_credit()
// picks the OLDEST pack with credit left in that category and takes exactly one,
// under FOR UPDATE SKIP LOCKED so two concurrent requests cannot spend the same
// last credit.
//
// Returns the pack id drawn from, or null when the user has none. A failure
// here is swallowed to null rather than thrown: the monthly guard has already
// refused, so the worst case is the user is told they are out of quota, which
// is what would have happened without packs at all.

async function consumePackCredit(
  supabaseUserId: string,
  feature: GatedFeature,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('consume_pack_credit', {
      p_user_id: supabaseUserId,
      p_field: feature,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (err) {
    console.error(`⚠️ Pack credit lookup failed for ${supabaseUserId}/${feature}:`, err);
    return null;
  }
}

/**
 * Remaining pack credit, keyed by GatedFeature.
 *
 * NOTE the vocabulary: the credit_packs ledger speaks FeatureType/GatedFeature
 * ("resumes"), NOT usage_counters column names ("resumes_used"). The SQL
 * parameter is still called p_field for historical reasons, but it takes a
 * feature key. Passing a column name silently returns no credit - a user would
 * buy a pack and get nothing, with no error anywhere.
 */
export async function getPackBalances(
  supabaseUserId: string,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseAdmin.rpc('pack_credit_balance', {
      p_user_id: supabaseUserId,
    });
    if (error) throw error;
    const rows = (data as Array<{ field: string; remaining: number }>) ?? [];
    return Object.fromEntries(rows.map((r) => [r.field, Number(r.remaining)]));
  } catch (err) {
    console.error(`⚠️ Pack balance lookup failed for ${supabaseUserId}:`, err);
    return {};
  }
}

// ─── Check usage (read-only, does NOT increment) ──────────────────────────────

export async function checkUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const [sub, profile] = await Promise.all([
      getSubscription(supabaseUserId),
      getProfile(supabaseUserId),
    ]);
    const admin = profile?.is_admin === true;
    const profileCreatedAt = profile?.created_at ?? null;

    const plan   = isTrialExpired(sub) ? 'free' : resolvePlanKey(sub?.plan, {
      isAdmin: admin,
      legacyQuotas: sub?.legacy_quotas === true,
    });
    const blocked = requirePhoneVerification(plan, profile, feature);
    if (blocked) return blocked;

    const limits = USAGE_LIMITS[plan];
    const limit  = limits[feature as keyof typeof limits];
    const field  = FEATURE_FIELD[feature];

    // Hourly ceiling on resumes + coverLetters combined. Enforced here rather
    // than per-route because those two features are spread across eight routes
    // (seven resume endpoints alone), and a per-route limiter gives each its
    // own bucket - which is exactly the hole this closes. Putting it in the
    // shared gate means a new resume route is covered the day it ships.
    //
    // Consumes a token on check, not on success: the point is to throttle
    // attempt rate, and a failed generation has already cost the upstream call.
    if ((HOURLY_LIMITED_FEATURES as readonly string[]).includes(feature)) {
      const hourly = await consumeHourlyQuota(supabaseUserId, plan);
      if (!hourly.allowed) {
        const mins = Math.ceil(hourly.retryAfterSeconds / 60);
        return {
          allowed: false, used: hourly.used, limit: hourly.limit, remaining: 0,
          plan, feature,
          message: `You've hit the hourly limit of ${hourly.limit} resume and cover letter actions. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        };
      }
    }

    const { periodStart } = computeUsagePeriod(
      pickAnchor(sub?.subscription_started_at, sub?.current_period_start, profileCreatedAt),
    );
    const { data: counterRow } = await supabaseAdmin
      .from('usage_counters')
      .select(field)
      .eq('user_id', supabaseUserId)
      .eq('period_start', periodStart)
      .maybeSingle();
    const used = (counterRow?.[field as keyof typeof counterRow] as number | undefined) ?? 0;

    if (limit === -1) {
      return { allowed: true, used, limit: -1, remaining: -1, plan, feature, source: 'subscription' };
    }

    const monthlyRemaining = Math.max(0, limit - used);

    // Only pay for the pack lookup when the monthly allowance is spent. This
    // runs on every gated request, so an extra round trip for the common case
    // would be a real cost.
    let packRemaining = 0;
    if (monthlyRemaining === 0) {
      packRemaining = (await getPackBalances(supabaseUserId))[feature] ?? 0;
    }

    const remaining = monthlyRemaining + packRemaining;
    const allowed   = remaining > 0;

    return {
      allowed, used, limit, remaining, plan, feature,
      source: monthlyRemaining > 0 ? 'subscription' : allowed ? 'pack' : undefined,
      message: allowed
        ? undefined
        : `You've reached your monthly limit of ${limit} ${FEATURE_NAMES[feature]}. Upgrade to Pro for more.`,
    };
  } catch (err) {
    console.error(`❌ Usage check failed for ${userId}/${feature}:`, err);
    // Fail CLOSED - block the user if we can't verify their quota.
    return {
      allowed: false, used: 0, limit: 0, remaining: 0, plan: 'unknown', feature,
      message: 'Unable to verify usage at this time. Please try again in a moment.',
    };
  }
}

// ─── Check AND increment atomically via the increment_usage_counter RPC ───────
//
// The row-exists-or-create + conditional-increment run inside a single
// Postgres function call, so only one request can win at the limit boundary
// - no race conditions, replacing the old Firestore transaction.

export async function checkAndIncrementUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  const field = FEATURE_FIELD[feature];

  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const [sub, profile] = await Promise.all([
      getSubscription(supabaseUserId),
      getProfile(supabaseUserId),
    ]);
    const admin = profile?.is_admin === true;
    const profileCreatedAt = profile?.created_at ?? null;
    const trialExpired = !admin && isTrialExpired(sub);

    // Fold the trial-expiry downgrade in as a best-effort side write, same as
    // the old Firestore transaction did - not part of the atomic increment
    // itself, since it's idempotent and not limit-boundary-sensitive.
    if (trialExpired) {
      await supabaseAdmin.from('subscriptions').update({
        plan: 'free',
        status: 'expired',
        updated_at: new Date().toISOString(),
      }).eq('user_id', supabaseUserId);
    }

    const plan   = trialExpired ? 'free' : resolvePlanKey(sub?.plan, {
      isAdmin: admin,
      legacyQuotas: sub?.legacy_quotas === true,
    });
    const blocked = requirePhoneVerification(plan, profile, feature);
    if (blocked) return blocked;

    const limits = USAGE_LIMITS[plan];
    const limit  = limits[feature as keyof typeof limits];

    const { periodStart, periodEnd } = computeUsagePeriod(
      pickAnchor(sub?.subscription_started_at, sub?.current_period_start, profileCreatedAt),
    );
    const { data, error } = await supabaseAdmin.rpc('increment_usage_counter', {
      p_user_id: supabaseUserId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_field: field,
      p_limit: limit,
    });
    if (error) throw error;

    const row = (data as Array<{ used: number; allowed: boolean }>)[0];

    // Monthly allowance exhausted: fall through to one-time pack credits before
    // refusing. Packs are checked second, never first, so a user's non-expiring
    // purchased credits are not silently spent while their resetting monthly
    // allowance still has room.
    if (!row.allowed) {
      const packId = await consumePackCredit(supabaseUserId, feature);
      if (packId) {
        console.log(`🎟️ Pack credit [${feature}] for ${userId} from pack ${packId}`);
        return {
          allowed: true, used: row.used, limit, remaining: 0, plan, feature,
          source: 'pack',
        };
      }
    }

    const remaining = limit === -1 ? -1 : Math.max(0, limit - row.used);

    const result: UsageCheckResult = {
      allowed: row.allowed, used: row.used, limit, remaining, plan, feature,
      source: 'subscription',
      message: row.allowed
        ? undefined
        : `You've reached your monthly limit of ${limit} ${FEATURE_NAMES[feature]}. Upgrade to Pro for more.`,
    };

    console.log(
      `📊 Usage [${feature}] for ${userId}: ${result.used}/${result.limit} - ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`,
    );
    return result;
  } catch (err) {
    console.error(`❌ Usage increment failed for ${userId}/${feature}:`, err);
    // Fail CLOSED - if the call errors we cannot safely allow the request.
    return {
      allowed: false, used: 0, limit: 0, remaining: 0, plan: 'unknown', feature,
      message: 'Unable to verify usage at this time. Please try again in a moment.',
    };
  }
}

