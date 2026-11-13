/**
 * scripts/salary/ingest.mjs
 *
 * Loads US Bureau of Labor Statistics OEWS wage percentiles into Supabase, so
 * the Salary page and the offer links can show what an occupation pays in a
 * metro area, a state and the nation. BLS publishes one release a year (the
 * May reference period, released around April), so this runs yearly from
 * .github/workflows/salary-ingest.yml, or by hand after a release.
 *
 * Source: the OEWS "special requests" downloads listed on
 * https://www.bls.gov/oes/tables.htm, one zip per area kind:
 *   https://www.bls.gov/oes/special-requests/oesm{YY}nat.zip  national
 *   https://www.bls.gov/oes/special-requests/oesm{YY}st.zip   states (+ PR, GU, VI)
 *   https://www.bls.gov/oes/special-requests/oesm{YY}ma.zip   metro areas
 * Each holds an .xlsx with every occupation x area estimate. These are the
 * files BLS itself points to for bulk use; the Public Data API v2 caps a key
 * at 500 queries a day of 50 series each, far short of ~180k series.
 *
 * Kept: cross-industry, detailed occupations with a median annual wage; the
 * five annual percentiles (10, 25, 50, 75, 90) and employment. Nonmetro and
 * industry tables are not read.
 *
 * Env:
 *   OEWS_YEAR            e.g. 2025. Default: the newest year BLS has published.
 *   LOCAL_DIR            read oesm{YY}{nat,st,ma}.zip from here instead of downloading
 *   OUT_DIR              write areas/occupations/wages JSON here and touch no database
 *   EMIT_LIB=1           also regenerate lib/salary/oews-data.ts (occupation titles
 *                        and metro names the title and location matchers use)
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   required unless OUT_DIR is set
 *
 * The load goes to salary_wages_staging, then salary_swap() replaces the live
 * table in one transaction, refusing a load far smaller than the current one.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readZip, sheetList, eachRow, sheetText } from "./xlsx.mjs";
import { toRecord, topCodeFromNotes, DEFAULT_TOP_CODE } from "./oews.mjs";

const BASE = "https://www.bls.gov/oes/special-requests";
// bls.gov answers 403 to requests without a browser-like User-Agent. A
// descriptive one, with no personal contact details in it.
const UA = "Mozilla/5.0 (compatible; PreciprocalSalaryIngest/1.0; yearly OEWS bulk download)";
const KINDS = [
  { key: "nat", file: (yy) => `national_M20${yy}_dl.xlsx` },
  { key: "st", file: (yy) => `state_M20${yy}_dl.xlsx` },
  { key: "ma", file: (yy) => `MSA_M20${yy}_dl.xlsx` },
];
/** May 2025 had ~178k kept rows. Far below this is a broken read. */
const MIN_WAGE_ROWS = 100_000;
const BATCH = 5000;

