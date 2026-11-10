// lib/outcomes/funnel-data.ts
// Reads one user's applications and status history into FunnelRows.
import { supabaseAdmin } from '@/supabase/admin';
import type { FunnelRow } from '@/lib/outcomes/funnel';

interface AppRow {
  id: string;
  status: string | null;
  applied_date: string | null;
  updated_at: string | null;
  reached_interview_at: string | null;
  source: string | null;
  posted_days_ago?: number | null;
  reposted?: boolean | null;
}

/**
 * Older extension versions wrote these. Same mapping as the job-tracker
 * route's normaliseRow, so the funnel and the board agree on every card.
 */
const LEGACY_STATUS: Record<string, string> = {
  Applied: 'applied', 'Under Review': 'applied', Interview: 'phone-screen',
  interviewing: 'phone-screen', Offer: 'offer', Rejected: 'rejected',
  Withdrawn: 'withdrew', withdrawn: 'withdrew',
};
const normaliseStatus = (s: string | null) => (s ? LEGACY_STATUS[s] ?? s : 'applied');

const BASE_COLS = 'id, status, applied_date, updated_at, reached_interview_at, source';

export async function loadFunnelRows(supabaseUserId: string): Promise<FunnelRow[]> {
  // The posting columns arrive with migration 0055. Before it is applied the
  // funnel still works, just without the posting-age comparison.
  let apps: AppRow[] | null = null;
  const withPosting = await supabaseAdmin
    .from('job_applications')
    .select(`${BASE_COLS}, posted_days_ago, reposted`)
    .eq('user_id', supabaseUserId);
  if (withPosting.error) {
    const plain = await supabaseAdmin.from('job_applications').select(BASE_COLS).eq('user_id', supabaseUserId);
    if (plain.error) throw plain.error;
    apps = plain.data as AppRow[];
  } else {
    apps = withPosting.data as AppRow[];
  }

  const { data: events, error: evErr } = await supabaseAdmin
    .from('application_status_events')
    .select('application_id, to_status')
    .eq('user_id', supabaseUserId);
  if (evErr) console.error('⚠️ status events unavailable for funnel:', evErr.message);

  const history = new Map<string, string[]>();
  for (const e of events ?? []) {
    const id = e.application_id as string;
    history.set(id, [...(history.get(id) ?? []), e.to_status as string]);
  }

  return (apps ?? []).map(a => ({
    status: normaliseStatus(a.status),
    appliedDate: a.applied_date,
    updatedAt: a.updated_at,
    reachedInterviewAt: a.reached_interview_at,
    pastStatuses: (history.get(a.id) ?? []).map(normaliseStatus),
    source: a.source,
    postedDaysAgo: a.posted_days_ago ?? null,
    reposted: a.reposted ?? null,
  }));
}
