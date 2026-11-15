// app/api/jobs/detail/route.ts
//
// GET ?url=<feed posting url> -> everything the job details view shows:
//   job        the feed record
//   posting    { open, title, sections } read from the employer's board (cached a day)
//   facts      pay, job type and workplace the posting states
//   fit        skill match against the default resume, and what the posting
//              says about sponsorship, citizenship, clearance and experience
//   company    E-Verify status, H-1B history by fiscal year, and the
//              employer's other open roles in the feed
// The url must be one in the feed; it is matched, never fetched.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { EVERGREEN, getFeed } from '@/lib/jobs/feed';
import { postingText } from '@/lib/jobs/posting-cache';
import { jobFit } from '@/lib/jobs/fit';
import { postingFacts, postingSections } from '@/lib/jobs/posting-facts';
import { lookupEverify } from '@/lib/jobs/everify';
import { lookupH1b, H1B_HUB_URL, type H1bHistory } from '@/lib/jobs/h1b';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;

  const url = new URL(request.url).searchParams.get('url') ?? '';
  const feed = await getFeed();
  if (!feed) return NextResponse.json({ error: 'The job feed is not available right now.' }, { status: 503 });
  const job = feed.jobs.find(j => j.u === url);
  if (!job) return NextResponse.json({ error: 'This job is no longer in the feed.' }, { status: 404 });

  const [posting, resume, everify, h1b] = await Promise.all([
    postingText(url).catch(() => null),
    extractFileText(user.userId, 'resume').catch(() => null),
    lookupEverify([job.c]).catch(() => null),
    lookupH1b([job.c]).catch(() => ({ histories: {} as Record<string, H1bHistory | null>, pointer: null })),
  ]);
  const text = posting?.description ?? '';

  const others = feed.jobs
    .filter(j => j.k === job.k && j.u !== job.u && !EVERGREEN.test(j.t))
    .sort((a, b) => b.p.localeCompare(a.p));

  return NextResponse.json({
    job,
    h1bYear: feed.h1bYear,
    posting: posting ? { open: posting.open, title: posting.title || job.t, sections: postingSections(text) } : null,
    facts: text ? postingFacts(posting?.title || job.t, job.l, text) : null,
    fit: text ? jobFit(text, resume) : null,
    hasResume: !!resume,
    company: {
      name: job.c,
      everify: everify?.available ? everify.statuses[job.c] ?? null : null,
      everifySyncedAt: everify?.syncedAt ?? null,
      h1b: h1b.histories[job.c] ?? null,
      h1bDataThrough: h1b.pointer?.dataThrough ?? null,
      h1bSource: H1B_HUB_URL,
      openRoles: others.length,
      otherRoles: others.slice(0, 8),
    },
  });
}
