// app/api/job-application/extract/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Job Details Extraction Started');

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
    console.log('✅ User authenticated:', userId);

    // Check API configuration
    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Parse request
    const { jobDescription } = await request.json();

    if (!jobDescription || jobDescription.trim().length < 50) {
      return NextResponse.json(
        { error: 'Job description is too short or missing' },
        { status: 400 }
      );
    }

    console.log('📄 Job description length:', jobDescription.length);

    // Extract details using Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `Analyze this job description and extract key information in JSON format.

Job Description:
"""
${jobDescription}
"""

Extract and return ONLY valid JSON with this structure:
{
  "jobTitle": "Exact job title from description",
  "companyName": "Company name if mentioned, otherwise null",
  "companyType": "Industry/sector (e.g., 'FinTech', 'Healthcare', 'E-commerce', 'Energy', 'Consulting', 'SaaS')",
  "location": "Location if mentioned",
  "techStack": ["List", "of", "specific", "technologies", "frameworks", "tools"],
  "requiredSkills": ["Hard", "and", "soft", "skills", "required"],
  "experienceLevel": "Entry/Mid/Senior/Lead",
  "keyResponsibilities": ["Main", "job", "duties"],
  "companyInfo": "Brief summary of company if available"
}

IMPORTANT RULES:
1. Extract EXACT technology names (React, not "modern frontend framework")
2. Include programming languages, frameworks, databases, cloud platforms, tools
3. Be specific with company type (e.g., "Healthcare SaaS" not just "Technology")
4. Return ONLY the JSON object, no markdown, no explanations
5. If information not found, use null or empty array
6. techStack should have 5-15 items typically
7. Identify company industry from context clues (e.g., mentions of "patients" = Healthcare)`;

    console.log('🤖 Calling Gemini for extraction...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Validate extracted data
    if (!extracted.jobTitle) {
      extracted.jobTitle = 'Position';
    }
    if (!extracted.techStack || !Array.isArray(extracted.techStack)) {
      extracted.techStack = [];
    }
    if (!extracted.requiredSkills || !Array.isArray(extracted.requiredSkills)) {
      extracted.requiredSkills = [];
    }

    console.log('✅ Extraction complete');
    console.log('   Job Title:', extracted.jobTitle);
    console.log('   Company:', extracted.companyName || 'Not specified');
    console.log('   Tech Stack:', extracted.techStack.length, 'items');
    console.log('   Company Type:', extracted.companyType || 'General');

    return NextResponse.json({
      success: true,
      extracted,
    });

  } catch (error: any) {
    console.error('❌ Extraction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract job details' },
      { status: 500 }
    );
  }
}