/**
 * scripts/salary/oews.mjs
 *
 * Turning one row of a BLS OEWS table into the compact record we store. Kept
 * apart from the download and load code so scripts/verify-salary.ts can pin
 * the marker rules without touching the network.
 *
 * OEWS cells are numbers or one of these markers (from the "Field
 * Descriptions" sheet of every download):
 *   *   wage estimate not available
 *   **  employment estimate not available
 *   #   wage at or above the top of the published range ($239,200 a year in
 *       May 2025). The true value is unknown, only that it is at least that.
 * A top-coded cell is stored as the top-code amount with a flag bit, so the
 * app can say "$239,200 or more" instead of pretending to know the number.
 */

/** BLS area type codes: 1 national, 2 state, 3 territory, 4 metro area. */
export const AREA_KIND = { 1: "national", 2: "state", 3: "state", 4: "metro" };

/** Percentile columns, in the order of the capped bitmask (bit 0 = 10th). */
export const PCT_COLUMNS = ["A_PCT10", "A_PCT25", "A_MEDIAN", "A_PCT75", "A_PCT90"];

/** Used only if a download's notes cannot be read; the May 2025 value. */
export const DEFAULT_TOP_CODE = 239_200;

/** The annual top-code amount stated in a download's field descriptions. */
export function topCodeFromNotes(text) {
  const m = String(text).match(/#\s*=[^\n]*?\$([\d,]+)\s*per\s*year/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/**
 * One wage cell -> { value, capped }. value is whole dollars or null.
 * "#" is the top code: value = topCode, capped = true.
 */
export function parseWage(raw, topCode) {
  const s = String(raw ?? "").trim();
  if (s === "#") return { value: topCode, capped: true };
  if (s === "" || s.startsWith("*")) return { value: null, capped: false };
  const n = Number(s.replace(/[,$]/g, ""));
  return Number.isFinite(n) && n > 0 ? { value: Math.round(n), capped: false } : { value: null, capped: false };
}

/** Employment cell -> whole number or null ("**" and blanks are unknown). */
export function parseEmployment(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s.startsWith("*")) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/**
 * BLS-style 7-digit area code: national 0000000, state SS00000, metro
 * 00MMMMM. The same scheme as BLS series ids, so a code cannot collide
 * across kinds (a state FIPS and a metro CBSA code can share digits).
 */
export function areaCode(kind, rawArea) {
  const a = String(rawArea).trim();
  if (kind === "national") return "0000000";
  if (kind === "state") return `${a.padStart(2, "0")}00000`;
  return a.padStart(7, "0");
}

/**
 * A parsed table row (header name -> cell) to { area, occupation, wage } or
 * null when the row is not one we keep: only cross-industry, all-ownership,
 * detailed occupations with at least a median annual wage.
 */
export function toRecord(row, topCode) {
  const kind = AREA_KIND[Number(row.AREA_TYPE)];
  if (!kind) return null;
  if (row.I_GROUP && row.I_GROUP !== "cross-industry") return null;
  if (row.OWN_CODE && row.OWN_CODE !== "1235") return null;
  if (row.O_GROUP !== "detailed") return null;
  const occ = String(row.OCC_CODE ?? "").trim();
  if (!/^\d{2}-\d{4}$/.test(occ)) return null;

  const pcts = PCT_COLUMNS.map((c) => parseWage(row[c], topCode));
  if (pcts[2].value === null) return null;
  let capped = 0;
  pcts.forEach((p, i) => { if (p.capped) capped |= 1 << i; });

  const code = areaCode(kind, row.AREA);
  return {
    area: { code, kind, name: String(row.AREA_TITLE ?? "").trim(), state: String(row.PRIM_STATE ?? "").trim() || null },
    occupation: { code: occ, title: String(row.OCC_TITLE ?? "").trim() },
    wage: {
      area_code: code,
      occ_code: occ,
      employment: parseEmployment(row.TOT_EMP),
      p10: pcts[0].value,
      p25: pcts[1].value,
      p50: pcts[2].value,
      p75: pcts[3].value,
      p90: pcts[4].value,
      capped,
    },
  };
}
