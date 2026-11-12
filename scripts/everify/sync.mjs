/**
 * scripts/everify/sync.mjs
 *
 * Copies the public E-Verify Employer Search into Supabase, once a day.
 * Run by .github/workflows/everify-sync.yml; nobody needs to run it by hand.
 *
 * Source: https://www.e-verify.gov/e-verify-employer-search, a Tableau
 * dashboard published by USCIS and refreshed daily at about 2 a.m. ET. The
 * employer rows live in its "Employer List" worksheet. They are read here the
 * same way the page reads them to draw its table: one normal page load, then
 * the Tableau Embedding API's summary-data reader, a page of rows at a time
 * with a pause between pages. Nothing is guessed and nothing is hammered.
 *
 * Writes go to everify_employers_staging; everify_swap() then replaces the
 * live table in one transaction, and refuses if the load is much smaller
 * than what is live. Any failure leaves users on yesterday's data, records the
 * run as failed, and exits non-zero so GitHub emails the repo owner.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Migration 0058 must be
 * applied first.
 *
 * DRY_RUN=1 reads and parses everything, prints counts and a sample, and
 * writes nothing (no Supabase credentials needed). Use it to check the source
 * after a change to the dashboard.
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SOURCE = "https://www.e-verify.gov/e-verify-employer-search";
const WORKSHEET = "Employer List";
const PAGE_ROWS = 10000;
const PAUSE_MS = 1500;
const INSERT_CHUNK = 1000;
/** A read must reach this share of the count the dashboard reports. */
const MIN_COMPLETE = 0.98;
/**
 * The full list was 1,276,835 employers on 2026-11-11. The dashboard's
 * default view is only the current enrolment year (about 91,000), so a
 * count far below the full list means the date filter was not widened.
 */
const MIN_EXPECTED_ROWS = 500_000;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DRY_RUN } = process.env;
const dry = DRY_RUN === "1";
if (!dry && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const db = dry ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function int(v) {
  const s = blank(v);
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function states(v) {
  const s = blank(v);
  if (!s) return null;
  const list = s.split(",").map((x) => x.trim()).filter(Boolean);
  return list.length ? list : null;
}

function yesNo(v) {
  const s = blank(v);
  if (!s) return null;
  return s.toLowerCase() === "yes";
}

/** Map one row by column name. Columns are found by name, not position. */
function toRecord(cols, row) {
  const get = (...names) => {
    for (const n of names) {
      const i = cols.indexOf(n);
      if (i >= 0) return row[i];
    }
    return undefined;
  };
  const employer = blank(get("Employer"));
  if (!employer) return null;
  return {
    employer,
    dba: blank(get("Doing Business As")),
    account_status: blank(get("Account Status")),
    date_enrolled: date(get("Date Enrolled")),
    date_terminated: date(get("Date Terminated")),
    workforce_size: blank(get("Workforce Size")),
    hiring_sites: int(get("SUM(Number of Hiring Sites)", "Number of Hiring Sites")),
    hiring_states: states(get("Hiring Site Locations")),
    everify_plus: yesNo(get("Opted into E-Verify+")),
    source_updated: date(get("Last Updated Date")),
  };
}

// ─── Database helpers ────────────────────────────────────────────────────────

async function startRun() {
  const { data, error } = await db.from("everify_sync_runs").insert({}).select("id").single();
  if (error) throw new Error(`could not record the run (is migration 0058 applied?): ${error.message}`);
  return data.id;
}

async function finishRun(id, fields) {
  const { error } = await db.from("everify_sync_runs").update({ finished_at: new Date().toISOString(), ...fields }).eq("id", id);
  if (error) console.error("could not update the run row:", error.message);
}

async function insertChunk(rows, attempt = 1) {
  const { error } = await db.from("everify_employers_staging").insert(rows);
  if (!error) return;
  if (attempt >= 3) throw new Error(`staging insert failed: ${error.message}`);
  await sleep(2000 * attempt);
  return insertChunk(rows, attempt + 1);
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
      throw new Error("the E-Verify Employer Search dashboard did not load in 3 minutes; the USCIS source is probably down (it has shown 'HTTP Status 404' during outages). Yesterday's data stays live.");
    });

    // Open a reader on the Employer List, with every account status included
    // (the dashboard may default to open accounts only).
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
    let read = 0;
    for (let p = 0; p < meta.pages; p++) {
      const chunk = await page.evaluate(async (i) => {
        const pg = await window.__everifyReader.getPageAsync(i);
        return { cols: pg.columns.map((c) => c.fieldName), rows: pg.data.map((r) => r.map((v) => v.formattedValue)) };
      }, p);
      read += chunk.rows.length;
      await onRows(chunk.cols, chunk.rows);
      console.log(`  page ${p + 1}/${meta.pages}: ${chunk.rows.length} rows`);
      await sleep(PAUSE_MS);
    }
    await page.evaluate(async () => { try { await window.__everifyReader.releaseAsync(); } catch { /* ignore */ } });
    return { reported: meta.totalRows, read };
  } finally {
    await browser.close();
  }
}

