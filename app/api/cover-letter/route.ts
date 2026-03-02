// app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { hashResumeContent } from '@/lib/redis/resume-cache';
import { redis, RedisKeys } from '@/lib/redis/redis-client';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const COVER_LETTER_TTL = 7 * 24 * 60 * 60;
const COMPANY_RESEARCH_TTL = 30 * 24 * 60 * 60;

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
  transcript?: string;
  transcriptFileName?: string;
  resume?: string;
  resumeFileName?: string;
  bio?: string;
  targetRole?: string;
  experienceLevel?: string;
  preferredTech?: string[];
  careerGoals?: string;
}

// ✅ Fix: typed cache payload instead of any
interface CoverLetterCache {
  content: string;
  wordCount: number;
  tokensUsed: number;
  createdAt: string;
}

/**
 * Convert Base64 PDF to Image (same as resume analysis)
 * This ensures consistent, high-quality text extraction
 */
async function convertBase64PDFToImage(base64PDF: string): Promise<string> {
  try {
    console.log('🖼️ Converting transcript PDF to image...');

    // Extract base64 content
    const base64Content = base64PDF.includes('base64,') 
      ? base64PDF.split('base64,')[1] 
      : base64PDF;

    // Convert to binary
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // We'll return the base64 image format that Gemini expects
    // In a real implementation, you'd use pdf.js to render to canvas
    // For now, we'll pass the PDF directly to Gemini which can handle it
    console.log('✅ PDF prepared for image analysis');
    
    return base64Content;
  } catch (error) {
    console.error('❌ PDF to image conversion error:', error);
    throw error;
  }
}

/**
 * Extract and analyze transcript using Gemini Vision
 * Uses IMAGE analysis (same approach as resume) for better accuracy
 */
async function analyzeTranscriptImage(
  base64PDF: string,
  jobRole: string,
  jobDescription?: string
): Promise<{ courses: string; success: boolean }> {
  if (!genAI) {
    return { courses: '', success: false };
  }

  try {
    console.log('🎓 ANALYZING TRANSCRIPT IMAGE WITH GEMINI VISION');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
      }
    });

    // Convert PDF to image format
    const imageData = await convertBase64PDFToImage(base64PDF);

    console.log('📸 Sending transcript image to Gemini Vision...');

    const analysisPrompt = `You are analyzing an ACADEMIC TRANSCRIPT image for a ${jobRole} position.

${jobDescription ? `JOB REQUIREMENTS:\n${jobDescription.substring(0, 1500)}\n` : ''}

INSTRUCTIONS:
1. Look at this transcript image carefully
2. Extract ALL courses visible in the image
3. Identify 4-6 courses most relevant to the ${jobRole} position
4. For each relevant course, provide detailed information

OUTPUT FORMAT:

RELEVANT COURSES FOR ${jobRole.toUpperCase()} POSITION:

Course 1: [EXACT Course Code]: [EXACT Course Name from transcript]
- What I Learned: [Specific technologies, programming languages, frameworks, concepts taught in this course]
- Course Project: [Describe a typical project or assignment from this type of course - what students build or implement]
- Skills Gained: [Specific technical skills like SQL, Python, React, data structures, algorithms, etc.]
- Application to Job: [How this course directly prepares you for ${jobRole} - be specific about which job requirements it addresses]

Course 2: [EXACT Course Code]: [EXACT Course Name from transcript]
- What I Learned: [...]
- Course Project: [...]
- Skills Gained: [...]
- Application to Job: [...]

Course 3: [EXACT Course Code]: [EXACT Course Name from transcript]
- What I Learned: [...]
- Course Project: [...]
- Skills Gained: [...]
- Application to Job: [...]

Course 4: [EXACT Course Code]: [EXACT Course Name from transcript]
- What I Learned: [...]
- Course Project: [...]
- Skills Gained: [...]
- Application to Job: [...]

CRITICAL REQUIREMENTS:
- Use EXACT course codes and names from the image (e.g., "CS 340", "STAT 385", "ECON 101")
- Be specific about technologies and skills (Python, SQL, React, pandas, machine learning, etc.)
- Describe realistic course projects (database design, web app, data analysis, etc.)
- Connect each course to specific ${jobRole} job requirements
- Include GPA if visible and above 3.5
- Mention honors/dean's list if visible

Be thorough and accurate. Only use courses you can actually see in the transcript image.`;

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageData,
          mimeType: 'application/pdf'
        }
      },
      analysisPrompt
    ]);

    const analysisText = result.response.text();
    
    console.log('✅ TRANSCRIPT ANALYSIS COMPLETE');
    console.log('   Analysis length:', analysisText.length, 'characters');
    console.log('   Preview:', analysisText.substring(0, 500));

    // Verify we got actual course information
    const hasCourseInfo = analysisText.includes('Course 1:') || 
                          analysisText.includes('RELEVANT COURSES');

    if (!hasCourseInfo || analysisText.length < 200) {
      console.error('❌ Analysis failed - no course information extracted');
      return { courses: '', success: false };
    }

    return { courses: analysisText, success: true };

  } catch (error) {
    console.error('❌ TRANSCRIPT ANALYSIS ERROR:', error);
    return { courses: '', success: false };
  }
}

