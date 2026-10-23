// app/api/planner/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { anthropic, extractText, extractJsonString, createMessage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

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

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert interview preparation coach. Create personalized, day-by-day interview preparation plans that are realistic, comprehensive, and resource-rich.

IMPORTANT GUIDELINES:
1. Each day should have 3-5 focused tasks with realistic time estimates.
2. Resources must include REAL URLs - use actual YouTube channels (NeetCode, TechLead, Clément Mihailescu), real LeetCode problem URLs, and real documentation links.
3. Behavioral questions should use the STAR framework and be relevant to the target role.
4. Scale difficulty progressively - start with fundamentals, build to advanced topics.
5. For shorter plans (< 7 days), focus on highest-impact topics only.
6. For longer plans (> 14 days), include revision days and mock interview practice.
7. Each day should have exactly 1 behavioral prep question.
8. Communication tips should be actionable and specific.

CRITICAL: Return ONLY valid JSON. No markdown fences, no preamble, no explanation. Start your response with { and end with }.

{
  "dailyPlans": [
    {
      "focus": "Topic name - clear and specific",
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
      "communicationTip": "When answering technical questions, think out loud - narrate your thought process before jumping to the solution.",
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

// ─── Generation helpers ───────────────────────────────────────────────────────

// 3 compact days is ~2,500 tokens, ~17s on the fast model; every group runs
// at once, so a plan of any length takes about one group's time.
const DAYS_PER_CALL = 3;
// Measured ~800 output tokens per compact day; the margin keeps a verbose day
// from cutting the group's JSON off (the cause of the original failures).
const TOKENS_PER_DAY = 1100;

/** One focus line per day, so parallel groups build on each other. */
async function outlinePlan(userPrompt: string, total: number): Promise<string> {
  const response = await createMessage({
    max_tokens: 200 + total * 40,
    system: 'You outline interview preparation plans. Return ONLY JSON: {"days":[{"day":1,"focus":"..."}]} with exactly one entry per day. Progress from fundamentals to advanced topics; for plans longer than 14 days include revision days and mock interview days.',
    messages: [{ role: 'user', content: `${userPrompt}\n\nOutline all ${total} days now.` }],
  });
  try {
    const { days } = JSON.parse(extractJsonString(extractText(response))) as { days: { day: number; focus: string }[] };
    return days.map(d => `Day ${d.day}: ${d.focus}`).join('\n');
  } catch {
    return ''; // groups still work without it, just less coordinated
  }
}

/** Days `from`..`to` of the plan, following the outline. Retried once if the JSON is unusable. */
async function writeDays(userPrompt: string, outline: string | null, from: number, to: number, total: number): Promise<DailyPlan[]> {
  const count = to - from + 1;
  const scope = (total > count
    ? `\n\n${outline ? `PLAN OUTLINE:\n${outline}\n\n` : ''}Write ONLY days ${from}-${to} of this ${total}-day plan: exactly ${count} entries in "dailyPlans", in order${outline ? ', each following its outline focus' : ''}.`
    : '') + '\n\nKeep each day compact: 3 tasks, 2-3 resources, and one-sentence descriptions and tips.';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await createMessage({
      max_tokens: 400 + count * TOKENS_PER_DAY,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt + scope }],
    });
    try {
      const plan = JSON.parse(extractJsonString(extractText(response))) as GeneratedPlan;
      if (Array.isArray(plan.dailyPlans) && plan.dailyPlans.length) return plan.dailyPlans.slice(0, count);
    } catch (err) {
      console.error(`❌ Days ${from}-${to} JSON unusable (attempt ${attempt}):`, (err as Error).message);
    }
  }
  throw new Error(`Failed to generate days ${from}-${to}`);
}

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
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'studyPlans');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
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

    // ── Generate ──────────────────────────────────────────────────
    // A whole plan in one response was ~7,000 tokens of JSON: about 70s to
    // write, and one malformed character anywhere failed the entire plan.
    // Now an outline call fixes each day's focus (small, fast), then the days
    // are written in groups of DAYS_PER_CALL at once from that outline, each
    // group parsed (and retried once) on its own.
    const total = Math.max(1, Math.min(60, Number(daysUntilInterview) || 1));
    const outline = total > DAYS_PER_CALL ? await outlinePlan(userPrompt, total) : null;
    const groups: Array<[number, number]> = [];
    for (let from = 1; from <= total; from += DAYS_PER_CALL) groups.push([from, Math.min(total, from + DAYS_PER_CALL - 1)]);
    console.log(`   Calling Claude AI... (${total} days, ${groups.length} parallel group(s))`);

    const written = await Promise.all(groups.map(([from, to]) => writeDays(userPrompt, outline, from, to, total)));
    const generatedPlan: GeneratedPlan = { dailyPlans: written.flat() };

    if (generatedPlan.dailyPlans.length === 0) {
      console.error('❌ Invalid plan structure');
      throw new Error('Invalid plan structure from AI');
    }

    console.log('   ✅ Plan structure validated');
    console.log('   Daily plans:', generatedPlan.dailyPlans.length);

    // ── Post-process: add IDs, dates, ensure structure ───────────
    const planId = crypto.randomUUID();
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

    // ── Save to Postgres ──────────────────────────────────────────
    const completePlan = {
      id: planId,
      userId: supabaseUserId,
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

    console.log('   Saving plan to Postgres...');
    const { error: insertError } = await supabaseAdmin.from('interview_plans').insert({
      id: planId,
      user_id: supabaseUserId,
      archived: false,
      data: completePlan,
    });
    if (insertError) throw insertError;

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'studyPlans');

    console.log('✅ Plan generated and saved successfully');
    console.log('   Plan ID:', planId);
    console.log('   Total tasks:', totalTasks);

    return NextResponse.json({ success: true, planId, plan: completePlan });

  } catch (error) {
    console.error('❌ Error generating interview plan:', error);
    return NextResponse.json(
      { error: 'Could not generate your plan. Please try again.' },
      { status: 500 },
    );
  }
}