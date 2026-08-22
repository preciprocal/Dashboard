// app/api/planner/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

// DELETE /api/planner/plans/[id] - delete a plan (ownership-checked)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data: row, error: fetchError } = await supabaseAdmin
      .from('interview_plans')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    if (row.user_id !== authedUser.supabaseUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const { error: deleteError } = await supabaseAdmin.from('interview_plans').delete().eq('id', id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting plan:', error);
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}
