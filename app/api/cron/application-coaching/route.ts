// app/api/cron/application-coaching/route.ts
// Once a day: turn yesterday's tracker changes into at most one coaching email
// per user (lib/email/application-coaching.ts). Triggered by vercel.json.
//
// ─── Rules ──────────────────────────────────────────────────────────────────
//   - An event only counts if the application is STILL at that status. A card
//     dragged to "offer" by mistake and dragged back never emails anyone.
//   - One email per user per day. When several things happened, the one that
//     matters most leads (KIND_PRIORITY) and the rest get a sentence.
//   - "You applied" emails at most once a week. Someone applying daily should
//     not hear from us daily about it.
//   - On a weekly-digest morning, low-stakes news (applied, rejected, ghosted,
//     check-ins) waits a day so nobody gets two emails from us at breakfast.
//     Interviews and offers do not wait: they are time-sensitive.
//   - Events older than four days are dropped rather than sent late. Coaching
//     for a phone screen that already happened is noise.
//   - With no changes, an application sitting at an interview stage for a
//     week gets one check-in, at most every two weeks per application.
//
// Hobby plan note: Vercel runs Hobby crons once a day, anywhere inside the
// scheduled hour. This is scheduled an hour after the weekly digest's hour so
// the digest has always gone first on Mondays.
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';
import {
  sendCoachingEmail,
  describeEvent,
  KIND_PRIORITY,
  SILENT_STATUSES,
  INTERVIEW_STAGES,
  type CoachingKind,
} from '@/lib/email/application-coaching';

export const runtime = 'nodejs';
export const maxDuration = 300;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const APPLIED_EMAIL_EVERY_DAYS = 7;
const MAX_EVENT_AGE_DAYS = 4;
const CHECKIN_AFTER_DAYS = 7;
const CHECKIN_GIVE_UP_DAYS = 30;
const CHECKIN_REPEAT_DAYS = 14;

/** Can wait a day on a digest morning. Everything else is time-sensitive. */
const DEFERRABLE: readonly CoachingKind[] = ['applied', 'rejected', 'ghosted', 'checkin'];

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Optional ?user=<uuid>: run for that one account only. For re-sending a
 * missed email to one person, and for testing against production without
 * emailing anyone else. Still behind CRON_SECRET like the full run.
 */
function onlyUser(req: NextRequest): Record<string, string> {
  const id = req.nextUrl.searchParams.get('user') ?? '';
  return /^[0-9a-f-]{36}$/i.test(id) ? { user_id: id } : {};
}

interface EventRow {
  id: string;
  user_id: string;
  application_id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
}

interface AppRow {
  id: string;
  user_id: string;
  status: string | null;
  company: string | null;
  job_title: string | null;
  resume_id: string | null;
  updated_at: string;
}

const KIND_OF: Record<string, CoachingKind | undefined> = {
  applied: 'applied',
  'phone-screen': 'phone-screen',
  technical: 'technical',
  final: 'final',
  offer: 'offer',
  rejected: 'rejected',
  ghosted: 'ghosted',
};

const rank = (k: CoachingKind) => KIND_PRIORITY.indexOf(k);

