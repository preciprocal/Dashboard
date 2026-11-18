// app/api/job-tracker/schedule/route.ts
// Interview times on tracker cards, mirrored to the connected calendar
// (Google Calendar or Outlook; one at a time).
//
//   GET                         every schedule + the calendar status
//   POST {applicationId, date, time, timeZone, durationMinutes, stage,
//         meetingUrl?, notes?, calendar?: boolean}
//                               create or reschedule; calendar=true writes the event
//                               (google=true is the older name and still works)
//   DELETE ?applicationId=      remove the schedule and its calendar event
//
// A schedule is useful without a calendar (the card shows it, the user
// downloads an .ics), so a calendar failure never loses the save: the
// response says what happened to the event and the UI offers a reconnect or
// the .ics instead.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { ReconnectRequiredError, type CalendarConfig } from '@/lib/calendar/oauth';
import { readCalendars } from '@/lib/calendar/server-status';
import {
  listSchedules, getSchedule, withAccessToken, SchemaMissingError, isMissingTable, scheduleCols, type ScheduleRow,
} from '@/lib/calendar/store';
import { withMicrosoftAccessToken, type MicrosoftConnection } from '@/lib/calendar/microsoft-store';
import { insertEvent, patchEvent, deleteEvent, listOurEvents, GoogleApiError } from '@/lib/calendar/google-api';
import { insertOutlookEvent, patchOutlookEvent, deleteOutlookEvent, getOutlookEvents, GraphApiError } from '@/lib/calendar/microsoft-api';
import { buildGoogleEvent, buildOutlookEvent, resolveSchedule, reconcileEvent, parseStage, cleanMeetingUrl, type GoogleEventLite } from '@/lib/calendar/events';
import type { GoogleSyncResult, InterviewSchedule } from '@/lib/calendar/status';
import type { StoredConnection } from '@/lib/calendar/tokens';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDto(r: ScheduleRow): InterviewSchedule {
  const onCalendar = r.google_event_id ? 'google' : r.microsoft_event_id ? 'microsoft' : null;
  return {
    applicationId: r.application_id, startsAt: r.starts_at, endsAt: r.ends_at, timeZone: r.time_zone,
    stage: r.stage, meetingUrl: r.meeting_url, notes: r.notes, onGoogle: !!r.google_event_id, onCalendar,
  };
}

const RECONCILE_WINDOW = { pastMs: 24 * 3600_000, futureMs: 120 * 24 * 3600_000 };

/** Throttle per user and provider so loading the tracker does not call the calendar every time. */
async function shouldReconcile(key: string): Promise<boolean> {
  if (!redis) return true;
  try {
    return (await redis.set(key, '1', { nx: true, ex: 120 })) !== null;
  } catch {
    return true;
  }
}

