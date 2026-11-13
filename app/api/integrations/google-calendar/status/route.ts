// app/api/integrations/google-calendar/status/route.ts
// Whether Google Calendar is available, connected, or needs a reconnect.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getCalendarConfig } from '@/lib/calendar/oauth';
import { readCalendarStatus } from '@/lib/calendar/server-status';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { status } = await readCalendarStatus(user.supabaseUserId, getCalendarConfig());
  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
