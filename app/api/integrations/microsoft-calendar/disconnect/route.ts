// app/api/integrations/microsoft-calendar/disconnect/route.ts
// Forgets the Outlook connection and the tokens we hold. Microsoft has no
// endpoint for an app to revoke its own refresh token for one user, so the
// Settings copy points to the Microsoft account page for removing the app.
// Events already added stay in Outlook.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getMicrosoftConfig } from '@/lib/calendar/microsoft-oauth';
import { deleteMicrosoftConnection } from '@/lib/calendar/microsoft-store';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cfg = getMicrosoftConfig();
  if (!cfg) return NextResponse.json({ error: 'Outlook calendar is not configured' }, { status: 404 });

  const reqOrigin = req.headers.get('origin');
  if (reqOrigin && reqOrigin !== new URL(cfg.appUrl).origin && reqOrigin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await deleteMicrosoftConnection(user.supabaseUserId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('microsoft-calendar disconnect:', err);
    return NextResponse.json({ error: 'Could not disconnect. Please try again.' }, { status: 500 });
  }
}
