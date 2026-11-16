// app/api/visa-timeline/route.ts
//
// GET            -> { timeline }
// POST timeline  -> { timeline }
// The student's own OPT, STEM OPT and H-1B dates and unemployment-day count,
// kept on their profile (extended_data.visaTimeline). See lib/visa/timeline.ts.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { EMPTY_TIMELINE, readTimeline } from '@/lib/visa/timeline';

export const runtime = 'nodejs';

type Ext = Record<string, unknown>;

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabaseAdmin.from('profiles').select('extended_data').eq('user_id', user.supabaseUserId).maybeSingle();
  const ext = (data?.extended_data as Ext | null) ?? {};
  return NextResponse.json({ timeline: ext.visaTimeline ? readTimeline(ext.visaTimeline) : EMPTY_TIMELINE });
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const timeline = { ...readTimeline(body), updatedAt: new Date().toISOString() };
  const { data } = await supabaseAdmin.from('profiles').select('extended_data').eq('user_id', user.supabaseUserId).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const ext = (data.extended_data as Ext | null) ?? {};
  const { error } = await supabaseAdmin.from('profiles')
    .update({ extended_data: { ...ext, visaTimeline: timeline }, updated_at: new Date().toISOString() })
    .eq('user_id', user.supabaseUserId);
  if (error) {
    console.error('❌ visa timeline save:', error);
    return NextResponse.json({ error: 'Could not save your dates. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ timeline });
}
