// lib/calendar/microsoft-store.ts
// Database side of Outlook calendar (migration 0070). Server only.
//
// One calendar per user: saving an Outlook connection removes a Google one
// (revoking it at Google), and lib/calendar/store.ts's Google save does the
// same for Outlook through removeMicrosoftConnection().

import { supabaseAdmin } from '@/supabase/admin';
import { getValidAccessToken, type StoredConnection } from './tokens';
import { decryptToken } from './crypto';
import { GraphApiError } from './microsoft-api';
import { MS_AAD_ACCESS, MS_AAD_REFRESH, refreshMicrosoftToken } from './microsoft-oauth';
import { getCalendarConfig, revokeToken, type CalendarConfig } from './oauth';
import { AAD_REFRESH } from './tokens';
import { deleteConnection, getConnection, isMissingTable, SchemaMissingError } from './store';

export interface MicrosoftConnection {
  user_id: string;
  account_email: string | null;
  scopes: string[];
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  connected_at: string;
  last_error: string | null;
  broken_at: string | null;
}

const COLS = 'user_id, account_email, scopes, refresh_token_enc, access_token_enc, access_token_expires_at, connected_at, last_error, broken_at';
const TABLE = 'microsoft_calendar_connections';

export async function getMicrosoftConnection(userId: string): Promise<MicrosoftConnection | null> {
  const { data, error } = await supabaseAdmin.from(TABLE).select(COLS).eq('user_id', userId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new SchemaMissingError();
    throw error;
  }
  return (data as MicrosoftConnection | null) ?? null;
}

export async function saveMicrosoftConnection(row: Omit<MicrosoftConnection, 'connected_at' | 'last_error' | 'broken_at'>): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from(TABLE).upsert(
    { ...row, connected_at: now, updated_at: now, last_error: null, broken_at: null },
    { onConflict: 'user_id' },
  );
  if (error) {
    if (isMissingTable(error)) throw new SchemaMissingError();
    throw error;
  }
  // One calendar at a time: an Outlook connection replaces Google.
  await removeGoogleConnection(row.user_id);
}

/** Forget the Outlook connection. Events already added stay in Outlook; we stop pointing at them. */
export async function deleteMicrosoftConnection(userId: string): Promise<void> {
  await supabaseAdmin.from(TABLE).delete().eq('user_id', userId);
  await supabaseAdmin.from('interview_schedules').update({ microsoft_event_id: null }).eq('user_id', userId);
}

/** Called when Google is connected. Best effort, and a no-op before 0070. */
export async function removeMicrosoftConnection(userId: string): Promise<void> {
  try {
    const conn = await getMicrosoftConnection(userId);
    if (conn) await deleteMicrosoftConnection(userId);
  } catch { /* no table yet, or a transient error: nothing to remove */ }
}

/** Called when Outlook is connected: revoke at Google, then forget. Best effort. */
async function removeGoogleConnection(userId: string): Promise<void> {
  try {
    const conn = await getConnection(userId);
    if (!conn) return;
    const gcfg = getCalendarConfig();
    if (gcfg) {
      try { await revokeToken(decryptToken(conn.refresh_token_enc, gcfg.encryptionKey, AAD_REFRESH)); } catch { /* unreadable: still forget it */ }
    }
    await deleteConnection(userId);
  } catch { /* no Google table or nothing to remove */ }
}

function tokenDeps(userId: string, cfg: CalendarConfig) {
  return {
    refresh: (rt: string) => refreshMicrosoftToken(cfg, rt),
    aad: { refresh: MS_AAD_REFRESH, access: MS_AAD_ACCESS },
    save: async (update: Record<string, string>) => {
      await supabaseAdmin.from(TABLE).update({ ...update, updated_at: new Date().toISOString() }).eq('user_id', userId);
    },
    markBroken: async (reason: string) => {
      const now = new Date().toISOString();
      await supabaseAdmin.from(TABLE)
        .update({ last_error: reason, broken_at: now, access_token_enc: null, access_token_expires_at: null, updated_at: now })
        .eq('user_id', userId);
    },
  };
}

/** Run a Graph call with a fresh token; a 401 refreshes once and retries. */
export async function withMicrosoftAccessToken<T>(conn: MicrosoftConnection, cfg: CalendarConfig, fn: (token: string) => Promise<T>): Promise<T> {
  const deps = tokenDeps(conn.user_id, cfg);
  const asStored = conn as unknown as Pick<StoredConnection, 'refresh_token_enc' | 'access_token_enc' | 'access_token_expires_at' | 'last_error' | 'broken_at'>;
  const token = await getValidAccessToken(asStored, cfg, deps);
  try {
    return await fn(token);
  } catch (err) {
    if (!(err instanceof GraphApiError) || err.status !== 401) throw err;
    const fresh = await getValidAccessToken(asStored, cfg, deps, { forceRefresh: true });
    return fn(fresh);
  }
}
