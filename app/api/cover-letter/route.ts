// app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { hashResumeContent } from '@/lib/redis/resume-cache';
import { redis, RedisKeys } from '@/lib/redis/redis-client';
import { getUserAIContext } from '@/lib/ai/user-context';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

const COVER_LETTER_TTL     = 7 * 24 * 60 * 60;
const COMPANY_RESEARCH_TTL = 30 * 24 * 60 * 60;

interface CoverLetterRequest {
  jobRole: string;
  jobDescription?: string;
  companyName?: string;
  tone?: string;
}

interface CoverLetterCache {
  content: string;
  wordCount: number;
  tokensUsed: number;
  createdAt: string;
}

// ─── Helper: extract text from Claude response ────────────────────────────────

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');
}

function countTokensUsed(response: Anthropic.Message): number {
  return (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
}

// ─── Company research ─────────────────────────────────────────────────────────

async function researchCompany(companyName: string, jobRole: string): Promise<string> {
  if (!companyName || !anthropic) return '';
  const cached = await getCachedCompanyResearch(companyName);
  if (cached) return cached;
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: `Research ${companyName} for a ${jobRole} cover letter. Provide 2-3 sentences covering: company mission, recent news (2024-2025), culture/values. If no info available, say "Company information not available".` }],
    });
    const research = extractText(response);
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
    if (cached) { const data = typeof cached === 'string' ? JSON.parse(cached) : cached; return data.research as string; }
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
  try { await redis.setex(`cover-letter:${cacheKey}`, COVER_LETTER_TTL, JSON.stringify(data)); }
  catch (err) { console.error('Redis error:', err); }
}

// ─── Transcript course extraction ─────────────────────────────────────────────

async function extractRelevantCourses(transcriptText: string, jobRole: string, jobDescription?: string): Promise<string> {
  if (!transcriptText || transcriptText.length < 50 || !anthropic) return '';
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: `From this academic transcript text, identify 4-6 courses most relevant to a ${jobRole} position.
${jobDescription ? `JOB REQUIREMENTS:\n${jobDescription.substring(0, 1500)}\n` : ''}
TRANSCRIPT TEXT:\n${transcriptText.substring(0, 3000)}

Format each as: "Course X: [CODE]: [NAME] - [RELEVANCE]"
List them under "RELEVANT COURSES:".` }],
    });
    const result = extractText(response);
    return (result.includes('Course') || result.includes('RELEVANT')) ? result : '';
  } catch (err) {
    console.error('❌ Course extraction error:', err);
    return '';
  }
}

// ─── Main POST ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!anthropic) {
      return NextResponse.json({ success: false, error: 'AI service not configured' }, { status: 503 });
    }

    // ── Auth ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try {
      const decodedClaims = await auth.verifySessionCookie(session.value, true);
      userId = decodedClaims.uid;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────
    const body = await request.json() as CoverLetterRequest;
    const { jobRole, jobDescription, companyName, tone = 'professional' } = body;
    if (!jobRole) return NextResponse.json({ success: false, error: 'jobRole is required' }, { status: 400 });

    // ── Fetch user context ────────────────────────────────────────
    console.log('📄 Fetching user AI context...');
    const ctx = await getUserAIContext(userId);
    const hasResume = !!ctx.resumeText;
    const hasTranscript = !!ctx.transcriptText;

    // ── Extract relevant courses from transcript ──────────────────
    let transcriptCourses = '';
    if (hasTranscript) {
      transcriptCourses = await extractRelevantCourses(ctx.transcriptText!, jobRole, jobDescription);
    }

    // ── Cache check ───────────────────────────────────────────────
    const cacheKey = hashResumeContent(
      `${userId}${jobRole}${companyName ?? ''}${jobDescription ?? ''}${tone}${(ctx.resumeText ?? '').substring(0, 500)}${transcriptCourses.substring(0, 200)}`
    );
    const cached = await getCachedCoverLetter(cacheKey);
    if (cached) {
      console.log('⚡ Returning cached cover letter');
      return NextResponse.json({
        success: true,
        coverLetter: { content: cached.content, jobRole, companyName: companyName ?? null, tone, wordCount: cached.wordCount, createdAt: cached.createdAt },
        metadata: { tokensUsed: cached.tokensUsed, responseTime: Date.now() - startTime, cached: true, usedResume: hasResume, usedTranscript: hasTranscript },
      });
    }

    // ── Company research ──────────────────────────────────────────
    let companyResearch = '';
    if (companyName) companyResearch = await researchCompany(companyName, jobRole);

    // ── Build prompt ──────────────────────────────────────────────
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const contactLines = [ctx.profile.name];
    const userDoc = (await (await import('@/firebase/admin')).db.collection('users').doc(userId).get()).data() || {};
    if (userDoc.streetAddress) contactLines.push(userDoc.streetAddress as string);
    const loc = [userDoc.city, userDoc.state].filter(Boolean).join(', ');
    if (loc) contactLines.push(loc);
    contactLines.push(ctx.profile.email);
    if (userDoc.phone) contactLines.push(userDoc.phone as string);
    const socialLinks = [userDoc.linkedIn, userDoc.github, userDoc.website].filter(Boolean) as string[];
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
Experience Level: ${ctx.profile.experienceLevel || 'mid'}
Skills: ${ctx.profile.preferredTech.join(', ') || 'N/A'}
${ctx.profile.bio ? `Bio: ${ctx.profile.bio}` : ''}
${ctx.profile.careerGoals ? `Career Goals: ${ctx.profile.careerGoals}` : ''}
${hasResume ? `\nWORK EXPERIENCE (from resume):\n${ctx.resumeText!.substring(0, 3000)}` : ''}

${hasTranscript && transcriptCourses ? `
ACADEMIC COURSEWORK FROM TRANSCRIPT:
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
[Body 2: ${hasTranscript && transcriptCourses ? '4-5 sentences on specific coursework with codes' : '3-4 sentences on technical skills'}]
[Body 3: 2-3 sentences on company interest using research above]
[Closing: 2 sentences with call to action]

Best regards,
${ctx.profile.name}

Generate the complete cover letter now.`;

    // ── Call Claude ───────────────────────────────────────────────
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const coverLetterText = extractText(response);
    const tokensUsed = countTokensUsed(response);
    const wordCount = coverLetterText.split(/\s+/).length;

    if (!coverLetterText || wordCount < 50) {
      return NextResponse.json({ success: false, error: 'Failed to generate cover letter' }, { status: 500 });
    }

    // ── Cache & return ────────────────────────────────────────────
    const cacheData: CoverLetterCache = { content: coverLetterText, wordCount, tokensUsed, createdAt: new Date().toISOString() };
    await cacheCoverLetter(cacheKey, cacheData);

    console.log(`✅ Cover letter generated | ${wordCount} words | resume: ${hasResume} | transcript: ${hasTranscript} | ${Date.now() - startTime}ms`);

    return NextResponse.json({
      success: true,
      coverLetter: { content: coverLetterText, jobRole, companyName: companyName ?? null, tone, wordCount, createdAt: cacheData.createdAt },
      metadata: { tokensUsed, responseTime: Date.now() - startTime, cached: false, usedResume: hasResume, usedTranscript: hasTranscript },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Cover letter error:', msg);
    const error = err as Error & { status?: number };
    if (error.status === 429 || msg.includes('rate_limit')) {
      return NextResponse.json({ success: false, error: 'AI quota exceeded, try again later' }, { status: 429 });
    }
    return NextResponse.json({ success: false, error: 'Failed to generate cover letter' }, { status: 500 });
  }
}