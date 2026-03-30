// app/api/planner/quiz/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { redis } from '@/lib/redis/redis-client';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// Cache TTL: 24 hours — quiz stays the same for a given plan version
const QUIZ_CACHE_TTL = 24 * 60 * 60;

interface QuizRequest {
  planId: string;
  forceRegenerate?: boolean;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  relatedDay: number;
  difficulty: string;
  source: string;
}

interface QuizData {
  questions: QuizQuestion[];
}

interface CachedQuiz {
  questions: QuizQuestion[];
  metadata: {
    role: string;
    company?: string;
    totalDays: number;
    totalTasks: number;
  };
  cachedAt: string;
  planProgressHash: string;
}

interface Resource {
  type: string;
  title: string;
  difficulty?: string;
}

interface BehavioralPrep {
  topic: string;
  question: string;
  tips?: string[];
}

interface Task {
  title: string;
  description: string;
}

interface DailyPlan {
  day: number;
  focus: string;
  topics?: string[];
  resources?: Resource[];
  behavioral?: BehavioralPrep;
  tasks?: Task[];
  aiTips?: string[];
}

interface PlanData {
  userId: string;
  role: string;
  company?: string;
  skillLevel: string;
  dailyPlans?: DailyPlan[];
  progress?: {
    totalTasks?: number;
    completedTasks?: number;
    percentage?: number;
  };
}

// ── Cache helpers ──────────────────────────────────────────────

function getQuizCacheKey(planId: string): string {
  return `quiz:${planId}`;
}

/**
 * Build a hash from plan progress so we can invalidate
 * when the user completes more tasks (quiz should reflect full plan)
 */
function buildProgressHash(plan: PlanData): string {
  const completed = plan.progress?.completedTasks ?? 0;
  const total = plan.progress?.totalTasks ?? 0;
  return `${total}-${completed}`;
}

async function getCachedQuiz(planId: string): Promise<CachedQuiz | null> {
  if (!redis) return null;
  try {
    const key = getQuizCacheKey(planId);
    const cached = await redis.get(key);
    if (cached) {
      console.log(`✅ Cache HIT - Quiz for plan ${planId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return data as CachedQuiz;
    }
    console.log(`❌ Cache MISS - Quiz for plan ${planId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

async function cacheQuiz(planId: string, quiz: CachedQuiz): Promise<void> {
  if (!redis) return;
  try {
    const key = getQuizCacheKey(planId);
    await redis.setex(key, QUIZ_CACHE_TTL, JSON.stringify(quiz));
    console.log(`✅ Cached quiz for plan ${planId} (TTL: ${QUIZ_CACHE_TTL}s)`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

async function invalidateQuizCache(planId: string): Promise<void> {
  if (!redis) return;
  try {
    const key = getQuizCacheKey(planId);
    await redis.del(key);
    console.log(`✅ Invalidated quiz cache for plan ${planId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

// ── System prompt ──────────────────────────────────────────────

const QUIZ_SYSTEM_PROMPT = `You are an expert interview coach. Generate a quiz based on the user's interview preparation plan.

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
1. Use ACTUAL content from the plan
2. Each question has exactly 4 options
3. correctAnswer is index 0-3
4. Mix difficulty levels
5. Reference specific days and topics from the plan
6. Make explanations educational and detailed`;

// ── Route handler ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = await auth.verifySessionCookie(sessionCookie, true);
      userId = decoded.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = (await request.json()) as QuizRequest;
    const { planId, forceRegenerate } = body;

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Fetch plan from Firestore
    const planDoc = await db.collection('interviewPlans').doc(planId).get();
    if (!planDoc.exists) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const planData = planDoc.data() as PlanData;
    if (planData.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ── Check Redis cache (unless force regenerate) ──
    if (!forceRegenerate) {
      const cached = await getCachedQuiz(planId);
      if (cached) {
        // Verify the plan hasn't changed significantly
        const currentHash = buildProgressHash(planData);
        if (cached.planProgressHash === currentHash) {
          console.log(`⚡ Returning cached quiz for plan ${planId}`);
          return NextResponse.json({
            questions: cached.questions,
            metadata: cached.metadata,
            _cached: true,
          });
        } else {
          // Plan progress changed, invalidate and regenerate
          console.log(`🔄 Plan progress changed, regenerating quiz for ${planId}`);
          await invalidateQuizCache(planId);
        }
      }
    } else {
      await invalidateQuizCache(planId);
    }

    // ── Generate quiz via AI ──
    if (!anthropic) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    // Build plan summary for prompt
    const dailyPlans = planData.dailyPlans || [];
    const planSummary = dailyPlans
      .map((day: DailyPlan) => {
        const topics = day.topics?.join(', ') || 'No topics';
        const resources = day.resources?.map((r: Resource) => `${r.title} (${r.type})`).join(', ') || 'None';
        const behavioral = day.behavioral ? `Behavioral: ${day.behavioral.topic} - ${day.behavioral.question}` : '';
        const tasks = day.tasks?.map((t: Task) => t.title).join(', ') || 'No tasks';
        const tips = day.aiTips?.join('; ') || '';
        return `Day ${day.day}: ${day.focus}\n  Topics: ${topics}\n  Resources: ${resources}\n  Tasks: ${tasks}\n  ${behavioral}\n  Tips: ${tips}`;
      })
      .join('\n\n');

    const userPrompt = `Generate a quiz for this preparation plan:

Role: ${planData.role}
${planData.company ? `Company: ${planData.company}` : ''}
Skill Level: ${planData.skillLevel}
Total Days: ${dailyPlans.length}

Plan Details:
${planSummary}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: QUIZ_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    // Parse JSON response
    let quizData: QuizData;
    try {
      const cleaned = textBlock.text
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      quizData = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse quiz JSON:', textBlock.text.substring(0, 200));
      return NextResponse.json({ error: 'Failed to parse quiz data' }, { status: 500 });
    }

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      return NextResponse.json({ error: 'Invalid quiz format' }, { status: 500 });
    }

    const metadata = {
      role: planData.role,
      company: planData.company,
      totalDays: dailyPlans.length,
      totalTasks: planData.progress?.totalTasks || 0,
    };

    // ── Cache the generated quiz ──
    const cachedQuiz: CachedQuiz = {
      questions: quizData.questions,
      metadata,
      cachedAt: new Date().toISOString(),
      planProgressHash: buildProgressHash(planData),
    };
    await cacheQuiz(planId, cachedQuiz);

    return NextResponse.json({
      questions: quizData.questions,
      metadata,
      _cached: false,
    });
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}