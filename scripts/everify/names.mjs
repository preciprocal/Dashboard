// scripts/everify/names.mjs
// Name normalisation and shard paths for the E-Verify list. Mirrors
// lib/jobs/everify-store.ts (the app's copy) and normalize_company() in
// migration 0055; scripts/verify-everify.ts checks they agree.

const SUFFIXES = /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|pvt|private|sa|ag|bv|lp|llp)\b/g;

/** "Stripe, Inc." and "stripe inc" -> "stripe". */
export function normalizeCompany(raw) {
  const s = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

/** The shard a normalised name lives in: its first two characters. */
export function shardOf(key) {
  const k = key.replace(/ /g, "_");
  return (k.length >= 2 ? k.slice(0, 2) : `${k}_`).replace(/[^a-z0-9_]/g, "_");
}

export const shardPath = (version, shard) => `v/${version}/${shard}.json.gz`;
