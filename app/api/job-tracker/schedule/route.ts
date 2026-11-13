// app/api/job-tracker/schedule/route.ts
// Interview times on tracker cards, mirrored to Google Calendar when connected.
//
//   GET                         every schedule + the Calendar status
//   POST {applicationId, date, time, timeZone, durationMinutes, stage,
//         meetingUrl?, notes?, google?: boolean}
//                               create or reschedule; google=true writes the event
//   DELETE ?applicationId=      remove the schedule and its Google event
//
// A schedule is useful without Google (the card shows it, the user downloads
// an .ics), so a Google failure never loses the save: the response says what
// happened to the event and the UI offers a reconnect or the .ics instead.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { getCalendarConfig, ReconnectRequiredError, type CalendarConfig } from '@/lib/calendar/oauth';
import { readCalendarStatus } from '@/lib/calendar/server-status';
import {
  listSchedules, getSchedule, withAccessToken, SchemaMissingError, isMissingTable, SCHEDULE_COLS, type ScheduleRow,
} from '@/lib/calendar/store';
import { insertEvent, patchEvent, deleteEvent, listOurEvents, GoogleApiError } from '@/lib/calendar/google-api';
import { buildGoogleEvent, resolveSchedule, reconcileEvent, parseStage, cleanMeetingUrl } from '@/lib/calendar/events';
import type { CalendarStatus, GoogleSyncResult, InterviewSchedule } from '@/lib/calendar/status';
import type { StoredConnection } from '@/lib/calendar/tokens';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDto(r: ScheduleRow): InterviewSchedule {
  return {
    applicationId: r.application_id, startsAt: r.starts_at, endsAt: r.ends_at, timeZone: r.time_zone,
    stage: r.stage, meetingUrl: r.meeting_url, notes: r.notes, onGoogle: !!r.google_event_id,
  };
}

/**
 * Follow changes made in Google Calendar: a dragged event moves the card, a
 * deleted one drops the calendar link. Throttled per user so loading the
 * tracker does not call Google every time.
 */
