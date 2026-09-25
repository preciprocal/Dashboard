// lib/config/abuse-guard.ts
// Thresholds for the Free-tier anti-abuse checks. Kept together so tuning is
// one reviewed file rather than numbers scattered through route handlers.

// ─── Signup rate limiting ────────────────────────────────────────────────────

/**
 * Max Free accounts per device fingerprint per window. 1 means "a second
 * signup from this browser inside 30 days is rejected".
 *
 * Lower false-positive risk than the IP limit below - a shared device is a
 * flatmate or a library machine, which is rarer than a shared IP.
 */
export const MAX_SIGNUPS_PER_DEVICE = 1;

/**
 * Max Free accounts per IP per window.
 *
 * ⚠️ READ BEFORE LOWERING. A single IP is routinely shared by hundreds of
 * unrelated people:
 *   - university campus NAT (our actual target demographic)
 *   - corporate offices
 *   - mobile carrier CGNAT - most phone traffic in a region can share a
 *     handful of addresses
 *   - VPNs, and the whole of an apartment building behind one router
 *
 * Originally specified as 1. Raised to 3 because of what rejection now costs
 * on the OAuth path: exchangeCodeForSession has already created the auth user
 * by the time the guard runs, so a block DELETES that account
 * (lib/actions/auth.action.ts ensureOAuthUserDocument). At 1, the second
 * genuine student on campus wifi would not get a polite refusal - their Google
 * account would be created and destroyed.
 *
 * The device limit above is the precise instrument; this one is blunt and is
 * the fallback for clients that report no fingerprint. Watch the `blocked=ip`
 * log line before moving it in either direction.
 */
export const MAX_SIGNUPS_PER_IP = 3;

/** Rolling window for both counters. */
export const SIGNUP_WINDOW_DAYS = 30;

/**
 * Shown when a signup is refused.
 *
 * It used to say "Preciprocal allows one free account per person", which is
 * not the rule the code enforces. The IP limit is 3, so this sentence appeared
 * on the FOURTH attempt from a network - by which point the reader has watched
 * three accounts be created and is being told the limit is one. Stating a rule
 * the system does not apply invites exactly the support email it is trying to
 * pre-empt, and makes the refusal look arbitrary.
 *
 * The wording now describes what actually happened - a limit from this device
 * or network - without claiming a per-person rule the product cannot detect.
 * Shared wifi is named first, because on a campus that is the likeliest
 * innocent explanation and the person reading this has done nothing wrong.
 */
export const SIGNUP_BLOCKED_MESSAGE =
  "We've already seen several new accounts from this device or network in the last 30 days, " +
  'so this one has been held back. If you share a computer or campus wifi, that is probably ' +
  "why - email support@preciprocal.com and we'll get you set up.";

// ─── Duplicate resume detection ──────────────────────────────────────────────

/**
 * Resume text shorter than this is not hashed. Short extractions are usually
 * a failed PDF parse (a page of whitespace, or an OCR miss), and hashing them
 * would collide unrelated accounts en masse on the same near-empty string.
 */
export const MIN_RESUME_CHARS_FOR_HASH = 400;

/**
 * Flag reason codes written to flagged_accounts.reason. Shared with Task 3
 * and Task 5 so the review queue has one vocabulary.
 */
export const FLAG_REASONS = {
  duplicateResume:  'duplicate_resume',
  refundHighUsage:  'refund_high_usage',
  multiDevice:      'multi_device',
  // A Stripe student coupon was applied to an account that never verified a
  // .edu address. Cannot be blocked at the point of detection - see
  // lib/subscription/student-coupon.ts.
  unverifiedStudentCoupon: 'unverified_student_coupon',
  // Several accounts sharing a display name, where each email also carries
  // that name. Log only, and expect legitimate matches - see
  // lib/abuse/signup-cluster.ts.
  duplicateIdentity: 'duplicate_identity',
} as const;
