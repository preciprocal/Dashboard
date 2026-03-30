// app/api/planner/rebalance/route.ts
// Missed-day recovery: redistributes undone tasks across remaining days
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';

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
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await auth.verifySessionCookie(session.value, true);
    const userId = decoded.uid;

    const { planId } = await request.json() as { planId: string };
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    const planDoc = await db.collection('interviewPlans').doc(planId).get();
    if (!planDoc.exists) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const plan = planDoc.data() as PlanData;
    if (plan.userId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

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
        message: 'No tasks to rebalance — you\'re on track!',
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

    // Update Firestore with dot-notation to avoid stale merge
    await db.collection('interviewPlans').doc(planId).update({
      dailyPlans: newDailyPlans,
      'progress.totalTasks': totalTasks,
      'progress.completedTasks': completedTasks,
      'progress.percentage': percentage,
      updatedAt: new Date().toISOString(),
      lastRebalancedAt: new Date().toISOString(),
    });

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