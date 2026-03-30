// app/api/planner/quiz/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import OpenAI from 'openai';
import { redis } from '@/lib/redis/redis-client';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QUIZ_CACHE_TTL = 24 * 60 * 60;

interface QuizRequest { planId: string; forceRegenerate?: boolean; }
interface QuizQuestion { id: number; question: string; options: string[]; correctAnswer: number; explanation: string; category: string; relatedDay: number; difficulty: string; source: string; }
interface QuizData { questions: QuizQuestion[]; }

interface CachedQuiz {
  questions: QuizQuestion[];
  metadata: { role: string; company?: string; totalDays: number; totalTasks: number };
  cachedAt: string;
  planProgressHash: string;
}

interface Resource { type: string; title: string; difficulty?: string; }
interface BehavioralPrep { topic: string; question: string; tips?: string[]; }
interface Task { title: string; description: string; }
interface DailyPlan { day: number; focus: string; topics?: string[]; resources?: Resource[]; behavioral?: BehavioralPrep; tasks?: Task[]; aiTips?: string[]; }
interface PlanData { userId: string; role: string; company?: string; skillLevel: string; dailyPlans?: DailyPlan[]; progress?: { totalTasks?: number; completedTasks?: number; percentage?: number }; }

function buildProgressHash(plan: PlanData): string {
  return `${plan.progress?.totalTasks ?? 0}-${plan.progress?.completedTasks ?? 0}`;
}

async function getCachedQuiz(planId: string): Promise<CachedQuiz | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get(`quiz:${planId}`);
    if (cached) { console.log(`✅ Quiz cache HIT ${planId}`); return typeof cached === 'string' ? JSON.parse(cached) : cached as CachedQuiz; }
    return null;
  } catch { return null; }
}

async function cacheQuiz(planId: string, quiz: CachedQuiz): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`quiz:${planId}`, QUIZ_CACHE_TTL, JSON.stringify(quiz)); } catch { /* ignore */ }
}

async function invalidateQuizCache(planId: string): Promise<void> {
  if (!redis) return;
  try { await redis.del(`quiz:${planId}`); } catch { /* ignore */ }
}

const QUIZ_SYSTEM_PROMPT = `You are an expert interview coach. Generate a quiz based on the user's preparation plan.

Generate exactly 12 questions:
- 6 Technical questions (from topics, coding problems, tasks)
- 3 Behavioral questions (from behavioral prep)
- 3 Conceptual questions (from AI tips and concepts)

Return ONLY valid JSON, no markdown:
{
  "questions": [
    {
      "id": 1,
      "question": "Question text based on plan content",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation referencing plan content",
      "category": "Technical",
      "relatedDay": 1,
      "difficulty": "medium",
      "source": "Topic from Day 1"
    }
  ]
}

Rules:
1. Use ACTUAL content from the plan — not generic questions
2. Each question has exactly 4 options
3. correctAnswer is index 0-3
4. Mix difficulty levels (easy, medium, hard)
5. Reference specific days and topics
6. Make explanations educational and detailed`;

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try {
      const decoded = await auth.verifySessionCookie(session.value, true);
      userId = decoded.uid;
    } catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    const body = await request.json() as QuizRequest;
    const { planId, forceRegenerate } = body;
    if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

    // Fetch plan
    const planDoc = await db.collection('interviewPlans').doc(planId).get();
    if (!planDoc.exists) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    const planData = planDoc.data() as PlanData;
    if (planData.userId !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    // ── Check cache ──
    if (!forceRegenerate) {
      const cached = await getCachedQuiz(planId);
      if (cached && cached.planProgressHash === buildProgressHash(planData)) {
        console.log(`⚡ Returning cached quiz for ${planId}`);
        return NextResponse.json({ questions: cached.questions, metadata: cached.metadata, _cached: true });
      }
      if (cached) await invalidateQuizCache(planId);
    } else {
      await invalidateQuizCache(planId);
    }

    // ── Build context ──
    const dailyPlans = planData.dailyPlans || [];
    const planSummary = dailyPlans.map((day: DailyPlan) => {
      const topics = day.topics?.join(', ') || 'No topics';
      const resources = day.resources?.map((r: Resource) => `${r.title} (${r.type})`).join(', ') || 'None';
      const behavioral = day.behavioral ? `Behavioral: ${day.behavioral.topic} - ${day.behavioral.question}` : '';
      const tasks = day.tasks?.map((t: Task) => t.title).join(', ') || 'No tasks';
      const tips = day.aiTips?.join('; ') || '';
      return `Day ${day.day}: ${day.focus}\n  Topics: ${topics}\n  Resources: ${resources}\n  Tasks: ${tasks}\n  ${behavioral}\n  Tips: ${tips}`;
    }).join('\n\n');

    const userPrompt = `Generate a quiz for this preparation plan:\n\nRole: ${planData.role}\n${planData.company ? `Company: ${planData.company}` : ''}\nSkill Level: ${planData.skillLevel}\nTotal Days: ${dailyPlans.length}\n\nPlan Details:\n${planSummary}`;

    // ── Call OpenAI ──
    console.log('🤖 Generating quiz via OpenAI...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: QUIZ_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content ?? '';
    let quizData: QuizData;
    try {
      const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      quizData = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse quiz JSON:', responseText.substring(0, 200));
      return NextResponse.json({ error: 'Failed to parse quiz data' }, { status: 500 });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return NextResponse.json({ error: 'Invalid quiz format' }, { status: 500 });
    }

    const metadata = { role: planData.role, company: planData.company, totalDays: dailyPlans.length, totalTasks: planData.progress?.totalTasks || 0 };

    // ── Cache ──
    await cacheQuiz(planId, { questions: quizData.questions, metadata, cachedAt: new Date().toISOString(), planProgressHash: buildProgressHash(planData) });

    return NextResponse.json({ questions: quizData.questions, metadata, _cached: false });
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}