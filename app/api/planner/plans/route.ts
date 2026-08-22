// app/api/planner/plans/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import type { InterviewPlan } from '@/types/planner';

// GET /api/planner/plans - list all plans for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('interview_plans')
      .select('data')
      .eq('user_id', authedUser.supabaseUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const plans = (data ?? []).map((row) => row.data as InterviewPlan);

    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error('❌ Error listing plans:', error);
    return NextResponse.json({ error: 'Failed to list plans' }, { status: 500 });
  }
}
