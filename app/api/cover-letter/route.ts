// app/api/cover-letter/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import { hashResumeContent } from '@/lib/redis/resume-cache';
import { redis, RedisKeys } from '@/lib/redis/redis-client';
import { getUserAIContext } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

const COVER_LETTER_TTL     = 7 * 24 * 60 * 60;
const COMPANY_RESEARCH_TTL = 30 * 24 * 60 * 60;

// Cover letter = ~350-500 words = ~500-700 tokens output.
// Company research sub-call is 300 tokens. Main call safe at 1200.
const MAX_TOKENS_MAIN    = 1200;
const MAX_TOKENS_RESEARCH = 250;
const MAX_TOKENS_COURSES  = 500;

const SYSTEM_PROMPT = `You are an expert cover letter writer. You create compelling, personalized cover letters that get interviews. You incorporate specific company research and candidate experience to create authentic, non-generic letters. Generate the complete cover letter directly — no preamble, no commentary.`;

interface CoverLetterRequest { jobRole: string; jobDescription?: string; companyName?: string; tone?: string; }
interface CoverLetterCache { content: string; wordCount: number; tokensUsed: number; createdAt: string; }

// ─── Company research ─────────────────────────────────────────────────────────

async function researchCompany(companyName: string, jobRole: string): Promise<string> {
  if (!companyName?.trim() || !anthropic) return '';
  const cached = await getCachedCompanyResearch(companyName);
  if (cached) return cached;
  try {
    const r = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS_RESEARCH, messages: [{ role: 'user', content: `Research ${companyName} for a ${jobRole} cover letter. 2-3 sentences: mission, recent news, culture. If unknown say "Company information not available".` }] });
    const research = extractText(r);
    await cacheCompanyResearch(companyName, research);
    return research;
  } catch { return ''; }
}

async function getCachedCompanyResearch(name: string): Promise<string | null> {
  if (!redis) return null;
  try { const c = await redis.get(RedisKeys.company(name.toLowerCase().trim())); if (c) { const d = typeof c === 'string' ? JSON.parse(c) : c; return d.research as string; } return null; } catch { return null; }
}
async function cacheCompanyResearch(name: string, research: string): Promise<void> {
  if (!redis || !research) return;
  try { await redis.setex(RedisKeys.company(name.toLowerCase().trim()), COMPANY_RESEARCH_TTL, JSON.stringify({ research, cachedAt: new Date().toISOString() })); } catch {}
}
async function getCachedCoverLetter(key: string): Promise<CoverLetterCache | null> {
  if (!redis) return null;
  try { const c = await redis.get(`cover-letter:${key}`); if (c) return typeof c === 'string' ? JSON.parse(c) : c as CoverLetterCache; return null; } catch { return null; }
}
async function cacheCoverLetter(key: string, data: CoverLetterCache): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`cover-letter:${key}`, COVER_LETTER_TTL, JSON.stringify(data)); } catch {}
}

// ─── Transcript course extraction ─────────────────────────────────────────────

