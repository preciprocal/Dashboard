// app/api/planner/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use correct environment variable name (same as your working route)
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces
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
}`;

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Plan generation started');
    console.log('   API Key Available:', !!apiKey);

    // Check API configuration
    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Get session cookie
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify session
    const decodedClaims = await auth.verifySessionCookie(session.value, true);
    const userId = decodedClaims.uid;

    // Parse request body
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

    // Validation
    if (!role || !interviewDate || !daysUntilInterview) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('   User ID:', userId);
    console.log('   Role:', role);
    console.log('   Days until interview:', daysUntilInterview);

    // Build user prompt
    const userPrompt = `Create a ${daysUntilInterview}-day interview preparation plan for:

Role: ${role}
${company ? `Company: ${company}` : ''}
Skill Level: ${skillLevel}
Interview Date: ${interviewDate}
${focusAreas?.length ? `Focus Areas: ${focusAreas.join(', ')}` : ''}
${existingSkills?.length ? `Existing Skills: ${existingSkills.join(', ')}` : ''}
${weakAreas?.length ? `Areas Needing Improvement: ${weakAreas.join(', ')}` : ''}

Create a detailed, day-by-day plan with specific resources, practice problems, and behavioral questions.`;

    // Use Gemini 2.0 Flash model (same as your working route)
    console.log('   Calling Gemini AI...');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001'
    });

    const fullPrompt = SYSTEM_PROMPT + '\n\n' + userPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, no markdown, no extra text.';
    
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();
    
    console.log('   ✅ AI response received');
    console.log('   Response length:', responseText.length);
    
    // Extract JSON from response (same approach as your working route)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('❌ No JSON found in response');
      console.error('Response:', responseText.substring(0, 500));
      throw new Error('Failed to parse AI response - no JSON found');
    }

    let generatedPlan: GeneratedPlan;
    try {
      generatedPlan = JSON.parse(jsonMatch[0]) as GeneratedPlan;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      console.error('Extracted text:', jsonMatch[0].substring(0, 500));
      throw new Error('Failed to parse AI response - invalid JSON');
    }

    // Validate response structure
    if (!generatedPlan.dailyPlans || !Array.isArray(generatedPlan.dailyPlans)) {
      console.error('❌ Invalid plan structure');
      throw new Error('Invalid plan structure from AI');
    }

    console.log('   ✅ Plan structure validated');
    console.log('   Daily plans:', generatedPlan.dailyPlans.length);

    // Add metadata and IDs
    const planId = db.collection('interviewPlans').doc().id;
    const currentDate = new Date();

    // Generate task IDs and dates
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

    // Calculate total tasks
    const totalTasks = generatedPlan.dailyPlans.reduce(
      (sum: number, day: DailyPlan) => sum + (day.tasks?.length || 0), 
      0
    );

    // Create complete plan object
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
      
      generatedBy: 'gemini',
      generationPrompt: userPrompt,
      lastAIUpdate: new Date().toISOString()
    };

    // Save to Firestore
    console.log('   Saving plan to Firestore...');
    await db.collection('interviewPlans').doc(planId).set(completePlan);

    console.log('✅ Plan generated and saved successfully');
    console.log('   Plan ID:', planId);
    console.log('   Total tasks:', totalTasks);

    return NextResponse.json({
      success: true,
      planId,
      plan: completePlan
    });

  } catch (error) {
    console.error('❌ Error generating interview plan:', error);
    const err = error as Error;
    console.error('   Error name:', err.name);
    console.error('   Error message:', err.message);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate plan', 
        details: err.message,
        type: err.name 
      },
      { status: 500 }
    );
  }
}