// app/api/resume/recruiter-analysis/route.ts - WITH DEBUG LOGGING
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface LinkedInJob {
  title: string;
  company: string;
  location?: string;
  description: string;
  url: string;
  jobId?: string;
}

export async function POST(request: NextRequest) {
  console.log('=== RECRUITER ANALYSIS API STARTED ===');
  
  try {
    // ==================== AUTHENTICATION ====================
    console.log('Step 1: Checking authentication...');
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      console.error('❌ No session cookie found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decodedClaims = await auth.verifySessionCookie(session.value, true);
      userId = decodedClaims.uid;
      console.log('✅ User authenticated:', userId);
    } catch (authError) {
      console.error('❌ Session verification failed:', authError);
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    // ==================== PARSE REQUEST ====================
    console.log('Step 2: Parsing request body...');
    const body = await request.json();
    const { resumeId, linkedInJob } = body as {
      resumeId: string;
      linkedInJob?: LinkedInJob;
    };

    console.log('Request data:', {
      resumeId,
      hasLinkedInJob: !!linkedInJob,
      jobTitle: linkedInJob?.title,
      jobCompany: linkedInJob?.company
    });

    if (!resumeId) {
      console.error('❌ No resume ID provided');
      return NextResponse.json(
        { success: false, error: 'Resume ID is required' },
        { status: 400 }
      );
    }

    // ==================== FETCH RESUME FROM FIRESTORE ====================
    console.log('Step 3: Fetching resume from Firestore...');
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();

    if (!resumeDoc.exists) {
      console.error('❌ Resume not found:', resumeId);
      return NextResponse.json(
        { success: false, error: 'Resume not found' },
        { status: 404 }
      );
    }

    const resume = resumeDoc.data();
    console.log('Resume data structure:', {
      hasData: !!resume,
      userId: resume?.userId,
      hasFeedback: !!resume?.feedback,
      hasResumeText: !!resume?.resumeText,
      hasExtractedText: !!resume?.extractedText
    });
    
    if (!resume) {
      console.error('❌ Resume data is empty');
      return NextResponse.json(
        { success: false, error: 'Resume data is empty' },
        { status: 404 }
      );
    }

    if (resume.userId !== userId) {
      console.error('❌ Unauthorized access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized access to resume' },
        { status: 403 }
      );
    }

    // Extract text from resume
    const resumeText = resume.feedback?.resumeText || 
                      resume.resumeText || 
                      resume.extractedText || 
                      '';

    console.log('Resume text status:', {
      length: resumeText.length,
      hasText: resumeText.length > 0,
      source: resume.feedback?.resumeText ? 'feedback.resumeText' : 
              resume.resumeText ? 'resumeText' : 
              resume.extractedText ? 'extractedText' : 'none'
    });

    if (!resumeText || resumeText.trim().length === 0) {
      console.error('❌ No resume text available');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Resume text not available for analysis. Please re-upload your resume to extract the text content.',
          debugInfo: {
            resumeId,
            hasFeedback: !!resume.feedback,
            hasResumeText: !!resume.resumeText,
            hasExtractedText: !!resume.extractedText
          }
        },
        { status: 400 }
      );
    }

    // ==================== PREPARE PROMPT ====================
    console.log('Step 4: Preparing AI prompt...');
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });

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

9. **Decision**: Choose one:
   - "strong_yes" (Definite interview)
   - "yes" (Proceed to next round)
   - "maybe" (Needs manager review)
   - "no" (Not a fit)

10. **Estimated Review Time**: Realistic seconds spent reviewing (6-30)

11. **Top Skills Found**: 5-7 most relevant skills identified${linkedInJob ? ' that match the job' : ''}

12. **Missing Keywords**: 3-5 important keywords/skills that should be added${linkedInJob ? ' from the job description' : ''}

${linkedInJob ? `
BE SPECIFIC about how this candidate's experience relates to ${linkedInJob.title} at ${linkedInJob.company}. Mention specific requirements from the job description that are met or missing.
` : ''}

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

    console.log('Step 5: Sending to Gemini AI...');
    console.log('Prompt length:', analysisPrompt.length);

    // ==================== GENERATE ANALYSIS ====================
    const result = await model.generateContent(analysisPrompt);
    const responseText = result.response.text();

    console.log('✅ Received Gemini response');
    console.log('Response length:', responseText.length);
    console.log('First 200 chars:', responseText.substring(0, 200));

    // ==================== PARSE RESPONSE ====================
    console.log('Step 6: Parsing AI response...');
    let cleanedResponse = responseText.trim();
    
    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(cleanedResponse);
      console.log('✅ JSON parsed successfully');
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError);
      console.error('Response text:', cleanedResponse);
      
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
    console.log('Step 7: Validating analysis structure...');
    const requiredFields = [
      'overallScore',
      'firstImpressionScore',
      'relevanceScore',
      'experienceAlignment',
      'keywordsMatch',
      'strengths',
      'concerns',
      'recommendations',
      'decision',
      'estimatedReviewTime',
      'topSkillsFound',
      'missingKeywords'
    ];

    const missingFields = requiredFields.filter(field => !(field in analysis));
    
    if (missingFields.length > 0) {
      console.error('❌ Missing fields:', missingFields);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Incomplete analysis generated',
          details: process.env.NODE_ENV === 'development' ? { missingFields, analysis } : undefined
        },
        { status: 500 }
      );
    }

    // ==================== RETURN RESPONSE ====================
    console.log('✅ Analysis complete - sending response');
    console.log('Analysis summary:', {
      overallScore: analysis.overallScore,
      decision: analysis.decision,
      strengthsCount: analysis.strengths?.length,
      concernsCount: analysis.concerns?.length
    });
    
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
    console.error('❌ FATAL ERROR in recruiter analysis:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
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