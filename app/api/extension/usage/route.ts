// app/api/extension/usage/route.ts
// The signed-in user's Chrome extension activity, for the /extension page.
//
// The extension does not log usage events of its own. What it leaves behind:
//  - job_applications rows it creates via /api/extension/track-job. LinkedIn
//    saves are stored with source 'chrome_extension' (and a linkedin_job_id);
//    application-form auto-tracking stores the ATS platform name as source.
//  - cover_letters started from a LinkedIn job carry a linkedin_job_id.
// Job analyses and form auto-fills are not recorded anywhere, so they are
// not reported here.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

export const runtime = 'nodejs';

// Must match PLATFORM_NAMES in extension/external-apply.js.
const ATS_PLATFORMS = [
  'Greenhouse', 'Lever', 'Workday', 'Indeed', 'Ashby', 'iCIMS', 'Jobvite',
  'SmartRecruiters', 'Taleo', 'BambooHR', 'Recruitee', 'Wellfound',
];
const INTERVIEW_STAGES = new Set(['phone-screen', 'technical', 'final', 'offer']);
const WEEKS = 12;

interface JobRow {
  id: string; company: string | null; job_title: string | null; status: string | null;
  source: string | null; linkedin_job_id: string | null; job_url: string | null; created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const platformList = ATS_PLATFORMS.map(p => `"${p}"`).join(',');
    const [jobsRes, lettersRes] = await Promise.all([
      supabaseAdmin
        .from('job_applications')
        .select('id, company, job_title, status, source, linkedin_job_id, job_url, created_at')
        .eq('user_id', uid)
        .or(`source.eq.chrome_extension,linkedin_job_id.not.is.null,source.in.(${platformList})`)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabaseAdmin
        .from('cover_letters')
        .select('id, job_role, company_name, created_at')
        .eq('user_id', uid)
        .not('linkedin_job_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (jobsRes.error) throw jobsRes.error;
    if (lettersRes.error) throw lettersRes.error;

    const jobs = (jobsRes.data ?? []) as JobRow[];
    const letters = lettersRes.data ?? [];

    // Where each job came from: LinkedIn saves vs. an ATS application form.
    const platformOf = (j: JobRow) =>
      j.source && ATS_PLATFORMS.includes(j.source) ? j.source : 'LinkedIn';
    const byPlatform = new Map<string, number>();
    for (const j of jobs) byPlatform.set(platformOf(j), (byPlatform.get(platformOf(j)) ?? 0) + 1);

    // Weekly activity, oldest first, Monday-based weeks.
    const startOfWeek = (d: Date) => {
      const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
      return x;
    };
    const thisWeek = startOfWeek(new Date());
    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(thisWeek); start.setUTCDate(start.getUTCDate() - (WEEKS - 1 - i) * 7);
      return { weekStart: start.toISOString().slice(0, 10), jobs: 0, coverLetters: 0 };
    });
    const bucket = (iso: string) => {
      const k = startOfWeek(new Date(iso)).toISOString().slice(0, 10);
      return weeks.find(w => w.weekStart === k);
    };
    for (const j of jobs) { const w = bucket(j.created_at); if (w) w.jobs++; }
    for (const l of letters) { const w = bucket(l.created_at as string); if (w) w.coverLetters++; }

    const dates = [...jobs.map(j => j.created_at), ...letters.map(l => l.created_at as string)].sort();

    return NextResponse.json({
      totals: {
        jobsTracked: jobs.length,
        fromLinkedIn: jobs.filter(j => platformOf(j) === 'LinkedIn').length,
        autoTracked: jobs.filter(j => platformOf(j) !== 'LinkedIn').length,
        coverLetters: letters.length,
        reachedInterview: jobs.filter(j => INTERVIEW_STAGES.has(j.status ?? '')).length,
        offers: jobs.filter(j => j.status === 'offer').length,
      },
      byPlatform: [...byPlatform.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      weekly: weeks,
      recentJobs: jobs.slice(0, 8).map(j => ({
        id: j.id, company: j.company, jobTitle: j.job_title, status: j.status,
        platform: platformOf(j), url: j.job_url, createdAt: j.created_at,
      })),
      recentCoverLetters: letters.slice(0, 5).map(l => ({
        id: l.id, jobRole: l.job_role, company: l.company_name, createdAt: l.created_at,
      })),
      firstUsedAt: dates[0] ?? null,
      lastUsedAt: dates[dates.length - 1] ?? null,
    });
  } catch (error) {
    console.error('Extension usage error:', error);
    return NextResponse.json({ error: 'Failed to load extension activity' }, { status: 500 });
  }
}
