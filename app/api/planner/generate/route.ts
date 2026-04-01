// app/api/planner/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeneratePlanRequest {
  role: string;
  company?: string;
  interviewDate: string;
  daysUntilInterview: number;
  skillLevel: string;
  focusAreas?: string[];
  existingSkills?: string[];
  weakAreas?: string[];
}

interface Resource {
  type: string;
  title: string;
  url: string;
  duration?: string;
  difficulty?: string;
}

interface BehavioralPrep {
  topic: string;
  question: string;
  tips: string[];
  framework: string;
}

interface Task {
  id?: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  estimatedMinutes: number;
  dueDate?: string;
}

interface DailyPlan {
  day?: number;
  date?: string;
  focus: string;
  topics: string[];
  resources: Resource[];
  behavioral: BehavioralPrep;
  communicationTip: string;
  tasks: Task[];
  estimatedHours: number;
  aiTips: string[];
  completed: boolean;
}

interface GeneratedPlan {
  dailyPlans: DailyPlan[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

function extractJsonString(raw: string): string {
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
  }
  return cleaned;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert interview preparation coach. Create personalized, day-by-day interview preparation plans that are realistic, comprehensive, and resource-rich.

IMPORTANT GUIDELINES:
1. Each day should have 3-5 focused tasks with realistic time estimates.
2. Resources must include REAL URLs — use actual YouTube channels (NeetCode, TechLead, Clément Mihailescu), real LeetCode problem URLs, and real documentation links.
3. Behavioral questions should use the STAR framework and be relevant to the target role.
4. Scale difficulty progressively — start with fundamentals, build to advanced topics.
5. For shorter plans (< 7 days), focus on highest-impact topics only.
6. For longer plans (> 14 days), include revision days and mock interview practice.
7. Each day should have exactly 1 behavioral prep question.
8. Communication tips should be actionable and specific.

CRITICAL: Return ONLY valid JSON. No markdown fences, no preamble, no explanation. Start your response with { and end with }.

{
  "dailyPlans": [
    {
      "focus": "Topic name — clear and specific",
      "topics": ["Subtopic 1", "Subtopic 2", "Subtopic 3"],
      "resources": [
        {
          "type": "youtube",
          "title": "Video title",
          "url": "https://youtube.com/watch?v=...",
          "duration": "15 min"
        },
        {
          "type": "leetcode",
          "title": "Problem: Two Sum",
          "url": "https://leetcode.com/problems/two-sum/",
          "difficulty": "easy"
        },
        {
          "type": "article",
          "title": "Article title",
          "url": "https://...",
          "duration": "10 min read"
        }
      ],
      "behavioral": {
        "topic": "Leadership",
        "question": "Tell me about a time you led a project under a tight deadline.",
        "tips": ["Use STAR format", "Quantify the outcome", "Mention what you learned"],
        "framework": "STAR"
      },
      "communicationTip": "When answering technical questions, think out loud — narrate your thought process before jumping to the solution.",
      "tasks": [
        {
          "type": "technical",
          "title": "Solve 3 array problems on LeetCode",
          "description": "Focus on Two Sum, Best Time to Buy and Sell Stock, and Contains Duplicate. Time yourself to 20 min each.",
          "status": "todo",
          "priority": "high",
          "estimatedMinutes": 60
        },
        {
          "type": "behavioral",
          "title": "Write STAR response for leadership question",
          "description": "Draft a 2-minute response using the STAR framework for today's behavioral question.",
          "status": "todo",
          "priority": "medium",
          "estimatedMinutes": 20
        }
      ],
      "estimatedHours": 3,
      "aiTips": ["Focus on understanding patterns, not memorising solutions", "Review time/space complexity for each problem"],
      "completed": false
    }
  ]
}`;

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Plan generation started');

    if (!anthropic) {
      console.error('❌ Claude API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add CLAUDE_API_KEY to environment variables.' },
        { status: 500 },
      );
    }

    // ── Auth ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try {
      const decodedClaims = await auth.verifySessionCookie(session.value, true);
      userId = decodedClaims.uid;
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────
    const body = await request.json() as GeneratePlanRequest;
    const { role, company, interviewDate, daysUntilInterview, skillLevel, focusAreas, existingSkills, weakAreas } = body;

    if (!role || !interviewDate || !daysUntilInterview) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('   User ID:', userId);
    console.log('   Role:', role);
    console.log('   Days until interview:', daysUntilInterview);

    // ── Build prompt ──────────────────────────────────────────────
    const userPrompt = `Create a ${daysUntilInterview}-day interview preparation plan for:

Role: ${role}
${company ? `Company: ${company}` : ''}
Skill Level: ${skillLevel}
Interview Date: ${interviewDate}
${focusAreas?.length ? `Focus Areas: ${focusAreas.join(', ')}` : ''}
${existingSkills?.length ? `Existing Skills: ${existingSkills.join(', ')}` : ''}
${weakAreas?.length ? `Areas Needing Improvement: ${weakAreas.join(', ')}` : ''}

Create a detailed, day-by-day plan with specific resources, practice problems, and behavioral questions for each day.`;

    // ── Call Claude ───────────────────────────────────────────────
    console.log('   Calling Claude AI...');

    const response = await anthropic.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 8192,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const raw = extractText(response);
    console.log('   ✅ AI response received, length:', raw.length);

    const cleaned = extractJsonString(raw);

    if (!cleaned) {
      console.error('❌ No JSON found in response');
      throw new Error('Failed to parse AI response — no JSON found');
    }

    let generatedPlan: GeneratedPlan;
    try {
      generatedPlan = JSON.parse(cleaned) as GeneratedPlan;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      console.error('   First 500 chars:', cleaned.slice(0, 500));
      throw new Error('Failed to parse AI response — invalid JSON');
    }

    if (!generatedPlan.dailyPlans || !Array.isArray(generatedPlan.dailyPlans)) {
      console.error('❌ Invalid plan structure');
      throw new Error('Invalid plan structure from AI');
    }

    console.log('   ✅ Plan structure validated');
    console.log('   Daily plans:', generatedPlan.dailyPlans.length);

    // ── Post-process: add IDs, dates, ensure structure ───────────
    const planId = db.collection('interviewPlans').doc().id;
    const currentDate = new Date();

    generatedPlan.dailyPlans = generatedPlan.dailyPlans.map((dailyPlan: DailyPlan, dayIndex: number) => {
      const planDate = new Date(currentDate);
      planDate.setDate(planDate.getDate() + dayIndex);

      return {
        ...dailyPlan,
        day: dayIndex + 1,
        date: planDate.toISOString().split('T')[0],
        completed: false,
        tasks: (dailyPlan.tasks || []).map((task: Task, taskIndex: number) => ({
          ...task,
          id: `${planId}_day${dayIndex + 1}_task${taskIndex + 1}`,
          dueDate: planDate.toISOString().split('T')[0],
          status: 'todo',
        })),
      };
    });

    const totalTasks = generatedPlan.dailyPlans.reduce(
      (sum: number, day: DailyPlan) => sum + (day.tasks?.length || 0),
      0,
    );

    // ── Save to Firestore ────────────────────────────────────────
    const completePlan = {
      id: planId,
      userId,
      role,
      company: company || null,
      interviewDate,
      daysUntilInterview,
      skillLevel,
      focusAreas: focusAreas || [],
      existingSkills: existingSkills || [],
      weakAreas: weakAreas || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      dailyPlans: generatedPlan.dailyPlans,
      customTasks: [],
      progress: {
        totalTasks,
        completedTasks: 0,
        percentage: 0,
        currentStreak: 0,
        totalStudyHours: 0,
      },
      generatedBy: 'claude',
      generationPrompt: userPrompt,
      lastAIUpdate: new Date().toISOString(),
    };

    console.log('   Saving plan to Firestore...');
    await db.collection('interviewPlans').doc(planId).set(completePlan);

    console.log('✅ Plan generated and saved successfully');
    console.log('   Plan ID:', planId);
    console.log('   Total tasks:', totalTasks);

    return NextResponse.json({ success: true, planId, plan: completePlan });

  } catch (error) {
    console.error('❌ Error generating interview plan:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Failed to generate plan', details: err.message, type: err.name },
      { status: 500 },
    );
  }
}