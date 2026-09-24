// lib/outcomes/resume-performance.ts
// "Which of my resumes is actually getting callbacks?"
//
// Pure aggregation over rows the product already collects. No model call, so
// this costs a query and nothing else - which is what makes it viable to show
// on every dashboard load and inside the weekly digest.
import { supabaseAdmin } from '@/supabase/admin';
import {
  isInterview, hasResponded, wasSent,
  MIN_APPLICATIONS_FOR_RATE,
} from '@/lib/config/outcomes';

export interface ResumeStats {
  resumeId: string | null;
  /** File name, or null for applications sent before attribution existed. */
  label: string;
  sent: number;
  interviews: number;
  rejected: number;
  silent: number;
  /** Percent, or null when `sent` is below the reporting threshold. */
  interviewRate: number | null;
  /** Median days from applying to the first employer response, if any. */
  medianDaysToResponse: number | null;
}

export interface OutcomeSummary {
  totalSent: number;
  totalInterviews: number;
  overallRate: number | null;
  byResume: ResumeStats[];
  /** Best and worst only when both clear the threshold and actually differ. */
  bestResumeId: string | null;
  worstResumeId: string | null;
}

interface AppRow {
  resume_id: string | null;
  status: string;
  applied_date: string | null;
  first_response_at: string | null;
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export async function getResumePerformance(supabaseUserId: string): Promise<OutcomeSummary> {
  const [{ data: apps }, { data: resumes }] = await Promise.all([
    supabaseAdmin
      .from('job_applications')
      .select('resume_id, status, applied_date, first_response_at')
      .eq('user_id', supabaseUserId),
    supabaseAdmin
      .from('resumes')
      .select('id, file_name, original_file_name')
      .eq('user_id', supabaseUserId)
      .eq('deleted', false),
  ]);

  const nameOf = new Map<string, string>(
    (resumes ?? []).map(r => [
      r.id as string,
      (r.original_file_name as string | null) ?? (r.file_name as string | null) ?? 'Untitled resume',
    ]),
  );

  // Bucket by resume. `null` is a real bucket, not an error: it holds both
  // applications logged before attribution existed and those whose resume was
  // later deleted (the FK is ON DELETE SET NULL).
  const buckets = new Map<string | null, { sent: number; interviews: number; rejected: number; days: number[] }>();

  for (const raw of (apps ?? []) as AppRow[]) {
    if (!wasSent(raw.status)) continue;

    const key = raw.resume_id;
    const b = buckets.get(key) ?? { sent: 0, interviews: 0, rejected: 0, days: [] };
    b.sent += 1;
    if (isInterview(raw.status)) b.interviews += 1;
    else if (hasResponded(raw.status)) b.rejected += 1;

    if (raw.first_response_at && raw.applied_date) {
      const ms = Date.parse(raw.first_response_at) - Date.parse(raw.applied_date);
      // Guard against a response recorded before the applied date, which
      // happens when someone back-dates an application after the fact.
      if (Number.isFinite(ms) && ms >= 0) b.days.push(Math.round(ms / 86_400_000));
    }

    buckets.set(key, b);
  }

  const byResume: ResumeStats[] = [...buckets.entries()]
    .map(([resumeId, b]) => ({
      resumeId,
      label: resumeId ? nameOf.get(resumeId) ?? 'Deleted resume' : 'No resume linked',
      sent: b.sent,
      interviews: b.interviews,
      rejected: b.rejected,
      silent: b.sent - b.interviews - b.rejected,
      interviewRate: b.sent >= MIN_APPLICATIONS_FOR_RATE
        ? Math.round((b.interviews / b.sent) * 100)
        : null,
      medianDaysToResponse: median(b.days),
    }))
    .sort((a, b) => b.sent - a.sent);

  const totalSent = byResume.reduce((n, r) => n + r.sent, 0);
  const totalInterviews = byResume.reduce((n, r) => n + r.interviews, 0);

  // Best/worst only among resumes with a real rate AND only when they differ.
  // Naming a "worst" resume on a 1-point gap would send someone rewriting
  // something that is performing identically.
  const rated = byResume.filter(r => r.interviewRate !== null && r.resumeId !== null);
  const sortedByRate = [...rated].sort((a, b) => (b.interviewRate ?? 0) - (a.interviewRate ?? 0));
  const spread = sortedByRate.length >= 2
    ? (sortedByRate[0].interviewRate ?? 0) - (sortedByRate[sortedByRate.length - 1].interviewRate ?? 0)
    : 0;

  return {
    totalSent,
    totalInterviews,
    overallRate: totalSent >= MIN_APPLICATIONS_FOR_RATE
      ? Math.round((totalInterviews / totalSent) * 100)
      : null,
    byResume,
    bestResumeId:  spread >= 10 ? sortedByRate[0].resumeId : null,
    worstResumeId: spread >= 10 ? sortedByRate[sortedByRate.length - 1].resumeId : null,
  };
}
