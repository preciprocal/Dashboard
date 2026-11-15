// app/api/jobs/fit/route.ts
//
// POST { url } -> { fit: { strengths, gaps, pitch } }
// Why a feed job fits the student, in plain words, grounded in the two texts:
// every strength quotes a line from their resume and every gap quotes the
// posting. Anything the model says that cannot be found there is dropped.
// Cached per student, job and resume for a week.
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { redis } from '@/lib/redis/redis-client';
import { anthropic, cachedSystem, cleanResumeText, createMessage, logUsage, stripDashesDeep, LANGUAGE_MATCH_INSTRUCTION } from '@/lib/ai/claude';
import { askJson } from '@/lib/applications/model-json';
import { containsLoose, groundingIssue } from '@/lib/applications/truthful-tailor';
import { postingText } from '@/lib/jobs/posting-cache';

export const runtime = 'nodejs';
export const maxDuration = 45;

const SYSTEM = `You explain to a student how their resume fits one job posting. You never invent experience.

Write to the student directly as "you" ("You have built..."). Never write about them in the third person and never use he, she, him or her.

Return:
- strengths: up to 4. Each "point" is one short sentence on how the student meets something the posting asks for. "evidence" is copied EXACTLY from the resume: the bullet or line that shows it.
- gaps: up to 3. Each "requirement" is copied EXACTLY from the posting: something it asks for that the resume does not show. "advice" is one short, honest sentence on how to address it (a project to mention, a skill to learn, how to talk about it). Never suggest claiming something the resume does not show.
- pitch: two sentences the student could say about why they fit, using only facts from the resume.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }. No em dashes or en dashes.${LANGUAGE_MATCH_INSTRUCTION}`;

export interface FitExplanation {
  strengths: { point: string; evidence: string }[];
  gaps: { requirement: string; advice: string }[];
  pitch: string;
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: NextRequest) {
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'medium');
  if (limited) return limited;

  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  const raw = await extractFileText(user.userId, 'resume').catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Add your default resume in Settings to see how you fit.', code: 'NO_RESUME' }, { status: 400 });
  const resume = cleanResumeText(raw).slice(0, 10000);
  const posting = await postingText(url).catch(() => null);
  if (!posting?.description) return NextResponse.json({ error: 'Could not read this posting right now.' }, { status: 502 });
  const jd = posting.description.slice(0, 8000);

  const cacheKey = `jobfit:v2:${user.userId}:${createHash('sha1').update(url + resume).digest('hex')}`;
  if (redis) {
    const hit = await redis.get<FitExplanation>(cacheKey).catch(() => null);
    if (hit) return NextResponse.json({ fit: hit });
  }

  try {
    const out = stripDashesDeep(await askJson(async () => {
      const response = await createMessage({
        max_tokens: 1500, system: cachedSystem(SYSTEM),
        messages: [{ role: 'user', content: `<posting title="${posting.title.replace(/"/g, "'")}">\n${jd}\n</posting>\n\n<resume>\n${resume}\n</resume>\n\nReturn JSON: { "strengths": [{ "point": "", "evidence": "" }], "gaps": [{ "requirement": "", "advice": "" }], "pitch": "" }` }],
      });
      logUsage('job-fit', response);
      return response;
    }, 'job-fit')) as { strengths?: unknown; gaps?: unknown; pitch?: unknown };

    // Keep only what the two texts back up.
    const fit: FitExplanation = {
      strengths: (Array.isArray(out.strengths) ? out.strengths : []).map((x: Record<string, unknown>) => ({ point: s(x.point, 240), evidence: s(x.evidence, 400) }))
        .filter(x => x.point && x.evidence && containsLoose(resume, x.evidence) && !groundingIssue(x.point, resume, `${resume}\n${jd}`)).slice(0, 4),
      gaps: (Array.isArray(out.gaps) ? out.gaps : []).map((x: Record<string, unknown>) => ({ requirement: s(x.requirement, 300), advice: s(x.advice, 240) }))
        .filter(x => x.requirement && containsLoose(jd, x.requirement)).slice(0, 3),
      pitch: '',
    };
    const pitch = s(out.pitch, 500);
    fit.pitch = pitch && !groundingIssue(pitch, resume, `${resume}\n${jd}`) ? pitch : '';

    if (redis) await redis.set(cacheKey, fit, { ex: 7 * 24 * 60 * 60 }).catch(() => {});
    return NextResponse.json({ fit });
  } catch (e) {
    console.error('❌ job fit:', e);
    return NextResponse.json({ error: 'Could not explain the fit right now. Please try again.' }, { status: 500 });
  }
}