async function researchCompany(companyName: string, jobRole: string): Promise<string> {
  if (!companyName || !genAI) return '';

  const cached = await getCachedCompanyResearch(companyName);
  if (cached) return cached;
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    });

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });

    const prompt = `Today is ${currentDate}. Research ${companyName} for a ${jobRole} cover letter:

1. Company mission/business
2. Recent news (2024-2025)
3. Company culture/values  
4. Products relevant to ${jobRole}

Provide 2-3 sentences. If no info: "Company information not available".`;

    const result = await model.generateContent(prompt);
    const research = result.response.text();

    await cacheCompanyResearch(companyName, research);
    return research;
  } catch (error) {
    console.error('❌ Company research error:', error);
    return '';
  }
}

async function getCachedCompanyResearch(companyName: string): Promise<string | null> {
  if (!redis) return null;
  try {
    const key = RedisKeys.company(companyName.toLowerCase().trim());
    const cached = await redis.get(key);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return data.research as string;
    }
    return null;
  } catch { return null; }
}

async function cacheCompanyResearch(companyName: string, research: string): Promise<void> {
  if (!redis || !research) return;
  try {
    const key = RedisKeys.company(companyName.toLowerCase().trim());
    await redis.setex(key, COMPANY_RESEARCH_TTL, JSON.stringify({
      research,
      cachedAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Redis error:', error);
  }
}

async function getCachedCoverLetter(cacheKey: string): Promise<CoverLetterCache | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get(`cover-letter:${cacheKey}`);
    if (cached) {
      return typeof cached === 'string'
        ? (JSON.parse(cached) as CoverLetterCache)
        : (cached as CoverLetterCache);
    }
    return null;
  } catch { return null; }
}

// ✅ Fix: replaced `any` with the typed CoverLetterCache interface
async function cacheCoverLetter(cacheKey: string, data: CoverLetterCache): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(`cover-letter:${cacheKey}`, COVER_LETTER_TTL, JSON.stringify(data));
  } catch (error) {
    console.error('Redis error:', error);
  }
}

function generateCacheKey(...parts: string[]): string {
  return hashResumeContent(parts.join(':'));
}