// ─── Dry run ─────────────────────────────────────────────────────────────────

if (dry) {
  const sample = [];
  const byStatus = {};
  let parsed = 0, newest = null;
  const { reported, read } = await readEmployerList(async (cols, rows) => {
    if (!sample.length) console.log("columns:", cols.join(" | "));
    for (const row of rows) {
      const rec = toRecord(cols, row);
      if (!rec) continue;
      parsed++;
      byStatus[rec.account_status ?? "null"] = (byStatus[rec.account_status ?? "null"] ?? 0) + 1;
      if (rec.source_updated && (!newest || rec.source_updated > newest)) newest = rec.source_updated;
      if (sample.length < 3) sample.push(rec);
    }
  });
  console.log(JSON.stringify({ reported, read, parsed, byStatus, newest, sample }, null, 2));
  process.exit(read >= reported * MIN_COMPLETE ? 0 : 1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const runId = await startRun();
try {
  let staged = 0;
  let newest = null;
  let buffer = [];
  const flush = async () => {
    if (!buffer.length) return;
    await insertChunk(buffer);
    staged += buffer.length;
    buffer = [];
  };

  // The dashboard occasionally loads slowly. A failed read empties staging
  // and tries once more before the run is marked failed.
  let reported = 0;
  let read = 0;
  for (let attempt = 1; ; attempt++) {
    const { error: resetErr } = await db.rpc("everify_staging_reset");
    if (resetErr) throw new Error(`staging reset failed: ${resetErr.message}`);
    staged = 0;
    newest = null;
    buffer = [];
    try {
      ({ reported, read } = await readEmployerList(async (cols, rows) => {
        for (const row of rows) {
          const rec = toRecord(cols, row);
          if (!rec) continue;
          if (rec.source_updated && (!newest || rec.source_updated > newest)) newest = rec.source_updated;
          buffer.push(rec);
          if (buffer.length >= INSERT_CHUNK) await flush();
        }
      }));
      await flush();
      break;
    } catch (err) {
      if (attempt >= 2) throw err;
      console.warn(`read failed (${err instanceof Error ? err.message : err}); retrying in 30s`);
      await sleep(30_000);
    }
  }

  if (reported < MIN_EXPECTED_ROWS) {
    throw new Error(`only ${reported} employers reported; the full list is over a million, so the enrolment date filter did not widen`);
  }
  if (read < reported * MIN_COMPLETE) {
    throw new Error(`incomplete read: ${read} of ${reported} rows`);
  }

  const { data: live, error: swapErr } = await db.rpc("everify_swap", { p_min_ratio: 0.8 });
  if (swapErr) throw new Error(`swap refused: ${swapErr.message}`);

  await finishRun(runId, { status: "ok", rows_read: read, rows_live: live, source_updated: newest, message: `staged ${staged}` });
  console.log(`Done: ${live} employers live, source updated ${newest ?? "unknown"}.`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("E-Verify sync failed:", message);
  await finishRun(runId, { status: "failed", message: message.slice(0, 2000) });
  process.exit(1);
}