async function extractRelevantCourses(transcriptText: string, jobRole: string, jobDescription?: string): Promise<string> {
  if (!transcriptText || transcriptText.length < 50 || !anthropic) return '';
  try {
    const r = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS_COURSES, messages: [{ role: 'user', content: `From this transcript, identify 4-6 courses relevant to a ${jobRole} position.\n${jobDescription ? `JOB:\n${jobDescription.substring(0, 1500)}\n` : ''}TRANSCRIPT:\n${transcriptText.substring(0, 3000)}\n\nFormat: "Course X: [CODE]: [NAME] - [RELEVANCE]"` }] });
    const result = extractText(r);
    return (result.includes('Course') || result.includes('RELEVANT')) ? result : '';
  } catch { return ''; }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    if (!anthropic) return NextResponse.json({ success: false, error: 'AI service not configured' }, { status: 503 });

    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; }
    catch { return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }); }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'medium');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'coverLetters');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { success: false, error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
    }

    const body = await request.json() as CoverLetterRequest;
    const { jobRole, jobDescription, companyName, tone = 'professional' } = body;
    if (!jobRole) return NextResponse.json({ success: false, error: 'jobRole is required' }, { status: 400 });

    const ctx = await getUserAIContext(userId);
    const hasResume = !!ctx.resumeText;
    const hasTranscript = !!ctx.transcriptText;

    let transcriptCourses = '';
    if (hasTranscript) transcriptCourses = await extractRelevantCourses(ctx.transcriptText!, jobRole, jobDescription);

    const cacheKey = hashResumeContent(`${userId}${jobRole}${companyName ?? ''}${jobDescription ?? ''}${tone}${(ctx.resumeText ?? '').substring(0, 500)}${transcriptCourses.substring(0, 200)}`);
    const cached = await getCachedCoverLetter(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, coverLetter: { content: cached.content, jobRole, companyName: companyName ?? null, tone, wordCount: cached.wordCount, createdAt: cached.createdAt }, metadata: { tokensUsed: cached.tokensUsed, responseTime: Date.now() - startTime, cached: true, usedResume: hasResume, usedTranscript: hasTranscript } });
    }

    let companyResearch = '';
    if (companyName) companyResearch = await researchCompany(companyName, jobRole);

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

    const toneMap: Record<string, string> = { professional: 'formal, polished, and confident', enthusiastic: 'energetic, passionate, and engaging', formal: 'very formal and traditional', friendly: 'warm, personable, and approachable', confident: 'assertive, direct, and self-assured' };

    const prompt = `Create a compelling ${toneMap[tone] ?? 'professional'} cover letter.

JOB: ${jobRole}${companyName ? ` at ${companyName}` : ''}
${jobDescription ? `Description:\n${jobDescription.substring(0, 2000)}` : ''}
${companyResearch ? `COMPANY RESEARCH:\n${companyResearch}` : ''}

CANDIDATE:
${contactLines.join('\n')}
Level: ${ctx.profile.experienceLevel || 'mid'} | Skills: ${ctx.profile.preferredTech.join(', ') || 'N/A'}
${ctx.profile.bio ? `Bio: ${ctx.profile.bio}` : ''}
${hasResume ? `EXPERIENCE:\n${ctx.resumeText!.substring(0, 3000)}` : ''}
${hasTranscript && transcriptCourses ? `COURSEWORK:\n${transcriptCourses}\nMUST mention 3-4 specific courses by code in body paragraph 2.` : ''}

FORMAT: ${contactLines.join('\n')}\n\n${currentDate}\n\nHiring Manager\n${companyName ?? '[Company]'}\n\nDear Hiring Team,\n[Opening 2-3 sentences]\n[Body 1: experience with metrics]\n[Body 2: ${hasTranscript && transcriptCourses ? 'coursework' : 'technical skills'}]\n[Body 3: company interest]\n[Closing with CTA]\n\nBest regards,\n${ctx.profile.name}`;

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS_MAIN, system: cachedSystem(SYSTEM_PROMPT), messages: [{ role: 'user', content: prompt }] });
    logUsage('cover-letter', response);

    const coverLetterText = extractText(response);
    const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
    const wordCount = coverLetterText.split(/\s+/).length;
    if (!coverLetterText || wordCount < 50) return NextResponse.json({ success: false, error: 'Failed to generate cover letter' }, { status: 500 });

    // ── Increment usage ───────────────────────────────────────────
    await checkAndIncrementUsage(userId, 'coverLetters');

    const cacheData: CoverLetterCache = { content: coverLetterText, wordCount, tokensUsed, createdAt: new Date().toISOString() };
    await cacheCoverLetter(cacheKey, cacheData);

    console.log(`✅ Cover letter | ${wordCount} words | ${Date.now() - startTime}ms`);
    return NextResponse.json({ success: true, coverLetter: { content: coverLetterText, jobRole, companyName: companyName ?? null, tone, wordCount, createdAt: cacheData.createdAt }, metadata: { tokensUsed, responseTime: Date.now() - startTime, cached: false, usedResume: hasResume, usedTranscript: hasTranscript } });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429 || (err instanceof Error && err.message.includes('rate_limit'))) return NextResponse.json({ success: false, error: 'AI quota exceeded' }, { status: 429 });
    console.error('❌ Cover letter error:', err);
    return NextResponse.json({ success: false, error: 'Failed to generate cover letter' }, { status: 500 });
  }
}