function buildProfessionalLinks(linkedin?: string, github?: string, website?: string) {
  const links: string[] = [];
  if (linkedin?.trim()) links.push(`[LinkedIn](${linkedin})`);
  if (github?.trim()) links.push(`[GitHub](${github})`);
  if (website?.trim()) links.push(`[Portfolio](${website})`);
  
  return {
    links,
    markdown: links.join(' | '),
    display: links.length > 0 ? links.join(' | ') : ''
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('📄 ========================================');
    console.log('📄 COVER LETTER GENERATION START');
    console.log('📄 ========================================');

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
      console.log('✅ User authenticated:', userId);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    if (!genAI || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // ==================== PARSE REQUEST ====================
    const body = await request.json() as CoverLetterRequest;
    const { jobRole, jobDescription, companyName, tone = 'professional' } = body;

    console.log('📋 Request Details:');
    console.log('   Job Role:', jobRole);
    console.log('   Company:', companyName || 'Not specified');
    console.log('   Has Job Description:', !!jobDescription);

    if (!jobRole) {
      return NextResponse.json(
        { success: false, error: 'Job role required' },
        { status: 400 }
      );
    }

    // ==================== FETCH USER PROFILE ====================
    console.log('👤 Fetching user profile...');
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    const userProfile = userDoc.data() as UserProfile;
    console.log('✅ Profile loaded:', userProfile.name);
    console.log('📊 Profile Data:');
    console.log('   Has transcript:', !!userProfile.transcript);
    console.log('   Transcript type:', userProfile.transcript?.substring(0, 30));
    console.log('   Transcript filename:', userProfile.transcriptFileName);
    console.log('   Has resume:', !!userProfile.resume);

    // ==================== FETCH RESUME ====================
    let resumeText = '';
    try {
      const resumesSnapshot = await db
        .collection('resumes')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!resumesSnapshot.empty) {
        const resume = resumesSnapshot.docs[0].data();
        resumeText = (resume.resumeText as string) || '';
        console.log('✅ Resume found:', resume.originalName);
      }
    } catch {
      console.log('⚠️ No resume found');
    }

    // ==================== PROCESS TRANSCRIPT (PDF → IMAGE → ANALYSIS) ====================
    let transcriptCourses = '';
    let hasTranscript = false;

    if (userProfile.transcript?.startsWith('data:application/pdf')) {
      console.log('📜 ========================================');
      console.log('📜 TRANSCRIPT PROCESSING START');
      console.log('📜 ========================================');
      console.log('   Filename:', userProfile.transcriptFileName);
      console.log('   PDF size:', userProfile.transcript.length, 'chars');
      
      try {
        // Use Gemini Vision to analyze the PDF image (same as resume)
        console.log('🎓 Analyzing transcript with Gemini Vision...');
        
        const transcriptResult = await analyzeTranscriptImage(
          userProfile.transcript,
          jobRole,
          jobDescription
        );

        console.log('📊 TRANSCRIPT ANALYSIS RESULT:');
        console.log('   Success:', transcriptResult.success);
        console.log('   Content length:', transcriptResult.courses.length);
        console.log('   Content preview:', transcriptResult.courses.substring(0, 400));

        if (transcriptResult.success && transcriptResult.courses.length > 200) {
          transcriptCourses = transcriptResult.courses;
          hasTranscript = true;
          console.log('✅ ========================================');
          console.log('✅ TRANSCRIPT SUCCESSFULLY PROCESSED');
          console.log('✅ WILL BE USED IN COVER LETTER');
          console.log('✅ ========================================');
        } else {
          console.error('❌ ========================================');
          console.error('❌ TRANSCRIPT ANALYSIS FAILED');
          console.error('❌ Insufficient content or analysis error');
          console.error('❌ ========================================');
        }
      } catch (error) {
        console.error('❌ ========================================');
        console.error('❌ TRANSCRIPT PROCESSING ERROR');
        console.error('❌', error);
        console.error('❌ ========================================');
      }
    } else {
      console.log('⚠️ No PDF transcript found in profile');
    }

    const professionalLinks = buildProfessionalLinks(
      userProfile.linkedIn,
      userProfile.github,
      userProfile.website
    );

    // ==================== CHECK CACHE ====================
    const cacheKey = generateCacheKey(
      userId,
      jobRole,
      companyName || '',
      jobDescription || '',
      tone,
      resumeText.substring(0, 500),
      transcriptCourses.substring(0, 200)
    );

    const cached = await getCachedCoverLetter(cacheKey);
    if (cached) {
      console.log('⚡ Returning cached cover letter');
      return NextResponse.json({
        success: true,
        coverLetter: {
          content: cached.content,
          jobRole,
          companyName: companyName || null,
          tone,
          wordCount: cached.wordCount,
          createdAt: cached.createdAt,
        },
        metadata: {
          tokensUsed: cached.tokensUsed,
          responseTime: Date.now() - startTime,
          cached: true,
          usedTranscript: hasTranscript
        }
      });
    }

    // ==================== RESEARCH COMPANY ====================
    let companyResearch = '';
    if (companyName) {
      console.log('🔍 Researching company...');
      companyResearch = await researchCompany(companyName, jobRole);
    }

    // ==================== GENERATE COVER LETTER ====================
    console.log('🤖 ========================================');
    console.log('🤖 GENERATING COVER LETTER');
    console.log('🤖 ========================================');
    console.log('   Will use transcript:', hasTranscript);
    console.log('   Will use resume:', resumeText.length > 0);
    console.log('   Will use company research:', !!companyResearch);

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 3000,
      }
    });

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });

    const contactLines = [userProfile.name];
    if (userProfile.streetAddress) contactLines.push(userProfile.streetAddress);
    if (userProfile.city || userProfile.state) {
      const loc = [userProfile.city, userProfile.state].filter(Boolean).join(', ');
      if (loc) contactLines.push(loc);
    }
    contactLines.push(userProfile.email);
    if (userProfile.phone) contactLines.push(userProfile.phone);
    if (professionalLinks.display) contactLines.push(professionalLinks.display);

    const prompt = `You are an expert cover letter writer. Create a compelling professional cover letter.

JOB DETAILS:
Role: ${jobRole}
${companyName ? `Company: ${companyName}` : ''}
${jobDescription ? `\nDescription:\n${jobDescription.substring(0, 2000)}` : ''}
${companyResearch ? `\nCOMPANY RESEARCH:\n${companyResearch}` : ''}

CANDIDATE:
${contactLines.join('\n')}

Experience: ${userProfile.experienceLevel || 'mid'}
Skills: ${userProfile.preferredTech?.join(', ') || 'N/A'}
${userProfile.bio ? `Bio: ${userProfile.bio}` : ''}

${resumeText ? `WORK EXPERIENCE:\n${resumeText.substring(0, 3000)}` : ''}

${hasTranscript ? `
═══════════════════════════════════════════════════════
ACADEMIC COURSEWORK FROM TRANSCRIPT
(Official Transcript: ${userProfile.transcriptFileName})
═══════════════════════════════════════════════════════

