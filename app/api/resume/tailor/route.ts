// app/api/resume/tailor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { getUserAIContext } from '@/lib/ai/user-context';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage, cleanResumeText, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION, createMessage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { applyChanges, check, cleanKeywords, coverage, groundingIssue, hasTerm, type ProposedChange } from '@/lib/applications/truthful-tailor';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TAILOR_CACHE_TTL = 7 * 24 * 60 * 60;
const MAX_TOKENS = 6000;

const TAILOR_SYSTEM = `You are a resume strategist. Rewrite the candidate's resume so it speaks to this job description, using only what the resume already says.

TRUTH RULES (a change that breaks one is removed before the candidate sees it):
1. Reword, reorder and use the job's language only for experience the resume already shows. "Managed the team database" may become "maintained the team's data pipeline" only if the resume shows that work.
2. Never add a number, percentage, team size, duration or metric that the original line does not contain. If a line has no metric, make it clearer in words.
3. Never add a tool, language, framework, certification or skill the resume does not mention somewhere. Job requirements the resume does not support go in "keywordsFromJD.missing" and "interviewPrepNotes", not on the resume.
4. Keep employers, titles, dates, degrees and schools exactly as they are.

WHAT TO DO:
- Summary: 2 to 3 sentences that match the job's top requirements to what the resume shows.
- Skills: put the skills the job asks for that the resume already lists first.
- Bullets: [strong verb] + [what was done, in the job's terms where true] + [the result the original states, if any].
- Same sections, same jobs, standard section names, no tables or columns.

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

CRITICAL: Return ONLY valid JSON. No markdown fences, no preamble. Start with { end with }.${LANGUAGE_MATCH_INSTRUCTION}`;

/**
 * Holds the model's output to the resume's facts (lib/applications/truthful-tailor.ts):
 * drops changes that add numbers, tools or job keywords the resume does not
 * have, rebuilds the full tailored text from the changes that remain, and
 * replaces the model's ATS guesses with a count of the job's keywords found.
 */
function enforceFacts(data: Record<string, unknown>, resumeText: string, jd: string): Record<string, unknown> {
  const kw = (data.keywordsFromJD ?? {}) as { critical?: unknown };
  const keywords = cleanKeywords(kw.critical, 30).filter(k => hasTerm(jd, k));

  const sections = (Array.isArray(data.sections) ? data.sections : []) as Array<{ name?: string; changes?: unknown; keywordsInjected?: unknown }>;
  const kept: ProposedChange[] = [];
  const outSections = sections.map(sec => {
    const proposed = (Array.isArray(sec.changes) ? sec.changes : [])
      .filter((c): c is string => typeof c === 'string' && c.includes('→'))
      .map(c => { const i = c.indexOf('→'); return { section: sec.name ?? '', original: c.slice(0, i).trim(), rewrite: c.slice(i + 1).trim(), reason: '' }; })
      .filter(c => c.original && c.original.toLowerCase() !== '(none)');
    const { accepted } = check(proposed, resumeText, keywords);
    kept.push(...accepted);
    return {
      name: sec.name ?? '',
      changes: accepted.map(c => `${c.original} → ${c.rewrite}`),
      keywordsInjected: [...new Set(accepted.flatMap(c => c.keywordsAdded))],
    };
  }).filter(sec => sec.changes.length > 0);

  let tailored = applyChanges(resumeText, kept);
  const summary = data.summary as { original?: string; tailored?: string; keywordsAdded?: unknown } | undefined;
  let outSummary: Record<string, unknown> | undefined;
  if (summary?.tailored) {
    const text = summary.tailored.trim();
    const unsupported = keywords.find(k => hasTerm(text, k) && !hasTerm(resumeText, k));
    if (!groundingIssue(text, resumeText) && !unsupported) {
      const original = summary.original && summary.original !== 'None' && resumeText.includes(summary.original) ? summary.original : 'None';
      tailored = original === 'None' ? `${text}

${tailored}` : tailored.replace(original, text);
      outSummary = { original, tailored: text, keywordsAdded: keywords.filter(k => hasTerm(text, k)) };
    }
  }

  const skills = (data.skillsOptimization ?? {}) as { added?: unknown; reordered?: unknown; removed?: unknown };
  const inResume = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && hasTerm(resumeText, s)) : []);

  const before = coverage(resumeText, keywords);
  const after = coverage(tailored, keywords);
  return {
    ...data,
    tailoredResume: tailored,
    summary: outSummary,
    sections: outSections,
    skillsOptimization: { added: inResume(skills.added), reordered: inResume(skills.reordered), removed: inResume(skills.removed) },
    // Counted, not estimated: the share of the job's keywords the text contains.
    atsScore: { before: before.percent, after: after.percent, keywordMatchBefore: before.percent, keywordMatchAfter: after.percent },
    keywordsFromJD: { critical: keywords, matched: after.matched, missing: after.missing },
    factChecked: true,
  };
}

