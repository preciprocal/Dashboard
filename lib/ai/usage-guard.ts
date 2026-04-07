// lib/ai/usage-guard.ts
// Server-side usage gate — checks and increments Firestore usage counters.
// Shared across all API routes that consume AI credits.
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// ─── Plan limits (single source of truth) ─────────────────────────────────────
// These match your pricing page and usage-limits.ts on the frontend.

export type GatedFeature =
  | 'resumes'          // resume analysis, benchmark, recruiter sim, intel, rewrite, tailor, deep analysis
  | 'coverLetters'
  | 'studyPlans'
  | 'interviews'
  | 'interviewDebriefs'
  | 'linkedinOptimisations'
  | 'coldOutreach'
  | 'findContacts';

interface PlanLimits {
  resumes: number;
  coverLetters: number;
  studyPlans: number;
  interviews: number;
  interviewDebriefs: number;
  linkedinOptimisations: number;
  coldOutreach: number;
  findContacts: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    resumes: 5,
    coverLetters: 5,
    studyPlans: 2,
    interviews: 3,
    interviewDebriefs: 1,
    linkedinOptimisations: 2,
    coldOutreach: 2,
    findContacts: 2,
  },
  starter: {
    resumes: 5,
    coverLetters: 5,
    studyPlans: 2,
    interviews: 3,
    interviewDebriefs: 1,
    linkedinOptimisations: 2,
    coldOutreach: 2,
    findContacts: 2,
  },
  pro: {
    resumes: 20,
    coverLetters: -1,    // unlimited
    studyPlans: 5,
    interviews: 30,
    interviewDebriefs: 5,
    linkedinOptimisations: 5,
    coldOutreach: 10,
    findContacts: 10,
  },
  premium: {
    resumes: -1,         // unlimited
    coverLetters: -1,
    studyPlans: -1,
    interviews: -1,
    interviewDebriefs: -1,
    linkedinOptimisations: -1,
    coldOutreach: -1,
    findContacts: -1,
  },
};

// Map feature to the Firestore field name under `usage.`
const FEATURE_FIELD: Record<GatedFeature, string> = {
  resumes:              'resumesUsed',
  coverLetters:         'coverLettersUsed',
  studyPlans:           'studyPlansUsed',
  interviews:           'interviewsUsed',
  interviewDebriefs:    'interviewDebriefsUsed',
  linkedinOptimisations:'linkedinOptimisationsUsed',
  coldOutreach:         'coldOutreachUsed',
  findContacts:         'findContactsUsed',
};

// Human-readable names for error messages
const FEATURE_NAMES: Record<GatedFeature, string> = {
  resumes:               'Resume Analyses',
  coverLetters:          'Cover Letters',
  studyPlans:            'Study Plans',
  interviews:            'Mock Interviews',
  interviewDebriefs:     'Interview Debriefs',
  linkedinOptimisations: 'LinkedIn Optimisations',
  coldOutreach:          'Cold Outreach',
  findContacts:          'Find Contacts',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsageCheckResult {
  allowed: boolean;
  used: number;
  limit: number;        // -1 = unlimited
  remaining: number;    // -1 = unlimited
  plan: string;
  feature: GatedFeature;
  message?: string;     // only set when blocked
}

// ─── Check usage (read-only, does NOT increment) ──────────────────────────────

export async function checkUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const data = userDoc.exists ? userDoc.data() : null;

    const plan  = normalisePlan(data?.subscription?.plan);
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const limit  = limits[feature];
    const field  = FEATURE_FIELD[feature];
    const used   = (data?.usage?.[field] as number) ?? 0;

    // Unlimited
    if (limit === -1) {
      return { allowed: true, used, limit: -1, remaining: -1, plan, feature };
    }

    const remaining = Math.max(0, limit - used);
    const allowed   = used < limit;

    return {
      allowed,
      used,
      limit,
      remaining,
      plan,
      feature,
      message: allowed ? undefined : `You've reached your monthly limit of ${limit} ${FEATURE_NAMES[feature]}. Upgrade to Pro for more.`,
    };
  } catch (err) {
    console.error(`❌ Usage check failed for ${userId}/${feature}:`, err);
    // Fail open — don't block the user if Firestore is down
    return { allowed: true, used: 0, limit: -1, remaining: -1, plan: 'unknown', feature };
  }
}

// ─── Check AND increment (call AFTER a successful AI response) ────────────────

export async function checkAndIncrementUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  const result = await checkUsage(userId, feature);

  if (!result.allowed) return result;

  // Increment the counter
  try {
    const field = FEATURE_FIELD[feature];
    await db.collection('users').doc(userId).update({
      [`usage.${field}`]: FieldValue.increment(1),
      'usage.lastUpdated': FieldValue.serverTimestamp(),
    });
    result.used += 1;
    if (result.limit !== -1) {
      result.remaining = Math.max(0, result.limit - result.used);
    }
  } catch (err) {
    console.warn(`⚠️ Failed to increment usage for ${userId}/${feature}:`, err);
    // Don't fail the request — the AI call already succeeded
  }

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalisePlan(raw: unknown): string {
  const plan = (typeof raw === 'string' ? raw : 'free').toLowerCase().trim();
  if (plan === 'starter') return 'free';
  if (['free', 'pro', 'premium'].includes(plan)) return plan;
  return 'free';
}