// app/api/job-application/tailor-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromResume } from '@/lib/resume/pdf-text-extractor';
import { LANGUAGE_MATCH_INSTRUCTION, stripDashes, stripDashesDeep } from '@/lib/ai/claude';

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

interface ResumeRow {
  user_id: string;
  resume_text: string | null;
  file_url: string | null;
}

export async function POST(request: NextRequest) {
  try {
    console.log('✏️ Resume Tailoring Started');

    // Authentication
    const authedUser = await getAuthedUser(request);

    if (!authedUser) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }
    const { supabaseUserId } = authedUser;

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

    // Fetch resume from Postgres
    const { data: resumeData, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('user_id, resume_text, file_url')
      .eq('id', resumeId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!resumeData) {
      return NextResponse.json(
        { error: 'Resume not found' },
        { status: 404 }
      );
    }

    const row = resumeData as ResumeRow;

    // Verify ownership
    if (row.user_id !== supabaseUserId) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // Extract resume text if not already available
    let resumeText = row.resume_text ?? undefined;

    if (!resumeText && row.file_url) {
      console.log('📖 Extracting text from resume...');
      try {
        resumeText = await extractTextFromResume(row.file_url);
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
      model: 'gemini-2.5-flash',
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
   - Reorder so the skills the job asks for that the resume ALREADY lists come first
   - Never add a technology, tool or skill the resume does not already mention
   - Job technologies to look for in the resume: ${extractedData?.techStack?.slice(0, 10).join(', ') || 'those in the job description'}

2. **Experience Descriptions**:
   - Enhance bullet points to highlight relevant experience for this role
   - Add industry-specific terminology for ${extractedData?.companyType || 'the target industry'}
   - Use the job description's wording only for work the resume already shows
   - Never add a number, percentage or metric the original line does not contain

3. **Professional Summary/Objective** (if exists):
   - Tailor to emphasize fit for ${extractedData?.jobTitle || 'the target'} role
   - Mention only technologies the resume already lists
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
- Every fact (tool, number, employer, project) must already be in the original resume
${LANGUAGE_MATCH_INSTRUCTION}`;

    console.log('🤖 Generating tailored resume...');
    const result = await model.generateContent(prompt);
    const tailoredResume = stripDashes(result.response.text());

    // Generate change summary
    const changesPrompt = `Compare the original and tailored resumes and list the TOP 5 most important changes made:

ORIGINAL:
${resumeText.substring(0, 2000)}

TAILORED:
${tailoredResume.substring(0, 2000)}

Return a JSON array of strings describing the changes:
["Moved React and Node.js to the front of the skills section",
 "Reworded the cloud project bullet in the job's terms",
 "Tailored the summary to emphasize backend development"]

Return ONLY the JSON array, nothing else.`;

    const changesResult = await model.generateContent(changesPrompt);
    const changesText = changesResult.response.text();
    
    let changes: string[] = [];
    try {
      const jsonMatch = changesText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        changes = stripDashesDeep(JSON.parse(jsonMatch[0])) as string[];
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