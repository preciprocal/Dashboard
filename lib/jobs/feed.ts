// lib/jobs/feed.ts
//
// The dashboard's job feed. Reads what scripts/everify/jobs-sync.mjs writes to
// the Storage bucket `jobs` every 6 hours: live postings from employers' own
// Greenhouse, Lever and Ashby boards, posted in the last 60 days, in the US,
// with reposts merged, each tagged with the employer's E-Verify state and H-1B
// approvals from our USCIS copies.
//
// On top of that the dashboard is stricter (see filterJobs):
//   - 30 days by default rather than 60,
//   - evergreen and talent-pool listings ("Expression of interest", "Join our
//     talent network") are never shown: they collect resumes, they are not
//     openings,
//   - and when a student applies, fetchPosting re-reads that one posting from
//     the employer's job-board API, so a role that closed since the last sync
//     is caught before anything is saved.
// None of this proves an employer intends to hire, so the UI lists the checks
// instead of promising "no ghost jobs".

import { gunzipSync } from 'node:zlib';
import { titleMatchesAny } from '@/lib/jobs/roles';
import { supabaseAdmin } from '@/supabase/admin';

const BUCKET = 'jobs';
const TTL_MS = 30 * 60 * 1000;
const UA = 'PreciprocalJobs/1.0 (+https://preciprocal.com)';

export type JobLevel = 'intern' | 'early' | 'mid' | 'senior';
export type JobFamily = 'software' | 'data' | 'hardware' | 'product' | 'business' | 'other';
export type EverifyState = 'enrolled' | 'ending' | 'ended' | 'not-found';

/** One posting, as stored by jobs-sync.mjs (short keys keep the file small). */
export interface FeedJob {
  t: string;           // title
  c: string;           // company
  k: string;           // employer key, into boards.json
  l: string;           // location
  u: string;           // the employer's posting URL
  p: string;           // first published, YYYY-MM-DD
  f: JobFamily;
  v: JobLevel;
  e: EverifyState;
  h: [number, number] | null; // H-1B [approvals, new employment] in h1bYear
}

interface Board { ats: 'greenhouse' | 'lever' | 'ashby'; slug: string; key: string }

interface Feed {
  version: string;
  syncedAt: string;
  h1bYear: string | null;
  jobs: FeedJob[];
  boards: Map<string, Board>;
  loadedAt: number;
}

let cached: Feed | null = null;
let loading: Promise<Feed | null> | null = null;

async function readText(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return data.text();
}

async function load(): Promise<Feed | null> {
  const pointerText = await readText('current.json');
  if (!pointerText) return null;
  const pointer = JSON.parse(pointerText) as { version: string; syncedAt: string };
  if (cached && cached.version === pointer.version) {
    cached.loadedAt = Date.now();
    return cached;
  }
  const [{ data: gz, error }, boardsText] = await Promise.all([
    supabaseAdmin.storage.from(BUCKET).download(`v/${pointer.version}/jobs.json.gz`),
    readText('boards.json'),
  ]);
  if (error || !gz) return null;
  const doc = JSON.parse(gunzipSync(Buffer.from(await gz.arrayBuffer())).toString('utf8')) as { jobs: FeedJob[]; h1bYear?: string | null };
  const boards = new Map<string, Board>();
  for (const b of (boardsText ? (JSON.parse(boardsText) as { boards: Board[] }).boards : [])) boards.set(b.key, b);
  cached = { version: pointer.version, syncedAt: pointer.syncedAt, h1bYear: doc.h1bYear ?? null, jobs: doc.jobs, boards, loadedAt: Date.now() };
  return cached;
}

/** The current feed, cached per server instance and re-checked every 30 minutes. */
export async function getFeed(): Promise<Feed | null> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  loading ??= load().finally(() => { loading = null; });
  return loading;
}

// ─── Filtering ───────────────────────────────────────────────────────────────

