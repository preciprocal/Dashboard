// app/api/job-application/customize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces for request body
interface CustomizationContext {
  jobTitle?: string;
  companyName?: string;
  companyType?: string;
  techStack?: string[];
}

interface CustomizationRequest {
  documentType: 'resume' | 'coverLetter';
  currentContent: string;
  userPrompt: string;
  context?: CustomizationContext;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 AI Customization Started');

    // Authentication
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Verify session but don't need to use the result
    await auth.verifySessionCookie(session.value, true);

    // Check API
    if (!genAI || !apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Parse request
    const body = await request.json() as CustomizationRequest;
    const { 
      documentType, // 'resume' or 'coverLetter'
      currentContent,
      userPrompt,
      context // job details for context
    } = body;

    if (!documentType || !currentContent || !userPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('📝 Document type:', documentType);
    console.log('💬 User prompt:', userPrompt);
    console.log('📄 Content length:', currentContent.length);

    // Generate customization using AI
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 4096,
      },
    });

    const systemContext = documentType === 'resume' 
      ? `You are an expert resume writer helping customize a tailored resume.`
      : `You are an expert cover letter writer helping customize a personalized cover letter.`;

    const jobContext = context ? `
JOB CONTEXT:
- Role: ${context.jobTitle || 'Not specified'}
- Company: ${context.companyName || 'Not specified'}
- Industry: ${context.companyType || 'Not specified'}
- Key Technologies: ${context.techStack?.join(', ') || 'Not specified'}
` : '';

    const prompt = `${systemContext}

CURRENT ${documentType.toUpperCase()}:
"""
${currentContent}
"""
${jobContext}

USER REQUEST:
"${userPrompt}"

INSTRUCTIONS:
1. Understand the user's customization request
2. Apply the requested changes to the document
3. Maintain professional quality and formatting
4. Preserve the overall structure unless specifically asked to change it
5. Keep the tone appropriate for job applications
6. Ensure ATS compatibility (if resume)

IMPORTANT FORMATTING RULES:
- Keep the same line breaks and spacing as the original
- Preserve section headers exactly as they are
- Maintain bullet point styles
- Keep contact information unchanged unless specifically requested

Return the complete customized ${documentType} with the requested changes applied.
Do NOT add explanations or commentary - just return the updated document.`;

    console.log('🤖 Generating customization...');
    const result = await model.generateContent(prompt);
    const customizedContent = result.response.text();

    // Generate explanation of changes
    const explanationPrompt = `Compare these two versions and explain what was changed:

ORIGINAL:
${currentContent.substring(0, 1500)}

MODIFIED:
${customizedContent.substring(0, 1500)}

USER REQUESTED: "${userPrompt}"

Provide a brief explanation (2-3 sentences) of what changes were made to fulfill the user's request.
Return ONLY the explanation, no other text.`;

    const explanationResult = await model.generateContent(explanationPrompt);
    const changeExplanation = explanationResult.response.text().trim();

    console.log('✅ Customization complete');
    console.log('   Original length:', currentContent.length);
    console.log('   Customized length:', customizedContent.length);

    return NextResponse.json({
      success: true,
      customizedContent,
      changeExplanation,
      metadata: {
        originalLength: currentContent.length,
        customizedLength: customizedContent.length,
        userPrompt
      }
    });

  } catch (error) {
    console.error('❌ Customization error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to customize document';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}