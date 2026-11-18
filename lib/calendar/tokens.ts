// lib/calendar/tokens.ts
// Keeping a usable Google access token for a stored connection.
//
// Access tokens last an hour. The cached one is used while it has a minute
// left; otherwise the refresh token buys a new one. If Google refuses the
// refresh token the connection is marked broken and the caller gets a
// ReconnectRequiredError, which the UI turns into "Reconnect Google Calendar".
//
// Storage is injected (save / markBroken) so the verify script can run the
// whole path with a mocked fetch and no database.

import { decryptToken, encryptToken } from './crypto';
import { refreshAccessToken, ReconnectRequiredError, type CalendarConfig, type FetchLike, type TokenResponse } from './oauth';

export const EXPIRY_SKEW_MS = 60_000;

export interface StoredConnection {
  user_id: string;
  google_email: string | null;
  scopes: string[];
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: string | null;
  calendar_id: string;
  connected_at: string;
  last_error: string | null;
  broken_at: string | null;
}

export interface TokenDeps {
  fetch?: FetchLike;
  now?: () => number;
  save: (update: { access_token_enc: string; access_token_expires_at: string; refresh_token_enc?: string }) => Promise<void>;
  markBroken: (reason: string) => Promise<void>;
  /** The provider's refresh call. Google's when omitted. */
  refresh?: (refreshToken: string, fetchImpl?: FetchLike) => Promise<TokenResponse>;
  /** Additional data the tokens were sealed with. Google's when omitted. */
  aad?: { refresh: string; access: string };
}

export const AAD_REFRESH = 'google-calendar:refresh';
export const AAD_ACCESS = 'google-calendar:access';

export async function getValidAccessToken(
  conn: Pick<StoredConnection, 'refresh_token_enc' | 'access_token_enc' | 'access_token_expires_at' | 'last_error' | 'broken_at'>,
  cfg: Pick<CalendarConfig, 'clientId' | 'clientSecret' | 'encryptionKey'>,
  deps: TokenDeps,
  opts: { forceRefresh?: boolean } = {},
): Promise<string> {
  if (conn.broken_at) throw new ReconnectRequiredError(conn.last_error ?? undefined);
  const now = deps.now ? deps.now() : Date.now();
  const aadAccess = deps.aad?.access ?? AAD_ACCESS;
  const aadRefresh = deps.aad?.refresh ?? AAD_REFRESH;

  if (!opts.forceRefresh && conn.access_token_enc && conn.access_token_expires_at) {
    if (new Date(conn.access_token_expires_at).getTime() - EXPIRY_SKEW_MS > now) {
      try {
        return decryptToken(conn.access_token_enc, cfg.encryptionKey, aadAccess);
      } catch {
        // A cache we cannot open (key rotated) is just a cache miss.
      }
    }
  }

  let refreshToken: string;
  try {
    refreshToken = decryptToken(conn.refresh_token_enc, cfg.encryptionKey, aadRefresh);
  } catch {
    // The key changed since this was sealed. The token is unrecoverable, so
    // the honest answer is the same as a revocation: connect again.
    await deps.markBroken('encryption-key-changed');
    throw new ReconnectRequiredError('Stored calendar credentials could not be read');
  }

  try {
    const t = deps.refresh ? await deps.refresh(refreshToken, deps.fetch) : await refreshAccessToken(cfg, refreshToken, deps.fetch);
    const update = {
      access_token_enc: encryptToken(t.access_token, cfg.encryptionKey, aadAccess),
      access_token_expires_at: new Date(now + t.expires_in * 1000).toISOString(),
      // Google may rotate the refresh token, and Microsoft usually does; keep whichever is current.
      ...(t.refresh_token ? { refresh_token_enc: encryptToken(t.refresh_token, cfg.encryptionKey, aadRefresh) } : {}),
    };
    await deps.save(update);
    return t.access_token;
  } catch (err) {
    if (err instanceof ReconnectRequiredError) await deps.markBroken('revoked');
    throw err;
  }
}
