// app/api/resume/interview-intel/route.ts
//
// Interview prep for a company and role: the rounds typical for this kind of
// role, the question themes they usually cover, and how this resume fits the
// job description. There is no web lookup behind this, so it asks for nothing
// the model cannot know: no pass rates, ratings, salaries, review summaries or
// "sources". Rounds are presented as typical for the role, not as this
// company's confirmed process.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { anthropic, extractText, extractJsonString, cachedSystem, logUsage, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION, createMessage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { INTEL_VERSION, type InterviewIntel } from '@/types/resume';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TOKENS = 3000;

const ROUND_TYPES = ['recruiter_screen', 'technical_phone', 'coding', 'system_design', 'behavioral', 'hiring_manager', 'team_match', 'take_home'] as const;

const INTEL_SYSTEM = `You help a candidate prepare for interviews. You have no access to the web or to any company's internal hiring data.

RULES:
1. Describe the interview rounds that are TYPICAL for this kind of role at a company of this kind. Never claim a specific company uses a specific process.
2. Never give numbers you cannot know: no pass rates, acceptance rates, ratings, salaries, timelines or counts of reports.
3. Never cite or name sources (Glassdoor, Reddit, Blind, Levels.fyi, LeetCode or any other). Never summarize reviews or posts.
4. Candidate fit uses ONLY facts written in the resume and the job description. Do not assume skills or experience the resume does not state.
5. Keep string values short (under 160 characters). No newlines inside strings.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }.${LANGUAGE_MATCH_INSTRUCTION}`;

/** Keep only the fields this version shows, in the shapes the UI expects. */
function normalize(raw: Record<string, unknown>, company: string, role: string, hasResume: boolean): InterviewIntel {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter((s): s is string => !!s) : []);
  const objs = (v: unknown) => (Array.isArray(v) ? v.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object') : []);

  const rounds = objs(raw.rounds)
    .map(r => ({
      name: str(r.name) ?? '',
      type: (ROUND_TYPES as readonly string[]).includes(r.type as string) ? (r.type as string) : 'behavioral',
      whatItTests: str(r.whatItTests) ?? '',
      tips: strs(r.tips).slice(0, 4),
    }))
    .filter(r => r.name);

  const questionThemes = objs(raw.questionThemes)
    .map(q => ({ theme: str(q.theme) ?? '', round: str(q.round), example: str(q.example), tip: str(q.tip) }))
    .filter(q => q.theme);

  const fit = raw.candidateFit as Record<string, unknown> | null | undefined;
  const candidateFit = hasResume && fit && typeof fit === 'object'
    ? {
        strengths: strs(fit.strengths),
        gaps: strs(fit.gaps),
        prepPriorities: objs(fit.prepPriorities)
          .map(p => ({ area: str(p.area) ?? '', reason: str(p.reason) ?? '', howToPrepare: str(p.howToPrepare) }))
          .filter(p => p.area),
      }
    : null;

  return { version: INTEL_VERSION, company, role, rounds, questionThemes, candidateFit };
}

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;

    const body = await request.json() as { resumeId: string; companyName?: string; jobTitle?: string; jobDescription?: string; force?: boolean };
    const { resumeId, force = false } = body;
    if (!resumeId) return NextResponse.json({ error: 'Resume ID required' }, { status: 400 });

    const { data: row, error: fetchError } = await supabaseAdmin.from('resumes').select('*').eq('id', resumeId).maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (row.user_id !== supabaseUserId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const company = (body.companyName || (row.company_name as string) || '').trim();
    const role = (body.jobTitle || (row.job_title as string) || '').trim();
    const jd = body.jobDescription || (row.job_description as string) || '';
    const feedback = row.feedback as Record<string, unknown> | undefined;
    const resumeText = (row.resume_text as string) || (feedback?.resumeText as string) || '';

    if (!company && !role) return NextResponse.json({ error: 'Company or job title required' }, { status: 400 });

    const usageCheck = await checkUsage(userId, 'resumes');
    if (!usageCheck.allowed) {
      return NextResponse.json({ error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit }, { status: 403 });
    }

    // Cached per resume (it includes this resume's fit), only for the same
    // company and role, and only in the current shape. There is deliberately no
    // cache shared across users: the fit analysis comes from one person's resume.
    const cached = row.interview_intel as Record<string, unknown> | undefined;
    const cachedAt = row.interview_intel_generated_at as string | undefined;
    const sameTarget = (row.interview_intel_company ?? '') === company && (row.interview_intel_role ?? '') === role;
    if (!force && cached?.version === INTEL_VERSION && sameTarget && cachedAt && Date.now() - new Date(cachedAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ success: true, intel: stripDashesDeep(cached), cached: true });
    }

    const prompt = `Company: ${company || 'Not specified'}
Role: ${role || 'Not specified'}
${jd ? `Job description:\n${jd.substring(0, 2500)}` : ''}
${resumeText ? `Resume:\n${resumeText.substring(0, 2500)}` : ''}

Return JSON:
{
  "rounds": [{ "name": "...", "type": "${ROUND_TYPES.join('|')}", "whatItTests": "...", "tips": ["...", "..."] }],
  "questionThemes": [{ "theme": "...", "round": "the round name it belongs to", "example": "one example question", "tip": "how to approach it" }],
  "candidateFit": ${resumeText ? '{ "strengths": ["a strength the resume shows for this job"], "gaps": ["a job requirement the resume does not show"], "prepPriorities": [{ "area": "...", "reason": "...", "howToPrepare": "..." }] }' : 'null'}
}

Give 4 to 6 rounds in the usual order, 6 to 8 question themes${jd ? ' drawn from the job description' : ''}, and 3 to 4 prep priorities.`;

    const response = await createMessage({ max_tokens: MAX_TOKENS, system: cachedSystem(INTEL_SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage('interview-intel', response);

    const raw = JSON.parse(extractJsonString(extractText(response))) as Record<string, unknown>;
    const intel = stripDashesDeep(normalize(raw, company, role, !!resumeText));

    await checkAndIncrementUsage(userId, 'resumes');

    try {
      await supabaseAdmin.from('resumes').update({
        interview_intel: intel,
        interview_intel_generated_at: new Date().toISOString(),
        interview_intel_company: company,
        interview_intel_role: role,
      }).eq('id', resumeId);
    } catch {}

    return NextResponse.json({ success: true, intel });
  } catch (error) { console.error('❌ Intel error:', error); return NextResponse.json({ error: 'Could not prepare interview prep. Please try again.' }, { status: 500 }); }
}
