// lib/ai/usage-guard.ts
// Server-side usage gate - checks and increments Postgres usage counters.
// Shared across all API routes that consume AI credits.
import { supabaseAdmin } from '@/supabase/admin';
import { toSupabaseUserId } from '@/lib/auth/verify-request';
import { USAGE_LIMITS, resolvePlanKey } from '@/lib/config/usage-limits';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';
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
    .select('plan, status, trial_ends_at, current_period_start, legacy_quotas')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return data as SubscriptionRow | null;
}

// Anchor for free accounts, which have no Stripe billing period to key off.
// Read separately rather than folded into getSubscription because it lives on
// profiles, and only matters when current_period_start is null.
async function getProfileCreatedAt(supabaseUserId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('created_at')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

// Admin accounts (profiles.is_admin) get unlimited access regardless of
// whatever is in the subscriptions table - this is granted separately from
// billing, so it can't be clobbered by a Stripe webhook or trial-expiry sync.
async function isAdminUser(supabaseUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return data?.is_admin === true;
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
  field: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('consume_pack_credit', {
      p_user_id: supabaseUserId,
      p_field: field,
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (err) {
    console.error(`⚠️ Pack credit lookup failed for ${supabaseUserId}/${field}:`, err);
    return null;
  }
}

/** Remaining pack credit per usage_counters column, for display. */
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
    const [sub, admin, profileCreatedAt] = await Promise.all([
      getSubscription(supabaseUserId),
      isAdminUser(supabaseUserId),
      getProfileCreatedAt(supabaseUserId),
    ]);

    const plan   = isTrialExpired(sub) ? 'free' : resolvePlanKey(sub?.plan, {
      isAdmin: admin,
      legacyQuotas: sub?.legacy_quotas === true,
    });
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
      pickAnchor(sub?.current_period_start, profileCreatedAt),
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
      packRemaining = (await getPackBalances(supabaseUserId))[field] ?? 0;
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
    const [sub, admin, profileCreatedAt] = await Promise.all([
      getSubscription(supabaseUserId),
      isAdminUser(supabaseUserId),
      getProfileCreatedAt(supabaseUserId),
    ]);
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
    const limits = USAGE_LIMITS[plan];
    const limit  = limits[feature as keyof typeof limits];

    const { periodStart, periodEnd } = computeUsagePeriod(
      pickAnchor(sub?.current_period_start, profileCreatedAt),
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
      const packId = await consumePackCredit(supabaseUserId, field);
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

