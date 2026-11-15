/**
 * scripts/everify/jobs-sync.mjs
 *
 * Live job postings for the public /jobs page on the landing site, refreshed
 * every 6 hours by .github/workflows/jobs-sync.yml.
 *
 * Source: employers' own job boards, through the official public job-board
 * APIs that Greenhouse, Lever and Ashby publish for exactly this use. The
 * board list (Storage jobs/boards.json) comes from a scan of every employer
 * in the USCIS H-1B data (see h1b-sync.mjs), checked so each board belongs
 * to the employer it is listed under. LinkedIn, Indeed and career sites whose
 * terms forbid automated access are not read.
 *
 * "Real jobs only" means:
 *   - live: the posting is on the employer's own board at this refresh, so a
 *     closed role disappears at the next run;
 *   - recent: first published in the last MAX_AGE_DAYS days;
 *   - in the US (or US remote);
 *   - from a known employer: each job carries that employer's E-Verify state
 *     and H-1B approvals from our USCIS copies;
 *   - one listing per employer, title and location (reposts collapse).
 * That cannot prove an employer intends to hire, so the page says what the
 * checks are rather than promising "no ghost jobs".
 *
 * Output: jobs/v/<version>/jobs.json.gz and jobs/current.json (pointer,
 * switched last). DRY_RUN=1 prints counts and writes nothing.
 */

import { gzipSync, gunzipSync } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { normalizeCompany, shardOf, shardPath } from "./names.mjs";

const MAX_AGE_DAYS = 60;
const CONCURRENCY = 8;
const PAUSE_MS = 150;
const UA = "PreciprocalJobs/1.0 (+https://preciprocal.com/jobs)";
/** A read far below the last run's count means a broken read; keep the old one. */
const MIN_SHARE_OF_PREVIOUS = 0.6;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DRY_RUN } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (the board list lives in Storage).");
  process.exit(1);
}
const dry = DRY_RUN === "1";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = Date.now();
const DAY = 86_400_000;

