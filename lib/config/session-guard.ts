// lib/config/session-guard.ts
// Concurrent-session and account-sharing thresholds.

/**
 * Maximum concurrent active web sessions per account. Over this, the oldest is
 * evicted and the user is emailed.
 *
 * The spec suggested 2. This is 3, deliberately, because 2 punishes ordinary
 * use: laptop plus phone is already 2, so a single additional login from a
 * work machine or a second browser would evict a session someone is actively
 * using. 3 still makes password-sharing across a study group inconvenient,
 * which is the actual goal, without generating support tickets from people
 * doing nothing wrong.
 *
 * Note this counts WEB sessions only. The Chrome extension reuses the web
 * app's access token via the auth bridge rather than creating its own GoTrue
 * session, so it does not consume a slot.
 */
export const MAX_CONCURRENT_SESSIONS = 3;

/**
 * A session with no heartbeat for this long stops counting toward the cap.
 *
 * Without this, every browser someone has ever logged in from counts forever,
 * and a user who closed a laptop three months ago would be evicted from their
 * phone. Shorter than Supabase's refresh-token lifetime on purpose: "could
 * still technically refresh" is not the same as "in use".
 */
export const SESSION_ACTIVE_DAYS = 7;

// ─── Account-sharing signal ──────────────────────────────────────────────────

/** Lookback for counting distinct devices and locations. */
export const DEVICE_SPREAD_WINDOW_DAYS = 7;

/**
 * Distinct devices OR distinct cities within the window that triggers a review
 * flag. Log only - it never blocks, evicts, or degrades anything.
 *
 * Expect false positives and treat the flag as "worth a look", not as
 * evidence: a single person on a laptop, a phone on mobile data, and a work
 * machine legitimately produces 3 devices and 2 or 3 cities in a week.
 */
export const DEVICE_SPREAD_THRESHOLD = 3;

