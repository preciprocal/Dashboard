// lib/jobs/h1b.ts
// H-1B history for the companies in a user's tracker.
//
// The data is the public USCIS H-1B Employer Data Hub, copied monthly by
// scripts/everify/h1b-sync.mjs into the Storage bucket `h1b`, in the same
// shard layout as the E-Verify list (lib/jobs/everify-store.ts):
//
//   h1b/current.json                { version, syncedAt, employers, years, dataThrough }
//   h1b/v/<version>/<shard>.json.gz { "<normalised name>": { n, st?, y: { "2026": [newEmployment, approvals, denials] } } }
//
// Counts are workers, and reflect USCIS's first decision on each petition.
// They show an employer has filed H-1B petitions that were approved, not
// that it will sponsor a given candidate, and the UI must say so.

import { gunzipSync } from 'node:zlib';
import { supabaseAdmin } from '@/supabase/admin';
import { normalizeCompany, shardOf, shardPath } from '@/lib/jobs/everify-store';

export const H1B_HUB_URL = 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub';
const BUCKET = 'h1b';
const POINTER = 'current.json';
const POINTER_TTL_MS = 30 * 60 * 1000;
const MAX_CACHED_SHARDS = 200;

export interface H1bPointer {
  version: string;
  syncedAt: string;
  employers: number;
  /** Fiscal years held, newest first. */
  years: string[];
  /** Last day the source covers, YYYY-MM-DD. */
  dataThrough: string | null;
}

interface H1bRecord {
  n: string;
  st?: string;
  y: Record<string, [number, number, number]>;
}

export interface H1bYear {
  year: string;
  newEmployment: number;
  approvals: number;
  denials: number;
}

export interface H1bHistory {
  /** The employer name as USCIS has it. */
  employer: string;
  state: string | null;
  /** Newest first, one entry per year held (zeros when none that year). */
  years: H1bYear[];
}

let pointerCache: { at: number; value: H1bPointer | null } | null = null;
const shardCache = new Map<string, Record<string, H1bRecord>>();

export async function readH1bPointer(): Promise<H1bPointer | null> {
  if (pointerCache && Date.now() - pointerCache.at < POINTER_TTL_MS) return pointerCache.value;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(POINTER);
  const value = error || !data ? null : (JSON.parse(await data.text()) as H1bPointer);
  pointerCache = { at: Date.now(), value };
  return value;
}

async function readShard(version: string, shard: string): Promise<Record<string, H1bRecord>> {
  const key = `${version}/${shard}`;
  const hit = shardCache.get(key);
  if (hit) return hit;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(shardPath(version, shard));
  const value = error || !data
    ? {}
    : (JSON.parse(gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf8')) as Record<string, H1bRecord>);
  if (shardCache.size >= MAX_CACHED_SHARDS) shardCache.delete(shardCache.keys().next().value as string);
  shardCache.set(key, value);
  return value;
}

function totalApprovals(r: H1bRecord): number {
  return Object.values(r.y).reduce((s, v) => s + v[1], 0);
}

/**
 * The record for a name: the exact normalised name, else the largest employer
 * whose name starts with it as a whole word ("amazon" finds "amazon com
 * services"), since petitions are filed under the legal entity.
 */
export function pickH1bRecord(shard: Record<string, H1bRecord>, key: string): H1bRecord | null {
  if (shard[key]) return shard[key];
  let best: H1bRecord | null = null;
  for (const [k, r] of Object.entries(shard)) {
    if (k.startsWith(`${key} `) && (!best || totalApprovals(r) > totalApprovals(best))) best = r;
  }
  return best;
}

export function toHistory(r: H1bRecord, years: string[]): H1bHistory {
  return {
    employer: r.n,
    state: r.st ?? null,
    years: years.map((year) => {
      const [newEmployment, approvals, denials] = r.y[year] ?? [0, 0, 0];
      return { year, newEmployment, approvals, denials };
    }),
  };
}

/** H-1B history per name; null for a name with no record. Empty when no sync has run. */
export async function lookupH1b(names: string[]): Promise<{ histories: Record<string, H1bHistory | null>; pointer: H1bPointer | null }> {
  const pointer = await readH1bPointer().catch(() => null);
  if (!pointer) return { histories: {}, pointer: null };
  const histories: Record<string, H1bHistory | null> = {};
  for (const name of names) {
    const key = normalizeCompany(name);
    const rec = key ? pickH1bRecord(await readShard(pointer.version, shardOf(key)), key) : null;
    histories[name] = rec ? toHistory(rec, pointer.years) : null;
  }
  return { histories, pointer };
}
