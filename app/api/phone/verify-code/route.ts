// app/api/phone/verify-code/route.ts
// Step 2 of one-time phone verification: check the code, mark the account
// verified, and clear the claim that gates the app.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { invalidateUserCache } from '@/lib/actions/auth.action';
import { toE164, checkVerificationCode } from '@/lib/sms/twilio-verify';
import { PHONE_VERIFICATION_ENABLED, REQUIRES_PHONE_CLAIM } from '@/lib/config/phone-verification';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  phone: z.string().min(6).max(24),
  code:  z.string().min(4).max(10),
});

export async function POST(req: NextRequest) {
  try {
    if (!PHONE_VERIFICATION_ENABLED) {
      return NextResponse.json({ error: 'Phone verification is not configured.' }, { status: 503 });
    }

    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Enter the code we sent you.' }, { status: 400 });

    // Prefer the number send-code actually dialled. Without this a client could
    // request a code to one number and submit the check against another.
    let e164: string | null = null;
    if (redis) {
      try {
        e164 = await redis.get<string>(`phoneotp:pending:${supabaseUserId}`);
      } catch { /* fall through to the client-supplied value */ }
    }
    e164 = e164 ?? toE164(parsed.data.phone);
    if (!e164) return NextResponse.json({ error: 'Please restart verification.' }, { status: 400 });

    const result = await checkVerificationCode(e164, parsed.data.code.trim());
    if (!result.ok) {
      const map: Record<string, { status: number; message: string }> = {
        incorrect:    { status: 400, message: 'That code is not right. Please check and try again.' },
        expired:      { status: 410, message: 'That code has expired. Request a new one.' },
        max_attempts: { status: 429, message: 'Too many attempts. Request a new code.' },
      };
      const mapped = map[result.reason ?? ''] ?? {
        status: 500, message: "We couldn't check that code. Please try again.",
      };
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }

    // ── Mark verified ───────────────────────────────────────────────────────
    // The partial unique index from 0029 is the real enforcement: if another
    // account verified this number between send-code's pre-check and now, this
    // update is what fails.
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        verified_phone:    e164,
        phone_verified:    true,
        phone_verified_at: now,
        updated_at:        now,
      })
      .eq('user_id', supabaseUserId);

    if (updateError) {
      // 23505 = unique violation on profiles_verified_phone_key.
      if (updateError.code === '23505') {
        return NextResponse.json(
          {
            error:
              'That number was just verified on another account. ' +
              'Each account needs its own number - email support@preciprocal.com if that seems wrong.',
          },
          { status: 409 },
        );
      }
      throw updateError;
    }

    // ── Lift the gate ───────────────────────────────────────────────────────
    // The middleware reads this from the JWT, so clearing it here is what lets
    // the user into the app. The client must refresh its session afterwards to
    // pick up a token without the claim - see app/verify-phone/page.tsx.
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(supabaseUserId);
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
      app_metadata: { ...(authUser?.user?.app_metadata ?? {}), [REQUIRES_PHONE_CLAIM]: false },
    });
    if (metaError) {
      // The profile row is already updated, so the account IS verified. Log
      // loudly: until the claim clears, the middleware keeps redirecting and
      // the user is stuck on a page telling them they are done.
      console.error('🚨 Phone verified but app_metadata not cleared:', supabaseUserId, metaError);
      throw metaError;
    }

    if (redis) {
      try { await redis.del(`phoneotp:pending:${supabaseUserId}`); } catch { /* harmless */ }
    }

    await invalidateUserCache(userId);

    console.log(`✅ Phone verified uid=${userId}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ phone/verify-code error:', err);
    return NextResponse.json(
      { error: 'Could not complete verification. Please try again or email support@preciprocal.com.' },
      { status: 500 },
    );
  }
}
