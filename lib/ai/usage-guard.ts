// lib/ai/usage-guard.ts
// Server-side usage gate - checks and increments Firestore usage counters.
// Shared across all API routes that consume AI credits.
import { db } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { USAGE_LIMITS } from '@/lib/config/usage-limits';

export type GatedFeature =
  | 'resumes'
  | 'coverLetters'
  | 'studyPlans'
  | 'interviews'
  | 'interviewDebriefs'
  | 'linkedinOptimisations'
  | 'coldOutreach'
  | 'findContacts'
  | 'jobTracker';

const FEATURE_FIELD: Record<GatedFeature, string> = {
  resumes:               'resumesUsed',
  coverLetters:          'coverLettersUsed',
  studyPlans:            'studyPlansUsed',
  interviews:            'interviewsUsed',
  interviewDebriefs:     'interviewDebriefsUsed',
  linkedinOptimisations: 'linkedinOptimisationsUsed',
  coldOutreach:          'coldOutreachUsed',
  findContacts:          'findContactsUsed',
  jobTracker:            'jobTrackerUsed',
};

const FEATURE_NAMES: Record<GatedFeature, string> = {
  resumes:               'Resume Analyses',
  coverLetters:          'Cover Letters',
  studyPlans:            'Study Plans',
  interviews:            'Mock Interviews',
  interviewDebriefs:     'Interview Debriefs',
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

// ─── Check usage (read-only, does NOT increment) ──────────────────────────────

export async function checkUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const data = userDoc.exists ? userDoc.data() : null;

    const plan   = normalisePlan(data?.subscription?.plan);
    const limits = USAGE_LIMITS[plan];
    const limit  = limits[feature as keyof typeof limits];
    const field  = FEATURE_FIELD[feature];
    const used   = (data?.usage?.[field] as number) ?? 0;

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

// ─── Check AND increment atomically via Firestore transaction ─────────────────
//
// The read + conditional write run inside a single Firestore transaction,
// so only one request can win at the limit boundary - no race conditions.

export async function checkAndIncrementUsage(
  userId: string,
  feature: GatedFeature,
): Promise<UsageCheckResult> {
  const userRef = db.collection('users').doc(userId);
  const field   = FEATURE_FIELD[feature];

  try {
    const result = await db.runTransaction<UsageCheckResult>(async (txn) => {
      const userDoc = await txn.get(userRef);
      const data    = userDoc.exists ? userDoc.data() : null;

      const plan   = normalisePlan(data?.subscription?.plan);
      const limits = USAGE_LIMITS[plan];
      const limit  = limits[feature as keyof typeof limits];
      const used   = (data?.usage?.[field] as number) ?? 0;

      // Unlimited - increment and allow immediately
      if (limit === -1) {
        txn.update(userRef, {
          [`usage.${field}`]:  FieldValue.increment(1),
          'usage.lastUpdated': FieldValue.serverTimestamp(),
        });
        return { allowed: true, used: used + 1, limit: -1, remaining: -1, plan, feature };
      }

      // Hard limit reached - abort without writing anything
      if (used >= limit) {
        return {
          allowed: false, used, limit, remaining: 0, plan, feature,
          message: `You've reached your monthly limit of ${limit} ${FEATURE_NAMES[feature]}. Upgrade to Pro for more.`,
        };
      }

      // Within limit - increment atomically inside the same transaction
      txn.update(userRef, {
        [`usage.${field}`]:  FieldValue.increment(1),
        'usage.lastUpdated': FieldValue.serverTimestamp(),
      });

      const newUsed   = used + 1;
      const remaining = Math.max(0, limit - newUsed);
      return { allowed: true, used: newUsed, limit, remaining, plan, feature };
    });

    console.log(
      `📊 Usage [${feature}] for ${userId}: ${result.used}/${result.limit} - ${result.allowed ? 'ALLOWED' : 'BLOCKED'}`,
    );
    return result;
  } catch (err) {
    console.error(`❌ Usage transaction failed for ${userId}/${feature}:`, err);
    // Fail CLOSED - if the transaction errors we cannot safely allow the request.
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
