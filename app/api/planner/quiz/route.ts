// app/api/planner/quiz/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { redis } from '@/lib/redis/redis-client';
import { getUserAIContext, buildUserContextPrompt } from '@/lib/ai/user-context';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

const QUIZ_CACHE_TTL = 24 * 60 * 60;

interface QuizRequest { planId: string; forceRegenerate?: boolean; }
interface QuizQuestion { id: number; question: string; options: string[]; correctAnswer: number; explanation: string; category: string; relatedDay: number; difficulty: string; source: string; }
interface QuizData { questions: QuizQuestion[]; }
interface CachedQuiz { questions: QuizQuestion[]; metadata: { role: string; company?: string; totalDays: number; totalTasks: number }; cachedAt: string; planProgressHash: string; }
interface Resource { type: string; title: string; difficulty?: string; }
interface BehavioralPrep { topic: string; question: string; tips?: string[]; }
interface Task { title: string; description: string; }
interface DailyPlan { day: number; focus: string; topics?: string[]; resources?: Resource[]; behavioral?: BehavioralPrep; tasks?: Task[]; aiTips?: string[]; }
interface PlanData { userId: string; role: string; company?: string; skillLevel: string; dailyPlans?: DailyPlan[]; progress?: { totalTasks?: number; completedTasks?: number; percentage?: number }; }

function buildProgressHash(plan: PlanData): string { return `${plan.progress?.totalTasks ?? 0}-${plan.progress?.completedTasks ?? 0}`; }

async function getCachedQuiz(planId: string): Promise<CachedQuiz | null> {
  if (!redis) return null;
  try { const c = await redis.get(`quiz:${planId}`); if (c) return typeof c === 'string' ? JSON.parse(c) : c as CachedQuiz; return null; } catch { return null; }
}
async function cacheQuiz(planId: string, quiz: CachedQuiz): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`quiz:${planId}`, QUIZ_CACHE_TTL, JSON.stringify(quiz)); } catch { /* ignore */ }
}
async function invalidateQuizCache(planId: string): Promise<void> {
  if (!redis) return;
  try { await redis.del(`quiz:${planId}`); } catch { /* ignore */ }
}

export async function POST(request: NextRequest) {
  try {
    if (!anthropic) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try { const d = await auth.verifySessionCookie(session.value, true); userId = d.uid; }
    catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    const body = await request.json() as QuizRequest;
    const { planId, forceRegenerate } = body;
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    const planDoc = await db.collection('interviewPlans').doc(planId).get();
    if (!planDoc.exists) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    const planData = planDoc.data() as PlanData;
    if (planData.userId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    if (!forceRegenerate) {
      const cached = await getCachedQuiz(planId);
      if (cached && cached.planProgressHash === buildProgressHash(planData)) {
        return NextResponse.json({ questions: cached.questions, metadata: cached.metadata, _cached: true });
      }
      if (cached) await invalidateQuizCache(planId);
    } else {
      await invalidateQuizCache(planId);
    }

    // ── Fetch user context ──
    let userContextPrompt = '';
    try {
      const ctx = await getUserAIContext(userId);
      userContextPrompt = buildUserContextPrompt(ctx);
      console.log(`✅ Quiz gen: user context loaded | resume: ${!!ctx.resumeText} | transcript: ${!!ctx.transcriptText}`);
    } catch (err) { console.warn('⚠️ Failed to load user context:', err); }

    const dailyPlans = planData.dailyPlans || [];
    const planSummary = dailyPlans.map((day: DailyPlan) => {
      const topics = day.topics?.join(', ') || 'No topics';
      const resources = day.resources?.map((r: Resource) => `${r.title} (${r.type})`).join(', ') || 'None';
      const behavioral = day.behavioral ? `Behavioral: ${day.behavioral.topic} - ${day.behavioral.question}` : '';
      const tasks = day.tasks?.map((t: Task) => t.title).join(', ') || 'No tasks';
      const tips = day.aiTips?.join('; ') || '';
      return `Day ${day.day}: ${day.focus}\n  Topics: ${topics}\n  Resources: ${resources}\n  Tasks: ${tasks}\n  ${behavioral}\n  Tips: ${tips}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert interview coach. Generate a quiz based on the user's preparation plan.
${userContextPrompt ? '\nThe candidate\'s resume and academic background are provided. Incorporate questions that test concepts from their actual coursework and projects.\n' : ''}
Generate exactly 12 questions: 6 Technical, 3 Behavioral, 3 Conceptual.
Return ONLY valid JSON — no markdown fences, no preamble, no extra text. Start your response with { and end with }:
{
  "questions": [{ "id": 1, "question": "...", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "...", "category": "Technical", "relatedDay": 1, "difficulty": "medium", "source": "Topic from Day 1" }]
}
Rules: Use ACTUAL plan content. 4 options per question. Mix difficulty. Reference specific days.`;

    const userPrompt = `${userContextPrompt}
Generate a quiz for this preparation plan:
Role: ${planData.role}
${planData.company ? `Company: ${planData.company}` : ''}
Skill Level: ${planData.skillLevel}
Total Days: ${dailyPlans.length}

Plan Details:
${planSummary}`;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    let quizData: QuizData;
    try {
      let cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      if (!cleaned.startsWith('{')) {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];
      }
      quizData = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: 'Failed to parse quiz data' }, { status: 500 });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return NextResponse.json({ error: 'Invalid quiz format' }, { status: 500 });
    }

    const metadata = { role: planData.role, company: planData.company, totalDays: dailyPlans.length, totalTasks: planData.progress?.totalTasks || 0 };
    await cacheQuiz(planId, { questions: quizData.questions, metadata, cachedAt: new Date().toISOString(), planProgressHash: buildProgressHash(planData) });

    return NextResponse.json({ questions: quizData.questions, metadata, _cached: false });
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}