interface TailorRequest { resumeId?: string; jobTitle: string; companyName?: string; jobDescription: string; }

function hash(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

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
        const { data: d } = await supabaseAdmin.from('resumes').select('resume_text').eq('id', resumeId).maybeSingle();
        if (d?.resume_text) resumeText = d.resume_text;
      } catch {}
    }
    if (!resumeText) {
      try { const ctx = await getUserAIContext(userId); resumeText = ctx.resumeText || ''; } catch {}
    }
    if (!resumeText || resumeText.length < 100) return NextResponse.json({ error: 'No resume found. Please upload a resume first.' }, { status: 400 });

    resumeText = cleanResumeText(resumeText).slice(0, 10_000);
    const jdTrimmed = jobDescription.slice(0, 3000);

    // v2: fact-checked output; earlier results could carry invented metrics and skills.
    const cacheKey = `tailor:v2:${hash(resumeText.slice(0, 500), jobTitle, companyName || '', jdTrimmed.slice(0, 500))}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) { const d = stripDashesDeep(typeof cached === 'string' ? JSON.parse(cached) : cached); return NextResponse.json({ success: true, data: d, cached: true, responseTime: Date.now() - start }); }
      } catch {}
    }

    const userPrompt = `TAILOR THIS RESUME for the job below, using only facts it already contains.

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
  "keywordsFromJD": { "critical": ["the 12 to 20 skills, tools and qualifications this job asks for, as written in it"], "matched": [], "missing": [] },
  "interviewPrepNotes": ["<skill to study up on>", "<another gap>"]
}

REMINDER: Every item in "changes" MUST use arrow format "original text → new text" using the → character. The original text must be EXACT verbatim from the resume so it can be located and replaced. Never use descriptive sentences.`;

    console.log(`🎯 Tailoring resume for "${jobTitle}"${companyName ? ` at ${companyName}` : ''}`);

    const response = await createMessage({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(TAILOR_SYSTEM), messages: [{ role: 'user', content: userPrompt }] });
    logUsage('resume-tailor', response);

    const raw = extractText(response);
    const cleaned = extractJsonString(raw);
    if (!cleaned) { console.error('❌ No JSON in tailor response:', raw.slice(0, 300)); return NextResponse.json({ error: 'AI returned unexpected format. Try again.' }, { status: 422 }); }

    let data: Record<string, unknown>;
    try { data = stripDashesDeep(JSON.parse(cleaned)); } catch (err) { console.error('❌ JSON parse failed:', err); return NextResponse.json({ error: 'AI returned malformed response. Try again.' }, { status: 422 }); }

    data = enforceFacts(data, resumeText, jdTrimmed);

    await checkAndIncrementUsage(userId, 'resumes');

    if (redis) { try { await redis.setex(cacheKey, TAILOR_CACHE_TTL, JSON.stringify(data)); } catch {} }

    // ── Save to resume row for preloading on page load ────────────
    if (resumeId) {
      try {
        await supabaseAdmin.from('resumes').update({
          tailor_result: data,
          tailor_result_generated_at: new Date().toISOString(),
          tailor_job_title: jobTitle,
          tailor_company_name: companyName || null,
        }).eq('id', resumeId);
      } catch (e) { console.warn('⚠️ Tailor cache write to resume failed:', e); }
    }

    try {
      await supabaseAdmin.from('tailored_resumes').insert({
        user_id: supabaseUserId, resume_id: resumeId || null, job_title: jobTitle, company_name: companyName || null,
        ats_score_before: (data.atsScore as Record<string, number>)?.before ?? null,
        ats_score_after: (data.atsScore as Record<string, number>)?.after ?? null,
        interview_prep_notes: data.interviewPrepNotes || [],
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