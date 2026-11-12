/**
 * scripts/everify/h1b-sync.mjs
 *
 * Copies the public USCIS H-1B Employer Data Hub into Supabase Storage, so
 * the app and the landing site can show an employer's H-1B history next to
 * its E-Verify status. Run monthly by .github/workflows/h1b-sync.yml (USCIS
 * updates the hub quarterly); nobody needs to run it by hand.
 *
 * Source: https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub,
 * a Tableau dashboard on the same USCIS server as the E-Verify search. Its
 * "H1B Public" dashboard has an "Employer Information" worksheet with one row
 * per employer, location, fiscal year and decision type (New Employment
 * Approval, Continuation Denial, ...). Counts are workers, and reflect USCIS's
 * first decision on each petition. Read the same way as scripts/everify/sync.mjs:
 * one normal page load, then the Embedding API's summary-data reader, a page
 * at a time with pauses.
 *
 * Kept per employer (normalised name, see names.mjs), for the latest
 * FISCAL_YEARS fiscal years:
 *   { n: name, st: state, y: { "2026": [newEmploymentApprovals, allApprovals, allDenials], ... } }
 * Locations and tax IDs of the same name are summed. Stored like the E-Verify
 * list: bucket `h1b`, gzipped shards keyed by the first two characters of the
 * normalised name, and current.json pointing at the live version.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. DRY_RUN=1 writes nothing.
 * FISCAL_YEARS overrides how many years are read (default 3).
 */

import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { normalizeCompany, shardOf, shardPath } from "./names.mjs";

