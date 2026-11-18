// lib/calendar/store.ts
// Database side of the Calendar feature (migration 0063). Server only.
//
// Every read tolerates the tables not existing yet: the owner applies
// migrations by hand, and until 0063 is in, the feature reports itself as
// unavailable instead of throwing 500s on the job tracker.

import { supabaseAdmin } from '@/supabase/admin';
import { getValidAccessToken, type StoredConnection } from './tokens';
import { GoogleApiError } from './google-api';
import type { CalendarConfig } from './oauth';

const CONN_COLS = 'user_id, google_email, scopes, refresh_token_enc, access_token_enc, access_token_expires_at, calendar_id, connected_at, last_error, broken_at';

/** Postgres "undefined_column" (a migration that adds a column is not applied yet). */
export function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42703' || /column .* does not exist/i.test(err.message ?? '');
}

/** Postgres "undefined_table", or PostgREST's "not in the schema cache". */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err || isMissingColumn(err)) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message ?? '');
}

export class SchemaMissingError extends Error {
  constructor() {
    super('Calendar tables are not set up yet (migration 0063)');
    this.name = 'SchemaMissingError';
  }
}

export async function getConnection(userId: string): Promise<StoredConnection | null> {
  const { data, error } = await supabaseAdmin.from('google_calendar_connections').select(CONN_COLS).eq('user_id', userId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new SchemaMissingError();
    throw error;
  }
  return (data as StoredConnection | null) ?? null;
}

export async function saveConnection(row: Omit<StoredConnection, 'connected_at' | 'last_error' | 'broken_at'>): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('google_calendar_connections').upsert(
    { ...row, connected_at: now, updated_at: now, last_error: null, broken_at: null },
    { onConflict: 'user_id' },
  );
  if (error) {
    if (isMissingTable(error)) throw new SchemaMissingError();
    throw error;
  }
}

export async function deleteConnection(userId: string): Promise<void> {
  await supabaseAdmin.from('google_calendar_connections').delete().eq('user_id', userId);
  // The events stay on the user's calendar (they are theirs now); we just
  // stop pointing at them, so a later edit does not try a dead connection.
  await supabaseAdmin.from('interview_schedules').update({ google_event_id: null, google_calendar_id: null }).eq('user_id', userId);
}

function tokenDeps(userId: string) {
  return {
    save: async (update: Record<string, string>) => {
      await supabaseAdmin.from('google_calendar_connections').update({ ...update, updated_at: new Date().toISOString() }).eq('user_id', userId);
    },
    markBroken: async (reason: string) => {
      const now = new Date().toISOString();
      await supabaseAdmin.from('google_calendar_connections')
        .update({ last_error: reason, broken_at: now, access_token_enc: null, access_token_expires_at: null, updated_at: now })
        .eq('user_id', userId);
    },
  };
}

/**
 * Run a Calendar API call with a fresh access token. A 401 means the cached
 * token died early (revoked session, clock skew), so it refreshes once and
 * retries; a second failure, or a refused refresh, propagates.
 */
export async function withAccessToken<T>(
  conn: StoredConnection,
  cfg: CalendarConfig,
  fn: (token: string, calendarId: string) => Promise<T>,
): Promise<T> {
  const deps = tokenDeps(conn.user_id);
  const token = await getValidAccessToken(conn, cfg, deps);
  try {
    return await fn(token, conn.calendar_id || 'primary');
  } catch (err) {
    if (!(err instanceof GoogleApiError) || err.status !== 401) throw err;
    const fresh = await getValidAccessToken(conn, cfg, deps, { forceRefresh: true });
    return fn(fresh, conn.calendar_id || 'primary');
  }
}

// ─── Schedules ───────────────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string;
  user_id: string;
  application_id: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  stage: string;
  meeting_url: string | null;
  notes: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  /** Migration 0070. Undefined until it is applied. */
  microsoft_event_id?: string | null;
}

export const SCHEDULE_COLS = 'id, user_id, application_id, starts_at, ends_at, time_zone, stage, meeting_url, notes, google_event_id, google_calendar_id';

export const SCHEDULE_COLS_MS = `${SCHEDULE_COLS}, microsoft_event_id`;

// Whether migration 0070 (Outlook) is applied. Rechecked every minute, so
// applying it takes effect without a deploy.
let msSchema: { ok: boolean; at: number } | null = null;
export async function microsoftSchemaReady(): Promise<boolean> {
  if (msSchema && Date.now() - msSchema.at < 60_000) return msSchema.ok;
  const [a, b] = await Promise.all([
    supabaseAdmin.from('microsoft_calendar_connections').select('user_id').limit(1),
    supabaseAdmin.from('interview_schedules').select('microsoft_event_id').limit(1),
  ]);
  const ok = !a.error && !b.error;
  msSchema = { ok, at: Date.now() };
  return ok;
}

/** The schedule columns to read: with the Outlook event id once 0070 is in. */
export async function scheduleCols(): Promise<string> {
  return (await microsoftSchemaReady().catch(() => false)) ? SCHEDULE_COLS_MS : SCHEDULE_COLS;
}

export async function listSchedules(userId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabaseAdmin.from('interview_schedules').select(await scheduleCols()).eq('user_id', userId).order('starts_at');
  if (error) {
    if (isMissingTable(error)) throw new SchemaMissingError();
    throw error;
  }
  return (data as unknown as ScheduleRow[]) ?? [];
}

export async function getSchedule(userId: string, applicationId: string): Promise<ScheduleRow | null> {
  const { data, error } = await supabaseAdmin.from('interview_schedules').select(await scheduleCols())
    .eq('user_id', userId).eq('application_id', applicationId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new SchemaMissingError();
    throw error;
  }
  return (data as unknown as ScheduleRow | null) ?? null;
}
