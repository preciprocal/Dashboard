// lib/calendar/server-status.ts
// Reads the connection and turns it into the CalendarStatus the UI renders.
// Server only. Never throws: any failure reads as "not available".

import { getConnection, SchemaMissingError } from './store';
import { NOT_CONFIGURED, type CalendarStatus } from './status';
import type { CalendarConfig } from './oauth';
import type { StoredConnection } from './tokens';

export async function readCalendarStatus(
  userId: string,
  cfg: CalendarConfig | null,
): Promise<{ status: CalendarStatus; connection: StoredConnection | null }> {
  if (!cfg) return { status: NOT_CONFIGURED, connection: null };
  try {
    const conn = await getConnection(userId);
    return {
      connection: conn,
      status: {
        configured: true, schemaReady: true,
        connected: !!conn && !conn.broken_at,
        broken: !!conn?.broken_at,
        email: conn?.google_email ?? null,
        connectedAt: conn?.connected_at ?? null,
      },
    };
  } catch (err) {
    if (!(err instanceof SchemaMissingError)) console.error('google-calendar status:', err);
    // Without the tables there is nowhere to keep a token, so do not offer to
    // connect; a transient read failure hides the option until the next load.
    return { status: NOT_CONFIGURED, connection: null };
  }
}
