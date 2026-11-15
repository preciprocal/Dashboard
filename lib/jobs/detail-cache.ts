// lib/jobs/detail-cache.ts
//
// The job details panel's data (app/api/jobs/detail), requested once per job
// and kept for the page's life. Cards start the request when the pointer
// rests on them, so the panel usually opens already filled.
const cache = new Map<string, { at: number; p: Promise<unknown> }>();
const TTL_MS = 10 * 60 * 1000;

export function loadDetail<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p as Promise<T>;
  const p = fetch(`/api/jobs/detail?url=${encodeURIComponent(url)}`).then(async r => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Could not load this job');
    return j as T;
  });
  // A failed request is not kept, so opening the job again retries.
  p.catch(() => cache.delete(url));
  cache.set(url, { at: Date.now(), p });
  return p;
}

/** Starts loading a job's details, ignoring the result. */
export function prefetchDetail(url: string) {
  loadDetail(url).catch(() => {});
}