async function download(bucket, path) {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
const readJson = async (bucket, path) => { const b = await download(bucket, path); return b ? JSON.parse(b.toString("utf8")) : null; };

// ─── Employer data: E-Verify and H-1B shards, read on demand ────────────────

const evPointer = await readJson("everify", "current.json");
const h1bPointer = await readJson("h1b", "current.json");
const shardCache = new Map();
async function shard(bucket, version, s) {
  const id = `${bucket}/${s}`;
  if (!shardCache.has(id)) {
    const b = await download(bucket, shardPath(version, s));
    shardCache.set(id, b ? JSON.parse(gunzipSync(b).toString("utf8")) : {});
  }
  return shardCache.get(id);
}

function everifyState(records) {
  if (!records?.length) return "not-found";
  const today = new Date().toISOString().slice(0, 10);
  const best = [...records].sort((a, b) => (a.s === b.s ? (b.en ?? "").localeCompare(a.en ?? "") : a.s === "o" ? -1 : 1))[0];
  if (best.te && best.te <= today) return "ended";
  if (best.s === "o" && best.te) return "ending";
  return best.s === "o" ? "enrolled" : "ended";
}

async function employer(key) {
  const s = shardOf(key);
  const ev = evPointer ? (await shard("everify", evPointer.version, s))[key] : null;
  const h = h1bPointer ? (await shard("h1b", h1bPointer.version, s))[key] : null;
  const year = h1bPointer?.years?.[0];
  return {
    // Display name: E-Verify's mixed-case spelling when there is one.
    name: ev?.[0]?.e ?? null,
    h1bName: h?.n ?? null,
    ev: everifyState(ev),
    h1b: h && year ? { year, approvals: h.y[year]?.[1] ?? 0, newEmployment: h.y[year]?.[0] ?? 0 } : null,
  };
}

// ─── Reading boards ──────────────────────────────────────────────────────────

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
      if (r.status === 404) return null;
      if (r.status === 429) { await sleep(10_000 * (attempt + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(1500); }
  }
  return null;
}

/** Each board's jobs as { title, location, url, posted (ms) }. */
async function readBoard({ ats, slug }) {
  if (ats === "greenhouse") {
    const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    return (j?.jobs ?? []).map((x) => ({ title: x.title, location: x.location?.name ?? "", url: x.absolute_url, posted: Date.parse(x.first_published ?? x.updated_at ?? "") || null }));
  }
  if (ats === "lever") {
    const j = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return (Array.isArray(j) ? j : []).map((x) => ({ title: x.text, location: x.categories?.location ?? "", url: x.hostedUrl, posted: x.createdAt ?? null }));
  }
  if (ats === "ashby") {
    const j = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    return (j?.jobs ?? []).filter((x) => x.isListed !== false).map((x) => ({ title: x.title, location: [x.location, ...(x.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean).join("; "), url: x.jobUrl, posted: Date.parse(x.publishedAt ?? "") || null, remote: x.isRemote === true }));
  }
  return [];
}

// ─── Classification ──────────────────────────────────────────────────────────

const US = /(united states|\bUSA?\b|\bU\.S\.|\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b|new york|san francisco|seattle|boston|austin|chicago|los angeles|mountain view|palo alto|sunnyvale|san jose|atlanta|denver|remote)/i;
const NON_US = /\b(india|london|uk|united kingdom|canada|toronto|vancouver|montreal|germany|berlin|munich|dublin|ireland|singapore|japan|tokyo|australia|sydney|melbourne|brazil|mexico|poland|amsterdam|netherlands|paris|france|spain|madrid|barcelona|israel|tel aviv|korea|seoul|china|shanghai|beijing|taiwan|philippines|bangalore|bengaluru|hyderabad|pune|emea|apac|latam|europe)\b/i;
const SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|architect|distinguished|fellow)\b/i;
const INTERN = /\b(intern|internship|co-op|coop)\b/i;
const EARLY = /\b(new grad|new graduate|graduate|entry[- ]level|junior|early career|university|campus|associate|engineer i\b|analyst i\b|level 1|apprentice)\b/i;
const FAMILY = [
  ["software", /\b(software|swe|backend|back-end|frontend|front-end|full[- ]stack|developer|mobile|ios|android|platform engineer|infrastructure engineer|site reliability|sre|devops|security engineer)\b/i],
  ["data", /\b(data|machine learning|ml|ai\b|artificial intelligence|scientist|analytics|research engineer|applied scientist)\b/i],
  ["hardware", /\b(hardware|electrical|asic|fpga|silicon|firmware|embedded|mechanical|process engineer|manufacturing engineer|robotics)\b/i],
  ["product", /\b(product manager|product management|designer|ux|ui\b|product designer)\b/i],
  ["business", /\b(finance|financial|accountant|accounting|analyst|operations|strategy|consultant|business|marketing|sales|account executive|customer success)\b/i],
];
const isUS = (j) => j.remote ? !NON_US.test(j.location) : US.test(j.location) && !NON_US.test(j.location);
const level = (t) => (INTERN.test(t) ? "intern" : EARLY.test(t) && !SENIOR.test(t) ? "early" : SENIOR.test(t) ? "senior" : "mid");
const family = (t) => (FAMILY.find(([, re]) => re.test(t)) ?? ["other"])[0];
const titleCase = (s) => String(s ?? "").toLowerCase().replace(/\b(inc|llc|ltd|corp|co|lp|llp|plc|pc)\b\.?/g, "").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

// ─── Run ─────────────────────────────────────────────────────────────────────

const boardsDoc = await readJson("jobs", "boards.json");
if (!boardsDoc?.boards?.length) { console.error("jobs/boards.json is missing or empty."); process.exit(1); }
const boards = boardsDoc.boards;
console.log(`Reading ${boards.length} boards`);

const jobs = [];
const seen = new Set();
let read = 0, boardsWithJobs = 0, raw = 0, droppedOld = 0, droppedNonUS = 0, droppedDup = 0, droppedNoDate = 0;
const queue = [...boards];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const b = queue.shift();
    const list = await readBoard(b);
    raw += list.length;
    if (list.length) boardsWithJobs++;
    const emp = list.length ? await employer(b.key) : null;
    for (const j of list) {
      if (!j.title || !j.url) continue;
      if (!j.posted) { droppedNoDate++; continue; }
      if (now - j.posted > MAX_AGE_DAYS * DAY) { droppedOld++; continue; }
      if (!isUS(j)) { droppedNonUS++; continue; }
      const dedupe = `${b.key}|${j.title.toLowerCase().trim()}|${j.location.toLowerCase().trim()}`;
      if (seen.has(dedupe)) { droppedDup++; continue; }
      seen.add(dedupe);
      jobs.push({
        t: j.title.trim(),
        c: b.board || emp?.name || titleCase(emp?.h1bName ?? b.key),
        k: b.key,
        l: j.location.trim() || (j.remote ? "Remote (US)" : ""),
        u: j.url,
        p: new Date(j.posted).toISOString().slice(0, 10),
        f: family(j.title),
        v: level(j.title),
        e: emp?.ev ?? "not-found",
        h: emp?.h1b ? [emp.h1b.approvals, emp.h1b.newEmployment] : null,
      });
    }
    if (++read % 250 === 0) console.log(`  ${read}/${boards.length} boards, ${jobs.length} jobs kept`);
    await sleep(PAUSE_MS);
  }
}));

