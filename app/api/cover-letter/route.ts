// app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use the same environment variable as your other routes
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const COVER_LETTER_SYSTEM_PROMPT = `You are an expert professional cover letter writer with years of experience in HR and recruitment. Your task is to create compelling, personalized cover letters that:

1. **Use proper business letter format** with sender/recipient details at the top
2. **Match the job description** - Align skills and experience with specific requirements
3. **Tell a story** - Create a narrative that explains why the candidate is perfect for this role
4. **Show personality** - Let the candidate's unique voice and passion come through
5. **Demonstrate value** - Highlight specific achievements and how they translate to this role
6. **Reference relevant work** - Mention specific projects, research, or industry insights that show deep understanding
7. **Be professional yet personable** - Strike the right balance for corporate communication

CRITICAL FORMAT REQUIREMENTS:
- Start with sender's full contact information (name, address, email, phone)
- Add current date
- Include recipient information (Hiring Manager, Company Name, Company Address)
- Use "Dear Hiring Team," or "Dear [Specific Name]," as salutation
- Write 3-4 paragraphs of body text
- End with "Best regards," or "Sincerely," followed by sender's name
- Keep total length to 400-500 words

Structure:
- Opening: Hook that shows enthusiasm and immediate relevance, mention specific role
- Body 1: Connect experience to job requirements with SPECIFIC examples and metrics
- Body 2: Highlight relevant projects, research, or industry knowledge that shows you've done homework
- Body 3: Show genuine interest in company/mission and explain why you're drawn to it
- Closing: Confident call to action with specific timeline or next steps

Tone Guidelines:
- Professional but conversational (like the example provided)
- Confident but not arrogant
- Enthusiastic but not desperate
- Specific and detailed, not generic
- Use "I'm" and contractions to sound natural
- Reference specific technologies, methodologies, or industry trends

Remember: Make it personal, make it relevant, make it memorable. Include specific project names or research areas when available.`;

// Add interface for request body
interface CoverLetterRequest {
  jobRole: string;
  jobDescription?: string;
  companyName?: string;
  tone?: string;
}

// Add interface for user profile
interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  linkedIn?: string;
  github?: string;
  website?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: string;
  preferredTech?: string[];
  careerGoals?: string;
}

// Add interface for resume data
interface ResumeData {
  id?: string;
  originalName?: string;
  resumeText?: string;
}

// Helper function to research company
async function researchCompany(companyName: string, jobRole: string): Promise<string> {
  if (!companyName || !genAI) return '';
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const researchPrompt = `Research ${companyName} and provide key information for a ${jobRole} cover letter:

1. Company's main business/mission
2. Recent news, achievements, or initiatives (last 6 months)
3. Company culture or values
4. Specific projects or products relevant to ${jobRole}
5. Company location/headquarters

Provide concise, factual information in 3-4 sentences. Focus on what would be impressive to mention in a cover letter.
If you cannot find specific information, say "Company information not available" and do not make up details.`;

    const result = await model.generateContent(researchPrompt);
    return result.response.text();
  } catch (error) {
    console.error('❌ Error researching company:', error);
    return '';
  }
}

