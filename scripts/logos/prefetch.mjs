// scripts/logos/prefetch.mjs
//
// Fills the Storage bucket `logos` with every job-feed company's brand logo
// from logo.dev, once, so the app serves them from our own copy and the free
// plan's request limit is not spent on page views (lib/jobs/logo-store.ts).
//
//   node scripts/logos/prefetch.mjs [--limit N] [--dry]
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOGO_DEV_TOKEN
// and, to share company domains with the app, UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN (read from .env.local when not in the environment).
// Domains come the same way the app finds them (lib/jobs/logos.ts): from a
// job link on the company's own site, else by exact name match. Logos already
// stored, and domains logo.dev recently had none for, are skipped, so a rerun
// only fetches what is new.
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';

const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOGO_DEV_TOKEN, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !LOGO_DEV_TOKEN) {
  console.error('Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and LOGO_DEV_TOKEN');
  process.exit(1);
}
const args = process.argv.slice(2);
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const DRY = args.includes('--dry');
const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// Two at a time with a short pause between requests, under logo.dev's burst limit.
const PAUSE_MS = 400;

// ─── Same rules as lib/jobs/logos.ts ─────────────────────────────────────────
const ATS_HOST = /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|myworkdaysite\.com|workday\.com|icims\.com|jobvite\.com|smartrecruiters\.com|taleo\.net|successfactors\.(com|eu)|bamboohr\.com|recruitee\.com|applytojob\.com|workable\.com|breezy\.hr|teamtailor\.com|personio\.(de|com)|pinpointhq\.com|rippling\.com|dover\.com|jobscore\.com|paylocity\.com|paycomonline\.net|adp\.com|ultipro\.com|dayforcehcm\.com|oraclecloud\.com|indeed\.com|linkedin\.com|wellfound\.com|join\.com|polymer\.co|comeet\.com)$/i;
const SUBDOMAIN = /^(www|careers?|jobs?|apply|recruiting|talent|hire|work|join|en|us)\./i;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const normalizeCompany = (name) => name.toLowerCase().replace(/&/g, ' and ')
  .replace(/\b(inc|incorporated|corp|corporation|co|company|llc|l\.l\.c|ltd|limited|plc|lp|llp|gmbh|pbc|holdings?|group)\b\.?/g, ' ')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function domainFromUrl(url) {
  try {
    let host = new URL(url).hostname.toLowerCase();
    if (ATS_HOST.test(host)) return null;
    while (SUBDOMAIN.test(host) && host.split('.').length > 2) host = host.replace(SUBDOMAIN, '');
    return DOMAIN.test(host) ? host : null;
  } catch { return null; }
}

const redis = async (cmd) => {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  const r = await fetch(UPSTASH_REDIS_REST_URL, { method: 'POST', headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }, body: JSON.stringify(cmd) }).catch(() => null);
  return r && r.ok ? (await r.json()).result : null;
};

async function domainByName(company) {
  const norm = normalizeCompany(company);
  if (!norm) return null;
  const cached = await redis(['GET', `logo:v1:${norm}`]);
  if (cached !== null && cached !== undefined) return cached || null;
  let domain = null;
  try {
    const r = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(norm)}`, { signal: AbortSignal.timeout(6000) });
    const list = r.ok ? await r.json() : [];
    const hit = list.find(x => x.name && x.domain && normalizeCompany(x.name) === norm);
    domain = hit?.domain && DOMAIN.test(hit.domain) ? hit.domain.toLowerCase() : null;
  } catch { /* leave null */ }
  await redis(['SETEX', `logo:v1:${norm}`, domain ? 30 * 86400 : 7 * 86400, domain ?? '']);
  return domain;
}

// ─── Run ─────────────────────────────────────────────────────────────────────
const pointer = JSON.parse(await (await admin.storage.from('jobs').download('current.json')).data.text());
const gz = (await admin.storage.from('jobs').download(`v/${pointer.version}/jobs.json.gz`)).data;
const { jobs } = JSON.parse(gunzipSync(Buffer.from(await gz.arrayBuffer())).toString('utf8'));
const companies = new Map();
for (const j of jobs) if (!companies.has(j.c)) companies.set(j.c, j.u);
console.log(`${companies.size} companies in the feed (${jobs.length} jobs)`);

const { data: buckets } = await admin.storage.listBuckets();
if (!buckets?.some(b => b.name === 'logos') && !DRY) {
  const { error } = await admin.storage.createBucket('logos', { public: false });
  if (error) throw error;
  console.log('created bucket logos');
}

// What is already stored.
const stored = new Set();
for (let offset = 0; ; offset += 1000) {
  const { data } = await admin.storage.from('logos').list('', { limit: 1000, offset });
  if (!data?.length) break;
  for (const f of data) stored.add(f.name);
  if (data.length < 1000) break;
}
console.log(`${stored.size} files already in logos`);

const stats = { domains: 0, noDomain: 0, have: 0, fetched: 0, none: 0, failed: 0 };
const list = [...companies].slice(0, LIMIT);
const seen = new Set();
let i = 0;
async function worker() {
  while (i < list.length) {
    const [company, url] = list[i++];
    const domain = domainFromUrl(url) ?? await domainByName(company);
    if (!domain) { stats.noDomain++; continue; }
    if (seen.has(domain)) continue;
    seen.add(domain); stats.domains++;
    if (stored.has(`${domain}.png`) || stored.has(`${domain}.none`)) { stats.have++; continue; }
    if (DRY) continue;
    // logo.dev limits bursts: on 429 wait (Retry-After, or longer each time) and try again.
    let r = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      r = await fetch(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}&size=200&format=png&retina=true&fallback=404`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
      if (!r || r.status !== 429) break;
      const wait = (Number(r.headers.get('retry-after')) || 15 * (attempt + 1)) * 1000;
      console.log(`  rate limited, waiting ${Math.round(wait / 1000)}s`);
      await new Promise(res => setTimeout(res, wait));
    }
    await new Promise(res => setTimeout(res, PAUSE_MS));
    const type = r?.headers.get('content-type') ?? '';
    if (r && r.ok && type.startsWith('image/')) {
      const body = Buffer.from(await r.arrayBuffer());
      const { error } = await admin.storage.from('logos').upload(`${domain}.png`, body, { contentType: 'image/png', upsert: true });
      if (error) stats.failed++; else stats.fetched++;
    } else if (r && r.status === 404) {
      await admin.storage.from('logos').upload(`${domain}.none`, Buffer.from([0]), { contentType: 'application/octet-stream', upsert: true });
      stats.none++;
    } else {
      stats.failed++;
    }
    const done = stats.fetched + stats.none + stats.failed;
    if (done && done % 100 === 0) console.log(`  ${done} fetched so far`, JSON.stringify(stats));
  }
}
await Promise.all(Array.from({ length: 2 }, worker));
console.log('done', JSON.stringify(stats));
