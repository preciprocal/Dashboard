// app/api/account/security-event/route.ts
// Called by Settings straight after a password change or an email change
// request (both happen in the browser through Supabase Auth). Records the
// event (account_events) and emails the account's current address, so a
// change the owner did not make does not go unnoticed.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { supabaseAdmin } from '@/supabase/admin';
import { recordAccountEvent } from '@/lib/account-events';
import { sendSecurityChangeEmail } from '@/lib/email/security-change';

export const runtime = 'nodejs';

const bodySchema = z.object({
  type: z.enum(['password_changed', 'email_change_requested']),
  newEmail: z.string().email().max(254).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(req, user.userId, 'light');
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { type, newEmail } = parsed.data;

  const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('user_id', user.supabaseUserId).maybeSingle();
  const currentEmail = (profile?.email as string | undefined) ?? user.email ?? null;

  await recordAccountEvent({
    type, userId: user.supabaseUserId,
    ip: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
    userAgent: req.headers.get('user-agent'),
    detail: newEmail ? { newEmail } : {},
  });
  if (currentEmail) {
    await sendSecurityChangeEmail({
      userId: user.supabaseUserId, email: currentEmail,
      kind: type === 'password_changed' ? 'password' : 'email', newEmail,
    });
  }
  return NextResponse.json({ success: true });
}