// Helper function to format current date
function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return now.toLocaleDateString('en-US', options);
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    console.log('📄 Cover Letter Generation Started');
    console.log('   API Key Available:', !!apiKey);

    // ==================== AUTHENTICATION ====================
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      console.error('❌ No session cookie found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
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
        { success: false, error: 'Invalid session - Please log in again' },
        { status: 401 }
      );
    }

    // ==================== CHECK API CONFIGURATION ====================
    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { 
          success: false,
          error: 'AI service not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to environment variables.' 
        },
        { status: 500 }
      );
    }

    // ==================== PARSE REQUEST ====================
    const body = await request.json() as CoverLetterRequest;
    const { jobRole, jobDescription, companyName, tone = 'professional' } = body;

    console.log('📋 Request Details:');
    console.log('   Job Role:', jobRole);
    console.log('   Company:', companyName || 'Not specified');
    console.log('   Job Description Length:', jobDescription?.length || 0);
    console.log('   Tone:', tone);

    // Validation
    if (!jobRole) {
      return NextResponse.json(
        { success: false, error: 'Job role is required' },
        { status: 400 }
      );
    }

    // ==================== FETCH USER PROFILE ====================
    console.log('👤 Fetching user profile...');
    let userProfile: UserProfile;
    
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return NextResponse.json(
          { success: false, error: 'User profile not found. Please complete your profile first.' },
          { status: 404 }
        );
      }

      userProfile = userDoc.data() as UserProfile;
      console.log('✅ User profile loaded:', userProfile.name);
    } catch (profileError) {
      console.error('❌ Error fetching user profile:', profileError);
      return NextResponse.json(
        { success: false, error: 'Failed to load user profile' },
        { status: 500 }
      );
    }

    // ==================== FETCH USER'S LATEST RESUME ====================
    console.log('📄 Fetching user resumes...');
    let latestResume: ResumeData | null = null;
    let resumeText = '';
    
    try {
      const resumesSnapshot = await db
        .collection('resumes')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!resumesSnapshot.empty) {
        latestResume = resumesSnapshot.docs[0].data() as ResumeData;
        resumeText = latestResume.resumeText || '';
        console.log('✅ Latest resume found:', latestResume.originalName);
        console.log('   Resume text length:', resumeText.length);
      } else {
        console.log('⚠️  No resume found for user');
      }
    } catch (resumeError) {
      console.error('❌ Error fetching resume:', resumeError);
    }

    // ==================== RESEARCH COMPANY ====================
    let companyResearch = '';
    if (companyName && companyName.trim().length > 0) {
      console.log('🔍 Researching company:', companyName);
      companyResearch = await researchCompany(companyName, jobRole);
      console.log('✅ Company research completed');
    }

    // ==================== CHECK IF USER HAS SUFFICIENT DATA ====================
    const hasBasicProfile = userProfile.name && userProfile.email;
    const hasResume = resumeText.length > 100;

    if (!hasBasicProfile && !hasResume) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Insufficient profile data. Please upload your resume or complete your profile in Settings.' 
        },
        { status: 400 }
      );
    }

    // ==================== BUILD USER CONTEXT ====================
    const userContext = {
      name: userProfile.name || 'Candidate',
      email: userProfile.email,
      phone: userProfile.phone || '',
      
      // Use separate address fields
      streetAddress: userProfile.streetAddress || '',
      city: userProfile.city || '',
      state: userProfile.state || '',
      
      linkedin: userProfile.linkedIn || '',
      github: userProfile.github || '',
      website: userProfile.website || '',
      bio: userProfile.bio || '',
      targetRole: userProfile.targetRole || jobRole,
      experienceLevel: userProfile.experienceLevel || 'mid',
      preferredTech: userProfile.preferredTech || [],
      careerGoals: userProfile.careerGoals || '',
      resumeText: resumeText.substring(0, 4000),
    };

    console.log('📊 User Context Built');
    console.log('   Has Resume:', hasResume);
    console.log('   Experience Level:', userContext.experienceLevel);
    console.log('   Preferred Tech:', userContext.preferredTech.length);
    console.log('   Has Company Research:', !!companyResearch);

    // ==================== GENERATE COVER LETTER ====================
    console.log('🤖 Generating cover letter with Gemini 2.0 Flash...');
    const aiStartTime = Date.now();

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    });

    // Get current date dynamically
    const currentDate = getCurrentDate();

    const userPrompt = `Generate a compelling cover letter in the EXACT format of the example below:

EXAMPLE FORMAT (FOLLOW THIS EXACTLY):
"""
[Candidate Name]
[Street Address]
[City, State ZIP]
[Email]
[Phone]
[Current Date]

Hiring Manager
[Company Name]
[Company City, State]

Dear Hiring Team,

[Opening paragraph with enthusiasm and role mention]

[Body paragraph 1 with specific experience and metrics]

[Body paragraph 2 with relevant projects and technical details]

[Body paragraph 3 showing company research and genuine interest]

[Closing paragraph with confidence and call to action]

Best regards,
[Candidate Name]
"""

NOW GENERATE FOR:

JOB DETAILS:
Role: ${jobRole}
${companyName ? `Company: ${companyName}` : ''}
${jobDescription ? `\nJob Description:\n${jobDescription.substring(0, 2000)}` : ''}

${companyResearch ? `\nCOMPANY RESEARCH:\n${companyResearch}\n` : ''}

CANDIDATE PROFILE:
Name: ${userContext.name}
Email: ${userContext.email}
${userContext.phone ? `Phone: ${userContext.phone}` : ''}
${userContext.streetAddress ? `Street Address: ${userContext.streetAddress}` : ''}
${userContext.city ? `City: ${userContext.city}` : ''}
${userContext.state ? `State: ${userContext.state}` : ''}
Experience Level: ${userContext.experienceLevel}
${userContext.targetRole ? `Target Role: ${userContext.targetRole}` : ''}
${userContext.preferredTech.length > 0 ? `Technical Skills: ${userContext.preferredTech.join(', ')}` : ''}
${userContext.bio ? `Bio: ${userContext.bio}` : ''}
${userContext.careerGoals ? `Career Goals: ${userContext.careerGoals}` : ''}

${hasResume ? `RESUME SUMMARY (Extract specific projects, metrics, and achievements):\n${userContext.resumeText}` : ''}

TONE: ${tone}

CRITICAL REQUIREMENTS:
1. START with candidate's contact info block:
   - Name on first line
   - Street address on second line (if provided, use: "${userContext.streetAddress}")
   - City, State on third line (if provided, format as: "${userContext.city}${userContext.city && userContext.state ? ', ' : ''}${userContext.state}")
   - Email
   - Phone
2. Add current date: ${currentDate}
3. Include recipient block (Hiring Manager, Company Name, City/State)
4. Use conversational, natural tone with contractions ("I'm", "I've", "you're")
5. Reference SPECIFIC projects from the resume with actual names
6. Include metrics and numbers where possible
7. Show you've researched the company (use the company research provided)
8. Mention specific technologies, frameworks, or methodologies
9. Keep it 400-500 words
10. End with "Best regards," and candidate name

Make it sound authentic and enthusiastic like the example. Don't be overly formal or robotic.

IMPORTANT: Return ONLY the formatted cover letter, no additional commentary or explanations.`;

    const fullPrompt = COVER_LETTER_SYSTEM_PROMPT + '\n\n' + userPrompt;

    let coverLetterText: string;
    let tokensUsed = 0;

    try {
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      coverLetterText = response.text();

      if (response.usageMetadata) {
        tokensUsed = response.usageMetadata.totalTokenCount || 0;
      }

      if (!coverLetterText || coverLetterText.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      const aiResponseTime = Date.now() - aiStartTime;
      console.log('✅ Cover letter generated');
      console.log('   Length:', coverLetterText.length, 'characters');
      console.log('   AI response time:', aiResponseTime, 'ms');
      console.log('   Tokens used:', tokensUsed);

    } catch (geminiError) {
      console.error('❌ Gemini API error:', geminiError);
      
      const error = geminiError as Error;
      if (error.message?.includes('quota')) {
        return NextResponse.json(
          { success: false, error: 'API quota exceeded. Please try again later.' },
          { status: 429 }
        );
      }

      if (error.message?.includes('safety')) {
        return NextResponse.json(
          { success: false, error: 'Content safety issue. Please modify your input and try again.' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Failed to generate cover letter. Please try again.' },
        { status: 500 }
      );
    }

    // ==================== SAVE TO FIRESTORE ====================
    console.log('💾 Saving cover letter to Firestore...');
    
    try {
      const coverLetterDoc = {
        userId,
        jobRole,
        companyName: companyName || null,
        jobDescription: jobDescription || null,
        tone,
        content: coverLetterText,
        resumeUsed: hasResume ? latestResume?.id : null,
        companyResearched: !!companyResearch,
        createdAt: new Date(),
        tokensUsed,
        wordCount: coverLetterText.split(/\s+/).length,
      };

      const docRef = await db.collection('coverLetters').add(coverLetterDoc);
      console.log('✅ Cover letter saved with ID:', docRef.id);

      const totalRequestTime = Date.now() - requestStartTime;
      console.log('✅ Total request time:', totalRequestTime, 'ms');

      return NextResponse.json({
        success: true,
        coverLetter: {
          id: docRef.id,
          content: coverLetterText,
          jobRole,
          companyName: companyName || null,
          tone,
          wordCount: coverLetterDoc.wordCount,
          createdAt: coverLetterDoc.createdAt.toISOString(),
        },
        metadata: {
          tokensUsed,
          responseTime: totalRequestTime,
          usedResume: hasResume,
          companyResearched: !!companyResearch,
        }
      });

    } catch (saveError) {
      console.error('❌ Error saving cover letter:', saveError);
      // Return the cover letter anyway, just log the save error
      return NextResponse.json({
        success: true,
        coverLetter: {
          content: coverLetterText,
          jobRole,
          companyName: companyName || null,
          tone,
        },
        warning: 'Cover letter generated but not saved to history'
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      },
      { status: 500 }
    );
  }
}