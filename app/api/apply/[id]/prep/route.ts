// app/api/apply/[id]/prep/route.ts
//
// POST -> { pack }   Builds the per-round prep pack for one application from
// the student's own resume (the approved tailored version when there is one)
// and the job description.
//
// Two model calls run in parallel (recruiter + hiring manager, and technical +
// behavioral). Their output is checked before it is kept: every story must be
// built on a line that is really in the resume, may not use a number or a tool
// the resume does not contain, and every technical topic must quote the job
// description. The sponsorship answer is not generated at all; it comes from
// lib/applications/sponsorship.ts, with the company's public E-Verify and
// H-1B records next to it.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { anthropic, cachedSystem, logUsage, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION, createMessage } from '@/lib/ai/claude';
import { askJson } from '@/lib/applications/model-json';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { getApplication, loadPack, savePack, type PrepPack, type StarStory } from '@/lib/applications/pack';
import { containsLoose, dropUnbackedClaims, groundingIssue } from '@/lib/applications/truthful-tailor';
import { sponsorshipAnswer } from '@/lib/applications/sponsorship';
import { loadOwnResumeText } from '@/lib/applications/resume-text';
import { lookupEverify } from '@/lib/jobs/everify';
import { lookupH1b } from '@/lib/jobs/h1b';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You prepare a student for one job's interviews using only their resume and the job description.

TRUTH RULES:
- Use only facts written in the resume. Never invent projects, employers, numbers, tools, team sizes or outcomes.
- If a STAR result has no number in the resume, describe the effect in words.
- Company facts come from the job description. Beyond it, mention only what the company is widely known to do, in general terms, with no figures.
- No salary figures unless the job description states a range.
- No em dashes or en dashes.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }.${LANGUAGE_MATCH_INSTRUCTION}`;

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const strs = (v: unknown, max = 8) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, max) : []);
const objs = (v: unknown) => (Array.isArray(v) ? v.filter((o): o is Record<string, unknown> => !!o && typeof o === 'object') : []);

async function ask(prompt: string, maxTokens: number, label: string): Promise<Record<string, unknown>> {
  return stripDashesDeep(await askJson(async () => {
    const response = await createMessage({ max_tokens: maxTokens, system: cachedSystem(SYSTEM), messages: [{ role: 'user', content: prompt }] });
    logUsage(label, response);
    return response;
  }, label));
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId: uid } = authedUser;

    const rateLimited = await applyRateLimit(request, userId, 'heavy');
    if (rateLimited) return rateLimited;
    const usage = await checkUsage(userId, 'resumes');
    if (!usage.allowed) return NextResponse.json({ error: usage.message, code: 'USAGE_LIMIT', used: usage.used, limit: usage.limit }, { status: 403 });

    const app = await getApplication(uid, (await params).id);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    const pack = await loadPack(uid, app);

    const jd = pack.jobDescription || app.jobDescription || '';
    if (jd.length < 50) return NextResponse.json({ error: 'Add the job description first.' }, { status: 400 });
    const resumeId = pack.resumeId || app.resumeId;
    const resumeText = pack.tailor?.tailoredText || (resumeId ? await loadOwnResumeText(uid, resumeId) : '');
    if (!resumeText) return NextResponse.json({ error: 'Choose a resume first.' }, { status: 400 });

    const context = `ROLE: ${app.jobTitle}${app.company ? ` at ${app.company}` : ''}
<job_description>
${jd.slice(0, 5000)}
</job_description>

<resume>
${resumeText.slice(0, 9000)}
</resume>`;

    const frontPrompt = `${context}

Return JSON:
{
  "pitch": "a 60-second answer to 'tell me about yourself' for this role, first person, about 120 words, using only resume facts",
  "whyCompany": "a short answer to 'why this company', grounded in the job description",
  "salaryApproach": ["3 to 4 steps for handling the salary question at the recruiter screen"],
  "impactStories": [{ "title": "...", "sourceLine": "one resume line copied verbatim", "talkingPoints": ["2 to 3 points"] }],
  "first90Days": ["4 to 5 steps for the first 90 days, tied to the job description"],
  "questionsToAsk": ["5 questions for the hiring manager, specific to this job"]
}
Give 3 impact stories.`;

    const deepPrompt = `${context}

