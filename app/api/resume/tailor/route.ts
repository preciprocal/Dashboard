// app/api/resume/tailor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { auth, db } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';
import { getUserAIContext } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage, cleanResumeText } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TAILOR_CACHE_TTL = 7 * 24 * 60 * 60;
const MAX_TOKENS = 6000;

const TAILOR_SYSTEM = `You are an elite resume strategist who has placed 5,000+ candidates at top companies. Your single mission: rewrite the candidate's resume so it gets past ATS filters AND makes a human recruiter reach for the phone within 6 seconds.

YOUR PHILOSOPHY:
The resume is a MARKETING DOCUMENT, not a biography. It should be tailored to make this specific job description's requirements light up like a Christmas tree. Every bullet, every skill, every word must earn its place.

CRITICAL RULES:

1. KEEP IT REAL - but REFRAME AGGRESSIVELY. Take the candidate's actual experience and reframe it using the exact language, keywords, and priorities from the job description. If they managed a database and the JD says "data pipeline engineering", reframe "managed database" as "engineered and maintained data pipelines". This is standard resume optimization, not fabrication.

2. SKILLS INJECTION - If the JD requires skills the candidate doesn't explicitly list but likely has exposure to (e.g., any developer probably knows Git, any analyst probably knows Excel), ADD them to the skills section. If the JD mentions tools in the same ecosystem the candidate works in (e.g., candidate uses React, JD mentions Next.js), add them. The interview prep plan will cover any gaps.

3. KEYWORD DENSITY - The tailored resume must contain AT LEAST 80% of the critical keywords from the JD. Weave them naturally into bullet points, skills section, and summary. ATS systems do keyword matching - this is non-negotiable.

4. BULLET FORMULA - Every experience bullet must follow: [Power Verb] + [What You Did Using JD Keywords] + [Quantified Result]. If the original bullet has no metric, ADD a plausible one based on context.

5. SUMMARY/OBJECTIVE - Write a 2-3 sentence professional summary that mirrors the JD's top 3 requirements and positions the candidate as an exact match for this specific role.

6. SKILLS SECTION - Reorganize to put JD-matching skills FIRST. Group by the categories the JD uses.

7. PRESERVE STRUCTURE - Keep the same sections, same number of jobs, same education. Only change the CONTENT within each section to align with the JD.

8. ATS FORMATTING - No tables, no columns, no graphics, no headers/footers. Standard section names.

CRITICAL FORMAT RULES FOR "changes" ARRAY:
- EVERY change MUST use arrow format: "exact original text → exact replacement text"
- The left side of → must be the EXACT text from the original resume (so it can be found and replaced)
- The right side of → must be the new tailored text
- NEVER use descriptive sentences like "Added X" or "Replaced X with Y"
- If adding new content where none existed, use: "(none) → new content here"
- Examples of CORRECT format:
  "Managed team database → Engineered and maintained enterprise data pipelines serving 10K+ daily queries"
  "Python, SQL → Python, SQL, Tableau, Power BI, Apache Spark"
  "(none) → Detail-oriented Junior Data Analyst with expertise in collecting, cleaning, and analyzing data"

CRITICAL: Return ONLY valid JSON. No markdown fences, no preamble. Start with { end with }.`;

interface TailorRequest { resumeId?: string; jobTitle: string; companyName?: string; jobDescription: string; }

function hash(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const session = (await cookies()).get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; }
    catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    const usageCheck = await checkUsage(userId, 'resumes');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
        { status: 403 },
      );
    }

    const body = await request.json() as TailorRequest;
    const { resumeId, jobTitle, companyName, jobDescription } = body;

    if (!jobTitle?.trim()) return NextResponse.json({ error: 'jobTitle is required' }, { status: 400 });
    if (!jobDescription?.trim() || jobDescription.length < 50) return NextResponse.json({ error: 'jobDescription is required (min 50 chars)' }, { status: 400 });

    let resumeText = '';
    if (resumeId) {
      try {
        const doc = await db.collection('resumes').doc(resumeId).get();
        if (doc.exists) { const d = doc.data() as Record<string, unknown>; resumeText = (d.resumeText as string) || (d.extractedText as string) || ''; }
      } catch {}
    }
    if (!resumeText) {
      try { const ctx = await getUserAIContext(userId); resumeText = ctx.resumeText || ''; } catch {}
    }
    if (!resumeText || resumeText.length < 100) return NextResponse.json({ error: 'No resume found. Please upload a resume first.' }, { status: 400 });

    resumeText = cleanResumeText(resumeText).slice(0, 10_000);
    const jdTrimmed = jobDescription.slice(0, 3000);

    const cacheKey = `tailor:${hash(resumeText.slice(0, 500), jobTitle, companyName || '', jdTrimmed.slice(0, 500))}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) { const d = typeof cached === 'string' ? JSON.parse(cached) : cached; return NextResponse.json({ success: true, data: d, cached: true, responseTime: Date.now() - start }); }
      } catch {}
    }

    const userPrompt = `TAILOR THIS RESUME for the exact job below. The goal is ONE thing: get the callback.

