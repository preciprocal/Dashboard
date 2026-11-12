// lib/jobs/everify-store.ts
// Where the E-Verify employer list lives, and how a name finds its shard.
//
// The full list is about 1.28 million employers. Stored as table rows it
// needs ~530 MB (peaking near 930 MB during a swap), more than the free
// Supabase database allows. So it lives in Supabase Storage instead, as
// ~1,300 small gzipped JSON shards keyed by the first two characters of the
// normalised company name (about 25-30 MB in total), plus a pointer file.
// scripts/everify/sync.mjs writes it; lib/jobs/everify.ts reads it.
//
//   everify/current.json           { version, syncedAt, rows, sourceUpdated }
//   everify/v/<version>/<shard>.json.gz
//       { "<normalised name>": EverifyRecord[] }  (open accounts first)
//
// normalizeCompany must stay identical to normalize_company() in migration
// 0055 and to the copy in scripts/everify/sync.mjs; scripts/verify-everify.ts
// checks the copies agree.

export const EVERIFY_BUCKET = 'everify';
export const EVERIFY_POINTER = 'current.json';

export interface EverifyPointer {
  version: string;
  syncedAt: string;
  rows: number;
  sourceUpdated: string | null;
}

/** One E-Verify account, kept small: it is stored a million times over. */
export interface EverifyRecord {
  /** Employer name as enrolled. */
  e: string;
  /** Doing-business-as name, if any. */
  d?: string;
  /** Account status: 'o' open, 't' terminated. */
  s: 'o' | 't';
  /** Date enrolled, YYYY-MM-DD. */
  en?: string;
  /** Date terminated, YYYY-MM-DD. */
  te?: string;
  /** Workforce size band, e.g. "100 to 499". */
  w?: string;
}

const SUFFIXES = /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|pvt|private|sa|ag|bv|lp|llp)\b/g;

/** "Stripe, Inc." and "stripe inc" -> "stripe". Mirrors normalize_company(). */
export function normalizeCompany(raw: string | null | undefined): string | null {
  const s = (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || null;
}

/** The shard a normalised name lives in: its first two characters. */
export function shardOf(key: string): string {
  const k = key.replace(/ /g, '_');
  return (k.length >= 2 ? k.slice(0, 2) : `${k}_`).replace(/[^a-z0-9_]/g, '_');
}

export function shardPath(version: string, shard: string): string {
  return `v/${version}/${shard}.json.gz`;
}
