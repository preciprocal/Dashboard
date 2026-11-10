// lib/jobs/everify.ts
// E-Verify enrolment for the companies in a user's tracker.
//
// The data is the public E-Verify Employer Search, copied daily into
// everify_employers by scripts/everify/sync.mjs (migration 0058). STEM OPT
// needs an employer enrolled in E-Verify, so this is the badge an F-1 student
// looks for first. It is self-reported by employers: the UI must say so and
// link to the official search for a second look.

import { supabaseAdmin } from '@/supabase/admin';

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
  /** False when the table is not there yet (migration 0058 not applied). */
  available: boolean;
}

const MAX_NAMES = 200;

/**
 * Open accounts are enrolled. An open account with a termination date ahead
 * is enrolled until then (the source lists some that way). A closed account,
 * or a termination date that has passed, has ended.
 */
function stateOf(status: string | null, terminatesOn: string | null, today: string): EverifyState {
  const open = (status ?? '').toLowerCase() === 'open';
  if (terminatesOn && terminatesOn <= today) return 'ended';
  if (open && terminatesOn) return 'ending';
  if (open) return 'enrolled';
  return 'ended';
}

export async function lookupEverify(companies: string[]): Promise<EverifyResult> {
  const names = [...new Set(companies.map((c) => c.trim()).filter(Boolean))].slice(0, MAX_NAMES);
  if (!names.length) return { statuses: {}, syncedAt: null, available: true };

  const { data, error } = await supabaseAdmin.rpc('everify_lookup', { p_names: names });
  if (error) {
    // Most likely migration 0058 is not applied yet: show nothing rather than fail.
    console.error('⚠️ everify_lookup failed:', error.message);
    return { statuses: {}, syncedAt: null, available: false };
  }

  const rows = (data ?? []) as Array<{
    name: string; employer: string | null; account_status: string | null;
    date_enrolled: string | null; date_terminated: string | null;
    workforce_size: string | null; synced_at: string | null;
  }>;
  const today = new Date().toISOString().slice(0, 10);
  const syncedAt = rows.find((r) => r.synced_at)?.synced_at ?? null;

  // No successful sync yet means "not found" would be a guess, not a fact.
  if (!syncedAt) return { statuses: {}, syncedAt: null, available: false };

  const statuses: Record<string, EverifyStatus> = {};
  for (const r of rows) {
    statuses[r.name] = r.employer
      ? {
          state: stateOf(r.account_status, r.date_terminated, today),
          employer: r.employer,
          enrolledOn: r.date_enrolled,
          terminatesOn: r.date_terminated,
          workforceSize: r.workforce_size,
        }
      : { state: 'not-found', employer: null, enrolledOn: null, terminatesOn: null, workforceSize: null };
  }
  return { statuses, syncedAt, available: true };
}
