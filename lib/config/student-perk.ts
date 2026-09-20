// lib/config/student-perk.ts
// Tunables for the .edu student perk. Domain eligibility rules live next door
// in student-domains.ts; this file is about the shape of the offer itself.
//
// ─── Uniqueness rule: DEVICE ALONE, confirmed final ─────────────────────────
//
// The original written spec called for "one redemption per verified domain +
// device fingerprint combo". What shipped enforces device ALONE, and that
// difference is deliberate and now confirmed as the intended behaviour - the
// spec was wrong, not the code.
//
// A (domain, device) composite key is trivially defeated: one laptop claims
// against mit.edu, then harvard.edu, then stanford.edu, and every pair is
// unique so every claim succeeds. The composite would have enforced almost
// nothing, which is the opposite of what the rule is for.
//
// Enforced by two partial unique indexes in 0022_student_verifications.sql,
// armed only on redemption so an abandoned verification never burns a slot:
//   student_verifications_edu_email_key  on (edu_email)          where redeemed
//   student_verifications_device_key     on (device_fingerprint) where redeemed
//
// Known and accepted cost: shared machines. A university library or lab
// desktop lets exactly one student claim, and the next sees a rejection they
// cannot act on. Judged the right trade against one device farming unlimited
// free months across institutions. If it becomes a real support burden, the
// answer is the enrolment-vendor path at the bottom of this file, not a weaker
// key - fingerprints are a heuristic and should not carry more weight than
// they can bear.
//
// Fingerprint absence is NOT treated as failure. lib/fingerprint.ts returns
// null on SSR, on insecure origins, and whenever the browser blocks the APIs
// it is built from, and the device index is partial on
// `device_fingerprint is not null` precisely so those users are let through
// rather than blocked by a signal that was never collected.

export const TRIAL_DAYS = 30;

export const OTP_TTL_MINUTES = 15;
export const OTP_MAX_ATTEMPTS = 8;

/**
 * When true, the free month requires a card on file: the user verifies their
 * .edu address, saves a card via a Stripe SetupIntent ($0 now), and Stripe
 * auto-bills the Pro price on day 31. When false, the perk is granted outright
 * with no card, which is the behaviour that originally shipped.
 *
 * DEFAULTS TO TRUE as of the Task 3 pass. The default is inverted rather than
 * env-gated so the decision travels with the code: an env-gated flag has to be
 * remembered separately in every environment, and being silently off in one of
 * them is the failure this is meant to prevent.
 *
 * Set STUDENT_PERK_REQUIRE_CARD=false to opt back out. If you do, the three
 * strings listed below become true again and should be reverted with it.
 *
 * Why on: the .edu perk is the only working route to Pro while paid checkout
 * is paused, which makes it the only path abuse can take. The no-card branch
 * also converts nobody - it sets trial_ends_at and leans on usage-guard's
 * isTrialExpired to downgrade, so a free month simply ends. The card branch
 * hands the trial to Stripe via trial_period_days, and Stripe bills day 31
 * with no cron on our side.
 *
 * Verified end to end against test-mode Stripe before flipping: SetupIntent
 * confirms, subscription lands `trialing` for 30 days, $0.00 is charged at
 * signup, and a $9.99 invoice is scheduled for day 31.
 *
 * Copy that depends on this flag, all in app/(root)/pricing/page.tsx:
 *   - the Pro feature bullet ("Students: 1 month free")
 *   - the student banner subtitle
 *   - the StudentModal pre-verification subtitle
 */
export const REQUIRE_CARD = process.env.STUDENT_PERK_REQUIRE_CARD !== 'false';

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