const { OEWS_YEAR, LOCAL_DIR, OUT_DIR, EMIT_LIB, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const here = dirname(fileURLToPath(import.meta.url));

async function fetchZip(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/zip,*/*" }, redirect: "manual" });
  // A missing year redirects to an HTML page rather than returning 404.
  if (res.status !== 200 || !/zip/i.test(res.headers.get("content-type") ?? "")) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** The newest May reference year whose national file exists. */
async function latestYear() {
  const now = new Date().getUTCFullYear();
  for (let y = now; y >= now - 4; y--) {
    const res = await fetch(`${BASE}/oesm${String(y).slice(2)}nat.zip`, { method: "HEAD", headers: { "User-Agent": UA }, redirect: "manual" });
    if (res.status === 200 && /zip/i.test(res.headers.get("content-type") ?? "")) return y;
  }
  throw new Error("no OEWS release found on bls.gov for the last five years");
}

async function loadZip(yy, key) {
  const name = `oesm${yy}${key}.zip`;
  if (LOCAL_DIR) return readFileSync(join(LOCAL_DIR, name));
  const url = `${BASE}/${name}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const buf = await fetchZip(url);
    if (buf) return buf;
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error(`could not download ${url}`);
}

/** Reads one area-kind zip into the shared maps. */
function readTable(zipBuf, innerName, out) {
  const outer = readZip(zipBuf);
  const entry = [...outer.keys()].find((k) => k.toLowerCase().endsWith(innerName.toLowerCase()));
  if (!entry) throw new Error(`${innerName} not found in zip (has ${[...outer.keys()].join(", ")})`);
  const book = readZip(outer.get(entry)());
  const sheets = sheetList(book);
  const notes = sheets.find((s) => /field descriptions/i.test(s.name));
  const topCode = (notes && topCodeFromNotes(sheetText(book, notes.path))) || DEFAULT_TOP_CODE;
  out.topCode = topCode;

  let header = null;
  let read = 0;
  eachRow(book, sheets[0].path, (cells) => {
    if (!header) { header = cells.map((c) => c.trim().toUpperCase()); return; }
    read++;
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    const rec = toRecord(row, topCode);
    if (!rec) return;
    out.areas.set(rec.area.code, rec.area);
    if (!out.occupations.has(rec.occupation.code)) out.occupations.set(rec.occupation.code, rec.occupation);
    out.wages.push(rec.wage);
  });
  if (!header?.includes("A_MEDIAN") || !header.includes("OCC_CODE")) throw new Error(`${innerName}: unexpected columns ${header?.join(",")}`);
  return read;
}

function emitLib(out, year) {
  const occs = [...out.occupations.values()].sort((a, b) => a.code.localeCompare(b.code));
  const metros = [...out.areas.values()].filter((a) => a.kind === "metro").sort((a, b) => a.code.localeCompare(b.code));
  const q = (s) => JSON.stringify(s);
  const body = `// lib/salary/oews-data.ts
// GENERATED by scripts/salary/ingest.mjs (EMIT_LIB=1) from BLS OEWS May ${year}.
// Do not edit by hand; rerun the ingest after a new release.
//
// Every detailed occupation and metro area in the release, so the title and
// location matchers can work without a database round trip.

export const OEWS_DATA_YEAR = ${year};

/** [SOC code, BLS occupation title] */
export const OEWS_OCCUPATIONS: ReadonlyArray<readonly [string, string]> = [
${occs.map((o) => `  [${q(o.code)}, ${q(o.title)}],`).join("\n")}
];

/** [area code (7 digits), metro area name, primary state] */
export const OEWS_METROS: ReadonlyArray<readonly [string, string, string]> = [
${metros.map((a) => `  [${q(a.code)}, ${q(a.name)}, ${q(a.state ?? "")}],`).join("\n")}
];
`;
  const path = join(here, "..", "..", "lib", "salary", "oews-data.ts");
  writeFileSync(path, body);
  console.log(`wrote ${path} (${occs.length} occupations, ${metros.length} metros)`);
}

async function load(out, year, sourceUrl) {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const run = async (label, p) => { const { error } = await p; if (error) throw new Error(`${label}: ${error.message}`); };

  const areas = [...out.areas.values()];
  const occs = [...out.occupations.values()];
  for (let i = 0; i < areas.length; i += BATCH) await run("areas", db.from("salary_areas").upsert(areas.slice(i, i + BATCH), { onConflict: "code" }));
  for (let i = 0; i < occs.length; i += BATCH) await run("occupations", db.from("salary_occupations").upsert(occs.slice(i, i + BATCH), { onConflict: "code" }));
  await run("staging reset", db.rpc("salary_staging_reset"));
  for (let i = 0; i < out.wages.length; i += BATCH) {
    await run(`wages ${i}`, db.from("salary_wages_staging").insert(out.wages.slice(i, i + BATCH)));
    if ((i / BATCH) % 10 === 0) console.log(`  staged ${Math.min(i + BATCH, out.wages.length)} / ${out.wages.length}`);
  }
  const { data, error } = await db.rpc("salary_swap", { p_year: year, p_source_url: sourceUrl, p_top_code: out.topCode });
  if (error) throw new Error(`swap: ${error.message}`);
  console.log(`live: ${data} wage rows for May ${year}`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

if (!OUT_DIR && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or set OUT_DIR for a local dry run).");
  process.exit(1);
}

try {
  const year = Number(OEWS_YEAR) || (LOCAL_DIR ? null : await latestYear());
  if (!year) throw new Error("set OEWS_YEAR when reading from LOCAL_DIR");
  const yy = String(year).slice(2);
  console.log(`OEWS May ${year}${LOCAL_DIR ? ` from ${LOCAL_DIR}` : " from bls.gov"}`);

  const out = { areas: new Map(), occupations: new Map(), wages: [], topCode: DEFAULT_TOP_CODE };
  for (const k of KINDS) {
    const t0 = Date.now();
    const before = out.wages.length;
    const read = readTable(await loadZip(yy, k.key), k.file(yy), out);
    console.log(`  ${k.key}: ${read} rows read, ${out.wages.length - before} kept (${Date.now() - t0} ms)`);
  }
  const capped = out.wages.filter((w) => w.capped).length;
  const kinds = [...out.areas.values()].reduce((m, a) => ({ ...m, [a.kind]: (m[a.kind] ?? 0) + 1 }), {});
  console.log(JSON.stringify({ year, topCode: out.topCode, areas: kinds, occupations: out.occupations.size, wageRows: out.wages.length, rowsWithTopCodedPercentile: capped }));
  if (out.wages.length < MIN_WAGE_ROWS) throw new Error(`only ${out.wages.length} wage rows; expected well over ${MIN_WAGE_ROWS}`);

  if (EMIT_LIB === "1") emitLib(out, year);
  const sourceUrl = "https://www.bls.gov/oes/tables.htm";

  if (OUT_DIR) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, "areas.json"), JSON.stringify([...out.areas.values()]));
    writeFileSync(join(OUT_DIR, "occupations.json"), JSON.stringify([...out.occupations.values()]));
    writeFileSync(join(OUT_DIR, "wages.json"), JSON.stringify(out.wages));
    writeFileSync(join(OUT_DIR, "meta.json"), JSON.stringify({ year, topCode: out.topCode, sourceUrl }, null, 2));
    console.log(`wrote JSON to ${OUT_DIR}; no database touched`);
  } else {
    await load(out, year, sourceUrl);
  }
} catch (err) {
  console.error(`salary ingest failed: ${err.message}`);
  process.exit(1);
}
