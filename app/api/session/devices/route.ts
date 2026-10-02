// app/api/session/devices/route.ts
// Settings > Devices: the signed-in user's own sessions, and removing them.
//
//   GET     every device still signed in, newest activity first, with the one
//           making the request marked `current`
//   DELETE  { sessionId }      remove one device
//           { allOthers: true } sign out everywhere except here
//
// Removal ends the session at the token layer, not just on next page load.
// See supabase/migrations/0044_user_session_revocation.sql.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { supabaseAdmin } from '@/supabase/admin';
import { describeDevice } from '@/lib/session/describe-device';
import { removeDevice, removeOtherDevices } from '@/lib/session/registry';

export const runtime = 'nodejs';

/**
 * The caller's user id AND session id.
 *
 * getUser() rather than getClaims() for the user, because it asks GoTrue: a
 * session that was itself just removed from another device must not be able
 * to turn around and remove the device that removed it. The session id only
 * exists as a token claim, so it comes from getClaims().
 */
async function caller(req: NextRequest): Promise<{ userId: string; sessionId: string } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() { /* middleware already refreshed the cookie */ },
      },
    },
  );

  const [{ data: userData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const claims = claimsData?.claims as { sub?: string; session_id?: string } | undefined;
  if (!userData.user || !claims?.session_id || claims.sub !== userData.user.id) return null;
  return { userId: userData.user.id, sessionId: claims.session_id };
}

export async function GET(req: NextRequest) {
  const me = await caller(req);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('user_sessions')
    .select('session_id, user_agent, geo_city, geo_country, created_at, last_seen_at')
    .eq('user_id', me.userId)
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('❌ devices list failed:', error.message);
    return NextResponse.json({ error: 'Could not load your devices' }, { status: 500 });
  }

  // Deliberately omitted: IP address and device fingerprint. Location is the
  // coarse city and country, which is all anyone needs to recognise a device.
  const devices = (data ?? []).map(row => {
    const { label, kind } = describeDevice(row.user_agent as string | null);
    return {
      id: row.session_id as string,
      label,
      kind,
      location: [row.geo_city, row.geo_country].filter(Boolean).join(', ') || null,
      createdAt: row.created_at as string,
      lastSeenAt: row.last_seen_at as string,
      current: row.session_id === me.sessionId,
    };
  });

  // The current device first, whatever its last heartbeat says.
  devices.sort((a, b) => Number(b.current) - Number(a.current));
  return NextResponse.json({ devices });
}

const deleteSchema = z.union([
  z.object({ sessionId: z.string().min(1).max(64) }),
  z.object({ allOthers: z.literal(true) }),
]);

export async function DELETE(req: NextRequest) {
  const me = await caller(req);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  if ('allOthers' in parsed.data) {
    const ok = await removeOtherDevices(me.userId, me.sessionId);
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Could not sign out your other devices' }, { status: 500 });
  }

  const { sessionId } = parsed.data;
  if (sessionId === me.sessionId) {
    return NextResponse.json({ error: 'Use Sign out to sign out of this device' }, { status: 400 });
  }

  // Scoped to the caller inside the RPC as well, but checked here first so a
  // guessed id for someone else's session gets a 404, not a silent success.
  const { data: owned } = await supabaseAdmin
    .from('user_sessions')
    .select('session_id')
    .eq('session_id', sessionId)
    .eq('user_id', me.userId)
    .maybeSingle();
  if (!owned) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const ok = await removeDevice(me.userId, sessionId);
  return ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Could not remove that device' }, { status: 500 });
}