/** Titles that collect applications without being one opening. */
export const EVERGREEN = /\b(general application|open application|expression of interest|talent (community|network|pool)|future opportunit(y|ies)|don'?t see (a|the|your) (role|job|position)|evergreen|always (open|hiring)|pipeline (role|requisition)|resume drop|submit your resume)\b/i;

export interface FeedQuery {
  q?: string;
  location?: string;
  levels?: JobLevel[];
  families?: JobFamily[];
  days?: number;
  everify?: boolean;
  h1b?: boolean;
  remote?: boolean;
  /** With a location: also keep remote roles anywhere. */
  orRemote?: boolean;
  /** Keep titles that match any of these roles (lib/jobs/roles.ts). */
  roles?: string[];
}

const daysAgo = (date: string) => Math.floor((Date.now() - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);

export function filterJobs(jobs: FeedJob[], q: FeedQuery): FeedJob[] {
  const words = (q.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const loc = (q.location ?? '').toLowerCase().trim();
  const days = Math.min(Math.max(q.days ?? 30, 1), 60);
  return jobs.filter(j => {
    if (EVERGREEN.test(j.t)) return false;
    if (daysAgo(j.p) > days) return false;
    if (q.levels?.length && !q.levels.includes(j.v)) return false;
    if (q.families?.length && !q.families.includes(j.f)) return false;
    if (q.everify && j.e !== 'enrolled' && j.e !== 'ending') return false;
    if (q.h1b && !(j.h && j.h[0] > 0)) return false;
    if (q.remote && !/remote/i.test(j.l)) return false;
    if (loc && !j.l.toLowerCase().includes(loc) && !(q.orRemote && /remote/i.test(j.l))) return false;
    if (q.roles?.length && !titleMatchesAny(j.t, q.roles)) return false;
    if (words.length) {
      const hay = `${j.t} ${j.c}`.toLowerCase();
      if (!words.every(w => hay.includes(w))) return false;
    }
    return true;
  });
}

// ─── One posting, live ───────────────────────────────────────────────────────

export interface LivePosting {
  open: boolean;
  title: string;
  location: string;
  description: string;
}

async function getJson(url: string): Promise<{ status: number; body: unknown }> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  return { status: r.status, body: r.ok ? await r.json() : null };
}

/** The posting's HTML as readable text, with bullets and paragraphs kept. */
export function htmlToText(html: string): string {
  const decoded = html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');
  return decoded
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|ul|ol|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Re-reads one posting from the employer's job board. `open: false` when the
 * board no longer lists it. Only the fixed ATS API hosts are called, with the
 * board slug from boards.json, never a URL the client supplies.
 */
export async function fetchPosting(job: FeedJob, board: Board): Promise<LivePosting> {
  const closed: LivePosting = { open: false, title: job.t, location: job.l, description: '' };
  const url = new URL(job.u);
  const slug = encodeURIComponent(board.slug);

  if (board.ats === 'greenhouse') {
    let id = url.searchParams.get('gh_jid') ?? url.pathname.match(/\/jobs\/(\d+)/)?.[1] ?? null;
    if (!id) {
      // A custom careers domain: find the posting in the board's own list.
      const list = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
      const hit = ((list.body as { jobs?: { id: number; absolute_url: string }[] } | null)?.jobs ?? []).find(x => x.absolute_url === job.u);
      if (!hit) return closed;
      id = String(hit.id);
    }
    const r = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${encodeURIComponent(id)}`);
    const b = r.body as { title?: string; location?: { name?: string }; content?: string } | null;
    if (r.status !== 200 || !b) return closed;
    return { open: true, title: b.title ?? job.t, location: b.location?.name ?? job.l, description: htmlToText(b.content ?? '') };
  }

  if (board.ats === 'lever') {
    const id = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const r = await getJson(`https://api.lever.co/v0/postings/${slug}/${encodeURIComponent(id)}`);
    const b = r.body as { text?: string; categories?: { location?: string }; descriptionPlain?: string; lists?: { text: string; content: string }[]; additionalPlain?: string } | null;
    if (r.status !== 200 || !b) return closed;
    const lists = (b.lists ?? []).map(l => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
    return { open: true, title: b.text ?? job.t, location: b.categories?.location ?? job.l, description: [b.descriptionPlain, lists, b.additionalPlain].filter(Boolean).join('\n\n').trim() };
  }

  // Ashby publishes the whole board in one document.
  const r = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  const jobs = (r.body as { jobs?: { jobUrl: string; title: string; location: string; descriptionPlain?: string; isListed?: boolean }[] } | null)?.jobs ?? [];
  const hit = jobs.find(x => x.jobUrl === job.u && x.isListed !== false);
  if (!hit) return closed;
  return { open: true, title: hit.title, location: hit.location ?? job.l, description: (hit.descriptionPlain ?? '').trim() };
}