jobs.sort((a, b) => b.p.localeCompare(a.p));
const stats = { boards: boards.length, boardsWithJobs, raw, kept: jobs.length, droppedOld, droppedNonUS, droppedDup, droppedNoDate };
console.log(JSON.stringify(stats));

if (dry) {
  const by = (k) => jobs.reduce((m, j) => ((m[j[k]] = (m[j[k]] ?? 0) + 1), m), {});
  console.log(JSON.stringify({ byFamily: by("f"), byLevel: by("v"), byEverify: by("e"), last7d: jobs.filter((j) => now - Date.parse(j.p) < 7 * DAY).length, sample: jobs.slice(0, 5) }, null, 2));
  process.exit(0);
}

const previous = await readJson("jobs", "current.json");
if (previous?.jobs && jobs.length < previous.jobs * MIN_SHARE_OF_PREVIOUS) {
  console.error(`Only ${jobs.length} jobs against ${previous.jobs} last run; keeping the previous version.`);
  process.exit(1);
}

const version = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const body = gzipSync(JSON.stringify({ generatedAt: new Date().toISOString(), maxAgeDays: MAX_AGE_DAYS, h1bYear: h1bPointer?.years?.[0] ?? null, jobs }));
let up = await db.storage.from("jobs").upload(`v/${version}/jobs.json.gz`, body, { contentType: "application/gzip", upsert: true });
if (up.error) { console.error("upload failed:", up.error.message); process.exit(1); }
up = await db.storage.from("jobs").upload("current.json", Buffer.from(JSON.stringify({ version, syncedAt: new Date().toISOString(), jobs: jobs.length, boards: boardsWithJobs, maxAgeDays: MAX_AGE_DAYS })), { contentType: "application/json", upsert: true });
if (up.error) { console.error("pointer upload failed:", up.error.message); process.exit(1); }

// Keep this version and the previous one.
const { data: folders } = await db.storage.from("jobs").list("v", { limit: 1000 });
for (const f of folders ?? []) {
  if (f.name === version || f.name === previous?.version) continue;
  const { data: files } = await db.storage.from("jobs").list(`v/${f.name}`);
  await db.storage.from("jobs").remove((files ?? []).map((x) => `v/${f.name}/${x.name}`));
}
console.log(`Done: ${jobs.length} jobs from ${boardsWithJobs} boards, ${(body.length / 1e6).toFixed(2)} MB, version ${version}.`);
