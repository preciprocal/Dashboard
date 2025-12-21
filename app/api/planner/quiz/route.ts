// app/api/planner/quiz/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces
interface QuizRequest {
  planId: string;
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
  };
}

const QUIZ_PROMPT = `You are an expert interview coach. Generate a quiz based on the user's interview preparation plan.

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
5. Reference specific days/topics`;

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Quiz API called');

    // Check Gemini API
    if (!genAI || !apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Check Firebase
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get session
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify session
    const decodedClaims = await auth.verifySessionCookie(session.value, true);
    const userId = decodedClaims.uid;
    console.log('✅ User:', userId);

    // Get planId from request
    const body = await request.json() as QuizRequest;
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: 'planId required' },
        { status: 400 }
      );
    }

    console.log('📝 Plan ID:', planId);

    // Fetch plan from Firestore
    const planDoc = await db.collection('interviewPlans').doc(planId).get();

    if (!planDoc.exists) {
      console.error('❌ Plan not found:', planId);
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    const planData = planDoc.data() as PlanData;
    console.log('✅ Plan loaded:', planData?.role);

    // Verify ownership
    if (planData?.userId !== userId) {
      return NextResponse.json(
        { error: 'Not your plan' },
        { status: 403 }
      );
    }

    // Check plan has content
    if (!planData.dailyPlans || planData.dailyPlans.length === 0) {
      return NextResponse.json(
        { error: 'Plan has no content' },
        { status: 400 }
      );
    }

    // Build context
    const context = buildContext(planData);
    console.log('📋 Context built:', context.length, 'chars');

    // Call Gemini
    console.log('🤖 Calling Gemini...');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    });

    const prompt = `${QUIZ_PROMPT}\n\nPLAN DATA:\n${context}\n\nGenerate quiz now.`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log('✅ AI response received');

    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const quizData = JSON.parse(jsonMatch[0]) as QuizData;

    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz structure');
    }

    console.log('✅ Quiz generated:', quizData.questions.length, 'questions');

    // Save to database (optional)
    const quizId = db.collection('quizzes').doc().id;
    await db.collection('quizzes').doc(quizId).set({
      id: quizId,
      planId,
      userId,
      questions: quizData.questions,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      quizId,
      questions: quizData.questions,
      metadata: {
        role: planData.role,
        company: planData.company,
        totalDays: planData.dailyPlans?.length || 0,
        totalTasks: planData.progress?.totalTasks || 0
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Failed to generate quiz' },
      { status: 500 }
    );
  }
}

function buildContext(planData: PlanData): string {
  const lines: string[] = [];
  
  lines.push(`ROLE: ${planData.role}`);
  if (planData.company) lines.push(`COMPANY: ${planData.company}`);
  lines.push(`SKILL: ${planData.skillLevel}`);
  lines.push('');

  planData.dailyPlans?.forEach((day: DailyPlan) => {
    lines.push(`DAY ${day.day}: ${day.focus}`);
    
    if (day.topics?.length) {
      lines.push(`Topics: ${day.topics.join(', ')}`);
    }
    
    if (day.resources?.length) {
      lines.push('Resources:');
      day.resources.forEach((r: Resource) => {
        lines.push(`  - ${r.title} (${r.type}${r.difficulty ? ', ' + r.difficulty : ''})`);
      });
    }
    
    if (day.behavioral) {
      lines.push('Behavioral:');
      lines.push(`  Topic: ${day.behavioral.topic}`);
      lines.push(`  Question: ${day.behavioral.question}`);
      if (day.behavioral.tips?.length) {
        lines.push(`  Tips: ${day.behavioral.tips.join('; ')}`);
      }
    }
    
    if (day.tasks?.length) {
      lines.push('Tasks:');
      day.tasks.forEach((t: Task) => {
        lines.push(`  - ${t.title}: ${t.description}`);
      });
    }
    
    if (day.aiTips?.length) {
      lines.push('AI Tips:');
      day.aiTips.forEach((tip: string) => {
        lines.push(`  - ${tip}`);
      });
    }
    
    lines.push('');
  });

  return lines.join('\n');
}