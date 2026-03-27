// app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import OpenAI from 'openai';
import { hashResumeContent } from '@/lib/redis/resume-cache';
import { redis, RedisKeys } from '@/lib/redis/redis-client';

const openai = new OpenAI({ apiKey: process.env.OPEN_AI_KEY });

const COVER_LETTER_TTL    = 7 * 24 * 60 * 60;   // 7 days
const COMPANY_RESEARCH_TTL = 30 * 24 * 60 * 60; // 30 days

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

interface CoverLetterCache {
  content: string;
  wordCount: number;
  tokensUsed: number;
  createdAt: string;
}

// ─── Company research ─────────────────────────────────────────────────────────

async function researchCompany(companyName: string, jobRole: string): Promise<string> {
  if (!companyName) return '';

  const cached = await getCachedCompanyResearch(companyName);
  if (cached) return cached;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Research ${companyName} for a ${jobRole} cover letter. Provide 2-3 sentences covering: company mission, recent news (2024-2025), culture/values. If no info available, say "Company information not available".`,
      }],
    });

    const research = completion.choices[0]?.message?.content ?? '';
    await cacheCompanyResearch(companyName, research);
    return research;
  } catch (err) {
    console.error('❌ Company research error:', err);
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
    await redis.setex(key, COMPANY_RESEARCH_TTL, JSON.stringify({ research, cachedAt: new Date().toISOString() }));
  } catch (err) { console.error('Redis error:', err); }
}

async function getCachedCoverLetter(cacheKey: string): Promise<CoverLetterCache | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get(`cover-letter:${cacheKey}`);
    if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached as CoverLetterCache;
    return null;
  } catch { return null; }
}

async function cacheCoverLetter(cacheKey: string, data: CoverLetterCache): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(`cover-letter:${cacheKey}`, COVER_LETTER_TTL, JSON.stringify(data));
  } catch (err) { console.error('Redis error:', err); }
}

// ─── Transcript analysis using vision ────────────────────────────────────────

async function analyzeTranscriptImage(
  base64PDF: string,
  jobRole: string,
  jobDescription?: string,
): Promise<{ courses: string; success: boolean }> {
  try {
    console.log('🎓 Analyzing transcript with gpt-4o vision');

    const base64Content = base64PDF.includes('base64,') ? base64PDF.split('base64,')[1] : base64PDF;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${base64Content}` },
          },
          {
            type: 'text',
            text: `You are analyzing an ACADEMIC TRANSCRIPT for a ${jobRole} position.
${jobDescription ? `JOB REQUIREMENTS:\n${jobDescription.substring(0, 1500)}\n` : ''}
Extract ALL courses visible and identify 4-6 most relevant to ${jobRole}.
Format each as: "Course X: [CODE]: [NAME] - [RELEVANCE]"
Then list them under "RELEVANT COURSES:".`,
          },
        ],
      }],
    });

    const analysisText = completion.choices[0]?.message?.content ?? '';
    const hasCourseInfo = analysisText.includes('Course') || analysisText.includes('RELEVANT COURSES');
    if (!hasCourseInfo || analysisText.length < 200) return { courses: '', success: false };
    return { courses: analysisText, success: true };
  } catch (err) {
    console.error('❌ Transcript analysis error:', err);
    return { courses: '', success: false };
  }
}

