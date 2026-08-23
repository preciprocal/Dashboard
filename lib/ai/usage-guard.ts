// lib/ai/usage-guard.ts
// Server-side usage gate - checks and increments Postgres usage counters.
// Shared across all API routes that consume AI credits.
import { supabaseAdmin } from '@/supabase/admin';
import { toSupabaseUserId } from '@/lib/auth/verify-request';
import { USAGE_LIMITS } from '@/lib/config/usage-limits';

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
const FEATURE_FIELD: Record<GatedFeature, string> = {
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
}

// Manually-granted trials (e.g. the student .edu offer) have no Stripe subscription
// behind them, so nothing else in the app ever expires them - this is the check.
function isTrialExpired(sub: SubscriptionRow | null): boolean {
  if (!sub || sub.status !== 'trialing' || !sub.trial_ends_at) return false;
  return new Date(sub.trial_ends_at).getTime() < Date.now();
}

// Calendar-month usage period, UTC. Real monthly resets - each new month
// gets a fresh usage_counters row (see increment_usage_counter RPC), unlike
// the old Firestore counters which never reset despite "monthly limit" copy.
function getCurrentPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) };
}

async function getSubscription(supabaseUserId: string): Promise<SubscriptionRow | null> {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, trial_ends_at')
    .eq('user_id', supabaseUserId)
    .maybeSingle();
  return data as SubscriptionRow | null;
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

// ─── Check usage (read-only, does NOT increment) ──────────────────────────────

export async function checkUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    const [sub, admin] = await Promise.all([getSubscription(supabaseUserId), isAdminUser(supabaseUserId)]);

    const plan   = admin ? 'admin' : isTrialExpired(sub) ? 'free' : normalisePlan(sub?.plan);
    const limits = USAGE_LIMITS[plan];
    const limit  = limits[feature as keyof typeof limits];
    const field  = FEATURE_FIELD[feature];

    const { periodStart } = getCurrentPeriod();
    const { data: counterRow } = await supabaseAdmin
      .from('usage_counters')
      .select(field)
      .eq('user_id', supabaseUserId)
      .eq('period_start', periodStart)
      .maybeSingle();
    const used = (counterRow?.[field as keyof typeof counterRow] as number | undefined) ?? 0;

    if (limit === -1) {
      return { allowed: true, used, limit: -1, remaining: -1, plan, feature };
    }

    const remaining = Math.max(0, limit - used);
    const allowed   = used < limit;

    return {
      allowed, used, limit, remaining, plan, feature,
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
    const [sub, admin] = await Promise.all([getSubscription(supabaseUserId), isAdminUser(supabaseUserId)]);
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

    const plan   = admin ? 'admin' : trialExpired ? 'free' : normalisePlan(sub?.plan);
    const limits = USAGE_LIMITS[plan];
    const limit  = limits[feature as keyof typeof limits];

    const { periodStart, periodEnd } = getCurrentPeriod();
    const { data, error } = await supabaseAdmin.rpc('increment_usage_counter', {
      p_user_id: supabaseUserId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_field: field,
      p_limit: limit,
    });
    if (error) throw error;

    const row = (data as Array<{ used: number; allowed: boolean }>)[0];
    const remaining = limit === -1 ? -1 : Math.max(0, limit - row.used);

    const result: UsageCheckResult = {
      allowed: row.allowed, used: row.used, limit, remaining, plan, feature,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalisePlan(raw: unknown): keyof typeof USAGE_LIMITS {
  const plan = (typeof raw === 'string' ? raw : 'free').toLowerCase().trim();
  if (plan === 'pro')     return 'pro';
  if (plan === 'premium') return 'premium';
  return 'free';
}
