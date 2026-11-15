// app/api/onboarding/parse-resume/route.ts
//
// POST -> { details }
// Reads the student's default resume and returns the contact, education and
// skills details written in it, for them to check in onboarding before
// anything is saved. Only what the resume states is returned: a field the
// resume does not have comes back empty, never guessed.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { anthropic, cachedSystem, cleanResumeText, createMessage, logUsage, stripDashesDeep } from '@/lib/ai/claude';
import { askJson } from '@/lib/applications/model-json';

export const runtime = 'nodejs';
export const maxDuration = 45;

const SYSTEM = `You copy facts from a resume into fields. You never infer, guess or complete anything.

Rules:
- Copy each value exactly as the resume writes it. If the resume does not state it, use "".
- name: the person's full name at the top.
- phone, email, linkedIn, github, website: only if written in the resume. URLs as written.
- city, state: the person's own location from the contact line, not an employer's or school's location.
- headline: a role title the resume itself states as the person's target or current title; otherwise "".
- education: each school with degree (e.g. "Master of Science"), field (e.g. "Data Analytics Engineering"), gpa if written, and year = the graduation or expected graduation year as written (YYYY). current = true only if the dates say it is ongoing or expected in the future.
- skills: the skills listed in the resume's skills section, comma-separated, at most 30, as written.

CRITICAL: Return ONLY JSON. No markdown. Start with { end with }. No em dashes or en dashes.`;

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: NextRequest) {
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'medium');
  if (limited) return limited;

  const raw = await extractFileText(user.userId, 'resume');
  if (!raw || raw.trim().length < 80) {
    return NextResponse.json({ error: 'We could not read text from that PDF. You can fill in the details yourself.' }, { status: 422 });
  }
  const text = cleanResumeText(raw).slice(0, 10000);

  try {
    const out = stripDashesDeep(await askJson(async () => {
      const response = await createMessage({
        max_tokens: 1500, system: cachedSystem(SYSTEM),
        messages: [{ role: 'user', content: `<resume>\n${text}\n</resume>\n\nReturn JSON: { "name": "", "phone": "", "email": "", "city": "", "state": "", "linkedIn": "", "github": "", "website": "", "headline": "", "education": [{ "school": "", "degree": "", "field": "", "gpa": "", "year": "", "current": false }], "skills": "" }` }],
      });
      logUsage('onboarding-parse-resume', response);
      return response;
    }, 'onboarding-parse-resume')) as Record<string, unknown>;

    // Keep a value only if it appears in the resume text, so nothing the
    // model made up reaches the form. Compared without spaces and case.
    const flat = text.toLowerCase().replace(/\s+/g, '');
    const inResume = (v: string) => !v || flat.includes(v.toLowerCase().replace(/\s+/g, ''));
    const keep = (v: unknown, max: number) => { const x = s(v, max); return inResume(x) ? x : ''; };
    const digits = (v: string) => v.replace(/\D/g, '');
    const phone = s(out.phone, 40);

    const education = (Array.isArray(out.education) ? out.education : []).slice(0, 4).map((e: Record<string, unknown>) => ({
      school: keep(e.school, 160), degree: keep(e.degree, 120), field: keep(e.field, 120),
      gpa: keep(e.gpa, 10), year: keep(e.year, 10), current: e.current === true,
    })).filter(e => e.school);

    return NextResponse.json({
      details: {
        name: keep(out.name, 120),
        phone: phone && text.replace(/\D/g, '').includes(digits(phone)) ? phone : '',
        city: keep(out.city, 80), state: keep(out.state, 80),
        linkedIn: keep(out.linkedIn, 300), github: keep(out.github, 300), website: keep(out.website, 300),
        headline: keep(out.headline, 120),
        education,
        skills: s(out.skills, 1000).split(',').map(x => x.trim()).filter(x => x && inResume(x)).slice(0, 30).join(', '),
      },
    });
  } catch (e) {
    console.error('❌ onboarding parse-resume:', e);
    return NextResponse.json({ error: 'Could not read your resume right now. You can fill in the details yourself.' }, { status: 500 });
  }
}
