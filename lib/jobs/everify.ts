// lib/jobs/everify.ts
// E-Verify enrolment for the companies in a user's tracker.
//
// The data is the public E-Verify Employer Search, copied daily by
// scripts/everify/sync.mjs into Supabase Storage as small gzipped shards
// (see lib/jobs/everify-store.ts for why it is not a table). STEM OPT needs
// an employer enrolled in E-Verify, so this is the badge an F-1 student looks
// for first. It is self-reported by employers: the UI must say so and link to
// the official search for a second look.

import { gunzipSync } from 'node:zlib';
import { supabaseAdmin } from '@/supabase/admin';
import {
  EVERIFY_BUCKET, EVERIFY_POINTER, normalizeCompany, shardOf, shardPath,
  type EverifyPointer, type EverifyRecord,
} from '@/lib/jobs/everify-store';

export const EVERIFY_SEARCH_URL = 'https://www.e-verify.gov/e-verify-employer-search';

export type EverifyState = 'enrolled' | 'ending' | 'ended' | 'not-found';

export interface EverifyStatus {
  state: EverifyState;
  /** The employer name as E-Verify has it, when matched. */
  employer: string | null;
  enrolledOn: string | null;
  terminatesOn: string | null;
  workforceSize: string | null;
}

export interface EverifyResult {
  /** Keyed by the company name exactly as it was passed in. */
  statuses: Record<string, EverifyStatus>;
  /** When the last successful daily sync finished; null if none yet. */
  syncedAt: string | null;
  /** False when there is no synced list yet. */
  available: boolean;
}

const MAX_NAMES = 200;
const POINTER_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED_SHARDS = 300;

// Per server instance. Shards are a few kilobytes each and only change with a
// new version, so they are cached by version and shard.
let pointerCache: { at: number; value: EverifyPointer | null } | null = null;
const shardCache = new Map<string, Record<string, EverifyRecord[]>>();

async function readPointer(): Promise<EverifyPointer | null> {
  if (pointerCache && Date.now() - pointerCache.at < POINTER_TTL_MS) return pointerCache.value;
  const { data, error } = await supabaseAdmin.storage.from(EVERIFY_BUCKET).download(EVERIFY_POINTER);
  const value = error || !data ? null : (JSON.parse(await data.text()) as EverifyPointer);
  pointerCache = { at: Date.now(), value };
  return value;
}

async function readShard(version: string, shard: string): Promise<Record<string, EverifyRecord[]>> {
  const key = `${version}/${shard}`;
  const hit = shardCache.get(key);
  if (hit) return hit;
  const { data, error } = await supabaseAdmin.storage.from(EVERIFY_BUCKET).download(shardPath(version, shard));
  // A missing shard means no employer name starts with those characters.
  const value = error || !data
    ? {}
    : (JSON.parse(gunzipSync(Buffer.from(await data.arrayBuffer())).toString('utf8')) as Record<string, EverifyRecord[]>);
  if (shardCache.size >= MAX_CACHED_SHARDS) shardCache.delete(shardCache.keys().next().value as string);
  shardCache.set(key, value);
  return value;
}

/**
 * Open accounts are enrolled. An open account with a termination date ahead
 * is enrolled until then (the source lists some that way). A terminated
 * account, or a termination date that has passed, has ended.
 */
export function everifyState(rec: EverifyRecord, today: string): EverifyState {
  if (rec.te && rec.te <= today) return 'ended';
  if (rec.s === 'o' && rec.te) return 'ending';
  if (rec.s === 'o') return 'enrolled';
  return 'ended';
}

/** Where a company has several accounts: open first, then most recently enrolled. */
export function bestRecord(records: EverifyRecord[]): EverifyRecord | null {
  if (!records.length) return null;
  return [...records].sort((a, b) => (a.s === b.s ? (b.en ?? '').localeCompare(a.en ?? '') : a.s === 'o' ? -1 : 1))[0];
}

export async function lookupEverify(companies: string[]): Promise<EverifyResult> {
  const names = [...new Set(companies.map((c) => c.trim()).filter(Boolean))].slice(0, MAX_NAMES);
  if (!names.length) return { statuses: {}, syncedAt: null, available: true };

  let pointer: EverifyPointer | null;
  try {
    pointer = await readPointer();
  } catch (err) {
    console.error('⚠️ E-Verify pointer read failed:', err);
    return { statuses: {}, syncedAt: null, available: false };
  }
  // No successful sync yet means "not found" would be a guess, not a fact.
  if (!pointer) return { statuses: {}, syncedAt: null, available: false };

  const today = new Date().toISOString().slice(0, 10);
  const statuses: Record<string, EverifyStatus> = {};
  for (const name of names) {
    const key = normalizeCompany(name);
    const shard = key ? await readShard(pointer.version, shardOf(key)) : {};
    const rec = key ? bestRecord(shard[key] ?? []) : null;
    statuses[name] = rec
      ? { state: everifyState(rec, today), employer: rec.e, enrolledOn: rec.en ?? null, terminatesOn: rec.te ?? null, workforceSize: rec.w ?? null }
      : { state: 'not-found', employer: null, enrolledOn: null, terminatesOn: null, workforceSize: null };
  }
  return { statuses, syncedAt: pointer.syncedAt, available: true };
}
