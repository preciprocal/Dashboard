/**
 * scripts/everify/sync.mjs
 *
 * Copies the public E-Verify Employer Search into Supabase Storage, once a
 * day. Run by .github/workflows/everify-sync.yml; nobody needs to run it by
 * hand.
 *
 * Source: https://www.e-verify.gov/e-verify-employer-search, a Tableau
 * dashboard published by USCIS and refreshed daily at about 2 a.m. ET. The
 * employer rows live in its "Employer List" worksheet. They are read the same
 * way the page reads them to draw its table: one normal page load, then the
 * Tableau Embedding API's summary-data reader, a page of rows at a time with
 * a pause between pages. The dashboard defaults to the current enrolment
 * year; the read widens that to every year (about 1.28 million employers).
 *
 * Why Storage, not a table: the full list needs ~530 MB as rows, more than a
 * free Supabase database holds. As ~1,300 gzipped JSON shards keyed by the
 * first two characters of the normalised name it is ~25-30 MB. Layout and
 * record shape: lib/jobs/everify-store.ts.
 *
 * Each run uploads a complete new version, then switches the pointer
 * (current.json) to it, then deletes versions older than the previous one.
 * A failed or partial run never moves the pointer, so users keep yesterday's
 * list; the run is logged as failed in everify_sync_runs and the process
 * exits non-zero so GitHub emails the repo owner.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * DRY_RUN=1 reads and parses everything, prints counts, shard sizes and a
 * sample, and writes nothing (no Supabase credentials needed).
 */

import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { normalizeCompany, shardOf, shardPath } from "./names.mjs";

const SOURCE = "https://www.e-verify.gov/e-verify-employer-search";
const WORKSHEET = "Employer List";
const PAGE_ROWS = 10000;
const PAUSE_MS = 1500;
/** A read must reach this share of the count the dashboard reports. */
const MIN_COMPLETE = 0.98;
/**
 * The full list was 1,276,835 employers on 2026-11-11. The dashboard's
 * default view is only the current enrolment year (about 91,000), so a
 * count far below the full list means the date filter was not widened.
 */
