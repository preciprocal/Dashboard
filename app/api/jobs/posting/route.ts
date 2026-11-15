// app/api/jobs/posting/route.ts
//
// POST { url } -> { open, company, title, location, jobUrl, description }
// Before a student applies to a feed job, re-reads that posting from the
// employer's own job board. A role that closed since the last sync comes back
// open: false, so it is never added to the tracker. The url must be one in the
// feed; it is matched, never fetched.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { fetchPosting, getFeed } from '@/lib/jobs/feed';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rateLimited = await applyRateLimit(request, authedUser.userId, 'medium');
    if (rateLimited) return rateLimited;

    const { url } = await request.json() as { url?: string };
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

    const feed = await getFeed();
    if (!feed) return NextResponse.json({ error: 'The job feed is not available right now.' }, { status: 503 });
    const job = feed.jobs.find(j => j.u === url);
    if (!job) return NextResponse.json({ error: 'That job is no longer in the feed.' }, { status: 404 });
    const board = feed.boards.get(job.k);
    if (!board) return NextResponse.json({ error: 'Could not reach this employer\'s job board.' }, { status: 502 });

    const live = await fetchPosting(job, board);
    return NextResponse.json({
      open: live.open,
      company: job.c,
      title: live.title,
      location: live.location,
      jobUrl: job.u,
      description: live.description.slice(0, 12000),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ jobs posting:', error);
    return NextResponse.json({ error: 'Could not check this posting. Try again.' }, { status: 502 });
  }
}
