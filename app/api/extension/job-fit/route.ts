// app/api/extension/job-fit/route.ts
//
// POST { company, title?, location?, description } ->
//   { success, resume, fit, facts, everify, h1b }
// The extension's LinkedIn banner (extension/banner.js): how the posting on
// screen fits the student's default resume, worked out the same way as the
// Jobs page (lib/jobs/fit.ts jobFit, no model): the skills the posting names
// and which are on the resume, what it says about sponsorship, citizenship,
// clearance and years, and the pay, type and workplace it states. Plus the
// employer's E-Verify status and H-1B history from our USCIS copies.
// Everything is read from the posting text and public records; nothing is
// estimated.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { cleanResumeText } from '@/lib/ai/claude';
import { jobFit } from '@/lib/jobs/fit';
import { postingFacts } from '@/lib/jobs/posting-facts';
import { lookupEverify } from '@/lib/jobs/everify';
import { lookupH1b } from '@/lib/jobs/h1b';
import { recordExtensionEvent } from '@/lib/extension/telemetry';

export const runtime = 'nodejs';
export const maxDuration = 20;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const user = await getAuthedUser(request);
    if (!user) {
      recordExtensionEvent(request, null, 'job_fit', { detail: { ok: false, error: 'unauthorized' } });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = user.supabaseUserId;
    // One call per job viewed, and students click through lists fast.
    const limited = await applyRateLimit(request, user.supabaseUserId, 'light');
    if (limited) {
      recordExtensionEvent(request, userId, 'job_fit', { detail: { ok: false, error: 'rate_limited' } });
      return limited;
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const company = str(body.company, 200);
    const description = str(body.description, 20000);
    const known = company && company !== 'Unknown Company';
    // With neither, there is nothing to look up. A description alone gives
    // the fit; a company alone gives E-Verify and H-1B.
    if (!description && !known) return NextResponse.json({ error: 'company or description is required' }, { status: 400 });

    const [raw, ev, h1b] = await Promise.all([
      extractFileText(user.userId, 'resume').catch(() => null),
      known ? lookupEverify([company]).catch(() => null) : Promise.resolve(null),
      known ? lookupH1b([company]).catch(() => null) : Promise.resolve(null),
    ]);
    const resumeText = raw ? cleanResumeText(raw) : null;
    const fit = jobFit(description, resumeText);

    recordExtensionEvent(request, userId, 'job_fit', {
      detail: { ok: true, has_resume: !!resumeText, fit_score: fit.score, skills_named: fit.skills.length, flags: fit.flags.length },
    });
    return NextResponse.json({
      success: true,
      resume: !!resumeText,
      fit,
      facts: postingFacts(str(body.title, 300), str(body.location, 200), description),
      everify: ev?.available ? { status: ev.statuses[company] ?? null, syncedAt: ev.syncedAt } : null,
      h1b: h1b?.pointer ? { history: h1b.histories[company] ?? null, years: h1b.pointer.years, dataThrough: h1b.pointer.dataThrough } : null,
    });
  } catch (error) {
    console.error('❌ extension job-fit:', error);
    recordExtensionEvent(request, userId, 'job_fit', { detail: { ok: false, error: 'server_error' } });
    return NextResponse.json({ error: 'Could not read this job right now' }, { status: 500 });
  }
}