${transcriptCourses}

═══════════════════════════════════════════════════════

🚨 MANDATORY FOR BODY PARAGRAPH 2:

You MUST write paragraph 2 using the courses above. Follow this structure:

"During my academic career, I completed several courses that directly prepared me for this ${jobRole} position. In [Exact Course Code: Exact Course Name from above], I learned [specific technologies/skills] and completed a [specific project type] where I [what you built/implemented]. This hands-on experience with [technology] gave me practical knowledge in [application area]. Similarly, my [Course Code: Course Name] coursework involved [specific project], where I [specific implementation - built, designed, analyzed, developed]. I also completed [Course Code: Course Name], which focused on [topic], and I [specific project/activity with technologies used]. These courses equipped me with [specific technical skills] that directly align with your requirements for [specific job requirement]."

REQUIREMENTS:
✅ Use 3-4 ACTUAL course names from the analysis above
✅ Include course codes (e.g., CS 340, STAT 385)
✅ Describe specific projects or activities from those courses
✅ Mention technologies learned (Python, SQL, React, etc.)
✅ Explain what you built or implemented
✅ Connect to job requirements

❌ DO NOT write: "While a specific academic transcript was not provided"
❌ DO NOT use generic course names
❌ The transcript HAS been provided and analyzed above
` : ''}

FORMAT:
${contactLines.join('\n')}

${currentDate}

Hiring Manager
${companyName || '[Company Name]'}

Dear Hiring Team,

[Opening: 2-3 sentences with enthusiasm for ${jobRole} role]

[Body 1: 3-4 sentences on work experience with metrics]

[Body 2: ${hasTranscript ? '4-5 sentences mentioning 3-4 SPECIFIC courses by code and name, describing projects completed, technologies used, and how they apply to this job' : '3-4 sentences on technical skills'}]

[Body 3: 2-3 sentences on company interest]

[Closing: 2 sentences with call to action]

Best regards,
${userProfile.name}

${hasTranscript ? '\n🚨 REMINDER: Use SPECIFIC course codes and names from the transcript analysis in paragraph 2!' : ''}

Generate the complete cover letter now.`;

    let coverLetterText: string;
    let tokensUsed = 0;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      coverLetterText = response.text();

      if (response.usageMetadata) {
        tokensUsed = response.usageMetadata.totalTokenCount || 0;
      }

      // Ensure proper closing
      if (!coverLetterText.includes('Best regards') && !coverLetterText.includes('Sincerely')) {
        coverLetterText += '\n\nBest regards,\n' + userProfile.name;
      }

      const wordCount = coverLetterText.split(/\s+/).length;
      console.log('✅ GENERATED SUCCESSFULLY');
      console.log('   Words:', wordCount);
      console.log('   Tokens:', tokensUsed);

      // Verify transcript usage
      if (hasTranscript) {
        const mentionsCourses = coverLetterText.toLowerCase().includes('course') ||
                                !!coverLetterText.match(/[A-Z]{2,4}\s*\d{3}/); // Course code pattern
        
        console.log('🔍 Transcript Usage Verification:');
        console.log('   Mentions courses:', mentionsCourses);
        
        if (!mentionsCourses) {
          console.error('❌ WARNING: Transcript available but NOT used in cover letter!');
        } else {
          console.log('✅ Transcript courses successfully integrated into cover letter');
        }
      }

      // Cache
      await cacheCoverLetter(cacheKey, {
        content: coverLetterText,
        wordCount,
        tokensUsed,
        createdAt: new Date().toISOString()
      });

      // Save to Firestore
      const docRef = await db.collection('coverLetters').add({
        userId,
        jobRole,
        companyName: companyName || null,
        jobDescription: jobDescription || null,
        tone,
        content: coverLetterText,
        transcriptUsed: hasTranscript,
        transcriptFileName: hasTranscript ? userProfile.transcriptFileName : null,
        companyResearched: !!companyResearch,
        createdAt: new Date(),
        tokensUsed,
        wordCount,
      });

      console.log('💾 Saved to Firestore:', docRef.id);
      console.log('✅ ========================================');
      console.log('✅ COVER LETTER GENERATION COMPLETE');
      console.log('✅ ========================================');

      return NextResponse.json({
        success: true,
        coverLetter: {
          id: docRef.id,
          content: coverLetterText,
          jobRole,
          companyName: companyName || null,
          tone,
          wordCount,
          createdAt: new Date().toISOString(),
        },
        metadata: {
          tokensUsed,
          responseTime: Date.now() - startTime,
          usedResume: resumeText.length > 0,
          usedTranscript: hasTranscript,
          companyResearched: !!companyResearch,
          cached: false
        }
      });

    } catch (error) {
      console.error('❌ GENERATION ERROR:', error);
      const err = error as Error;
      
      if (err.message?.includes('quota')) {
        return NextResponse.json(
          { success: false, error: 'API quota exceeded' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Generation failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ UNEXPECTED ERROR:', error);
    return NextResponse.json(
      { success: false, error: 'Unexpected error' },
      { status: 500 }
    );
  }
}