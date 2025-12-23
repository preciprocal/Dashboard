// app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const COVER_LETTER_SYSTEM_PROMPT = `You are an expert professional cover letter writer with years of experience in HR and recruitment. Your task is to create compelling, personalized cover letters that:

1. **Use proper business letter format** with sender/recipient details at the top
2. **Include professional links** - LinkedIn, GitHub, Portfolio in a clean format
3. **Match the job description** - Align skills and experience with specific requirements
4. **Tell a story** - Create a narrative that explains why the candidate is perfect for this role
5. **Show personality** - Let the candidate's unique voice and passion come through
6. **Demonstrate value** - Highlight specific achievements and how they translate to this role
7. **Reference relevant work** - Mention specific projects, research, or industry insights
8. **Be professional yet personable** - Strike the right balance for corporate communication

CRITICAL FORMAT REQUIREMENTS:
- Start with candidate's full contact information (name, address, email, phone)
- Include professional links in a clean format: LinkedIn | GitHub | Portfolio (on separate lines)
- Add current date
- Include recipient information (Hiring Manager, Company Name, Company Address)
- Use "Dear Hiring Team," or "Dear [Specific Name]," as salutation
- Write 3-4 well-developed paragraphs of body text
- End with "Best regards," or "Sincerely," followed by sender's name
- Keep it concise but comprehensive (400-500 words)

Structure:
- Opening: Hook that shows enthusiasm and immediate relevance, mention specific role
- Body 1: Connect experience to job requirements with SPECIFIC examples and metrics
- Body 2: Highlight relevant projects with GitHub/portfolio references where appropriate
- Body 3: Show genuine interest in company/mission and explain cultural fit
- Closing: Confident call to action with specific next steps

Tone Guidelines:
- Professional but conversational
- Confident but not arrogant
- Enthusiastic but not desperate
- Specific and detailed, not generic
- Use "I'm" and contractions to sound natural
- Reference specific technologies, frameworks, or methodologies

Remember: Make it personal, make it relevant, make it memorable. Be concise and impactful.`;

interface CoverLetterRequest {
  jobRole: string;
  jobDescription?: string;
  companyName?: string;
  tone?: string;
}

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

interface ResumeData {
  id?: string;
  originalName?: string;
  resumeText?: string;
}

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

Provide concise, factual information in 2-3 sentences. Focus on what would be impressive to mention in a cover letter.
If you cannot find specific information, say "Company information not available" and do not make up details.`;

    const result = await model.generateContent(researchPrompt);
    return result.response.text();
  } catch (error) {
    console.error('❌ Error researching company:', error);
    return '';
  }
}

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

    // Build professional links string with markdown hyperlinks
    const professionalLinks: string[] = [];
    if (userContext.linkedin) professionalLinks.push(`[LinkedIn](${userContext.linkedin})`);
    if (userContext.github) professionalLinks.push(`[GitHub](${userContext.github})`);
    if (userContext.website) professionalLinks.push(`[Portfolio](${userContext.website})`);
    const linksString = professionalLinks.length > 0 ? professionalLinks.join(' | ') : '';

    console.log('📊 User Context Built');
    console.log('   Has Resume:', hasResume);
    console.log('   Professional Links:', professionalLinks.length);
    console.log('   Experience Level:', userContext.experienceLevel);
    console.log('   Has Company Research:', !!companyResearch);

    // ==================== GENERATE COVER LETTER ====================
    console.log('🤖 Generating cover letter with Gemini 2.5 Flash...');
    const aiStartTime = Date.now();

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    });

    const currentDate = getCurrentDate();

    const userPrompt = `Generate a compelling, professional cover letter in the EXACT format below.

EXACT FORMAT TO FOLLOW:
"""
[Candidate Name]
[Street Address]
[City, State ZIP]
[Email]
[Phone]
${linksString ? '[Professional Links - format as hyperlinked text: LinkedIn | GitHub | Portfolio]' : ''}

[Current Date]

Hiring Manager
[Company Name]
[Company City, State]

Dear Hiring Team,

[Opening paragraph - 2-3 sentences with enthusiasm and role mention]

[Body paragraph 1 - 3-4 sentences connecting experience to job with metrics]

[Body paragraph 2 - 3-4 sentences with projects and technical details]

[Body paragraph 3 - 2-3 sentences showing company research and genuine interest]

[Closing paragraph - 2 sentences with confidence and call to action]

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
${userContext.city && userContext.state ? `Location: ${userContext.city}, ${userContext.state}` : ''}
${linksString ? `Professional Links (use markdown hyperlinks): ${linksString}` : ''}
Experience Level: ${userContext.experienceLevel}
${userContext.preferredTech.length > 0 ? `Technical Skills: ${userContext.preferredTech.join(', ')}` : ''}
${userContext.bio ? `Bio: ${userContext.bio}` : ''}
${userContext.careerGoals ? `Career Goals: ${userContext.careerGoals}` : ''}

${hasResume ? `RESUME SUMMARY (Extract specific projects, metrics, and achievements):\n${userContext.resumeText}` : ''}

TONE: ${tone}

CRITICAL REQUIREMENTS:
1. START with candidate's contact block including:
   - Name
   - Street address (if provided: "${userContext.streetAddress}")
   - City, State (if provided: "${userContext.city}${userContext.city && userContext.state ? ', ' : ''}${userContext.state}")
   - Email
   - Phone
   ${linksString ? `- Professional links on ONE line using MARKDOWN HYPERLINK format: ${linksString}` : ''}
2. Add current date: ${currentDate}
3. Include recipient block (Hiring Manager, Company Name, City/State)
4. Use conversational tone with contractions ("I'm", "I've", "you're")
5. Reference SPECIFIC projects from resume with actual names
6. Include metrics and numbers
7. ${companyResearch ? 'Show company research knowledge' : 'Show genuine interest in company'}
8. Mention specific technologies and methodologies
9. Keep it concise and impactful (400-500 words)
10. End with "Best regards," and candidate name

IMPORTANT FOR LINKS: Format professional links as markdown hyperlinks where the link text is the platform name:
- LinkedIn link should be: [LinkedIn](url)
- GitHub link should be: [GitHub](url)
- Portfolio link should be: [Portfolio](url)
- Separate multiple links with: " | "
- Example: [LinkedIn](https://linkedin.com/in/user) | [GitHub](https://github.com/user) | [Portfolio](https://portfolio.com)

Make it sound authentic, enthusiastic, and professional.

IMPORTANT: Return ONLY the formatted cover letter, no additional commentary.

CRITICAL: Ensure you complete the entire letter including:
- All body paragraphs
- Closing statement
- "Best regards," or "Sincerely,"
- Candidate name at the end

Do not stop mid-paragraph. Complete the full letter.`;

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

      // Check if response was cut off (ends abruptly without proper closing)
      const hasProperClosing = coverLetterText.includes('Best regards') || 
                                coverLetterText.includes('Sincerely') ||
                                coverLetterText.includes('Regards');
      
      if (!hasProperClosing) {
        console.warn('⚠️ Response appears incomplete, missing proper closing');
        // Add a note that this might be incomplete
        coverLetterText += '\n\n[Note: Generation may have been cut off. Please regenerate for a complete letter.]';
      }

      const aiResponseTime = Date.now() - aiStartTime;
      console.log('✅ Cover letter generated');
      console.log('   Length:', coverLetterText.length, 'characters');
      console.log('   Word count:', coverLetterText.split(/\s+/).length);
      console.log('   AI response time:', aiResponseTime, 'ms');
      console.log('   Tokens used:', tokensUsed);
      console.log('   Has proper closing:', hasProperClosing);

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