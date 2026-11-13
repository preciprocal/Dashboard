// lib/salary/lookup.ts
// Market pay for a (job title, location), from the BLS OEWS tables that
// scripts/salary/ingest.mjs loads (migration 0064).
//
// Matching is deterministic (lib/salary/match-title.ts, match-location.ts).
// Only when no title rule or BLS title fits is a model asked to pick from a
// shortlist of SOC codes; that answer is cached for a month per title, so the
// same odd title never costs twice.
//
// Before 0064 is applied, or before the first ingest, the RPC fails or
// returns nothing and this reports `unavailable`; the page then shows a quiet
// "not available yet" note instead of an error.

import 'server-only';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { createMessage, extractText } from '@/lib/ai/claude';
import { matchTitle, normalizeTitle, shortlist, occupationTitle, isKnownOccupation } from '@/lib/salary/match-title';
import { matchLocation, NATIONAL_AREA } from '@/lib/salary/match-location';
import type { WageBand } from '@/lib/salary/position';

export const OEWS_SOURCE_URL = 'https://www.bls.gov/oes/tables.htm';

export type OccupationSource = 'curated' | 'bls-title' | 'ai' | 'user';

export interface SalaryOccupation { code: string; title: string }

export interface SalaryResult {
  status: 'ok';
  occupation: SalaryOccupation & { source: OccupationSource };
  alternatives: SalaryOccupation[];
  area: {
    code: string;
    kind: 'metro' | 'state' | 'national';
    name: string;
    /** The location asked for matched something narrower than the data shown. */
    fellBack: boolean;
    /** The location was remote or not recognised, so national figures are shown. */
    remote: boolean;
  };
  wages: WageBand & { employment: number | null };
  year: number;
  topCode: number;
  sourceUrl: string;
}

export type SalaryResponse =
  | SalaryResult
  | { status: 'unavailable' }
  | { status: 'no-match'; alternatives: SalaryOccupation[] }
  | { status: 'no-data'; occupation: SalaryOccupation & { source: OccupationSource }; alternatives: SalaryOccupation[] };

interface LookupRow {
  occ_code: string; occ_title: string; area_code: string; area_kind: 'metro' | 'state' | 'national';
  area_name: string; area_state: string | null; employment: number | null;
  p10: number | null; p25: number | null; p50: number; p75: number | null; p90: number | null; capped: number;
  data_year: number; top_code: number; source_url: string;
}

const CACHE_VERSION = 1;
const RESULT_TTL = 7 * 24 * 3600;
const AI_TTL = 30 * 24 * 3600;

const toOcc = (code: string): SalaryOccupation | null => {
  const title = occupationTitle(code);
  return title ? { code, title } : null;
};

async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try { return (await redis.get<T>(key)) ?? null; } catch { return null; }
}
async function cacheSet(key: string, value: unknown, ttl: number): Promise<void> {
  if (!redis) return;
  try { await redis.set(key, value, { ex: ttl }); } catch { /* the cache is optional */ }
}

/** Asks a model to choose one SOC code from a shortlist. Cached per title. */
async function aiPick(title: string): Promise<string | null> {
  const norm = normalizeTitle(title);
  if (!norm || norm.length < 3) return null;
  const key = `salary:ai:v${CACHE_VERSION}:${norm}`;
  const cached = await cacheGet<{ code: string | null }>(key);
  if (cached) return cached.code;

  const options = shortlist(title).map((c) => `${c} ${occupationTitle(c)}`).join('\n');
  let code: string | null = null;
  try {
    const res = await createMessage({
      max_tokens: 20,
      system: 'You map job titles to US Standard Occupational Classification codes. Reply with exactly one code from the list, or NONE if none fits.',
      messages: [{ role: 'user', content: `Job title: ${title.slice(0, 120)}\n\nCodes:\n${options}` }],
    });
    const found = extractText(res).match(/\d{2}-\d{4}/)?.[0] ?? null;
    code = found && isKnownOccupation(found) ? found : null;
  } catch (err) {
    console.error('salary ai match failed:', err);
    return null; // not cached: a transient failure should not stick for a month
  }
  await cacheSet(key, { code }, AI_TTL);
  return code;
}

async function queryWages(occ: string, areas: string[]): Promise<LookupRow | null | 'unavailable'> {
  const { data, error } = await supabaseAdmin.rpc('salary_lookup', { p_occ: occ, p_areas: areas });
  // Function missing (migration not applied) or any other failure: show
  // nothing rather than an error.
  if (error) {
    console.warn('salary_lookup unavailable:', error.message);
    return 'unavailable';
  }
  const rows = (data ?? []) as LookupRow[];
  return rows[0] ?? null;
}

/** Is any release loaded? Distinguishes "nothing loaded" from "no data for this occupation". */
async function anyLoaded(): Promise<boolean> {
  const row = await queryWages('15-1252', [NATIONAL_AREA]);
  return row !== null && row !== 'unavailable';
}

export async function lookupSalary(input: { title: string; location?: string | null; occ?: string | null; allowAi?: boolean }): Promise<SalaryResponse> {
  // 1. Occupation: the user's pick, then the deterministic match, then a model.
  let code: string | null = null;
  let source: OccupationSource = 'curated';
  let altCodes: string[] = [];
  if (input.occ && isKnownOccupation(input.occ)) {
    code = input.occ;
    source = 'user';
    altCodes = matchTitle(input.title)?.alternatives ?? [];
  } else {
    const m = matchTitle(input.title);
    if (m) { code = m.code; source = m.source; altCodes = m.alternatives; }
    else if (input.allowAi !== false) {
      code = await aiPick(input.title);
      source = 'ai';
    }
  }
  const alternatives = altCodes.map(toOcc).filter((o): o is SalaryOccupation => !!o && o.code !== code);
  if (!code) return { status: 'no-match', alternatives: shortlist(input.title, 6).map(toOcc).filter((o): o is SalaryOccupation => !!o) };

  // 2. Area candidates, then the first one with data.
  const loc = matchLocation(input.location);
  const cacheKey = `salary:v${CACHE_VERSION}:${code}:${loc.candidates.join(',')}`;
  let row = await cacheGet<LookupRow>(cacheKey);
  if (!row) {
    const fresh = await queryWages(code, loc.candidates);
    if (fresh === 'unavailable') return { status: 'unavailable' };
    if (!fresh) {
      const occupation = { ...(toOcc(code) as SalaryOccupation), source };
      return (await anyLoaded()) ? { status: 'no-data', occupation, alternatives } : { status: 'unavailable' };
    }
    row = fresh;
    await cacheSet(cacheKey, row, RESULT_TTL);
  }

  return {
    status: 'ok',
    occupation: { code: row.occ_code, title: row.occ_title, source },
    alternatives,
    area: {
      code: row.area_code,
      kind: row.area_kind,
      name: row.area_kind === 'national' ? 'United States' : row.area_name,
      fellBack: row.area_code !== loc.candidates[0],
      remote: loc.remote,
    },
    wages: { p10: row.p10, p25: row.p25, p50: row.p50, p75: row.p75, p90: row.p90, capped: row.capped, employment: row.employment },
    year: row.data_year,
    topCode: row.top_code,
    sourceUrl: OEWS_SOURCE_URL,
  };
}
