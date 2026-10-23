// app/api/planner/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import type { InterviewPlan, TaskStatus } from '@/types/planner';

type Ctx = { params: Promise<{ id: string }> };

/** The caller's own plan, or the response to send instead. */
async function ownPlan(request: NextRequest, id: string): Promise<{ plan: InterviewPlan } | { res: NextResponse }> {
  const authedUser = await getAuthedUser(request);
  if (!authedUser) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: row, error } = await supabaseAdmin
    .from('interview_plans')
    .select('user_id, data')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { res: NextResponse.json({ error: 'Plan not found' }, { status: 404 }) };
  if (row.user_id !== authedUser.supabaseUserId) return { res: NextResponse.json({ error: 'Unauthorized' }, { status: 403 }) };
  return { plan: row.data as InterviewPlan };
}

// GET /api/planner/plans/[id] - one plan (ownership-checked)
export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const result = await ownPlan(request, (await params).id);
    if ('res' in result) return result.res;
    return NextResponse.json({ success: true, plan: result.plan });
  } catch (error) {
    console.error('❌ Error loading plan:', error);
    return NextResponse.json({ error: 'Failed to load plan' }, { status: 500 });
  }
}

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

// PATCH /api/planner/plans/[id] - set one task's status; progress is recomputed here
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const { taskId, status } = await request.json() as { taskId?: string; status?: TaskStatus };
    if (!taskId || !status || !STATUSES.includes(status)) {
      return NextResponse.json({ error: 'taskId and a valid status are required' }, { status: 400 });
    }
    const result = await ownPlan(request, id);
    if ('res' in result) return result.res;
    const plan = result.plan;

    const nowIso = new Date().toISOString();
    let found = false;
    const setStatus = <T extends { id: string; status: TaskStatus; completedAt?: string }>(t: T): T => {
      if (t.id !== taskId) return t;
      found = true;
      return { ...t, status, completedAt: status === 'done' ? nowIso : undefined };
    };
    const dailyPlans = (plan.dailyPlans ?? []).map(dp => {
      const tasks = dp.tasks.map(setStatus);
      return { ...dp, tasks, completed: tasks.length > 0 && tasks.every(t => t.status === 'done') };
    });
    const customTasks = (plan.customTasks ?? []).map(setStatus);
    if (!found) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const all = [...dailyPlans.flatMap(dp => dp.tasks), ...customTasks];
    const completedTasks = all.filter(t => t.status === 'done').length;
    const percentage = all.length ? Math.round((completedTasks / all.length) * 100) : 0;
    const updatedPlan: InterviewPlan = {
      ...plan,
      dailyPlans,
      customTasks,
      status: percentage === 100 ? 'completed' : plan.status === 'completed' ? 'active' : plan.status,
      progress: { ...plan.progress, totalTasks: all.length, completedTasks, percentage, lastActivityDate: nowIso },
      updatedAt: nowIso,
    };
    const { error: updateError } = await supabaseAdmin
      .from('interview_plans')
      .update({ data: updatedPlan, updated_at: nowIso })
      .eq('id', id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, progress: updatedPlan.progress });
  } catch (error) {
    console.error('❌ Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

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
