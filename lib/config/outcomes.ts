// lib/config/outcomes.ts
// How an application's status maps to an outcome, and when silence becomes
// worth mentioning.
//
// Kept apart from the job-tracker route because three separate things now read
// this vocabulary - the attribution report, the follow-up detector and the
// weekly digest - and a disagreement between them would show up as a
// contradiction in the same email.

export type AppStatus =
  | 'wishlist' | 'applied' | 'phone-screen' | 'technical'
  | 'final' | 'offer' | 'rejected' | 'ghosted' | 'withdrew';

/**
 * Statuses that mean a human on the other side engaged.
 *
 * 'rejected' is deliberately NOT here. A rejection IS a response, but the
 * metric people care about is "did this resume get me in the room", and
 * counting rejections as a win would let a resume that collects nothing but
 * form rejections outscore one that quietly lands interviews.
 *
 * It is tracked separately below so the report can still distinguish "rejected"
 * from "never heard back", which is a real difference to a job seeker.
 */
export const INTERVIEW_STATUSES: readonly AppStatus[] = [
  'phone-screen', 'technical', 'final', 'offer',
] as const;

/** Any status implying the employer replied at all, positively or not. */
export const RESPONDED_STATUSES: readonly AppStatus[] = [
  ...INTERVIEW_STATUSES, 'rejected',
] as const;

/**
 * Excluded from rate denominators entirely.
 *
 * 'wishlist' was never sent, so counting it would dilute every rate with jobs
 * the user only bookmarked. 'withdrew' is the user's own decision, and
 * penalising a resume because its owner took a different offer is nonsense.
 */
export const NOT_SENT_STATUSES: readonly AppStatus[] = ['wishlist', 'withdrew'] as const;

export const isInterview = (s: string) => INTERVIEW_STATUSES.includes(s as AppStatus);
export const hasResponded = (s: string) => RESPONDED_STATUSES.includes(s as AppStatus);
export const wasSent = (s: string) => !NOT_SENT_STATUSES.includes(s as AppStatus);

// ─── Follow-up nudges ────────────────────────────────────────────────────────

/**
 * Days of silence before an application is worth chasing.
 *
 * 7 is deliberately not shorter. Most processes take a week to move at all, and
 * a nudge at day 3 trains people to ignore the digest - which then costs us the
 * weeks where the nudge is actually right.
 */
export const FOLLOW_UP_AFTER_DAYS = 7;

/**
 * Days after which an application is old enough that chasing it reads as
 * desperate rather than diligent. Past this we stop suggesting it.
 */
export const FOLLOW_UP_STALE_AFTER_DAYS = 45;

/** Minimum gap between nudging about the same application again. */
export const RENUDGE_AFTER_DAYS = 14;

/** Most follow-ups to surface in one digest, newest-silence first. */
export const MAX_FOLLOW_UPS_PER_DIGEST = 5;

// ─── Reporting thresholds ────────────────────────────────────────────────────

/**
 * Applications a resume needs before its rate is shown as a number.
 *
 * Below this the report says "not enough data yet" instead. One callback from
 * one application is not a 100% interview rate, and presenting it as one would
 * send someone off to rewrite a CV that is working fine - the exact opposite of
 * what this feature is for.
 */
export const MIN_APPLICATIONS_FOR_RATE = 5;