=== TARGET JOB ===
Title: ${jobTitle}
${companyName ? `Company: ${companyName}` : ''}

JOB DESCRIPTION:
<jd>
${jdTrimmed}
</jd>

=== CURRENT RESUME ===
<resume>
${resumeText}
</resume>

=== WHAT TO RETURN ===
{
  "tailoredResume": "<THE COMPLETE TAILORED RESUME as plain text - ready to copy-paste. Include all sections.>",
  "summary": { "original": "<exact original summary text or 'None'>", "tailored": "<new 2-3 sentence summary>", "keywordsAdded": ["..."] },
  "sections": [
    {
      "name": "<e.g. 'Experience - Company X'>",
      "changes": [
        "exact original text from resume → tailored replacement text",
        "another original line → its tailored version",
        "(none) → completely new content added"
      ],
      "keywordsInjected": ["keyword1", "keyword2"]
    }
  ],
  "skillsOptimization": { "added": ["..."], "reordered": ["..."], "removed": ["..."] },
  "atsScore": { "before": <0-100>, "after": <0-100>, "keywordMatchBefore": <0-100>, "keywordMatchAfter": <0-100> },
  "keywordsFromJD": { "critical": ["..."], "matched": ["..."], "missing": ["..."] },
  "interviewPrepNotes": ["<skill to study up on>", "<another gap>"]
}

REMINDER: Every item in "changes" MUST use arrow format "original text → new text" using the → character. The original text must be EXACT verbatim from the resume so it can be located and replaced. Never use descriptive sentences.`;

    console.log(`🎯 Tailoring resume for "${jobTitle}"${companyName ? ` at ${companyName}` : ''}`);

    const response = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(TAILOR_SYSTEM), messages: [{ role: 'user', content: userPrompt }] });
    logUsage('resume-tailor', response);

    const raw = extractText(response);
    const cleaned = extractJsonString(raw);
    if (!cleaned) { console.error('❌ No JSON in tailor response:', raw.slice(0, 300)); return NextResponse.json({ error: 'AI returned unexpected format. Try again.' }, { status: 422 }); }

    let data: Record<string, unknown>;
    try { data = JSON.parse(cleaned); } catch (err) { console.error('❌ JSON parse failed:', err); return NextResponse.json({ error: 'AI returned malformed response. Try again.' }, { status: 422 }); }

    await checkAndIncrementUsage(userId, 'resumes');

    if (redis) { try { await redis.setex(cacheKey, TAILOR_CACHE_TTL, JSON.stringify(data)); } catch {} }

    // ── Save to resume doc for preloading on page load ────────────
    if (resumeId) {
      try {
        await db.collection('resumes').doc(resumeId).update({
          tailorResult: data,
          tailorResultGeneratedAt: Date.now(),
          tailorJobTitle: jobTitle,
          tailorCompanyName: companyName || null,
        });
      } catch (e) { console.warn('⚠️ Tailor cache write to resume failed:', e); }
    }

    try {
      await db.collection('tailoredResumes').add({
        userId, resumeId: resumeId || null, jobTitle, companyName: companyName || null,
        atsScoreBefore: (data.atsScore as Record<string, number>)?.before ?? null,
        atsScoreAfter: (data.atsScore as Record<string, number>)?.after ?? null,
        interviewPrepNotes: data.interviewPrepNotes || [], createdAt: new Date(),
      });
    } catch {}

    console.log(`✅ Resume tailored | ATS: ${(data.atsScore as Record<string, number>)?.before ?? '?'} → ${(data.atsScore as Record<string, number>)?.after ?? '?'} | ${Date.now() - start}ms`);
    return NextResponse.json({ success: true, data, cached: false, responseTime: Date.now() - start });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429) return NextResponse.json({ error: 'AI quota exceeded. Try again later.' }, { status: 429 });
    console.error('❌ Tailor error:', err);
    return NextResponse.json({ error: 'Failed to tailor resume' }, { status: 500 });
  }
}