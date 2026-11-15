// lib/jobs/logos.ts
//
// Company logos for job cards. A logo needs the company's own domain, which a
// job link on an ATS (boards.greenhouse.io/zoox) does not give. So:
//   1. a job link on the company's own site (careers.pantheon.io) gives it,
//   2. otherwise the name is looked up, and a match is kept only when the
//      names agree exactly (after dropping "Inc", "Corporation" and the like):
//      a wrong logo is worse than the monogram the cards fall back to.
// Results are cached in Redis for 30 days, misses for 7.

import { redis } from '@/lib/redis/redis-client';

const ATS_HOST = /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|myworkdaysite\.com|workday\.com|icims\.com|jobvite\.com|smartrecruiters\.com|taleo\.net|successfactors\.(com|eu)|bamboohr\.com|recruitee\.com|applytojob\.com|workable\.com|breezy\.hr|teamtailor\.com|personio\.(de|com)|pinpointhq\.com|rippling\.com|dover\.com|jobscore\.com|paylocity\.com|paycomonline\.net|adp\.com|ultipro\.com|dayforcehcm\.com|oraclecloud\.com|indeed\.com|linkedin\.com|wellfound\.com|join\.com|polymer\.co|comeet\.com)$/i;
const SUBDOMAIN = /^(www|careers?|jobs?|apply|recruiting|talent|hire|work|join|en|us)\./i;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

const POSITIVE_TTL = 30 * 24 * 60 * 60;
const NEGATIVE_TTL = 7 * 24 * 60 * 60;

/** "Zoox, Inc." -> "zoox"; "Virta Health Corporation" -> "virta health". */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(inc|incorporated|corp|corporation|co|company|llc|l\.l\.c|ltd|limited|plc|lp|llp|gmbh|pbc|holdings?|group)\b\.?/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The company's own domain from a job link, when the link is not on an ATS. */
export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    let host = new URL(url).hostname.toLowerCase();
    if (ATS_HOST.test(host)) return null;
    while (SUBDOMAIN.test(host) && host.split('.').length > 2) host = host.replace(SUBDOMAIN, '');
    return DOMAIN.test(host) ? host : null;
  } catch {
    return null;
  }
}

async function lookupByName(company: string): Promise<string | null> {
  const norm = normalizeCompany(company);
  if (!norm) return null;
  try {
    const r = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(norm)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const list = (await r.json()) as { name?: string; domain?: string }[];
    const hit = list.find(x => x.name && x.domain && normalizeCompany(x.name) === norm);
    return hit?.domain && DOMAIN.test(hit.domain) ? hit.domain.toLowerCase() : null;
  } catch {
    return null;
  }
}

const key = (norm: string) => `logo:v1:${norm}`;

/** company -> domain (or null) for up to 40 companies, cached. */
export async function resolveDomains(items: { company: string; url?: string | null }[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  const todo: { company: string; norm: string }[] = [];
  for (const { company, url } of items.slice(0, 40)) {
    if (!company || company in out) continue;
    const fromUrl = domainFromUrl(url);
    if (fromUrl) { out[company] = fromUrl; continue; }
    out[company] = null;
    todo.push({ company, norm: normalizeCompany(company) });
  }
  if (!todo.length) return out;

  const cached = redis ? await Promise.all(todo.map(t => redis!.get<string>(key(t.norm)).catch(() => null))) : todo.map(() => null);
  const misses: { company: string; norm: string }[] = [];
  todo.forEach((t, i) => {
    const c = cached[i];
    if (c === null || c === undefined) misses.push(t);
    else out[t.company] = c === '' ? null : c;
  });

  // A few lookups at a time; each is a small request.
  for (let i = 0; i < misses.length; i += 6) {
    await Promise.all(misses.slice(i, i + 6).map(async t => {
      const domain = await lookupByName(t.company);
      out[t.company] = domain;
      if (redis) await redis.setex(key(t.norm), domain ? POSITIVE_TTL : NEGATIVE_TTL, domain ?? '').catch(() => {});
    }));
  }
  return out;
}

export const isDomain = (d: string) => DOMAIN.test(d) && d.length <= 100;