async function markEvents(ids: string[], outcome: string): Promise<void> {
  if (ids.length === 0) return;
  await supabaseAdmin
    .from('application_status_events')
    .update({ processed_at: new Date().toISOString(), outcome })
    .in('id', ids);
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const scope = onlyUser(req);
  const iso = (ms: number) => new Date(ms).toISOString();
  const tally = { users: 0, sent: 0, checkins: 0, deferred: 0, skipped: 0, superseded: 0, failed: 0 };

  try {
    // ── Expire events too old to be worth coaching on ─────────────────────
    await supabaseAdmin
      .from('application_status_events')
      .update({ processed_at: iso(now), outcome: 'skipped' })
      .is('processed_at', null)
      .lt('created_at', iso(now - MAX_EVENT_AGE_DAYS * DAY_MS))
      .match(scope);

    const { data: eventRows, error: evErr } = await supabaseAdmin
      .from('application_status_events')
      .select('id, user_id, application_id, from_status, to_status, created_at')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .match(scope)
      .limit(5000);
    if (evErr) throw evErr;

    // ── Interview stages gone quiet, for users with nothing new ───────────
    const { data: stalledRows, error: stErr } = await supabaseAdmin
      .from('job_applications')
      .select('id, user_id, status, company, job_title, resume_id, updated_at')
      .in('status', [...INTERVIEW_STAGES])
      .lt('updated_at', iso(now - CHECKIN_AFTER_DAYS * DAY_MS))
      .gt('updated_at', iso(now - CHECKIN_GIVE_UP_DAYS * DAY_MS))
      .or(`last_nudged_at.is.null,last_nudged_at.lt.${iso(now - CHECKIN_REPEAT_DAYS * DAY_MS)}`)
      .match(scope)
      .limit(2000);
    if (stErr) throw stErr;

    const eventsByUser = new Map<string, EventRow[]>();
    for (const e of (eventRows ?? []) as EventRow[]) {
      const list = eventsByUser.get(e.user_id) ?? [];
      list.push(e);
      eventsByUser.set(e.user_id, list);
    }
    const stalledByUser = new Map<string, AppRow[]>();
    for (const a of (stalledRows ?? []) as AppRow[]) {
      const list = stalledByUser.get(a.user_id) ?? [];
      list.push(a);
      stalledByUser.set(a.user_id, list);
    }

    const userIds = [...new Set([...eventsByUser.keys(), ...stalledByUser.keys()])];
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, ...tally, ms: Date.now() - now });
    }

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('user_id, name, email, application_email_opt_out, application_applied_email_at, weekly_digest_sent_at, weekly_digest_opt_out')
      .in('user_id', userIds);
    const profileOf = new Map((profiles ?? []).map(p => [p.user_id as string, p]));

    for (const userId of userIds) {
      tally.users += 1;
      const events = eventsByUser.get(userId) ?? [];
      const eventIds = events.map(e => e.id);

      try {
        const profile = profileOf.get(userId);
        if (!profile?.email || profile.application_email_opt_out) {
          await markEvents(eventIds, 'skipped');
          tally.skipped += 1;
          continue;
        }

        // ── Keep only events that still describe the application ──────────
        const appIds = [...new Set(events.map(e => e.application_id))];
        const { data: appRows } = appIds.length
          ? await supabaseAdmin
              .from('job_applications')
              .select('id, user_id, status, company, job_title, resume_id, updated_at')
              .in('id', appIds)
          : { data: [] as AppRow[] };
        const appOf = new Map(((appRows ?? []) as AppRow[]).map(a => [a.id, a]));

        // Latest event per application, and only if it still matches.
        const latest = new Map<string, EventRow>();
        for (const e of events) latest.set(e.application_id, e);
        const live: { event: EventRow; app: AppRow; kind: CoachingKind }[] = [];
        const dead: string[] = [];
        const quiet: string[] = [];
        for (const e of events) {
          const app = appOf.get(e.application_id);
          const kind = KIND_OF[e.to_status];
          const isLatest = latest.get(e.application_id)?.id === e.id;
          const stillTrue = app?.status === e.to_status;
          const silent = (SILENT_STATUSES as readonly string[]).includes(e.to_status);
          if (!isLatest || !stillTrue || !app) dead.push(e.id);
          else if (silent || !kind) quiet.push(e.id);
          else live.push({ event: e, app, kind });
        }
        await markEvents(dead, 'superseded');
        await markEvents(quiet, 'skipped');
        tally.superseded += dead.length;

        // ── Decide what this email is about ───────────────────────────────
        live.sort((a, b) => rank(a.kind) - rank(b.kind));
        const stalled = (stalledByUser.get(userId) ?? [])
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

        let kind: CoachingKind;
        let app: AppRow;
        let fromStatus: string | null;
        if (live.length > 0) {
          ({ kind, app } = live[0]);
          fromStatus = live[0].event.from_status;
        } else if (stalled.length > 0) {
          kind = 'checkin';
          app = stalled[0];
          fromStatus = app.status; // the stage it has been sitting at
        } else {
          continue;
        }

        const liveIds = live.map(l => l.event.id);

        if (kind === 'applied') {
          const lastApplied = profile.application_applied_email_at as string | null;
          if (lastApplied && lastApplied > iso(now - APPLIED_EMAIL_EVERY_DAYS * DAY_MS)) {
            await markEvents(liveIds, 'skipped');
            tally.skipped += 1;
            continue;
          }
        }

        const digestAt = profile.weekly_digest_sent_at as string | null;
        if (digestAt && digestAt > iso(now - 12 * HOUR_MS) && DEFERRABLE.includes(kind)) {
          // Left unprocessed on purpose: tomorrow's run picks them up.
          tally.deferred += 1;
          continue;
        }

        // ── Claim, so a re-run or overlapping run cannot double-send ──────
        const { data: claimed } = await supabaseAdmin.rpc('claim_application_email', {
          p_user_id: userId,
          p_not_since: iso(now - 20 * HOUR_MS),
        });
        if (claimed !== true) continue;

        const appliedEvents = live.filter(l => l.kind === 'applied');
        const others = live.filter(l => l.event.id !== live[0]?.event.id && (kind !== 'applied' || l.kind !== 'applied'));
        const alsoHappened = others
          .filter(l => l.kind !== 'applied')
          .map(l => describeEvent(l.app.company || 'a company', l.kind));
        if (kind !== 'applied' && appliedEvents.length > 0) {
          alsoHappened.push(`you logged ${appliedEvents.length} new application${appliedEvents.length === 1 ? '' : 's'}`);
        }

        const { data: allApps } = await supabaseAdmin
          .from('job_applications').select('status').eq('user_id', userId);
        const statuses = (allApps ?? []).map(a => a.status as string);
        const interviewing = statuses.filter(s => (INTERVIEW_STAGES as readonly string[]).includes(s)).length;

        const ok = await sendCoachingEmail({
          userId,
          email: profile.email as string,
          name: profile.name as string | null,
          kind,
          app: {
            company: app.company || 'the company',
            jobTitle: app.job_title || 'the role',
            fromStatus,
            hasResume: Boolean(app.resume_id),
          },
          appliedCount: kind === 'applied' ? Math.max(appliedEvents.length, 1) : 0,
          alsoHappened,
          weeklyDigestOn: profile.weekly_digest_opt_out !== true,
          pipeline: {
            active: statuses.filter(s => s === 'applied').length + interviewing,
            interviewing,
            offers: statuses.filter(s => s === 'offer').length,
          },
          unsubscribeUrl: unsubscribeUrl(userId, 'coaching'),
        });

        if (!ok) {
          tally.failed += 1;
          // Give the day's claim back; events stay pending for tomorrow.
          await supabaseAdmin.from('profiles')
            .update({ application_email_sent_at: null }).eq('user_id', userId);
          continue;
        }

        tally.sent += 1;
        if (kind === 'checkin') {
          tally.checkins += 1;
          await supabaseAdmin.from('job_applications')
            .update({ last_nudged_at: iso(now) }).eq('id', app.id);
        } else {
          await markEvents([live[0].event.id], 'emailed');
          await markEvents(liveIds.filter(id => id !== live[0].event.id), 'mentioned');
        }
        if (kind === 'applied') {
          await supabaseAdmin.from('profiles')
            .update({ application_applied_email_at: iso(now) }).eq('user_id', userId);
        }
      } catch (userErr) {
        tally.failed += 1;
        console.error('⚠️ Coaching failed for user:', userId, userErr);
      }
    }

    console.log('🧭 Application coaching run:', JSON.stringify({ ...tally, ms: Date.now() - now }));
    return NextResponse.json({ success: true, ...tally, ms: Date.now() - now });
  } catch (err) {
    console.error('❌ Application coaching cron failed:', err);
    return NextResponse.json({ error: 'Coaching run failed', ...tally }, { status: 500 });
  }
}
