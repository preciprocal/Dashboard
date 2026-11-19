// app/api/cron/job-alerts/route.ts
// New jobs that match each student's job setup (lib/email/job-alerts.ts).
// Triggered by the Vercel cron entry in vercel.json, twice a week.
//
// Off until JOB_ALERTS_ENABLED=1: a full run emails every student with a
// finished job setup, so it is switched on deliberately. ?user=<uuid> runs for
// one account even while it is off, to check a real send without emailing
// anyone else. Both are behind CRON_SECRET.
//
// Who gets one: a finished job setup (jobPreferences.completedAt), not opted
// out (Settings > Notifications, or the email's unsubscribe link), and at
// least one posting new since their last alert. The last-sent time is stamped
// before sending, so a retried or overlapping run cannot send twice; a send
// that fails after the stamp waits for the next run, which is the right way
// round for an email people can unsubscribe from.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { getFeed } from '@/lib/jobs/feed';
import { readPreferences } from '@/lib/onboarding/preferences';
import { alertSince, buildJobAlertEmail, pickAlertJobs, sendJobAlertEmail } from '@/lib/email/job-alerts';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Two runs a week; anything sent within this counts as this run's. */
const MIN_GAP_MS = 2.5 * 86_400_000;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Settings = { notifications?: { jobAlerts?: boolean }; jobAlerts?: { lastSentAt?: string } } & Record<string, unknown>;

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const only = req.nextUrl.searchParams.get('user') ?? '';
  const scoped = /^[0-9a-f-]{36}$/i.test(only);
  if (!scoped && process.env.JOB_ALERTS_ENABLED !== '1') {
    return NextResponse.json({ skipped: true, reason: 'JOB_ALERTS_ENABLED is not 1' });
  }

  const feed = await getFeed();
  if (!feed) return NextResponse.json({ error: 'The job feed is not available' }, { status: 503 });

  let query = supabaseAdmin.from('profiles').select('user_id, name, email, extended_data').limit(5000);
  if (scoped) query = query.eq('user_id', only);
  const { data: profiles, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let considered = 0, sent = 0, nothingNew = 0, optedOut = 0, recent = 0, failed = 0;
  const now = Date.now();
  for (const p of profiles ?? []) {
    const ext = (p.extended_data as Record<string, unknown> | null) ?? {};
    const prefs = readPreferences(ext.jobPreferences);
    if (!prefs.completedAt || !p.email) continue;
    considered += 1;

    const { data: row } = await supabaseAdmin.from('user_settings').select('settings').eq('user_id', p.user_id).maybeSingle();
    const settings = ((row?.settings as Settings | null) ?? {}) as Settings;
    if (settings.notifications?.jobAlerts === false) { optedOut += 1; continue; }
    const last = settings.jobAlerts?.lastSentAt;
    if (!scoped && last && now - Date.parse(last) < MIN_GAP_MS) { recent += 1; continue; }

    const pick = pickAlertJobs(feed.jobs, prefs, alertSince(last, now));
    if (!pick.jobs.length) { nothingNew += 1; continue; }

    // Stamp first, then send.
    const { error: stampErr } = await supabaseAdmin.from('user_settings').upsert({
      user_id: p.user_id,
      settings: { ...settings, jobAlerts: { ...(settings.jobAlerts ?? {}), lastSentAt: new Date(now).toISOString() } },
      updated_at: new Date(now).toISOString(),
    }, { onConflict: 'user_id' });
    if (stampErr) { failed += 1; continue; }

    const unsub = unsubscribeUrl(p.user_id as string, 'jobAlerts');
    const email = buildJobAlertEmail({ name: p.name as string | null, prefs, pick, h1bYear: feed.h1bYear, unsubscribeUrl: unsub });
    if (await sendJobAlertEmail(p.email as string, email, unsub)) sent += 1;
    else failed += 1;
  }
  return NextResponse.json({ considered, sent, nothingNew, optedOut, recent, failed });
}
