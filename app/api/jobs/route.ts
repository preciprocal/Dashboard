// app/api/jobs/route.ts
//
// GET ?q=&location=&levels=intern,early&families=data&days=30&everify=1&h1b=1&remote=1&page=1
//   -> { syncedAt, h1bYear, total, page, pageSize, jobs }
// The dashboard job feed (lib/jobs/feed.ts), filtered and paged on the server
// so the browser never downloads all 30,000+ postings.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { filterJobs, getFeed, type JobFamily, type JobLevel } from '@/lib/jobs/feed';

export const runtime = 'nodejs';

const PAGE_SIZE = 25;
const LEVELS: JobLevel[] = ['intern', 'early', 'mid', 'senior'];
const FAMILIES: JobFamily[] = ['software', 'data', 'hardware', 'product', 'business', 'other'];

const list = <T extends string>(v: string | null, allowed: T[]) =>
  (v ?? '').split(',').filter((x): x is T => (allowed as string[]).includes(x));

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const feed = await getFeed();
    if (!feed) return NextResponse.json({ error: 'The job feed is not available right now.' }, { status: 503 });

    const sp = new URL(request.url).searchParams;
    const matches = filterJobs(feed.jobs, {
      q: sp.get('q')?.slice(0, 100),
      location: sp.get('location')?.slice(0, 60),
      levels: list(sp.get('levels'), LEVELS),
      families: list(sp.get('families'), FAMILIES),
      days: Number(sp.get('days')) || 30,
      everify: sp.get('everify') === '1',
      h1b: sp.get('h1b') === '1',
      remote: sp.get('remote') === '1',
    });
    const page = Math.max(1, Math.min(200, Number(sp.get('page')) || 1));
    return NextResponse.json({
      syncedAt: feed.syncedAt,
      h1bYear: feed.h1bYear,
      total: matches.length,
      page,
      pageSize: PAGE_SIZE,
      jobs: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    });
  } catch (error) {
    console.error('❌ jobs feed:', error);
    return NextResponse.json({ error: 'Could not load jobs' }, { status: 500 });
  }
}
