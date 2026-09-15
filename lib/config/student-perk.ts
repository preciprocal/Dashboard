// lib/config/student-perk.ts
// Tunables for the .edu student perk. Domain eligibility rules live next door
// in student-domains.ts; this file is about the shape of the offer itself.

export const TRIAL_DAYS = 30;

export const OTP_TTL_MINUTES = 15;
export const OTP_MAX_ATTEMPTS = 8;

/**
 * When true, the free month requires a card on file: the user verifies their
 * .edu address, saves a card via a Stripe SetupIntent ($0 now), and Stripe
 * auto-bills the Pro price on day 31. When false, the perk is granted outright
 * with no card, which is the behaviour that shipped originally.
 *
 * DEFAULTS TO FALSE, deliberately. Paid checkout is currently paused
 * (see PaymentPausedModal in app/(root)/pricing/page.tsx), which makes the
 * .edu perk the only route to Pro right now - and the pricing page copy sells
 * it as "no credit card needed ... free while billing comes back online".
 * Turning this on before billing resumes would contradict that copy and gate
 * the only working upgrade path behind a card.
 *
 * To enable: set STUDENT_PERK_REQUIRE_CARD=true, and update the two "no credit
 * card" strings in app/(root)/pricing/page.tsx (the student banner and the
 * StudentModal subtitle) in the same deploy.
 */
export const REQUIRE_CARD = process.env.STUDENT_PERK_REQUIRE_CARD === 'true';

/**
 * Price the student trial converts onto at day 31. Matches the Pro monthly
 * entry in the webhook's price->plan map (app/api/webhooks/stripe/route.ts);
 * env-overridable so staging can point at a test price without a code change.
 */
export const STUDENT_CONVERSION_PRICE_ID =
  process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? 'price_1TFjwCQSkS83MGF9xH1bdc1o';

// ─── Future upgrade path ─────────────────────────────────────────────────────
// TODO: If abuse persists past the domain denylist + device fingerprinting in
// 0022_student_verifications.sql, replace the self-attested email OTP with a
// real enrolment check against a verification vendor:
//   SheerID  - https://developer.sheerid.com/docs/verification-api
//   UNiDAYS  - https://developer.myunidays.com/
// Both confirm CURRENT enrolment against registrar data, which is the thing
// an email OTP fundamentally cannot do - a valid .edu address proves the
// institution issued it at some point, not that the holder is enrolled today.
//
// The integration point is already carved out: student_verifications
// .verification_method is a free text column defaulting to 'email_otp', so a
// vendor flow records 'sheerid' against the same ledger and inherits the same
// per-address and per-device uniqueness indexes with no schema change. Only
// app/api/student/send-verification + verify-code would be replaced.
