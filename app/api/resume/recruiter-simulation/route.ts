// app/api/resume/recruiter-simulation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/firebase/admin';

// Use correct environment variable name
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces
interface RecruiterSimulationRequest {
  resumeId: string;
}

interface ResumeData {
  jobTitle?: string;
  companyName?: string;
  feedback?: {
    overallScore?: number;
    resumeText?: string;
  };
}

interface HeatmapSection {
  section: string;
  attentionScore: number;
  timeSpent: number;
  notes: string;
}

interface FirstImpression {
  score: number;
  standoutElements: string[];
  concerningElements: string[];
  timeSpentInSeconds: number;
}

interface RecruiterSimulation {
  firstImpression: FirstImpression;
  timeToReview: number;
  eyeTrackingHeatmap: HeatmapSection[];
  passScreening: boolean;
  screenerNotes: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RecruiterSimulationRequest;
    const { resumeId } = body;

    console.log('👁️ Recruiter Simulation Started');
    console.log('   Resume ID:', resumeId);
    console.log('   API Key Available:', !!apiKey);

    if (!resumeId) {
      return NextResponse.json(
        { error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to environment variables.' },
        { status: 500 }
      );
    }

    // Get resume data from Firestore
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    
    if (!resumeDoc.exists) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    const resumeData = resumeDoc.data() as ResumeData;
    
    // Use Gemini 2.0 Flash model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001'
    });

    const prompt = `You are a senior recruiter reviewing resumes. Simulate how you would review this resume in the first 6-10 seconds.

Resume Context:
- Job Title: ${resumeData.jobTitle || 'Not specified'}
- Company: ${resumeData.companyName || 'Not specified'}
- Overall Score: ${resumeData.feedback?.overallScore || 'N/A'}

${resumeData.feedback?.resumeText ? `Resume Content:\n${resumeData.feedback.resumeText.substring(0, 2000)}...` : 'Resume analysis available'}

Provide a recruiter eye-tracking simulation in JSON format:
{
  "firstImpression": {
    "score": 85,
    "standoutElements": [
      "Clear job titles with well-known company names",
      "Quantified achievements (e.g., 'Increased revenue by 40%')",
      "Relevant technical skills prominently displayed"
    ],
    "concerningElements": [
      "No clear career progression visible",
      "Lacks specific technical skills for this role"
    ],
    "timeSpentInSeconds": 7
  },
  "timeToReview": 8,
  "eyeTrackingHeatmap": [
    {
      "section": "Professional Summary",
      "attentionScore": 90,
      "timeSpent": 3,
      "notes": "Strong opening statement with clear value proposition"
    },
    {
      "section": "Work Experience",
      "attentionScore": 85,
      "timeSpent": 4,
      "notes": "Good use of metrics and action verbs"
    },
    {
      "section": "Technical Skills",
      "attentionScore": 75,
      "timeSpent": 1,
      "notes": "Relevant technologies listed"
    },
    {
      "section": "Education",
      "attentionScore": 70,
      "timeSpent": 1,
      "notes": "Solid educational background"
    }
  ],
  "passScreening": true,
  "screenerNotes": [
    "Strong candidate for second round interview",
    "Experience aligns well with role requirements",
    "Technical skills match job requirements",
    "Resume formatting is clean and easy to scan"
  ]
}

Base your simulation on typical recruiter behavior:
1. Recruiters scan resumes top-to-bottom in 6-10 seconds initially
2. They spend most time on recent experience and key achievements
3. They look for red flags (gaps, frequent job changes, lack of progression)
4. They scan for standout accomplishments and relevant keywords
5. AttentionScore represents focus level (0-100): 90+ = high focus, 70-89 = moderate, below 70 = quick glance
6. Total timeToReview should be realistic (typically 6-10 seconds for initial scan)

Provide realistic, actionable insights based on the resume content.`;

    console.log('   Calling Gemini AI for simulation...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const simulation = JSON.parse(jsonMatch[0]) as RecruiterSimulation;
    
    // Validate simulation data
    if (!simulation.firstImpression || !simulation.eyeTrackingHeatmap) {
      throw new Error('Invalid simulation data structure');
    }

    console.log('   ✅ Recruiter simulation complete');
    console.log('   Pass Screening:', simulation.passScreening);
    console.log('   First Impression Score:', simulation.firstImpression.score);

    return NextResponse.json({
      success: true,
      simulation,
    });

  } catch (error) {
    console.error('❌ Recruiter simulation error:', error);
    const err = error as Error & { status?: number; statusText?: string };
    console.error('   Error details:', {
      message: err.message,
      status: err.status,
      statusText: err.statusText
    });
    
    return NextResponse.json(
      { 
        error: err.message || 'Failed to run recruiter simulation',
        details: process.env.NODE_ENV === 'development' ? err.toString() : undefined
      },
      { status: 500 }
    );
  }
}