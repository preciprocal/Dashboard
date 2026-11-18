// lib/calendar/server-status.ts
// Reads the user's calendar connection (Google or Outlook) and turns it into
// the CalendarStatus the UI renders. Server only. Never throws: any failure
// reads as "not available" for that provider.

import { getConnection, microsoftSchemaReady, SchemaMissingError } from './store';
import { getMicrosoftConnection, type MicrosoftConnection } from './microsoft-store';
import { getMicrosoftConfig } from './microsoft-oauth';
import { getCalendarConfig, type CalendarConfig } from './oauth';
import { NOT_CONFIGURED, type CalendarStatus } from './status';
import type { StoredConnection } from './tokens';

export interface Calendars {
  status: CalendarStatus;
  google: { cfg: CalendarConfig; conn: StoredConnection | null } | null;
  microsoft: { cfg: CalendarConfig; conn: MicrosoftConnection | null } | null;
}

export async function readCalendars(userId: string): Promise<Calendars> {
  const gcfg = getCalendarConfig();
  const mcfg = getMicrosoftConfig();

  let google: Calendars['google'] = null;
  if (gcfg) {
    try {
      google = { cfg: gcfg, conn: await getConnection(userId) };
    } catch (err) {
      // Without the tables there is nowhere to keep a token, so do not offer to connect.
      if (!(err instanceof SchemaMissingError)) console.error('google-calendar status:', err);
    }
  }

  let microsoft: Calendars['microsoft'] = null;
  if (mcfg) {
    try {
      if (await microsoftSchemaReady()) microsoft = { cfg: mcfg, conn: await getMicrosoftConnection(userId) };
    } catch (err) {
      if (!(err instanceof SchemaMissingError)) console.error('microsoft-calendar status:', err);
    }
  }

  if (!google && !microsoft) return { status: NOT_CONFIGURED, google: null, microsoft: null };

  // One connection at a time; if both somehow exist, the newer one wins.
  const g = google?.conn ?? null;
  const m = microsoft?.conn ?? null;
  const active = g && m ? (g.connected_at > m.connected_at ? 'google' : 'microsoft') : g ? 'google' : m ? 'microsoft' : null;
  const conn = active === 'google' ? g : active === 'microsoft' ? m : null;
  return {
    google,
    microsoft,
    status: {
      configured: true,
      schemaReady: true,
      available: { google: !!google, microsoft: !!microsoft },
      provider: active,
      connected: !!conn && !conn.broken_at,
      broken: !!conn?.broken_at,
      email: active === 'google' ? g?.google_email ?? null : active === 'microsoft' ? m?.account_email ?? null : null,
      connectedAt: conn?.connected_at ?? null,
    },
  };
}

/** The Google part, for callers that only deal with Google. */
export async function readCalendarStatus(
  userId: string,
  cfg: CalendarConfig | null,
): Promise<{ status: CalendarStatus; connection: StoredConnection | null }> {
  if (!cfg) return { status: NOT_CONFIGURED, connection: null };
  const c = await readCalendars(userId);
  return { status: c.status, connection: c.google?.conn ?? null };
}
