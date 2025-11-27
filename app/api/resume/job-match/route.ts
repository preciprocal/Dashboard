// app/api/resume/job-match/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use correct environment variable name
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces
interface JobMatchRequest {
  resumeId: string;
  resumeText: string;
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
}

interface SkillMatch {
  skill: string;
  present: boolean;
  importance: 'critical' | 'important' | 'nice-to-have';
}

interface JobMatchResult {
  overallScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  skillsMatch: SkillMatch[];
  experienceAlignment: number;
  recommendations: string[];
  competitiveAdvantages: string[];
  redFlags: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as JobMatchRequest;
    const { resumeId, resumeText, jobDescription, jobTitle, companyName } = body;

    console.log('🎯 Job Match Analysis Started');
    console.log('   Resume ID:', resumeId);
    console.log('   Resume Text Length:', resumeText?.length || 0);
    console.log('   Job Description Length:', jobDescription?.length || 0);
    console.log('   API Key Available:', !!apiKey);

    if (!jobDescription) {
      return NextResponse.json(
        { error: 'Job description is required' },
        { status: 400 }
      );
    }

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json(
        { error: 'Resume text not available or too short' },
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

    // Use stable model version
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001' 
    });

    const prompt = `You are an expert ATS system and recruiter. Analyze how well this resume matches the job description.

Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""

${jobTitle ? `Job Title: ${jobTitle}` : ''}
${companyName ? `Company: ${companyName}` : ''}

Provide a comprehensive match analysis in JSON format:
{
  "overallScore": 85,
  "matchedKeywords": ["Python", "React", "AWS", "Leadership"],
  "missingKeywords": ["Kubernetes", "GraphQL", "CI/CD"],
  "skillsMatch": [
    {
      "skill": "Python",
      "present": true,
      "importance": "critical"
    },
    {
      "skill": "Kubernetes",
      "present": false,
      "importance": "critical"
    },
    {
      "skill": "React",
      "present": true,
      "importance": "important"
    }
  ],
  "experienceAlignment": 90,
  "recommendations": [
    "Add specific examples of Python projects you've led",
    "Include metrics showing AWS cost optimization",
    "Mention any Kubernetes experience, even if basic"
  ],
  "competitiveAdvantages": [
    "Strong leadership experience with team sizes matching the role",
    "Relevant AWS certifications",
    "Proven track record in similar industry"
  ],
  "redFlags": [
    "Employment gap from 2022-2023 not explained",
    "Missing required Kubernetes expertise"
  ]
}

Be specific and actionable in your analysis. Score from 0-100 where:
- 90-100: Excellent match, strong candidate
- 80-89: Very good match, likely to pass screening
- 70-79: Good match, competitive candidate
- 60-69: Fair match, some gaps to address
- Below 60: Weak match, significant improvements needed`;

    console.log('   Calling Gemini AI...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const matchResult = JSON.parse(jsonMatch[0]) as JobMatchResult;
    console.log('   ✅ Job match analysis complete');
    console.log('   Overall Score:', matchResult.overallScore);

    return NextResponse.json({
      success: true,
      matchResult,
    });

  } catch (error) {
    console.error('❌ Job match error:', error);
    const err = error as Error & { status?: number; statusText?: string };
    console.error('   Error details:', {
      message: err.message,
      status: err.status,
      statusText: err.statusText
    });
    
    return NextResponse.json(
      { 
        error: err.message || 'Failed to analyze job match',
        details: process.env.NODE_ENV === 'development' ? err.toString() : undefined
      },
      { status: 500 }
    );
  }
}