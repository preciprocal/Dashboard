// app/api/resume/benchmark/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION, createMessage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

// A recruiter-style read of one resume against what employers usually look
// for in the role. Everything is judged from the resume itself. It does NOT
// compare the student with real applicants or real hires: there is no such
// data behind it, so it gives no percentiles, peer medians, "hired" scores or
// sources. A percentile can come back once enough real outcomes are recorded
// (lib/ai/outcome-tracking.ts) and be labelled with that count.

/** Results saved before this version had invented comparisons; they are not reused. */
const BENCHMARK_VERSION = 2;

const MAX_TOKENS = 2500;

const BENCHMARK_SYSTEM = `You are an experienced recruiter reviewing one resume for one target role. Be direct and honest, not softened.

You have NO data about real applicants, real hires or a company's hiring results, and you must never imply otherwise:
- Never give percentiles, rankings, averages, medians, response rates, odds or any statistic.
- Never name sources such as Glassdoor, LinkedIn, career pages or "industry data".
- Describe what strong candidates usually show as general guidance, in plain words, without numbers about other people.

RULES:
1. Quote the resume: cite specific bullets, titles and skills as evidence.
2. No empty praise. Adequate is the baseline.
3. KILLER FLAW: the single most damaging thing for this role.
4. THREE FIXES: specific actions the student can take today. No score gains or promised outcomes.
5. FIRST IMPRESSION: a recruiter's honest first read, in 2 or 3 sentences.
6. A missing job description or target role is not a resume flaw.
7. When a company is named, describe what that kind of employer usually screens for only in general terms you are confident about.

Return ONLY valid JSON. No markdown. Start with { end with }.${LANGUAGE_MATCH_INSTRUCTION}`;

const buildPrompt = (d: Record<string, unknown>): string => {
  const s = d.feedback as Record<string, unknown> | undefined;
  const ats = (s?.ATS as Record<string, number>)?.score ?? 0;
  const content = (s?.content as Record<string, number>)?.score ?? 0;
  const structure = (s?.structure as Record<string, number>)?.score ?? 0;
  const skills = (s?.skills as Record<string, number>)?.score ?? 0;
  const overall = (s?.overallScore as number) ?? 0;
  const text = (d.resumeText as string) || (d.extractedText as string) || '';
  const title = (d.jobTitle as string) || 'Not specified';
  const company = (d.companyName as string) || '';
  const jd = (d.jobDescription as string) || '';

  return `TARGET: ${title}${company ? ` at ${company}` : ''}
${jd ? `JD:\n${jd.slice(0, 1500)}` : 'No JD. Judge against what this kind of role usually asks for.'}

SCORES FROM THE RESUME ANALYSIS: Overall ${overall}, ATS ${ats}, Content ${content}, Structure ${structure}, Skills ${skills}

${text ? `RESUME:\n${text.slice(0, 4000)}` : 'No text available.'}

Return JSON:
{
  "strongCandidateProfile": {
    "summary": "<1-2 sentences: what a strong ${title} resume usually shows, as general guidance>",
    "skills": ["<skill or tool>", "<another>", "<another>", "<another>"],
    "experience": "<the kind of experience strong candidates usually show, in words, no statistics>",
    "differentiators": ["<what tends to set a strong resume apart for this role>", "<another>"]
  },
  "killerFlaw": { "title": "<5-8 words>", "detail": "<2-3 sentences, quoting the resume>", "urgency": "critical|high|medium" },
  "dimensions": [
    { "name": "ATS Compatibility", "userScore": ${ats}, "verdict": "strong|competitive|weak|critical", "honestTake": "<specific, quoting the resume>" },
    { "name": "Content Quality", "userScore": ${content}, "verdict": "<>", "honestTake": "<>" },
    { "name": "Structure & Format", "userScore": ${structure}, "verdict": "<>", "honestTake": "<>" },
    { "name": "Skills & Keywords", "userScore": ${skills}, "verdict": "<>", "honestTake": "<>" },
    { "name": "Impact & Achievements", "userScore": <0-100, your judgment of the resume>, "verdict": "<>", "honestTake": "<>" }
  ],
  "gapsToStrongResume": ["<specific thing a strong resume for this role usually shows that this one does not>", "<another>", "<another>"],
  "threeThingsToFixNow": [{ "action": "<specific>", "whyItMatters": "<>" }, {}, {}],
  "recruitersFirstImpression": "<2-3 sentences>",
  "ifThisResumeAppliedToday": "<1 sentence: your honest read of how it would land>"
}`;
};

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    const usageCheck = await checkUsage(userId, 'resumes');
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit }, { status: 403 });
    }

    const { resumeId, force = false } = await request.json();
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

    const { data: row, error: fetchError } = await supabaseAdmin.from('resumes').select('*').eq('id', resumeId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.user_id !== supabaseUserId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const data: Record<string, unknown> = {
      feedback: row.feedback,
      resumeText: row.resume_text,
      jobTitle: row.job_title,
      companyName: row.company_name,
      jobDescription: row.job_description,
    };

    const cached = row.benchmark_result as Record<string, unknown> | undefined;
    const cachedAt = row.benchmark_generated_at ? new Date(row.benchmark_generated_at as string).getTime() : undefined;
    if (!force && cached && cached._v === BENCHMARK_VERSION && cachedAt && Date.now() - cachedAt < 7 * 24 * 60 * 60 * 1000) return NextResponse.json({ success: true, data: stripDashesDeep(cached), cached: true });

    const response = await createMessage({ model: CLAUDE_MODEL, max_tokens: MAX_TOKENS, system: cachedSystem(BENCHMARK_SYSTEM), messages: [{ role: 'user', content: buildPrompt(data) }] });
    logUsage('benchmark', response);

    const cleaned = extractJsonString(extractText(response));
    if (!cleaned) return NextResponse.json({ error: 'AI returned malformed response' }, { status: 500 });
    const benchmarkData = stripDashesDeep(JSON.parse(cleaned)) as Record<string, unknown>;

    benchmarkData._v = BENCHMARK_VERSION;

    await checkAndIncrementUsage(userId, 'resumes');

    try { await supabaseAdmin.from('resumes').update({ benchmark_result: benchmarkData, benchmark_generated_at: new Date().toISOString() }).eq('id', resumeId); } catch {}
    return NextResponse.json({ success: true, data: benchmarkData, cached: false });
  } catch (error) { console.error('❌ Benchmark error:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}