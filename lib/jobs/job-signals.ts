// lib/jobs/job-signals.ts
// The database half of job signals: pooled company odds and the user's own
// history, both through security-definer functions in migration 0055.
//
// Pooled stats are the same for everyone, so they are cached per company for
// a few hours. Personal history is never cached: it changes the moment the
// user logs an application, and showing stale "you never applied here" right
// after they did would look broken.
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import {
  buildJobSignals,
  MIN_USERS_FOR_COMPANY_ODDS,
  type CompanyOdds,
  type JobSignals,
  type PersonalHistory,
  type PostingInput,
} from '@/lib/jobs/posting-signals';

const COMPANY_ODDS_TTL_SECONDS = 6 * 60 * 60;

const cacheKey = (company: string) =>
  `job-signals:company:v1:${company.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120)}`;

export async function getCompanyOdds(company: string): Promise<CompanyOdds | null> {
  if (!company.trim()) return null;

  if (redis) {
    try {
      const hit = await redis.get(cacheKey(company));
      if (hit) return (typeof hit === 'string' ? JSON.parse(hit) : hit) as CompanyOdds;
    } catch { /* cache is best effort */ }
  }

  const { data, error } = await supabaseAdmin.rpc('company_outcome_stats', {
    p_company: company,
    p_min_users: MIN_USERS_FOR_COMPANY_ODDS,
  });
  if (error) {
    // Most likely migration 0055 is not applied yet. Signals still work from
    // the posting alone, so this degrades rather than failing the request.
    console.error('⚠️ company_outcome_stats failed:', error.message);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const odds: CompanyOdds = {
    distinctUsers: Number(row.distinct_users ?? 0),
    applications: num(row.applications),
    responded: num(row.responded),
    interviews: num(row.interviews),
    silent30d: num(row.silent_30d),
    medianDaysToResponse: num(row.median_days_to_response),
  };

  if (redis) {
    try { await redis.setex(cacheKey(company), COMPANY_ODDS_TTL_SECONDS, JSON.stringify(odds)); } catch { /* best effort */ }
  }
  return odds;
}

export async function getMyCompanyHistory(
  supabaseUserId: string,
  company: string,
  excludeLinkedInJobId: string | null = null,
): Promise<PersonalHistory | null> {
  if (!company.trim()) return null;
  const { data, error } = await supabaseAdmin.rpc('my_company_history', {
    p_user: supabaseUserId,
    p_company: company,
    p_exclude_linkedin_job_id: excludeLinkedInJobId,
  });
  if (error) {
    console.error('⚠️ my_company_history failed:', error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    applications: Number(row.applications ?? 0),
    interviews: Number(row.interviews ?? 0),
    rejected: Number(row.rejected ?? 0),
    lastApplied: (row.last_applied as string | null) ?? null,
  };
}

export async function getJobSignals(
  supabaseUserId: string,
  company: string,
  posting: PostingInput,
  linkedInJobId: string | null = null,
): Promise<JobSignals> {
  const [odds, mine] = await Promise.all([
    getCompanyOdds(company),
    getMyCompanyHistory(supabaseUserId, company, linkedInJobId),
  ]);
  return buildJobSignals(posting, odds, mine);
}
