// app/api/job-application/tailor-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromResume } from '@/lib/resume/pdf-text-extractor';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces
interface ExtractedData {
  jobTitle?: string;
  companyName?: string;
  companyType?: string;
  techStack?: string[];
}

interface TailorResumeRequest {
  resumeId: string;
  jobDescription: string;
  extractedData?: ExtractedData;
}

interface ResumeData {
  userId: string;
  resumeText?: string;
  fileUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('✏️ Resume Tailoring Started');

    // Authentication
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const decodedClaims = await auth.verifySessionCookie(session.value, true);
    const userId = decodedClaims.uid;

    // Check API
    if (!genAI || !apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Parse request
    const body = await request.json() as TailorResumeRequest;
    const { resumeId, jobDescription, extractedData } = body;

    if (!resumeId || !jobDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📄 Resume ID:', resumeId);
    console.log('🎯 Target role:', extractedData?.jobTitle);

    // Fetch resume from Firestore
    const resumeDoc = await db.collection('resumes').doc(resumeId).get();
    
    if (!resumeDoc.exists) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    const resumeData = resumeDoc.data() as ResumeData;

    // Verify ownership
    if (resumeData.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // Extract resume text if not already available
    let resumeText = resumeData.resumeText;
    
    if (!resumeText && resumeData.fileUrl) {
      console.log('📖 Extracting text from resume...');
      try {
        resumeText = await extractTextFromResume(resumeData.fileUrl);
      } catch (extractError) {
        console.error('❌ Text extraction failed:', extractError);
        return NextResponse.json(
          { error: 'Could not extract text from resume' },
          { status: 400 }
        );
      }
    }

    if (!resumeText) {
      return NextResponse.json(
        { error: 'Resume text not available' },
        { status: 400 }
      );
    }

    console.log('📝 Resume text length:', resumeText.length);

    // Tailor resume using AI
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    });

    const companyContext = extractedData?.companyType 
      ? `\nCOMPANY CONTEXT: The company is in the ${extractedData.companyType} industry.` 
      : '';

    const techStackContext = extractedData?.techStack && extractedData.techStack.length > 0
      ? `\nREQUIRED TECHNOLOGIES: ${extractedData.techStack.join(', ')}`
      : '';

    const prompt = `You are an expert resume writer. Tailor this resume to match the job description while PRESERVING THE EXACT FORMAT AND STRUCTURE.

ORIGINAL RESUME:
"""
${resumeText}
"""

TARGET JOB:
Role: ${extractedData?.jobTitle || 'Not specified'}
Company: ${extractedData?.companyName || 'Not specified'}${companyContext}${techStackContext}

JOB DESCRIPTION:
"""
${jobDescription.substring(0, 3000)}
"""

CRITICAL INSTRUCTIONS:
1. PRESERVE EXACT FORMAT: Keep all line breaks, spacing, section headers, bullet points exactly as they are
2. DO NOT change the overall structure or layout
3. DO NOT add new sections or remove existing ones
4. DO NOT change formatting characters (*, -, •, etc.)

WHAT YOU SHOULD CHANGE:
1. **Technical Skills Section**: 
   - Add relevant technologies from the job description that match candidate's experience
   - Prioritize technologies: ${extractedData?.techStack?.slice(0, 10).join(', ') || 'relevant technologies'}
   - Keep existing skills, just reorder/emphasize relevant ones

2. **Experience Descriptions**:
   - Enhance bullet points to highlight relevant experience for this role
   - Add industry-specific terminology for ${extractedData?.companyType || 'the target industry'}
   - Include keywords from job description naturally
   - Quantify achievements where possible

3. **Professional Summary/Objective** (if exists):
   - Tailor to emphasize fit for ${extractedData?.jobTitle || 'the target'} role
   - Mention relevant technologies from target tech stack
   - Keep it concise (2-3 sentences)

4. **Project Descriptions**:
   - Emphasize projects using similar tech stack
   - Highlight relevant methodologies, frameworks, or approaches

WHAT TO PRESERVE:
- All personal information (name, contact, etc.)
- Education details
- Work history dates and company names
- Overall resume length
- Section order and formatting
- Bullet point styles
- Line spacing and structure

OUTPUT FORMAT:
Return the complete tailored resume maintaining the exact same format as the original.
Do NOT add explanations, comments, or markdown formatting.
Just return the tailored resume text.

QUALITY CHECKS:
- Resume should be same length (±10%) as original
- All sections from original should be present
- Format should look identical to original
- Content should naturally incorporate target keywords`;

    console.log('🤖 Generating tailored resume...');
    const result = await model.generateContent(prompt);
    const tailoredResume = result.response.text();

    // Generate change summary
    const changesPrompt = `Compare the original and tailored resumes and list the TOP 5 most important changes made:

ORIGINAL:
${resumeText.substring(0, 2000)}

TAILORED:
${tailoredResume.substring(0, 2000)}

Return a JSON array of strings describing the changes:
["Change 1: Added React and Node.js to skills section",
 "Change 2: Emphasized cloud architecture experience",
 "Change 3: Highlighted fintech project experience",
 "Change 4: Quantified performance improvements with metrics",
 "Change 5: Tailored summary to emphasize backend development"]

Return ONLY the JSON array, nothing else.`;

    const changesResult = await model.generateContent(changesPrompt);
    const changesText = changesResult.response.text();
    
    let changes: string[] = [];
    try {
      const jsonMatch = changesText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        changes = JSON.parse(jsonMatch[0]) as string[];
      }
    } catch (e) {
      console.error('Failed to parse changes:', e);
      changes = ['Resume tailored to match job requirements'];
    }

    console.log('✅ Resume tailoring complete');
    console.log('   Original length:', resumeText.length);
    console.log('   Tailored length:', tailoredResume.length);
    console.log('   Changes identified:', changes.length);

    return NextResponse.json({
      success: true,
      tailoredResume,
      changes,
      metadata: {
        originalLength: resumeText.length,
        tailoredLength: tailoredResume.length,
        targetRole: extractedData?.jobTitle,
        targetCompany: extractedData?.companyName,
        techStackMatched: extractedData?.techStack?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ Resume tailoring error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to tailor resume';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}