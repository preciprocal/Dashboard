// lib/config/phone-verification.ts
// One-time phone verification for new accounts.
//
// ─── How this switches on ───────────────────────────────────────────────────
// There is no separate on/off env var: the feature is live exactly when the
// three Twilio credentials are present. Set them and new signups start being
// gated; leave them unset and the whole flow is inert - the middleware gate
// does not engage, signUp does not mark accounts as requiring verification,
// and the routes return 503.
//
// That coupling is deliberate. A standalone ENABLED flag can be true while the
// credentials are missing, which would gate every new signup behind a step
// that cannot possibly succeed - locking out every new user with no way
// forward.
//
// ─── Who gets gated ─────────────────────────────────────────────────────────
// Only accounts created AFTER this ships. signUp and the OAuth provisioning
// path stamp `phone_verification_required: true` into the user's app_metadata
// at creation; existing accounts have no such claim and are never gated. That
// avoids both a backfill and the much worse outcome of locking out every
// current user and charging an SMS each to let them back in.
//
// To also require it of existing users, run a one-off script setting that
// app_metadata flag on them - the gate needs no code change.

export const TWILIO_ACCOUNT_SID        = process.env.TWILIO_ACCOUNT_SID;
export const TWILIO_AUTH_TOKEN         = process.env.TWILIO_AUTH_TOKEN;
export const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

export const PHONE_VERIFICATION_ENABLED = Boolean(
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID,
);

/** app_metadata key the middleware gate reads. */
export const REQUIRES_PHONE_CLAIM = 'phone_verification_required';

/** Where an unverified account is sent. */
export const VERIFY_PHONE_PATH = '/verify-phone';

// ─── Abuse limits ────────────────────────────────────────────────────────────
// Every send costs money and, worse, an unthrottled send endpoint is an
// SMS-pumping target: an attacker drives traffic to premium-rate ranges they
// control and collects a share of the carrier fee. These caps bound both.

/** Codes an account may request per rolling day. */
export const MAX_SENDS_PER_ACCOUNT_PER_DAY = 5;

/** Codes any one phone number may receive per rolling day, across accounts. */
export const MAX_SENDS_PER_NUMBER_PER_DAY = 5;

/** Codes one IP may request per rolling day. */
export const MAX_SENDS_PER_IP_PER_DAY = 10;

/** Failed code submissions before the account must request a fresh code. */
export const MAX_CHECK_ATTEMPTS = 6;

/**
 * Country calling codes accepted, as E.164 prefixes without the '+'.
 *
 * An allowlist rather than a denylist: SMS-pumping fraud concentrates in
 * specific high-cost ranges, and enumerating where the customers actually are
 * is far more robust than chasing the ranges attackers move to. Widen this as
 * you open new markets - an unlisted country is refused before Twilio is ever
 * called, so it costs nothing.
 */
export const ALLOWED_COUNTRY_CODES = [
  '1',    // US, Canada
  '44',   // UK
  '353',  // Ireland
  '61',   // Australia
  '64',   // New Zealand
  '91',   // India
  '49',   // Germany
  '33',   // France
  '31',   // Netherlands
  '34',   // Spain
  '39',   // Italy
  '46',   // Sweden
  '47',   // Norway
  '45',   // Denmark
  '48',   // Poland
  '351',  // Portugal
  '65',   // Singapore
  '852',  // Hong Kong
  '971',  // UAE
  '27',   // South Africa
];

export const UNSUPPORTED_COUNTRY_MESSAGE =
  "We can't send a verification code to that country yet. " +
  'Email support@preciprocal.com and we\'ll verify your account manually.';