const SOURCE = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub";
const DASHBOARD = "H1B Public";
const WORKSHEET = "Employer Information";
const YEAR_FIELD = "Fiscal Year   "; // sic: the field name has trailing spaces
const PAGE_ROWS = 10000;
const PAUSE_MS = 1000;
const MIN_COMPLETE = 0.98;
/** FY2026 had 785,664 rows. A year far below this is a broken read. */
const MIN_ROWS_PER_YEAR = 200_000;
const BUCKET = "h1b";
const POINTER = "current.json";
const UPLOAD_CONCURRENCY = 8;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DRY_RUN } = process.env;
const YEARS_TO_READ = Math.max(1, Math.min(10, Number(process.env.FISCAL_YEARS) || 3));
const dry = DRY_RUN === "1";
if (!dry && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const db = dry ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const blank = (v) => (v === undefined || v === null || v === "" || v === "Null" ? null : String(v).trim());
const num = (v) => Number(String(v ?? "").replace(/,/g, "")) || 0;

// ─── The read ────────────────────────────────────────────────────────────────

async function withDashboard(fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(SOURCE, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(
      () => {
        const viz = document.querySelector("tableau-viz");
        try { return !!viz?.workbook?.activeSheet; } catch { return false; }
      },
      null,
      { timeout: 180_000, polling: 1000 },
    ).catch(() => {
      throw new Error("the H-1B Employer Data Hub dashboard did not load in 3 minutes; the USCIS source is probably down. The current data stays live.");
    });
    await page.evaluate(async (name) => {
      const viz = document.querySelector("tableau-viz");
      if (viz.workbook.activeSheet.name !== name) await viz.workbook.activateSheetAsync(name);
    }, DASHBOARD);
    await page.waitForFunction(
      ({ name, ws }) => {
        const viz = document.querySelector("tableau-viz");
        try { return viz.workbook.activeSheet.name === name && viz.workbook.activeSheet.worksheets.some((w) => w.name === ws); } catch { return false; }
      },
      { name: DASHBOARD, ws: WORKSHEET },
      { timeout: 120_000, polling: 1000 },
    );
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/** The fiscal years the hub offers, newest first. */
async function availableYears(page) {
  return page.evaluate(async ({ ws, field }) => {
    const viz = document.querySelector("tableau-viz");
    const sheet = viz.workbook.activeSheet.worksheets.find((w) => w.name === ws);
    const filter = (await sheet.getFiltersAsync()).find((f) => f.fieldName === field);
    const domain = await filter.getDomainAsync("database");
    return domain.values.map((v) => v.formattedValue).filter((y) => /^\d{4}$/.test(y)).sort().reverse();
  }, { ws: WORKSHEET, field: YEAR_FIELD });
}

/** Data through date shown on the main dashboard ("9/30/2026"), as ISO. */
async function dataThrough(page) {
  const raw = await page.evaluate(async () => {
    const viz = document.querySelector("tableau-viz");
    const wb = viz.workbook;
    await wb.activateSheetAsync("H1B-Employer Data Hub");
    const ws = wb.activeSheet.worksheets.find((w) => w.name === "Max-Run Date1");
    if (!ws) return null;
    const r = await ws.getSummaryDataReaderAsync(1, { ignoreSelection: true });
    const p = await r.getPageAsync(0);
    await r.releaseAsync();
    return p.data[0]?.[0]?.formattedValue ?? null;
  });
  const m = String(raw ?? "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

async function readYear(page, year, onRows) {
  const meta = await page.evaluate(async ({ ws, field, year, pageRows }) => {
    const viz = document.querySelector("tableau-viz");
    const sheet = viz.workbook.activeSheet.worksheets.find((w) => w.name === ws);
    await sheet.applyFilterAsync(field, [year], "replace");
    const reader = await sheet.getSummaryDataReaderAsync(pageRows, { ignoreSelection: true });
    window.__h1bReader = reader;
    return { totalRows: reader.totalRowCount, pages: reader.pageCount };
  }, { ws: WORKSHEET, field: YEAR_FIELD, year, pageRows: PAGE_ROWS });

  console.log(`FY${year}: ${meta.totalRows} rows in ${meta.pages} pages`);
  if (meta.totalRows < MIN_ROWS_PER_YEAR) throw new Error(`FY${year} reported only ${meta.totalRows} rows; expected several hundred thousand`);
  let read = 0;
  for (let p = 0; p < meta.pages; p++) {
    const chunk = await page.evaluate(async (i) => {
      const pg = await window.__h1bReader.getPageAsync(i);
      return { cols: pg.columns.map((c) => c.fieldName), rows: pg.data.map((r) => r.map((v) => v.formattedValue)) };
    }, p);
    read += chunk.rows.length;
    onRows(chunk.cols, chunk.rows);
    if ((p + 1) % 20 === 0 || p + 1 === meta.pages) console.log(`  page ${p + 1}/${meta.pages}: ${read} rows so far`);
    await sleep(PAUSE_MS);
  }
  await page.evaluate(async () => { try { await window.__h1bReader.releaseAsync(); } catch { /* ignore */ } });
  if (read < meta.totalRows * MIN_COMPLETE) throw new Error(`FY${year}: incomplete read, ${read} of ${meta.totalRows} rows`);
  return read;
}

/**
 * Reads the latest fiscal years into per-employer records:
 * normalised name -> { names: Map(name -> approvals), states: Map, y: { year: [newEmp, approvals, denials] } }
 */
async function readAll() {
  const employers = new Map();
  let rowsRead = 0;
  const { years, through } = await withDashboard(async (page) => {
    const years = (await availableYears(page)).slice(0, YEARS_TO_READ);
    if (!years.length) throw new Error("no fiscal years found on the dashboard");
    for (const year of years) {
      rowsRead += await readYear(page, year, (cols, rows) => {
        const at = (name) => cols.indexOf(name);
        const iName = at("Employer (Petitioner) Name"), iMeasure = at("Measure Names"), iValue = at("Measure Values"), iState = at("Petitioner State");
        if (iName < 0 || iMeasure < 0 || iValue < 0) throw new Error(`unexpected columns: ${cols.join(", ")}`);
        for (const row of rows) {
          const name = blank(row[iName]);
          const value = num(row[iValue]);
          if (!name || !value) continue;
          const key = normalizeCompany(name);
          if (!key) continue;
          const measure = String(row[iMeasure]);
          let e = employers.get(key);
          if (!e) { e = { names: new Map(), states: new Map(), y: {} }; employers.set(key, e); }
          const y = (e.y[year] ??= [0, 0, 0]);
          if (/approval$/i.test(measure)) {
            y[1] += value;
            if (/^new employment approval$/i.test(measure)) y[0] += value;
            e.names.set(name, (e.names.get(name) ?? 0) + value);
            const st = blank(row[iState]);
            if (st) e.states.set(st, (e.states.get(st) ?? 0) + value);
          } else if (/denial$/i.test(measure)) {
            y[2] += value;
            if (!e.names.has(name)) e.names.set(name, 0);
          }
        }
      });
    }
    return { years, through: await dataThrough(page).catch(() => null) };
  });
  return { employers, years, through, rowsRead };
}

/** The most-approved spelling and state, and the yearly counts. */
function toShards(employers) {
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const shards = new Map();
  for (const [key, e] of employers) {
    const rec = { n: top(e.names), y: e.y };
    const st = top(e.states);
    if (st) rec.st = st;
    const s = shardOf(key);
    let shard = shards.get(s);
    if (!shard) { shard = {}; shards.set(s, shard); }
    shard[key] = rec;
  }
  return shards;
}

// ─── Dry run ─────────────────────────────────────────────────────────────────

if (dry) {
  const { employers, years, through, rowsRead } = await readAll();
  const shards = toShards(employers);
  let gz = 0;
  for (const shard of shards.values()) gz += gzipSync(JSON.stringify(shard)).length;
  const sample = ["google", "amazon com services", "stripe", "deloitte consulting llp", "northeastern university", "meta platforms"]
    .map((k) => [k, shards.get(shardOf(k))?.[k] ?? null]);
  console.log(JSON.stringify({ years, through, rowsRead, employers: employers.size, shards: shards.size, gzippedMB: +(gz / 1e6).toFixed(2), sample }, null, 2));
  process.exit(0);
}

// ─── Real run ────────────────────────────────────────────────────────────────

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

try {
  await ensureBucket();
  let result;
  for (let attempt = 1; ; attempt++) {
    try { result = await readAll(); break; } catch (err) {
      if (attempt >= 2) throw err;
      console.warn(`read failed (${err instanceof Error ? err.message : err}); retrying in 60s`);
      await sleep(60_000);
    }
  }
  const { employers, years, through, rowsRead } = result;
  const shards = toShards(employers);

  const version = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const entries = [...shards.entries()];
  let bytes = 0;
  await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
    while (entries.length) {
      const [shard, data] = entries.pop();
      const body = gzipSync(JSON.stringify(data));
      bytes += body.length;
      await upload(shardPath(version, shard), body, "application/gzip");
    }
  }));

  const { data: oldPointer } = await db.storage.from(BUCKET).download(POINTER);
  const previous = oldPointer ? JSON.parse(await oldPointer.text()).version : null;
  const pointer = { version, syncedAt: new Date().toISOString(), employers: employers.size, years, dataThrough: through };
  await upload(POINTER, Buffer.from(JSON.stringify(pointer)), "application/json");
  const pruned = await pruneVersions([version, previous].filter(Boolean));
  console.log(`Done: ${employers.size} employers from ${rowsRead} rows (FY${years.join(", FY")}), ${shards.size} shards (${(bytes / 1e6).toFixed(1)} MB), data through ${through ?? "unknown"}, version ${version}, pruned ${pruned}.`);
} catch (err) {
  console.error("H-1B sync failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
