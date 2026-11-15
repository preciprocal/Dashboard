// lib/jobs/posting-cache.ts
//
// A feed posting's text, read from the employer's job board and kept for a
// day, so scoring a page of jobs does not call every board each time.
import { createHash } from 'node:crypto';
import { redis } from '@/lib/redis/redis-client';
import { fetchPosting, getFeed } from '@/lib/jobs/feed';

const TTL_SECONDS = 24 * 60 * 60;
const key = (url: string) => `posting:v1:${createHash('sha1').update(url).digest('hex')}`;

export interface CachedPosting { open: boolean; title: string; description: string }

// Requests already under way on this server, so a warm-up and a card asking
// for the same posting share one call to the job board.
const inFlight = new Map<string, Promise<CachedPosting | null>>();

/** The posting for a feed URL, or null when it is not in the feed. */
export function postingText(url: string): Promise<CachedPosting | null> {
  const running = inFlight.get(url);
  if (running) return running;
  const p = readPosting(url).finally(() => inFlight.delete(url));
  inFlight.set(url, p);
  return p;
}

/** Reads the first postings of a page into the cache, a few at a time. */
export async function warmPostings(urls: string[]) {
  for (let i = 0; i < urls.length; i += 5) {
    await Promise.all(urls.slice(i, i + 5).map(u => postingText(u).catch(() => null)));
  }
}

async function readPosting(url: string): Promise<CachedPosting | null> {
  if (redis) {
    const hit = await redis.get<CachedPosting>(key(url)).catch(() => null);
    if (hit) return hit;
  }
  const feed = await getFeed();
  const job = feed?.jobs.find(j => j.u === url);
  const board = job ? feed!.boards.get(job.k) : undefined;
  if (!job || !board) return null;
  const live = await fetchPosting(job, board).catch(() => null);
  if (!live) return null;
  const out: CachedPosting = { open: live.open, title: live.title, description: live.description.slice(0, 20000) };
  if (redis) await redis.set(key(url), out, { ex: TTL_SECONDS }).catch(() => {});
  return out;
}