const MIN_EXPECTED_ROWS = 500_000;
/** Records kept per normalised name: plenty for a company with several accounts. */
const MAX_PER_KEY = 5;
const BUCKET = "everify";
const POINTER = "current.json";
const UPLOAD_CONCURRENCY = 8;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DRY_RUN } = process.env;
const dry = DRY_RUN === "1";
if (!dry && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const db = dry ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Names and shards: scripts/everify/names.mjs (mirrors lib/jobs/everify-store.ts).

// ─── Parsing the dashboard's formatted values ────────────────────────────────

const blank = (v) => (v === undefined || v === null || v === "" || v === "Null" ? null : String(v).trim());

/** "05/12/2026" or "11/8/2026" to "2026-05-12". */
function date(v) {
  const s = blank(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** One row as the compact stored record, plus the source date. */
function toRecord(cols, row) {
  const get = (name) => {
    const i = cols.indexOf(name);
    return i >= 0 ? row[i] : undefined;
  };
  const employer = blank(get("Employer"));
  if (!employer) return null;
  const rec = { e: employer, s: (blank(get("Account Status")) ?? "").toLowerCase() === "open" ? "o" : "t" };
  const dba = blank(get("Doing Business As"));
  if (dba && dba.toLowerCase() !== employer.toLowerCase()) rec.d = dba;
  const en = date(get("Date Enrolled"));
  if (en) rec.en = en;
  const te = date(get("Date Terminated"));
  if (te) rec.te = te;
  const w = blank(get("Workforce Size"));
  if (w) rec.w = w;
  return { rec, sourceUpdated: date(get("Last Updated Date")) };
}

// ─── The read ────────────────────────────────────────────────────────────────

async function readEmployerList(onRows) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(SOURCE, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // Wait for the embedded dashboard to finish loading.
    await page.waitForFunction(
      () => {
        const viz = document.querySelector("tableau-viz");
        try { return !!viz?.workbook?.activeSheet?.worksheets?.length; } catch { return false; }
      },
      null,
      { timeout: 180_000, polling: 1000 },
    ).catch(() => {
      throw new Error("the E-Verify Employer Search dashboard did not load in 3 minutes; the USCIS source is probably down (it has shown 'HTTP Status 404' during outages). Yesterday's list stays live.");
    });

    const meta = await page.evaluate(async ({ worksheet, pageRows }) => {
      const viz = document.querySelector("tableau-viz");
      const sheets = viz.workbook.activeSheet.worksheets;
      const ws = sheets.find((w) => w.name === worksheet);
      if (!ws) throw new Error(`worksheet "${worksheet}" not found; sheets are: ${sheets.map((w) => w.name).join(", ")}`);
      try { await ws.clearFilterAsync("Account Status"); } catch { /* keep the default view */ }
      // "Date Enrolled" defaults to a relative filter on the current year,
      // and cannot be cleared. Widening it to the last 40 years covers every
      // enrolment (E-Verify began in 1997).
      await ws.applyRelativeDateFilterAsync("Date Enrolled", { periodType: "years", rangeType: "last-n", rangeN: 40 });
      const reader = await ws.getSummaryDataReaderAsync(pageRows, { ignoreSelection: true });
      window.__everifyReader = reader;
      return { totalRows: reader.totalRowCount, pages: reader.pageCount };
    }, { worksheet: WORKSHEET, pageRows: PAGE_ROWS });

    console.log(`Employer List: ${meta.totalRows} rows in ${meta.pages} pages`);
    if (meta.totalRows < MIN_EXPECTED_ROWS) {
      throw new Error(`only ${meta.totalRows} employers reported; the full list is over a million, so the enrolment date filter did not widen`);
    }
    let read = 0;
    for (let p = 0; p < meta.pages; p++) {
      const chunk = await page.evaluate(async (i) => {
        const pg = await window.__everifyReader.getPageAsync(i);
        return { cols: pg.columns.map((c) => c.fieldName), rows: pg.data.map((r) => r.map((v) => v.formattedValue)) };
      }, p);
      read += chunk.rows.length;
      onRows(chunk.cols, chunk.rows);
      if ((p + 1) % 10 === 0 || p + 1 === meta.pages) console.log(`  page ${p + 1}/${meta.pages}: ${read} rows so far`);
      await sleep(PAUSE_MS);
    }
    await page.evaluate(async () => { try { await window.__everifyReader.releaseAsync(); } catch { /* ignore */ } });
    return { reported: meta.totalRows, read };
  } finally {
    await browser.close();
  }
}

/** Reads the whole list into shards: shard -> { normalised name -> records }. */
async function readIntoShards() {
  const shards = new Map();
  let parsed = 0, newest = null;
  const add = (key, rec) => {
    const s = shardOf(key);
    let shard = shards.get(s);
    if (!shard) { shard = {}; shards.set(s, shard); }
    (shard[key] ??= []).push(rec);
  };
  const { reported, read } = await readEmployerList((cols, rows) => {
    for (const row of rows) {
      const r = toRecord(cols, row);
      if (!r) continue;
      parsed++;
      if (r.sourceUpdated && (!newest || r.sourceUpdated > newest)) newest = r.sourceUpdated;
      const k1 = normalizeCompany(r.rec.e);
      if (k1) add(k1, r.rec);
      const k2 = r.rec.d ? normalizeCompany(r.rec.d) : null;
      if (k2 && k2 !== k1) add(k2, r.rec);
    }
  });
  if (read < reported * MIN_COMPLETE) throw new Error(`incomplete read: ${read} of ${reported} rows`);

  // Open accounts first, then most recently enrolled; cap per name.
  for (const shard of shards.values()) {
    for (const key of Object.keys(shard)) {
      shard[key] = shard[key]
        .sort((a, b) => (a.s === b.s ? (b.en ?? "").localeCompare(a.en ?? "") : a.s === "o" ? -1 : 1))
        .slice(0, MAX_PER_KEY);
    }
  }
  return { shards, reported, read, parsed, newest };
}

// ─── Dry run ─────────────────────────────────────────────────────────────────

if (dry) {
  const { shards, reported, read, parsed, newest } = await readIntoShards();
  let gz = 0, keys = 0, biggest = ["", 0];
  for (const [s, shard] of shards) {
    const size = gzipSync(JSON.stringify(shard)).length;
    gz += size; keys += Object.keys(shard).length;
    if (size > biggest[1]) biggest = [s, size];
  }
  const sample = shards.get("go") ? Object.entries(shards.get("go")).filter(([k]) => k.startsWith("google")).slice(0, 3) : [];
  console.log(JSON.stringify({ reported, read, parsed, newest, shards: shards.size, names: keys, gzippedMB: +(gz / 1e6).toFixed(1), biggestShard: { shard: biggest[0], kb: Math.round(biggest[1] / 1024) }, sample }, null, 2));
  process.exit(0);
}

// ─── Real run ────────────────────────────────────────────────────────────────

async function startRun() {
  const { data, error } = await db.from("everify_sync_runs").insert({}).select("id").single();
  if (error) throw new Error(`could not record the run (is migration 0058 applied?): ${error.message}`);
  return data.id;
}

async function finishRun(id, fields) {
  const { error } = await db.from("everify_sync_runs").update({ finished_at: new Date().toISOString(), ...fields }).eq("id", id);
  if (error) console.error("could not update the run row:", error.message);
}

async function ensureBucket() {
  const { data } = await db.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await db.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw new Error(`could not create the ${BUCKET} bucket: ${error.message}`);
}

async function upload(path, body, contentType, attempt = 1) {
  const { error } = await db.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (!error) return;
  if (attempt >= 3) throw new Error(`upload of ${path} failed: ${error.message}`);
  await sleep(2000 * attempt);
  return upload(path, body, contentType, attempt + 1);
}

/** Deletes every version folder except the two newest. */
async function pruneVersions(keep) {
  const { data: folders } = await db.storage.from(BUCKET).list("v", { limit: 1000 });
  const old = (folders ?? []).map((f) => f.name).filter((n) => !keep.includes(n));
  for (const v of old) {
    const { data: files } = await db.storage.from(BUCKET).list(`v/${v}`, { limit: 10000 });
    const paths = (files ?? []).map((f) => `v/${v}/${f.name}`);
    for (let i = 0; i < paths.length; i += 900) await db.storage.from(BUCKET).remove(paths.slice(i, i + 900));
  }
  return old.length;
}

const runId = await startRun();
try {
  await ensureBucket();

  // Read, retrying once if the dashboard is slow.
  let result;
  for (let attempt = 1; ; attempt++) {
    try { result = await readIntoShards(); break; } catch (err) {
      if (attempt >= 2) throw err;
      console.warn(`read failed (${err instanceof Error ? err.message : err}); retrying in 30s`);
      await sleep(30_000);
    }
  }
  const { shards, reported, read, newest } = result;

  // Upload the new version in full before anyone can see it.
  const version = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const entries = [...shards.entries()];
  let done = 0, bytes = 0;
  const workers = Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
    while (entries.length) {
      const [shard, data] = entries.pop();
      const body = gzipSync(JSON.stringify(data));
      bytes += body.length;
      await upload(shardPath(version, shard), body, "application/gzip");
      if (++done % 200 === 0) console.log(`  uploaded ${done}/${shards.size} shards`);
    }
  });
  await Promise.all(workers);

  // Switch the pointer: from here on, lookups use the new version.
  const { data: oldPointer } = await db.storage.from(BUCKET).download(POINTER);
  const previous = oldPointer ? JSON.parse(await oldPointer.text()).version : null;
  const pointer = { version, syncedAt: new Date().toISOString(), rows: read, sourceUpdated: newest };
  await upload(POINTER, Buffer.from(JSON.stringify(pointer)), "application/json");

  const pruned = await pruneVersions([version, previous].filter(Boolean));
  await finishRun(runId, { status: "ok", rows_read: read, rows_live: read, source_updated: newest, message: `version ${version}: ${shards.size} shards, ${(bytes / 1e6).toFixed(1)} MB gzipped; pruned ${pruned} old versions` });
  console.log(`Done: ${read} of ${reported} employers in ${shards.size} shards (${(bytes / 1e6).toFixed(1)} MB), version ${version}, source updated ${newest ?? "unknown"}.`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("E-Verify sync failed:", message);
  await finishRun(runId, { status: "failed", message: message.slice(0, 2000) });
  process.exit(1);
}