Return JSON:
{
  "topics": [{ "topic": "...", "fromJob": "the phrase from the job description it comes from, copied verbatim", "questions": ["2 to 3 practice questions"] }],
  "stories": [{ "question": "a likely behavioral question", "sourceLine": "one resume line copied verbatim", "situation": "...", "task": "...", "action": "...", "result": "..." }]
}
Give 5 to 7 technical topics and 4 to 5 STAR stories, each story built on a different resume line.`;

    const company = app.company.trim();
    const [front, deep, everify, h1b] = await Promise.all([
      ask(frontPrompt, 3000, 'apply-prep-front'),
      ask(deepPrompt, 3500, 'apply-prep-deep'),
      company ? lookupEverify([company]).catch(() => null) : Promise.resolve(null),
      company ? lookupH1b([company]).catch(() => null) : Promise.resolve(null),
    ]);

    const dropped: string[] = [];
    // Numbers must come from the resume. Names may also come from the posting
    // and the company where that is not a claim of experience (a pitch says
    // "Stripe"); stories keep to names the resume itself contains.
    const nameSources = `${resumeText}\n${jd}\n${company}`;
    const grounded = (text: string, label: string, names = resumeText) => {
      const issue = groundingIssue(text, resumeText, names);
      if (issue) dropped.push(`${label}: ${issue}`);
      return !issue;
    };

    const stories: StarStory[] = objs(deep.stories)
      .map((s, i) => ({
        id: `story-${i + 1}`,
        question: str(s.question), sourceLine: str(s.sourceLine),
        situation: str(s.situation), task: str(s.task), action: str(s.action), result: str(s.result),
      }))
      .filter(s => s.question && s.sourceLine && containsLoose(resumeText, s.sourceLine))
      .filter(s => grounded([s.situation, s.task, s.action, s.result].join(' '), `story "${s.question}"`));

    const impactStories = objs(front.impactStories)
      .map(s => ({ title: str(s.title), sourceLine: str(s.sourceLine), talkingPoints: strs(s.talkingPoints, 4) }))
      .filter(s => s.title && containsLoose(resumeText, s.sourceLine))
      .filter(s => grounded(s.talkingPoints.join(' '), `impact story "${s.title}"`));

    const topics = objs(deep.topics)
      .map(t => ({ topic: str(t.topic), fromJob: str(t.fromJob), questions: strs(t.questions, 4) }))
      .filter(t => t.topic && t.fromJob && containsLoose(jd, t.fromJob));

    // The pitch and "why this company" may describe the job's stack, but any
    // sentence claiming a skill the resume does not show is taken out.
    const claimFree = (text: string, label: string) => {
      const r = dropUnbackedClaims(text, resumeText, pack.keywords, `${jd}\n${company}`);
      r.removed.forEach(s => dropped.push(`${label}: claims a skill the resume does not show: "${s}"`));
      return r.text;
    };
    const pitchText = claimFree(str(front.pitch), 'pitch');
    const pitch = pitchText && grounded(pitchText, 'pitch', nameSources) ? pitchText : '';
    // "Why this company" may draw on the posting as well as the resume, but no further.
    const whyCompany = claimFree(str(front.whyCompany), 'why this company');
    const whyIssue = groundingIssue(whyCompany, nameSources);
    if (whyIssue) dropped.push(`why this company: ${whyIssue}`);
    // Salary steps may only use figures the posting itself gives.
    const salaryApproach = strs(front.salaryApproach, 5).filter(s => !groundingIssue(s, jd) || !/\d/.test(s));
    if (dropped.length) console.log('apply-prep: removed by fact checks:', dropped);

    const prep: PrepPack = {
      generatedAt: new Date().toISOString(),
      recruiter: {
        pitch,
        whyCompany: whyIssue ? '' : whyCompany,
        salaryApproach,
        sponsorship: pack.authStage ? sponsorshipAnswer(pack.authStage) : null,
      },
      employerRecords: {
        everify: everify?.available ? everify.statuses[company] ?? null : null,
        everifySyncedAt: everify?.available ? everify.syncedAt : null,
        h1b: h1b?.histories[company] ?? null,
        h1bDataThrough: h1b?.pointer?.dataThrough ?? null,
      },
      technical: { topics },
      behavioral: { stories },
      hiringManager: { impactStories, first90Days: strs(front.first90Days, 6), questionsToAsk: strs(front.questionsToAsk, 6) },
      nextRoundFocus: pack.prep?.nextRoundFocus ?? null,
    };

    await checkAndIncrementUsage(userId, 'resumes');
    pack.prep = prep;
    return NextResponse.json({ success: true, pack: await savePack(uid, pack), removed: dropped.length });
  } catch (error) {
    console.error('❌ apply prep:', error);
    return NextResponse.json({ error: 'Could not build the prep pack. Please try again.' }, { status: 500 });
  }
}
