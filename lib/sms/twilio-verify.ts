// lib/sms/twilio-verify.ts
// Thin wrapper over Twilio Verify v2.
//
// Uses the REST API over fetch rather than the `twilio` npm package: this needs
// exactly two endpoints, and the package pulls a large dependency tree into
// serverless bundles for no benefit at that scale.
//
// Twilio Verify (rather than raw SMS) on purpose - it generates, stores,
// expires and rate-limits the codes itself, so no OTP ever touches our
// database and there is no code-comparison logic here to get wrong.
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID,
  ALLOWED_COUNTRY_CODES,
} from '@/lib/config/phone-verification';

const BASE = 'https://verify.twilio.com/v2/Services';

function authHeader(): string {
  const raw = `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/**
 * Normalise user input to E.164, or null if it cannot be.
 *
 * Deliberately conservative: it strips formatting and requires the caller to
 * have supplied a country code (leading '+', or a bare number long enough to
 * include one). Guessing a default country silently sends the code to the
 * wrong place and the user simply never receives it.
 */
export function toE164(input: string): string | null {
  const trimmed = input.trim();
  // 00 is the international prefix in much of the world; treat it as '+'.
  const withPlus = trimmed.startsWith('00') ? `+${trimmed.slice(2)}` : trimmed;
  const digits = withPlus.replace(/[^\d+]/g, '');

  if (!digits.startsWith('+')) return null;

  const bare = digits.slice(1);
  // E.164 allows at most 15 digits; below ~8 is not a dialable mobile.
  if (!/^\d{8,15}$/.test(bare)) return null;

  return `+${bare}`;
}

/** Country calling code for an E.164 number, matched longest-prefix-first. */
export function countryCodeOf(e164: string): string | null {
  const bare = e164.replace(/^\+/, '');
  // Longest first, so '1' never shadows '1876' style codes if those are added.
  const sorted = [...ALLOWED_COUNTRY_CODES].sort((a, b) => b.length - a.length);
  return sorted.find(code => bare.startsWith(code)) ?? null;
}

export function isAllowedCountry(e164: string): boolean {
  return countryCodeOf(e164) !== null;
}

export interface TwilioResult {
  ok: boolean;
  /** Machine-readable reason when ok is false. */
  reason?: 'not_configured' | 'invalid_number' | 'max_attempts' | 'expired' | 'incorrect' | 'provider_error';
  message?: string;
}

/** Ask Twilio to SMS a code. Never throws. */
export async function sendVerificationCode(e164: string): Promise<TwilioResult> {
  if (!TWILIO_VERIFY_SERVICE_SID) return { ok: false, reason: 'not_configured' };

  try {
    const res = await fetch(`${BASE}/${TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Channel: 'sms' }),
    });

    if (res.ok) return { ok: true };

    const body = await res.json().catch(() => ({})) as { code?: number; message?: string };

    // 60200 invalid parameter, 60033 invalid To - both mean the number is not
    // dialable. Reported as such so the user can correct it rather than seeing
    // a generic failure and retrying the same bad number.
    if (body.code === 60200 || body.code === 60033) {
      return { ok: false, reason: 'invalid_number' };
    }
    // 60203: too many send attempts for this number, Twilio's own throttle.
    if (body.code === 60203) {
      return { ok: false, reason: 'max_attempts' };
    }

    console.error('❌ Twilio Verify send failed:', res.status, body.code, body.message);
    return { ok: false, reason: 'provider_error' };
  } catch (err) {
    console.error('❌ Twilio Verify send threw:', err);
    return { ok: false, reason: 'provider_error' };
  }
}

/** Check a submitted code. Never throws. */
export async function checkVerificationCode(e164: string, code: string): Promise<TwilioResult> {
  if (!TWILIO_VERIFY_SERVICE_SID) return { ok: false, reason: 'not_configured' };

  try {
    const res = await fetch(`${BASE}/${TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Code: code }),
    });

    const body = await res.json().catch(() => ({})) as {
      status?: string; code?: number; message?: string;
    };

    if (res.ok && body.status === 'approved') return { ok: true };

    // Twilio 404s a VerificationCheck once the verification has expired or
    // already been consumed, which is a different user message from a wrong code.
    if (res.status === 404) return { ok: false, reason: 'expired' };
    if (body.code === 60202) return { ok: false, reason: 'max_attempts' };
    if (res.ok) return { ok: false, reason: 'incorrect' };

    console.error('❌ Twilio Verify check failed:', res.status, body.code, body.message);
    return { ok: false, reason: 'provider_error' };
  } catch (err) {
    console.error('❌ Twilio Verify check threw:', err);
    return { ok: false, reason: 'provider_error' };
  }
}
