// lib/outcomes/follow-ups.ts
// Applications that have gone quiet and are worth chasing.
//
// The job tracker is a passive list: it records that you applied and then does
// nothing with that fact. This turns it into something that notices silence on
// the user's behalf, which is the part people are worst at doing themselves.
import { supabaseAdmin } from '@/supabase/admin';
import {
  FOLLOW_UP_AFTER_DAYS,
  FOLLOW_UP_STALE_AFTER_DAYS,
  RENUDGE_AFTER_DAYS,
  MAX_FOLLOW_UPS_PER_DIGEST,
} from '@/lib/config/outcomes';

export interface FollowUp {
  id: string;
  company: string;
  jobTitle: string;
  appliedDate: string;
  daysSilent: number;
}

const DAY_MS = 86_400_000;
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Applications still sitting at 'applied' inside the chase window.
 *
 * Bounded at both ends on purpose. Younger than FOLLOW_UP_AFTER_DAYS is just a
 * normal hiring process, and older than FOLLOW_UP_STALE_AFTER_DAYS is a dead
 * lead where a nudge reads as desperate rather than diligent.
 */
export async function getFollowUps(supabaseUserId: string): Promise<FollowUp[]> {
  const now = Date.now();
  const newest = dateOnly(now - FOLLOW_UP_AFTER_DAYS * DAY_MS);
  const oldest = dateOnly(now - FOLLOW_UP_STALE_AFTER_DAYS * DAY_MS);
  const renudgeCutoff = new Date(now - RENUDGE_AFTER_DAYS * DAY_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from('job_applications')
    .select('id, company, job_title, applied_date, last_nudged_at')
    .eq('user_id', supabaseUserId)
    .eq('status', 'applied')
    .lte('applied_date', newest)
    .gte('applied_date', oldest)
    // Either never nudged, or nudged long enough ago to mention again. Without
    // this the same silent application appears in every weekly digest until
    // the user changes its status, which is how a useful email becomes noise.
    .or(`last_nudged_at.is.null,last_nudged_at.lt.${renudgeCutoff}`)
    .order('applied_date', { ascending: false })
    .limit(MAX_FOLLOW_UPS_PER_DIGEST);

  if (error) {
    console.error('⚠️ follow-up lookup failed:', error);
    return [];
  }

  return (data ?? []).map(row => ({
    id: row.id as string,
    company: (row.company as string | null) ?? 'Unknown company',
    jobTitle: (row.job_title as string | null) ?? 'Unknown role',
    appliedDate: row.applied_date as string,
    daysSilent: Math.max(
      0,
      Math.floor((now - Date.parse(row.applied_date as string)) / DAY_MS),
    ),
  }));
}

/**
 * Mark these applications as nudged.
 *
 * Called only after the digest has actually been sent. Stamping before the send
 * would silence a follow-up that the user never saw, which is the more
 * expensive failure: a duplicate nudge is mildly annoying, a dropped one costs
 * them the interview.
 */
export async function markNudged(applicationIds: string[]): Promise<void> {
  if (applicationIds.length === 0) return;
  try {
    const { error } = await supabaseAdmin
      .from('job_applications')
      .update({ last_nudged_at: new Date().toISOString() })
      .in('id', applicationIds);
    if (error) throw error;
  } catch (err) {
    console.error('⚠️ Could not stamp last_nudged_at (non-fatal):', err);
  }
}
