// app/api/planner/rebalance/route.ts
// Missed-day recovery: redistributes undone tasks across remaining days
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

interface Task {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimatedMinutes: number;
  dueDate?: string;
  [key: string]: unknown;
}

interface DailyPlan {
  day: number;
  date: string;
  focus: string;
  topics: string[];
  tasks: Task[];
  estimatedHours: number;
  [key: string]: unknown;
}

interface PlanData {
  userId: string;
  interviewDate: string;
  dailyPlans: DailyPlan[];
  progress: {
    totalTasks: number;
    completedTasks: number;
    percentage: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { supabaseUserId } = authedUser;

    const { planId } = await request.json() as { planId: string };
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    const { data: row, error: fetchError } = await supabaseAdmin.from('interview_plans').select('user_id, data').eq('id', planId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const plan = row.data as PlanData;
    if (row.user_id !== supabaseUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Separate past/today days from future days
    const pastDays: DailyPlan[] = [];
    const futureDays: DailyPlan[] = [];

    for (const dp of plan.dailyPlans) {
      if (dp.date <= todayStr) {
        pastDays.push(dp);
      } else {
        futureDays.push(dp);
      }
    }

    if (futureDays.length === 0) {
      return NextResponse.json({
        error: 'No future days to redistribute tasks to',
        rebalanced: false,
      }, { status: 400 });
    }

    // Collect all undone tasks from past days
    const undoneTasks: Task[] = [];
    const updatedPastDays = pastDays.map(dp => {
      const done: Task[] = [];
      const notDone: Task[] = [];
      dp.tasks.forEach(t => {
        if (t.status === 'done') done.push(t);
        else notDone.push(t);
      });
      undoneTasks.push(...notDone);
      return { ...dp, tasks: done }; // past days only keep completed tasks
    });

    if (undoneTasks.length === 0) {
      return NextResponse.json({
        message: 'No tasks to rebalance - you\'re on track!',
        rebalanced: false,
        movedTasks: 0,
      });
    }

    // Sort undone tasks by priority (high first)
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    undoneTasks.sort((a, b) =>
      (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
    );

    // Distribute undone tasks evenly across future days
    const updatedFutureDays = futureDays.map(dp => ({ ...dp, tasks: [...dp.tasks] }));

    undoneTasks.forEach((task, i) => {
      const targetDay = updatedFutureDays[i % updatedFutureDays.length];
      targetDay.tasks.push({
        ...task,
        status: 'todo',
        dueDate: targetDay.date,
        // Mark as rebalanced so UI can highlight
        id: task.id + '_rb',
      });
    });

    // Recalculate estimated hours for future days
    updatedFutureDays.forEach(dp => {
      dp.estimatedHours = Math.round(
        dp.tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0) / 60 * 10
      ) / 10;
    });

    // Merge back
    const newDailyPlans = [...updatedPastDays, ...updatedFutureDays];

    // Recalculate progress
    const allTasks = newDailyPlans.flatMap(dp => dp.tasks);
    const completedTasks = allTasks.filter(t => t.status === 'done').length;
    const totalTasks = allTasks.length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Merge into the plan blob and write the whole `data` column back -
    // Postgres jsonb has no dot-notation partial update like Firestore did.
    const nowIso = new Date().toISOString();
    const updatedPlan = {
      ...plan,
      dailyPlans: newDailyPlans,
      progress: { ...plan.progress, totalTasks, completedTasks, percentage },
      updatedAt: nowIso,
      lastRebalancedAt: nowIso,
    };
    const { error: updateError } = await supabaseAdmin
      .from('interview_plans')
      .update({ data: updatedPlan, updated_at: nowIso })
      .eq('id', planId);
    if (updateError) throw updateError;

    console.log(`✅ Rebalanced plan ${planId}: moved ${undoneTasks.length} tasks across ${updatedFutureDays.length} future days`);

    return NextResponse.json({
      success: true,
      rebalanced: true,
      movedTasks: undoneTasks.length,
      futureDaysAffected: updatedFutureDays.length,
      newProgress: { totalTasks, completedTasks, percentage },
    });
  } catch (error) {
    console.error('❌ Rebalance error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rebalance failed' },
      { status: 500 }
    );
  }
}