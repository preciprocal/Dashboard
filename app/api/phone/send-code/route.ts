// app/api/phone/send-code/route.ts
// Step 1 of one-time phone verification: SMS a code to the number the user
// just entered.
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { toE164, isAllowedCountry, sendVerificationCode } from '@/lib/sms/twilio-verify';
import {
  PHONE_VERIFICATION_ENABLED,
  MAX_SENDS_PER_ACCOUNT_PER_DAY,
  MAX_SENDS_PER_NUMBER_PER_DAY,
  MAX_SENDS_PER_IP_PER_DAY,
  UNSUPPORTED_COUNTRY_MESSAGE,
} from '@/lib/config/phone-verification';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({ phone: z.string().min(6).max(24) });

const DAY_SECONDS = 24 * 60 * 60;

// The phone number is hashed into the Redis key rather than stored raw: these
// keys live outside Postgres with no RLS over them, and a plaintext phone
// number is not something to scatter across a cache.
const hashNumber = (e164: string) => createHash('sha256').update(e164).digest('hex').slice(0, 32);

/** Increment and report whether the caller is now over the cap. */
async function overLimit(key: string, max: number): Promise<boolean> {
  if (!redis) return false; // fails open, see below
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, DAY_SECONDS);
    return count > max;
  } catch (err) {
    // Fails OPEN on a Redis outage: Twilio Verify applies its own per-number
    // throttling, so the floor here is the provider's limits rather than
    // nothing at all - and failing closed would make an unrelated cache
    // outage block every new signup from finishing.
    console.error('⚠️ Phone send rate-limit check failed, allowing:', err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!PHONE_VERIFICATION_ENABLED) {
      return NextResponse.json({ error: 'Phone verification is not configured.' }, { status: 503 });
    }

    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
    }

    const e164 = toE164(parsed.data.phone);
    if (!e164) {
      return NextResponse.json(
        { error: 'Include your country code, for example +1 555 123 4567.' },
        { status: 400 },
      );
    }
    if (!isAllowedCountry(e164)) {
      return NextResponse.json({ error: UNSUPPORTED_COUNTRY_MESSAGE }, { status: 400 });
    }

    // ── Already verified? ───────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('phone_verified')
      .eq('user_id', supabaseUserId)
      .maybeSingle();
    if (profile?.phone_verified) {
      return NextResponse.json({ error: 'This account is already verified.' }, { status: 409 });
    }

    // ── One account per number ──────────────────────────────────────────────
    // Checked here so the user finds out before we pay for an SMS. The unique
    // index in 0029 is what actually enforces it at redemption time, so a race
    // between this check and verify-code still cannot produce two accounts on
    // one number.
    const { data: taken } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('verified_phone', e164)
      .eq('phone_verified', true)
      .maybeSingle();
    if (taken && taken.user_id !== supabaseUserId) {
      return NextResponse.json(
        {
          error:
            'That number is already verified on another Preciprocal account. ' +
            'Each account needs its own number - email support@preciprocal.com if that seems wrong.',
        },
        { status: 409 },
      );
    }

    // ── Throttles ───────────────────────────────────────────────────────────
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';

    const [accountOver, numberOver, ipOver] = await Promise.all([
      overLimit(`phoneotp:acct:${supabaseUserId}`, MAX_SENDS_PER_ACCOUNT_PER_DAY),
      overLimit(`phoneotp:num:${hashNumber(e164)}`, MAX_SENDS_PER_NUMBER_PER_DAY),
      overLimit(`phoneotp:ip:${ip}`, MAX_SENDS_PER_IP_PER_DAY),
    ]);

    if (accountOver || numberOver || ipOver) {
      console.warn(
        `🚫 Phone OTP throttled uid=${userId} ` +
        `acct=${accountOver} num=${numberOver} ip=${ipOver}`,
      );
      return NextResponse.json(
        { error: "You've requested too many codes today. Try again tomorrow, or email support@preciprocal.com." },
        { status: 429 },
      );
    }

    // ── Send ────────────────────────────────────────────────────────────────
    const result = await sendVerificationCode(e164);
    if (!result.ok) {
      const message =
        result.reason === 'invalid_number'
          ? "We couldn't send a code to that number. Please check it and try again."
          : result.reason === 'max_attempts'
            ? 'Too many codes have been sent to that number. Please try again later.'
            : "We couldn't send the code right now. Please try again in a moment.";
      return NextResponse.json({ error: message }, { status: result.reason === 'max_attempts' ? 429 : 400 });
    }

    // Stash the normalised number so verify-code checks the code against the
    // same string we sent to, not whatever the client posts back.
    if (redis) {
      try {
        await redis.set(`phoneotp:pending:${supabaseUserId}`, e164, { ex: 15 * 60 });
      } catch { /* verify-code falls back to the client-supplied number */ }
    }

    console.log(`📱 Phone code sent uid=${userId} country=${e164.slice(0, 3)}…`);

    // Echo the normalised number so the UI can show exactly where it went.
    return NextResponse.json({ success: true, phone: e164 });
  } catch (err) {
    console.error('❌ phone/send-code error:', err);
    return NextResponse.json({ error: 'Could not send the code. Please try again.' }, { status: 500 });
  }
}
