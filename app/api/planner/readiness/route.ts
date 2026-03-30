// app/api/planner/readiness/route.ts
// Computes a weighted readiness score from tasks, quiz, interviews, and consistency
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';

const READINESS_CACHE_TTL = 5 * 60; // 5 minutes

interface PlanData {
  userId: string;
  role: string;
  company?: string;
  dailyPlans: Array<{
    day: number;
    date: string;
    focus: string;
    tasks: Array<{ id: string; status: string; type: string; priority: string }>;
  }>;
  progress: {
    totalTasks: number;
    completedTasks: number;
    percentage: number;
    currentStreak: number;
    totalStudyHours: number;
  };
  [key: string]: unknown;
}

interface ReadinessBreakdown {
  taskCompletion: { score: number; weight: number; detail: string };
  quizPerformance: { score: number; weight: number; detail: string };
  interviewPerformance: { score: number; weight: number; detail: string };
  consistency: { score: number; weight: number; detail: string };
  overallScore: number;
  level: string;
  recommendation: string;
  weakAreas: string[];
  strongAreas: string[];
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

    // Check cache
    if (redis) {
      try {
        const cached = await redis.get(`readiness:${planId}`);
        if (cached) {
          console.log(`⚡ Readiness cache HIT for ${planId}`);
          const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return NextResponse.json({ ...data, _cached: true });
        }
      } catch { /* ignore cache errors */ }
    }

    // Fetch plan
    const planDoc = await db.collection('interviewPlans').doc(planId).get();
    if (!planDoc.exists) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    const plan = planDoc.data() as PlanData;
    if (plan.userId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    // ── 1. Task completion score (40% weight) ──
    // Weight by priority: high tasks count 2x, medium 1.5x
    let weightedDone = 0, weightedTotal = 0;
    plan.dailyPlans.forEach(dp => {
      dp.tasks.forEach(t => {
        const w = t.priority === 'high' ? 2 : t.priority === 'medium' ? 1.5 : 1;
        weightedTotal += w;
        if (t.status === 'done') weightedDone += w;
      });
    });
    const weightedTaskScore = weightedTotal > 0 ? Math.round((weightedDone / weightedTotal) * 100) : 0;

    // ── 2. Quiz performance (25% weight) ──
    let quizScore = 0;
    let quizDetail = 'No quiz attempted yet';
    if (redis) {
      try {
        const quizData = await redis.get(`quiz:${planId}`);
        if (quizData) {
          quizDetail = 'Quiz available — take it to improve your readiness score';
        }
      } catch { /* ignore */ }
    }
    // Check Firestore for quiz results — wrapped in try/catch since subcollection may not exist
    try {
      const quizRef = db.collection('interviewPlans').doc(planId).collection('quizResults');
      const quizSnap = await quizRef.orderBy('completedAt', 'desc').limit(1).get();
      if (!quizSnap.empty) {
        const result = quizSnap.docs[0].data() as { score: number; total: number };
        if (result.score !== undefined && result.total) {
          quizScore = Math.round((result.score / result.total) * 100);
          quizDetail = `${result.score}/${result.total} correct (${quizScore}%)`;
        }
      }
    } catch { /* subcollection may not exist yet — that's fine */ }

    // ── 3. Mock interview performance (20% weight) ──
    let interviewScore = 0;
    let interviewDetail = 'No mock interviews completed';
    try {
      // Try without orderBy first (avoids composite index requirement)
      const fbSnap = await db.collection('feedback')
        .where('userId', '==', userId)
        .limit(5)
        .get();
      if (!fbSnap.empty) {
        const scores = fbSnap.docs
          .map(d => (d.data() as { totalScore?: number }).totalScore)
          .filter((s): s is number => typeof s === 'number');
        if (scores.length > 0) {
          interviewScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
          interviewDetail = `Avg ${interviewScore}/100 across ${scores.length} session(s)`;
        }
      }
    } catch {
      // If feedback collection doesn't exist or query fails, just skip
      console.warn('⚠️ Could not fetch interview feedback for readiness score');
    }

    // ── 4. Consistency / streak (15% weight) ──
    const streak = plan.progress.currentStreak || 0;
    const totalDays = plan.dailyPlans.length;
    const consistencyScore = totalDays > 0 ? Math.min(100, Math.round((streak / totalDays) * 100)) : 0;
    const consistencyDetail = streak > 0
      ? `${streak}-day streak (${consistencyScore}% of plan)`
      : 'No active streak';

    // ── Calculate weighted overall ──
    const overallScore = Math.round(
      weightedTaskScore * 0.4 +
      quizScore * 0.25 +
      interviewScore * 0.2 +
      consistencyScore * 0.15
    );

    // ── Determine level ──
    let level: string, recommendation: string;
    if (overallScore >= 85) { level = 'Interview Ready'; recommendation = 'You\'re well-prepared. Focus on mock interviews for final polish.'; }
    else if (overallScore >= 70) { level = 'Almost Ready'; recommendation = 'Good progress! Complete remaining tasks and take the quiz to solidify knowledge.'; }
    else if (overallScore >= 50) { level = 'Building Up'; recommendation = 'You\'re making progress. Focus on high-priority tasks and your weak areas.'; }
    else if (overallScore >= 25) { level = 'Getting Started'; recommendation = 'Keep at it! Consistency is key. Try to complete at least 2-3 tasks daily.'; }
    else { level = 'Just Beginning'; recommendation = 'Start with the first day\'s tasks. Small consistent efforts add up quickly.'; }

    // ── Identify weak/strong areas by task type ──
    const typeStats: Record<string, { done: number; total: number }> = {};
    plan.dailyPlans.forEach(dp => {
      dp.tasks.forEach(t => {
        if (!typeStats[t.type]) typeStats[t.type] = { done: 0, total: 0 };
        typeStats[t.type].total++;
        if (t.status === 'done') typeStats[t.type].done++;
      });
    });

    const weakAreas: string[] = [];
    const strongAreas: string[] = [];
    Object.entries(typeStats).forEach(([type, { done, total }]) => {
      const pct = total > 0 ? (done / total) * 100 : 0;
      if (pct < 40 && total >= 2) weakAreas.push(type);
      else if (pct >= 75 && total >= 2) strongAreas.push(type);
    });

    const breakdown: ReadinessBreakdown = {
      taskCompletion: { score: weightedTaskScore, weight: 40, detail: `${plan.progress.completedTasks}/${plan.progress.totalTasks} tasks (priority-weighted: ${weightedTaskScore}%)` },
      quizPerformance: { score: quizScore, weight: 25, detail: quizDetail },
      interviewPerformance: { score: interviewScore, weight: 20, detail: interviewDetail },
      consistency: { score: consistencyScore, weight: 15, detail: consistencyDetail },
      overallScore,
      level,
      recommendation,
      weakAreas,
      strongAreas,
    };

    // Cache result
    if (redis) {
      try {
        await redis.setex(`readiness:${planId}`, READINESS_CACHE_TTL, JSON.stringify(breakdown));
      } catch { /* ignore */ }
    }

    return NextResponse.json(breakdown);
  } catch (error) {
    console.error('❌ Readiness error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute readiness' },
      { status: 500 }
    );
  }
}