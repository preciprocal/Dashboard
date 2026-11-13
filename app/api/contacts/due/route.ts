// app/api/contacts/due/route.ts
// How many follow-ups are due, for a badge or a header line without loading
// the whole list. ?tz=<Date.getTimezoneOffset()> so "today" is the user's day.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { supabaseAdmin } from '@/supabase/admin';
import { endOfLocalDay, safeTzOffset, startOfLocalDay } from '@/lib/contacts/model';
import { isMissingTable } from '@/lib/contacts/server';

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;

  const tz = safeTzOffset(new URL(request.url).searchParams.get('tz'));
  const now = new Date();
  const startOfToday = startOfLocalDay(now, tz);

  try {
    // Served by contacts_user_follow_up_idx (open contacts with a date).
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('next_follow_up_at')
      .eq('user_id', user.supabaseUserId)
      .neq('status', 'closed')
      .not('next_follow_up_at', 'is', null)
      .lt('next_follow_up_at', new Date(endOfLocalDay(now, tz)).toISOString())
      .limit(2000);
    if (isMissingTable(error)) return NextResponse.json({ success: true, setupRequired: true, due: 0, overdue: 0, dueToday: 0 });
    if (error) throw error;

    const rows = data as { next_follow_up_at: string }[];
    const overdue = rows.filter(r => Date.parse(r.next_follow_up_at) < startOfToday).length;
    return NextResponse.json({ success: true, due: rows.length, overdue, dueToday: rows.length - overdue });
  } catch (error) {
    console.error('❌ contacts due GET:', error);
    return NextResponse.json({ error: 'Failed to count follow-ups' }, { status: 500 });
  }
}