/** Apply what changed in the calendar: a moved event moves the card, a deleted one drops the link. */
async function applyChanges(
  rows: ScheduleRow[],
  idOf: (r: ScheduleRow) => string | null | undefined,
  unlink: Partial<ScheduleRow>,
  events: Map<string, GoogleEventLite | undefined>,
  min: number,
  max: number,
): Promise<ScheduleRow[]> {
  const out: ScheduleRow[] = [];
  for (const r of rows) {
    const id = idOf(r);
    const start = new Date(r.starts_at).getTime();
    if (!id || start < min || start > max) { out.push(r); continue; }
    const change = reconcileEvent({ startsAt: r.starts_at, endsAt: r.ends_at }, events.get(id));
    if (change.kind === 'moved') {
      await supabaseAdmin.from('interview_schedules').update({ starts_at: change.startsAt, ends_at: change.endsAt, updated_at: new Date().toISOString() }).eq('id', r.id);
      out.push({ ...r, starts_at: change.startsAt, ends_at: change.endsAt });
    } else if (change.kind === 'deleted') {
      await supabaseAdmin.from('interview_schedules').update({ ...unlink, updated_at: new Date().toISOString() }).eq('id', r.id);
      out.push({ ...r, ...unlink });
    } else {
      out.push(r);
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

async function reconcileGoogle(rows: ScheduleRow[], conn: StoredConnection, cfg: CalendarConfig): Promise<ScheduleRow[]> {
  if (!rows.some((r) => r.google_event_id)) return rows;
  if (!(await shouldReconcile(`gcal:reconcile:${conn.user_id}`))) return rows;
  const now = Date.now();
  const min = new Date(now - RECONCILE_WINDOW.pastMs);
  const max = new Date(now + RECONCILE_WINDOW.futureMs);
  const events = await withAccessToken(conn, cfg, (t, cal) => listOurEvents(t, cal, min, max));
  // Google returns every one of our events in the window, so a missing id means deleted.
  const byId = new Map<string, GoogleEventLite | undefined>(events.map((e) => [e.id, e]));
  return applyChanges(rows, (r) => r.google_event_id, { google_event_id: null, google_calendar_id: null }, byId, min.getTime(), max.getTime());
}

async function reconcileMicrosoft(rows: ScheduleRow[], conn: MicrosoftConnection, cfg: CalendarConfig): Promise<ScheduleRow[]> {
  const now = Date.now();
  const min = now - RECONCILE_WINDOW.pastMs;
  const max = now + RECONCILE_WINDOW.futureMs;
  const ids = rows
    .filter((r) => r.microsoft_event_id && new Date(r.starts_at).getTime() >= min && new Date(r.starts_at).getTime() <= max)
    .map((r) => r.microsoft_event_id!)
    .slice(0, 25);
  if (!ids.length) return rows;
  if (!(await shouldReconcile(`mscal:reconcile:${conn.user_id}`))) return rows;
  const events = await withMicrosoftAccessToken(conn, cfg, (t) => getOutlookEvents(t, ids));
  return applyChanges(rows, (r) => (r.microsoft_event_id && events.has(r.microsoft_event_id) ? r.microsoft_event_id : null), { microsoft_event_id: null }, events, min, max);
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cals = await readCalendars(user.supabaseUserId);

  try {
    let rows = await listSchedules(user.supabaseUserId);
    try {
      if (cals.status.connected && cals.status.provider === 'google' && cals.google?.conn) rows = await reconcileGoogle(rows, cals.google.conn, cals.google.cfg);
      if (cals.status.connected && cals.status.provider === 'microsoft' && cals.microsoft?.conn) rows = await reconcileMicrosoft(rows, cals.microsoft.conn, cals.microsoft.cfg);
    } catch (err) {
      // Reading the calendar is a nicety here; the stored times still show.
      if (!(err instanceof ReconnectRequiredError)) console.error('schedule reconcile:', err instanceof Error ? err.message : err);
    }
    // A reconcile may have just discovered a revoked grant.
    const finalStatus = cals.status.connected ? (await readCalendars(user.supabaseUserId)).status : cals.status;
    return NextResponse.json({ schemaReady: true, schedules: rows.map(toDto), calendar: finalStatus }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (!(err instanceof SchemaMissingError)) console.error('schedule GET:', err);
    return NextResponse.json({ schemaReady: false, schedules: [], calendar: cals.status });
  }
}

async function loadApplication(userId: string, id: string) {
  const { data } = await supabaseAdmin.from('job_applications').select('id, company, job_title').eq('id', id).eq('user_id', userId).maybeSingle();
  return data as { id: string; company: string | null; job_title: string | null } | null;
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = user.supabaseUserId;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const applicationId = typeof body.applicationId === 'string' && UUID_RE.test(body.applicationId) ? body.applicationId : '';
  if (!applicationId) return NextResponse.json({ error: 'Unknown application' }, { status: 400 });
  const app = await loadApplication(uid, applicationId);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const resolved = resolveSchedule({
    applicationId,
    company: app.company ?? '',
    jobTitle: app.job_title ?? '',
    wall: { date: String(body.date ?? ''), time: String(body.time ?? '') },
    timeZone: String(body.timeZone ?? ''),
    durationMinutes: Number(body.durationMinutes),
    stage: parseStage(body.stage),
    meetingUrl: cleanMeetingUrl(body.meetingUrl),
    notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null,
  });
  if ('error' in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });
  if (typeof body.meetingUrl === 'string' && body.meetingUrl.trim() && !resolved.meetingUrl) {
    return NextResponse.json({ error: 'Meeting link must start with https://' }, { status: 400 });
  }

  let existing: ScheduleRow | null;
  try {
    existing = await getSchedule(uid, applicationId);
  } catch (err) {
    if (err instanceof SchemaMissingError) return NextResponse.json({ error: 'Scheduling is not set up yet', schemaReady: false }, { status: 503 });
    throw err;
  }

  const cals = await readCalendars(uid);
  const { status } = cals;
  let sync: GoogleSyncResult = 'skipped';
  let gEventId = existing?.google_event_id ?? null;
  let gCalendarId = existing?.google_calendar_id ?? null;
  let msEventId = existing?.microsoft_event_id ?? null;
  const wantCalendar = body.calendar === true || body.google === true || !!gEventId || !!msEventId;

  // ── Google ──
  if (wantCalendar && status.provider === 'google' && status.connected && cals.google?.conn) {
    const { conn, cfg } = cals.google;
    try {
      const payload = buildGoogleEvent(resolved, cfg.appUrl);
      const ev = await withAccessToken(conn, cfg, async (token, cal) => {
        if (gEventId) {
          try {
            return await patchEvent(token, gCalendarId ?? cal, gEventId, payload);
          } catch (err) {
            // Deleted in Google since: make a new one rather than fail.
            if (!(err instanceof GoogleApiError && (err.status === 404 || err.status === 410))) throw err;
          }
        }
        gCalendarId = cal;
        return insertEvent(token, cal, payload);
      });
      sync = ev.id === gEventId ? 'updated' : 'created';
      gEventId = ev.id;
      gCalendarId = gCalendarId ?? conn.calendar_id;
    } catch (err) {
      sync = err instanceof ReconnectRequiredError ? 'reconnect' : 'failed';
      if (sync === 'failed') console.error('schedule google write:', err instanceof Error ? err.message : err);
    }
  // ── Outlook ──
  } else if (wantCalendar && status.provider === 'microsoft' && status.connected && cals.microsoft?.conn) {
    const { conn, cfg } = cals.microsoft;
    try {
      const payload = buildOutlookEvent(resolved, cfg.appUrl);
      const ev = await withMicrosoftAccessToken(conn, cfg, async (token) => {
        if (msEventId) {
          try {
            return await patchOutlookEvent(token, msEventId, payload);
          } catch (err) {
            if (!(err instanceof GraphApiError && (err.status === 404 || err.status === 410))) throw err;
          }
        }
        return insertOutlookEvent(token, payload);
      });
      sync = ev.id === msEventId ? 'updated' : 'created';
      msEventId = ev.id;
    } catch (err) {
      sync = err instanceof ReconnectRequiredError ? 'reconnect' : 'failed';
      if (sync === 'failed') console.error('schedule outlook write:', err instanceof Error ? err.message : err);
    }
  } else if (wantCalendar && status.broken) {
    sync = 'reconnect';
  }

  const cols = await scheduleCols();
  const row = {
    user_id: uid,
    application_id: applicationId,
    starts_at: resolved.start.toISOString(),
    ends_at: resolved.end.toISOString(),
    time_zone: resolved.timeZone,
    stage: resolved.stage,
    meeting_url: resolved.meetingUrl,
    notes: resolved.notes,
    google_event_id: gEventId,
    google_calendar_id: gEventId ? gCalendarId : null,
    // Only once migration 0070 has added the column.
    ...(cols.includes('microsoft_event_id') ? { microsoft_event_id: msEventId } : {}),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin.from('interview_schedules').upsert(row, { onConflict: 'application_id' }).select(cols).single();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: 'Scheduling is not set up yet', schemaReady: false }, { status: 503 });
    console.error('schedule save:', error);
    return NextResponse.json({ error: 'Could not save the interview time' }, { status: 500 });
  }
  // `google` is the older field name; `calendar` says the same for either provider.
  return NextResponse.json({ success: true, schedule: toDto(data as unknown as ScheduleRow), google: sync, calendar: sync, provider: status.provider });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = user.supabaseUserId;
  const applicationId = req.nextUrl.searchParams.get('applicationId') ?? '';
  if (!UUID_RE.test(applicationId)) return NextResponse.json({ error: 'Unknown application' }, { status: 400 });

  let existing: ScheduleRow | null;
  try {
    existing = await getSchedule(uid, applicationId);
  } catch (err) {
    if (err instanceof SchemaMissingError) return NextResponse.json({ success: true, google: 'skipped', calendar: 'skipped' });
    throw err;
  }
  if (!existing) return NextResponse.json({ success: true, google: 'skipped', calendar: 'skipped' });

  let sync: GoogleSyncResult = 'skipped';
  if (existing.google_event_id || existing.microsoft_event_id) {
    const cals = await readCalendars(uid);
    try {
      if (existing.google_event_id && cals.google?.conn && !cals.google.conn.broken_at) {
        await withAccessToken(cals.google.conn, cals.google.cfg, (t, cal) => deleteEvent(t, existing.google_calendar_id ?? cal, existing.google_event_id!));
        sync = 'deleted';
      } else if (existing.microsoft_event_id && cals.microsoft?.conn && !cals.microsoft.conn.broken_at) {
        await withMicrosoftAccessToken(cals.microsoft.conn, cals.microsoft.cfg, (t) => deleteOutlookEvent(t, existing.microsoft_event_id!));
        sync = 'deleted';
      } else {
        sync = 'reconnect';
      }
    } catch (err) {
      sync = err instanceof ReconnectRequiredError ? 'reconnect' : 'failed';
    }
  }
  await supabaseAdmin.from('interview_schedules').delete().eq('id', existing.id).eq('user_id', uid);
  return NextResponse.json({ success: true, google: sync, calendar: sync });
}
