// app/api/jobs/match/route.ts
//
// POST { urls: string[] } (up to 6) -> { resume: boolean, results: { [url]: JobFit & { open } | null } }
// How each feed job fits the student's default resume (lib/jobs/fit.ts):
// skills in the posting found on the resume, and what the posting says about
// sponsorship, citizenship, clearance and years of experience, and the pay,
// job type and workplace it states (lib/jobs/posting-facts.ts). Postings are
// read from the employer's board and cached for a day.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { jobFit, type JobFit } from '@/lib/jobs/fit';
import { postingText } from '@/lib/jobs/posting-cache';
import { getFeed } from '@/lib/jobs/feed';
import { postingFacts, type PostingFacts } from '@/lib/jobs/posting-facts';

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
  const results: Record<string, (JobFit & { open: boolean; facts: PostingFacts }) | null> = {};
  const feed = await getFeed().catch(() => null);

  // All at once (at most six): each may call an employer's job board.
  {
    await Promise.all(urls.map(async url => {
      const p = await postingText(url).catch(() => null);
      const job = feed?.jobs.find(j => j.u === url);
      results[url] = p && p.description
        ? { ...jobFit(p.description, resumeText), open: p.open, facts: postingFacts(p.title || job?.t || '', job?.l ?? '', p.description) }
        : null;
    }));
  }
  return NextResponse.json({ resume: !!resumeText, results });
}
