// app/api/resume/recruiter-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

interface LinkedInJob {
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  jobId?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting recruiter analysis...');

    // ==================== AUTHENTICATION ====================
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decodedClaims = await auth.verifySessionCookie(session.value, true);
      userId = decodedClaims.uid;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    // ==================== PARSE REQUEST ====================
    const body = await request.json();
    const { resumeId, linkedInJob } = body as {
      resumeId: string;
      linkedInJob?: LinkedInJob;
    };

    if (!resumeId) {
      return NextResponse.json(
        { success: false, error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    console.log('📄 Fetching resume:', resumeId);
    console.log('🎯 LinkedIn job:', linkedInJob ? 'Present' : 'Not provided');

    // ==================== FETCH RESUME FROM FIRESTORE ====================
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();

    if (!resumeDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    const resume = resumeDoc.data();

    if (!resume) {
      return NextResponse.json(
        { success: false, error: 'Resume data is empty' },
        { status: 404 }
      );
    }

    if (resume.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access to resume' },
        { status: 403 }
      );
    }

    // Extract text from resume - check multiple possible locations
    const resumeText = resume.feedback?.resumeText ||
                      resume.resumeText ||
                      resume.extractedText ||
                      '';

    if (!resumeText || resumeText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Resume text not available for analysis. Please re-upload your resume to extract the text content.'
        },
        { status: 400 }
      );
    }

    console.log('📝 Resume text length:', resumeText.length);

    // ==================== PREPARE PROMPT ====================
    const analysisPrompt = `You are an experienced technical recruiter conducting a 6-second initial resume screening. Analyze this resume from a recruiter's perspective.

RESUME CONTENT:
${resumeText}

${linkedInJob ? `
TARGET JOB DESCRIPTION:
Position: ${linkedInJob.title}
Company: ${linkedInJob.company}
${linkedInJob.location ? `Location: ${linkedInJob.location}` : ''}

Job Description:
${linkedInJob.description}

IMPORTANT: This candidate is applying for THIS SPECIFIC JOB. Analyze the resume specifically for how well it matches this role at ${linkedInJob.company}.
` : `
GENERAL SCREENING: Analyze this resume as a general screening without a specific job target.
`}

Provide a realistic recruiter analysis covering:

1. **Overall Score (0-100)**: How strong is this resume${linkedInJob ? ' for this specific job' : ''}?
2. **First Impression Score (0-100)**: Visual appeal, formatting, clarity in the first 6 seconds
3. **Relevance Score (0-100)**: ${linkedInJob ? `How well does the experience match ${linkedInJob.title} at ${linkedInJob.company}?` : 'How relevant is the experience for typical roles?'}
4. **Experience Alignment (0-100)**: ${linkedInJob ? 'Does the career trajectory fit this role?' : 'Is the career progression clear and strong?'}
5. **Keywords Match (0-100)**: ${linkedInJob ? 'Percentage of job posting keywords found in resume' : 'Industry keywords and technical terms present'}
6. **Strengths**: 3-5 specific things that stood out positively${linkedInJob ? ' for this role' : ''}
7. **Concerns**: 2-4 red flags or concerns${linkedInJob ? ' regarding fit for this position' : ''}
8. **Recommendations**: 3-5 specific action items to improve the resume${linkedInJob ? ' for this job' : ''}
9. **Decision**: Choose one: "strong_yes" | "yes" | "maybe" | "no"
10. **Estimated Review Time**: Realistic seconds spent reviewing (6-30)
11. **Top Skills Found**: 5-7 most relevant skills identified${linkedInJob ? ' that match the job' : ''}
12. **Missing Keywords**: 3-5 important keywords/skills that should be added${linkedInJob ? ' from the job description' : ''}

${linkedInJob ? `BE SPECIFIC about how this candidate's experience relates to ${linkedInJob.title} at ${linkedInJob.company}.` : ''}

Respond ONLY with valid JSON in this exact format:
{
  "overallScore": 75,
  "firstImpressionScore": 80,
  "relevanceScore": 70,
  "experienceAlignment": 75,
  "keywordsMatch": 65,
  "strengths": ["strength1", "strength2", "strength3"],
  "concerns": ["concern1", "concern2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "decision": "yes",
  "estimatedReviewTime": 12,
  "topSkillsFound": ["skill1", "skill2", "skill3"],
  "missingKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

    console.log('🤖 Sending to Claude...');

    // ==================== GENERATE ANALYSIS ====================
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    console.log('✅ Received Claude response');

    // ==================== PARSE RESPONSE ====================
    let cleanedResponse = responseText.trim();

    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to parse AI response',
          details: process.env.NODE_ENV === 'development' ? cleanedResponse : undefined
        },
        { status: 500 }
      );
    }

    // ==================== VALIDATE ANALYSIS ====================
    const requiredFields = [
      'overallScore', 'firstImpressionScore', 'relevanceScore',
      'experienceAlignment', 'keywordsMatch', 'strengths', 'concerns',
      'recommendations', 'decision', 'estimatedReviewTime',
      'topSkillsFound', 'missingKeywords'
    ];

    const missingFields = requiredFields.filter(field => !(field in analysis));

    if (missingFields.length > 0) {
      console.error('Missing fields:', missingFields);
      return NextResponse.json(
        {
          success: false,
          error: 'Incomplete analysis generated',
          details: process.env.NODE_ENV === 'development' ? { missingFields, analysis } : undefined
        },
        { status: 500 }
      );
    }

    console.log('✅ Recruiter analysis complete');

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        resumeId,
        hasLinkedInJob: !!linkedInJob,
        jobTitle: linkedInJob?.title,
        jobCompany: linkedInJob?.company,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    console.error('❌ Recruiter analysis error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate recruiter analysis',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}