// ─── Main POST ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!process.env.OPEN_AI_KEY) {
      return NextResponse.json({ success: false, error: 'AI service not configured' }, { status: 503 });
    }

    // ── Auth ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    let decodedClaims;
    try {
      decodedClaims = await auth.verifySessionCookie(session.value, true);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    const userId = decodedClaims.uid;

    // ── Parse body ────────────────────────────────────────────────
    const body = await request.json() as CoverLetterRequest;
    const { jobRole, jobDescription, companyName, tone = 'professional' } = body;

    if (!jobRole) {
      return NextResponse.json({ success: false, error: 'jobRole is required' }, { status: 400 });
    }

    // ── Fetch user profile ────────────────────────────────────────
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    const userProfile = userDoc.data() as UserProfile;

    const resumeText: string = userProfile.resume ?? '';
    const hasTranscript = !!(userProfile.transcript && userProfile.transcriptFileName);

    // ── Transcript analysis ───────────────────────────────────────
    let transcriptCourses = '';
    if (hasTranscript && userProfile.transcript) {
      const { courses, success } = await analyzeTranscriptImage(userProfile.transcript, jobRole, jobDescription);
      if (success) transcriptCourses = courses;
    }

    // ── Cache check ───────────────────────────────────────────────
    const cacheKey = hashResumeContent(`${userId}${jobRole}${companyName ?? ''}${jobDescription ?? ''}${tone}${resumeText.substring(0, 500)}${transcriptCourses.substring(0, 200)}`);
    const cached = await getCachedCoverLetter(cacheKey);
    if (cached) {
      console.log('⚡ Returning cached cover letter');
      return NextResponse.json({
        success: true,
        coverLetter: { content: cached.content, jobRole, companyName: companyName ?? null, tone, wordCount: cached.wordCount, createdAt: cached.createdAt },
        metadata: { tokensUsed: cached.tokensUsed, responseTime: Date.now() - startTime, cached: true, usedTranscript: hasTranscript },
      });
    }

    // ── Company research ──────────────────────────────────────────
    let companyResearch = '';
    if (companyName) companyResearch = await researchCompany(companyName, jobRole);

    // ── Build prompt ──────────────────────────────────────────────
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const contactLines = [userProfile.name];
    if (userProfile.streetAddress) contactLines.push(userProfile.streetAddress);
    const loc = [userProfile.city, userProfile.state].filter(Boolean).join(', ');
    if (loc) contactLines.push(loc);
    contactLines.push(userProfile.email);
    if (userProfile.phone) contactLines.push(userProfile.phone);

    const socialLinks = [userProfile.linkedIn, userProfile.github, userProfile.website].filter(Boolean);
    if (socialLinks.length) contactLines.push(socialLinks.join(' | '));

    const toneMap: Record<string, string> = {
      professional: 'formal, polished, and confident',
      enthusiastic: 'energetic, passionate, and engaging',
      formal: 'very formal and traditional',
      friendly: 'warm, personable, and approachable',
      confident: 'assertive, direct, and self-assured',
    };
    const toneDesc = toneMap[tone] ?? 'professional';

    const prompt = `You are an expert cover letter writer. Create a compelling ${toneDesc} cover letter.

JOB DETAILS:
Role: ${jobRole}
${companyName ? `Company: ${companyName}` : ''}
${jobDescription ? `\nDescription:\n${jobDescription.substring(0, 2000)}` : ''}
${companyResearch ? `\nCOMPANY RESEARCH:\n${companyResearch}` : ''}

CANDIDATE:
${contactLines.join('\n')}
Experience Level: ${userProfile.experienceLevel ?? 'mid'}
Skills: ${userProfile.preferredTech?.join(', ') ?? 'N/A'}
${userProfile.bio ? `Bio: ${userProfile.bio}` : ''}
${resumeText ? `\nWORK EXPERIENCE:\n${resumeText.substring(0, 3000)}` : ''}

${hasTranscript ? `
ACADEMIC COURSEWORK FROM TRANSCRIPT (${userProfile.transcriptFileName}):
${transcriptCourses}

MANDATORY: Body paragraph 2 MUST mention 3-4 specific courses by code and name from above, describing what was built/learned and how it connects to the ${jobRole} role.
` : ''}

FORMAT:
${contactLines.join('\n')}

${currentDate}

Hiring Manager
${companyName ?? '[Company Name]'}

Dear Hiring Team,

[Opening: 2-3 sentences — enthusiasm for ${jobRole} role]
[Body 1: 3-4 sentences on work experience with metrics]
[Body 2: ${hasTranscript ? '4-5 sentences on specific coursework with codes' : '3-4 sentences on technical skills'}]
[Body 3: 2-3 sentences on company interest using research above]
[Closing: 2 sentences with call to action]

Best regards,
${userProfile.name}

Generate the complete cover letter now.`;

    // ── Call OpenAI ───────────────────────────────────────────────
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const coverLetterText = completion.choices[0]?.message?.content ?? '';
    const tokensUsed = completion.usage?.total_tokens ?? 0;
    const wordCount = coverLetterText.split(/\s+/).length;

    if (!coverLetterText || wordCount < 50) {
      return NextResponse.json({ success: false, error: 'Failed to generate cover letter' }, { status: 500 });
    }

    // ── Cache & return ────────────────────────────────────────────
    const cacheData: CoverLetterCache = { content: coverLetterText, wordCount, tokensUsed, createdAt: new Date().toISOString() };
    await cacheCoverLetter(cacheKey, cacheData);

    console.log(`✅ Cover letter generated | ${wordCount} words | ${tokensUsed} tokens | ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      coverLetter: { content: coverLetterText, jobRole, companyName: companyName ?? null, tone, wordCount, createdAt: cacheData.createdAt },
      metadata: { tokensUsed, responseTime: Date.now() - startTime, cached: false, usedTranscript: hasTranscript },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Cover letter error:', msg);
    if (msg.includes('rate_limit') || msg.includes('429')) {
      return NextResponse.json({ success: false, error: 'AI quota exceeded, try again later' }, { status: 429 });
    }
    return NextResponse.json({ success: false, error: 'Failed to generate cover letter' }, { status: 500 });
  }
}