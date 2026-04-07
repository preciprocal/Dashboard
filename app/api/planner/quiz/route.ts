// app/api/planner/quiz/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';
import { getUserAIContext, buildUserContextPrompt } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

const QUIZ_CACHE_TTL = 24 * 60 * 60;

// Output: 12 questions × ~80 tokens each = ~960 tokens.
// With explanations + JSON overhead: ~1500 tokens typical.
const MAX_TOKENS = 2000;

interface QuizQuestion { id: number; question: string; options: string[]; correctAnswer: number; explanation: string; category: string; relatedDay: number; difficulty: string; source: string; }
interface QuizData { questions: QuizQuestion[]; }
interface CachedQuiz { questions: QuizQuestion[]; metadata: { role: string; company?: string; totalDays: number; totalTasks: number }; cachedAt: string; planProgressHash: string; }
interface Resource { type: string; title: string; }
interface BehavioralPrep { topic: string; question: string; }
interface Task { title: string; }
interface DailyPlan { day: number; focus: string; topics?: string[]; resources?: Resource[]; behavioral?: BehavioralPrep; tasks?: Task[]; aiTips?: string[]; }
interface PlanData { userId: string; role: string; company?: string; skillLevel: string; dailyPlans?: DailyPlan[]; progress?: { totalTasks?: number; completedTasks?: number; }; }

function progressHash(p: PlanData): string { return `${p.progress?.totalTasks ?? 0}-${p.progress?.completedTasks ?? 0}`; }

async function getCachedQuiz(planId: string): Promise<CachedQuiz | null> {
  if (!redis) return null;
  try { const c = await redis.get(`quiz:${planId}`); return c ? (typeof c === 'string' ? JSON.parse(c) : c as CachedQuiz) : null; } catch { return null; }
}
async function cacheQuiz(planId: string, quiz: CachedQuiz): Promise<void> { if (redis) try { await redis.setex(`quiz:${planId}`, QUIZ_CACHE_TTL, JSON.stringify(quiz)); } catch {} }
async function invalidateQuiz(planId: string): Promise<void> { if (redis) try { await redis.del(`quiz:${planId}`); } catch {} }

const QUIZ_SYSTEM = `You are an expert interview coach. Generate a quiz based on the user's preparation plan.
Generate exactly 12 questions: 6 Technical, 3 Behavioral, 3 Conceptual.

CRITICAL: Return ONLY valid JSON. No markdown, no preamble. Start with { end with }.
{ "questions": [{ "id": 1, "question": "...", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "...", "category": "Technical", "relatedDay": 1, "difficulty": "medium", "source": "Topic from Day 1" }] }

Rules: Use ACTUAL plan content. 4 options per question. Mix difficulty. Reference specific days.`;

export async function POST(request: NextRequest) {
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const session = (await cookies()).get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'light');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'studyPlans');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
    }

    const { planId, forceRegenerate } = await request.json() as { planId: string; forceRegenerate?: boolean };
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    const planDoc = await db.collection('interviewPlans').doc(planId).get();
    if (!planDoc.exists) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    const plan = planDoc.data() as PlanData;
    if (plan.userId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    if (!forceRegenerate) {
      const cached = await getCachedQuiz(planId);
      if (cached && cached.planProgressHash === progressHash(plan)) return NextResponse.json({ questions: cached.questions, metadata: cached.metadata, _cached: true });
      if (cached) await invalidateQuiz(planId);
    } else { await invalidateQuiz(planId); }

    let userCtx = '';
    try { const ctx = await getUserAIContext(userId); userCtx = buildUserContextPrompt(ctx); } catch {}

    const dailyPlans = plan.dailyPlans || [];
    const summary = dailyPlans.map(d => {
      const topics = d.topics?.join(', ') || 'None';
      const res = d.resources?.map(r => r.title).join(', ') || 'None';
      const beh = d.behavioral ? `Behavioral: ${d.behavioral.topic}` : '';
      const tasks = d.tasks?.map(t => t.title).join(', ') || 'None';
      return `Day ${d.day}: ${d.focus} | Topics: ${topics} | Resources: ${res} | Tasks: ${tasks} ${beh}`;
    }).join('\n');

    const userPrompt = `${userCtx}\nRole: ${plan.role}${plan.company ? ` | Company: ${plan.company}` : ''} | Level: ${plan.skillLevel} | Days: ${dailyPlans.length}\n\n${summary}\n\nGenerate quiz now.`;

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(QUIZ_SYSTEM), messages: [{ role: 'user', content: userPrompt }] });
    logUsage('quiz-generate', response);

    let quizData: QuizData;
    try { quizData = JSON.parse(extractJsonString(extractText(response))); } catch { return NextResponse.json({ error: 'Failed to parse quiz' }, { status: 500 }); }
    if (!quizData.questions?.length) return NextResponse.json({ error: 'Invalid quiz' }, { status: 500 });

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'studyPlans');

    const metadata = { role: plan.role, company: plan.company, totalDays: dailyPlans.length, totalTasks: plan.progress?.totalTasks || 0 };
    await cacheQuiz(planId, { questions: quizData.questions, metadata, cachedAt: new Date().toISOString(), planProgressHash: progressHash(plan) });

    return NextResponse.json({ questions: quizData.questions, metadata, _cached: false });
  } catch (error) {
    console.error('❌ Quiz error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal error' }, { status: 500 });
  }
}