async function reconcile(rows: ScheduleRow[], conn: StoredConnection, cfg: CalendarConfig): Promise<ScheduleRow[]> {
  const linked = rows.filter((r) => r.google_event_id);
  if (!linked.length) return rows;
  if (redis) {
    try {
      const fresh = await redis.set(`gcal:reconcile:${conn.user_id}`, '1', { nx: true, ex: 120 });
      if (fresh === null) return rows;
    } catch { /* reconcile anyway */ }
  }
  const now = Date.now();
  const min = new Date(now - 24 * 3600_000);
  const max = new Date(now + 120 * 24 * 3600_000);
  const events = await withAccessToken(conn, cfg, (t, cal) => listOurEvents(t, cal, min, max));
  const byId = new Map(events.map((e) => [e.id, e]));
  const out: ScheduleRow[] = [];
  for (const r of rows) {
    const start = new Date(r.starts_at).getTime();
    // Only judge events inside the window we asked about.
    if (!r.google_event_id || start < min.getTime() || start > max.getTime()) { out.push(r); continue; }
    const change = reconcileEvent({ startsAt: r.starts_at, endsAt: r.ends_at }, byId.get(r.google_event_id));
    if (change.kind === 'moved') {
      await supabaseAdmin.from('interview_schedules').update({ starts_at: change.startsAt, ends_at: change.endsAt, updated_at: new Date().toISOString() }).eq('id', r.id);
      out.push({ ...r, starts_at: change.startsAt, ends_at: change.endsAt });
    } else if (change.kind === 'deleted') {
      await supabaseAdmin.from('interview_schedules').update({ google_event_id: null, google_calendar_id: null, updated_at: new Date().toISOString() }).eq('id', r.id);
      out.push({ ...r, google_event_id: null, google_calendar_id: null });
    } else {
      out.push(r);
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const cfg = getCalendarConfig();
  const { status, connection } = await readCalendarStatus(user.supabaseUserId, cfg);

  try {
    let rows = await listSchedules(user.supabaseUserId);
    if (cfg && connection && status.connected) {
      try {
        rows = await reconcile(rows, connection, cfg);
      } catch (err) {
        // Reading Google is a nicety here; the stored times still show.
        if (!(err instanceof ReconnectRequiredError)) console.error('schedule reconcile:', err instanceof Error ? err.message : err);
      }
    }
    // A reconcile may have just discovered a revoked grant.
    const finalStatus: CalendarStatus = cfg && connection
      ? (await readCalendarStatus(user.supabaseUserId, cfg)).status
      : status;
    return NextResponse.json({ schemaReady: true, schedules: rows.map(toDto), calendar: finalStatus }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    if (!(err instanceof SchemaMissingError)) console.error('schedule GET:', err);
    return NextResponse.json({ schemaReady: false, schedules: [], calendar: status });
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

  // ── Google ──
  const cfg = getCalendarConfig();
  let google: GoogleSyncResult = 'skipped';
  let eventId = existing?.google_event_id ?? null;
  let calendarId = existing?.google_calendar_id ?? null;
  const { connection, status } = await readCalendarStatus(uid, cfg);
  const wantGoogle = body.google === true || !!eventId;
  if (cfg && wantGoogle && connection && status.connected) {
    try {
      const payload = buildGoogleEvent(resolved, cfg.appUrl);
      const ev = await withAccessToken(connection, cfg, async (token, cal) => {
        if (eventId) {
          try {
            return await patchEvent(token, calendarId ?? cal, eventId, payload);
          } catch (err) {
            // Deleted in Google since: make a new one rather than fail.
            if (!(err instanceof GoogleApiError && (err.status === 404 || err.status === 410))) throw err;
          }
        }
        calendarId = cal;
        return insertEvent(token, cal, payload);
      });
      google = ev.id === eventId ? 'updated' : 'created';
      eventId = ev.id;
      calendarId = calendarId ?? connection.calendar_id;
    } catch (err) {
      google = err instanceof ReconnectRequiredError ? 'reconnect' : 'failed';
      if (google === 'failed') console.error('schedule google write:', err instanceof Error ? err.message : err);
    }
  } else if (wantGoogle && status.broken) {
    google = 'reconnect';
  }

  const row = {
    user_id: uid,
    application_id: applicationId,
    starts_at: resolved.start.toISOString(),
    ends_at: resolved.end.toISOString(),
    time_zone: resolved.timeZone,
    stage: resolved.stage,
    meeting_url: resolved.meetingUrl,
    notes: resolved.notes,
    google_event_id: eventId,
    google_calendar_id: eventId ? calendarId : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin.from('interview_schedules').upsert(row, { onConflict: 'application_id' }).select(SCHEDULE_COLS).single();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: 'Scheduling is not set up yet', schemaReady: false }, { status: 503 });
    console.error('schedule save:', error);
    return NextResponse.json({ error: 'Could not save the interview time' }, { status: 500 });
  }
  return NextResponse.json({ success: true, schedule: toDto(data as ScheduleRow), google });
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
    if (err instanceof SchemaMissingError) return NextResponse.json({ success: true, google: 'skipped' });
    throw err;
  }
  if (!existing) return NextResponse.json({ success: true, google: 'skipped' });

  let google: GoogleSyncResult = 'skipped';
  const cfg = getCalendarConfig();
  if (existing.google_event_id && cfg) {
    const { connection, status } = await readCalendarStatus(uid, cfg);
    if (connection && status.connected) {
      try {
        await withAccessToken(connection, cfg, (t, cal) => deleteEvent(t, existing.google_calendar_id ?? cal, existing.google_event_id!));
        google = 'deleted';
      } catch (err) {
        google = err instanceof ReconnectRequiredError ? 'reconnect' : 'failed';
      }
    } else {
      google = 'reconnect';
    }
  }
  await supabaseAdmin.from('interview_schedules').delete().eq('id', existing.id).eq('user_id', uid);
  return NextResponse.json({ success: true, google });
}
