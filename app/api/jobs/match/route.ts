// app/api/jobs/match/route.ts
//
// POST { urls: string[] } (up to 6) -> { resume: boolean, results: { [url]: JobFit & { open } | null } }
// How each feed job fits the student's default resume (lib/jobs/fit.ts):
// skills in the posting found on the resume, and what the posting says about
// sponsorship, citizenship, clearance and years of experience. Postings are
// read from the employer's board and cached for a day.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { jobFit, type JobFit } from '@/lib/jobs/fit';
import { postingText } from '@/lib/jobs/posting-cache';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX = 6;

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;

  const body = await request.json().catch(() => null) as { urls?: unknown } | null;
  const urls = (Array.isArray(body?.urls) ? body!.urls : []).filter((u): u is string => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, MAX);
  if (!urls.length) return NextResponse.json({ error: 'urls is required' }, { status: 400 });

  const resumeText = await extractFileText(user.userId, 'resume').catch(() => null);
  const results: Record<string, (JobFit & { open: boolean }) | null> = {};

  // A few at a time: each may call an employer's job board.
  for (let i = 0; i < urls.length; i += 3) {
    await Promise.all(urls.slice(i, i + 3).map(async url => {
      const p = await postingText(url).catch(() => null);
      results[url] = p && p.description ? { ...jobFit(p.description, resumeText), open: p.open } : null;
    }));
  }
  return NextResponse.json({ resume: !!resumeText, results });
}
