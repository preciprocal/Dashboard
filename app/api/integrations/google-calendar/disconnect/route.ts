// app/api/integrations/google-calendar/disconnect/route.ts
// Revokes the grant at Google, then forgets it here. Events already on the
// calendar stay: they belong to the user now.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getCalendarConfig, revokeToken } from '@/lib/calendar/oauth';
import { decryptToken } from '@/lib/calendar/crypto';
import { AAD_REFRESH } from '@/lib/calendar/tokens';
import { getConnection, deleteConnection, SchemaMissingError } from '@/lib/calendar/store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cfg = getCalendarConfig();
  if (!cfg) return NextResponse.json({ error: 'Google Calendar is not configured' }, { status: 404 });

  // Same-origin only. SameSite=Lax session cookies already stop a cross-site
  // form post from being authenticated; this is the second lock.
  const reqOrigin = req.headers.get('origin');
  if (reqOrigin && reqOrigin !== new URL(cfg.appUrl).origin && reqOrigin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const conn = await getConnection(user.supabaseUserId);
    if (!conn) return NextResponse.json({ success: true, revoked: false });
    let revoked = false;
    try {
      revoked = await revokeToken(decryptToken(conn.refresh_token_enc, cfg.encryptionKey, AAD_REFRESH));
    } catch {
      // Unreadable token: nothing we can revoke. The row still goes.
    }
    await deleteConnection(user.supabaseUserId);
    return NextResponse.json({ success: true, revoked });
  } catch (err) {
    if (err instanceof SchemaMissingError) return NextResponse.json({ success: true, revoked: false });
    console.error('google-calendar disconnect:', err);
    return NextResponse.json({ error: 'Could not disconnect. Please try again.' }, { status: 500 });
  }
}
