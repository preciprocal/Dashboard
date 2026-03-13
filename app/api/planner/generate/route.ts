// app/api/planner/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.CLAUDE_API_KEY;

if (!apiKey) {
  console.error('❌ CLAUDE_API_KEY is not set');
}

const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

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

const SYSTEM_PROMPT = `You are an expert interview preparation coach. Create personalized, day-by-day interview preparation plans that are realistic, comprehensive, and resource-rich.

Return your response as valid JSON with this exact structure:
{
  "dailyPlans": [
    {
      "focus": "Topic name",
      "topics": ["Subtopic 1", "Subtopic 2"],
      "resources": [
        {
          "type": "youtube",
          "title": "Resource title",
          "url": "https://youtube.com/...",
          "duration": "30 min"
        },
        {
          "type": "leetcode",
          "title": "Problem name",
          "url": "https://leetcode.com/problems/...",
          "difficulty": "medium"
        }
      ],
      "behavioral": {
        "topic": "Communication",
        "question": "Tell me about...",
        "tips": ["tip1", "tip2"],
        "framework": "STAR"
      },
      "communicationTip": "Practice tip",
      "tasks": [
        {
          "type": "technical",
          "title": "Task name",
          "description": "Task description",
          "status": "todo",
          "priority": "high",
          "estimatedMinutes": 45
        }
      ],
      "estimatedHours": 3,
      "aiTips": ["tip1", "tip2"],
      "completed": false
    }
  ]
}

Return ONLY valid JSON, no markdown, no extra text.`;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Plan generation started');
    console.log('   API Key Available:', !!apiKey);

    if (!anthropic || !apiKey) {
      console.error('❌ Claude API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add CLAUDE_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedClaims = await auth.verifySessionCookie(session.value, true);
    const userId = decodedClaims.uid;

    const body = await request.json() as GeneratePlanRequest;
    const {
      role,
      company,
      interviewDate,
      daysUntilInterview,
      skillLevel,
      focusAreas,
      existingSkills,
      weakAreas
    } = body;

    if (!role || !interviewDate || !daysUntilInterview) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log('   User ID:', userId);
    console.log('   Role:', role);
    console.log('   Days until interview:', daysUntilInterview);

    const userPrompt = `Create a ${daysUntilInterview}-day interview preparation plan for:

Role: ${role}
${company ? `Company: ${company}` : ''}
Skill Level: ${skillLevel}
Interview Date: ${interviewDate}
${focusAreas?.length ? `Focus Areas: ${focusAreas.join(', ')}` : ''}
${existingSkills?.length ? `Existing Skills: ${existingSkills.join(', ')}` : ''}
${weakAreas?.length ? `Areas Needing Improvement: ${weakAreas.join(', ')}` : ''}

Create a detailed, day-by-day plan with specific resources, practice problems, and behavioral questions.`;

    console.log('   Calling Claude AI...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    console.log('   ✅ AI response received');
    console.log('   Response length:', responseText.length);

    let cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
    }

    if (!cleaned) {
      console.error('❌ No JSON found in response');
      throw new Error('Failed to parse AI response - no JSON found');
    }

    let generatedPlan: GeneratedPlan;
    try {
      generatedPlan = JSON.parse(cleaned) as GeneratedPlan;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      throw new Error('Failed to parse AI response - invalid JSON');
    }

    if (!generatedPlan.dailyPlans || !Array.isArray(generatedPlan.dailyPlans)) {
      console.error('❌ Invalid plan structure');
      throw new Error('Invalid plan structure from AI');
    }

    console.log('   ✅ Plan structure validated');
    console.log('   Daily plans:', generatedPlan.dailyPlans.length);

    const planId = db.collection('interviewPlans').doc().id;
    const currentDate = new Date();

    generatedPlan.dailyPlans = generatedPlan.dailyPlans.map((dailyPlan: DailyPlan, dayIndex: number) => {
      const planDate = new Date(currentDate);
      planDate.setDate(planDate.getDate() + dayIndex);

      return {
        ...dailyPlan,
        day: dayIndex + 1,
        date: planDate.toISOString().split('T')[0],
        tasks: (dailyPlan.tasks || []).map((task: Task, taskIndex: number) => ({
          ...task,
          id: `${planId}_day${dayIndex + 1}_task${taskIndex + 1}`,
          dueDate: planDate.toISOString().split('T')[0],
          status: 'todo'
        }))
      };
    });

    const totalTasks = generatedPlan.dailyPlans.reduce(
      (sum: number, day: DailyPlan) => sum + (day.tasks?.length || 0),
      0
    );

    const completePlan = {
      id: planId,
      userId,
      role,
      company: company || null,
      interviewDate,
      daysUntilInterview,
      skillLevel,
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
        totalStudyHours: 0
      },
      generatedBy: 'claude',
      generationPrompt: userPrompt,
      lastAIUpdate: new Date().toISOString()
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
      { status: 500 }
    );
  }
}