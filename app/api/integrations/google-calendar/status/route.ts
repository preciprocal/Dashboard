// app/api/integrations/google-calendar/status/route.ts
// The calendar connection status (Google or Outlook): which providers can be
// connected, which one is, and whether it needs a reconnect.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { readCalendars } from '@/lib/calendar/server-status';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { status } = await readCalendars(user.supabaseUserId);
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
