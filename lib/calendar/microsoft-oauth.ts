// lib/calendar/microsoft-oauth.ts
// Microsoft identity platform (v2) OAuth for Outlook calendar: authorization
// code flow with PKCE and the same signed state as Google (lib/calendar/oauth.ts),
// for a confidential web client on the `common` tenant, so personal
// Outlook.com accounts and school or work (Microsoft 365) accounts both work.
//
// Server only. Network calls take an injectable fetch for the verify script.

import { deriveStateKey, loadEncryptionKey } from './crypto';
import { ReconnectRequiredError, type CalendarConfig, type FetchLike, type TokenResponse } from './oauth';

// Calendars.ReadWrite: create, update, delete and read events on the user's
// calendars. Microsoft has no narrower delegated scope that can write to the
// default calendar (Calendars.ReadWrite.Shared is broader; Calendars.Read
// cannot write). The app touches only the events it created (by id).
// offline_access: a refresh token. User.Read: the account name and email
// shown in Settings. openid + email: the id_token with the email claim.
export const MS_CALENDAR_SCOPE = 'Calendars.ReadWrite';
export const MS_OAUTH_SCOPES = ['openid', 'email', 'offline_access', 'User.Read', MS_CALENDAR_SCOPE];

const TENANT = 'common';
export const MS_AUTH_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
export const MS_TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

export const MS_CALLBACK_PATH = '/api/integrations/microsoft-calendar/callback';
export const MS_FLOW_COOKIE = 'prc_mscal_flow';

export const MS_AAD_REFRESH = 'microsoft-calendar:refresh';
export const MS_AAD_ACCESS = 'microsoft-calendar:access';

/** Everything Outlook needs, or null if any piece is missing (the feature then hides). */
export function getMicrosoftConfig(env: Record<string, string | undefined> = process.env): CalendarConfig | null {
  const clientId = env.MICROSOFT_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim();
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  const encryptionKey = loadEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  if (!clientId || !clientSecret || !appUrl || !encryptionKey) return null;
  try { new URL(appUrl); } catch { return null; }
  return {
    clientId, clientSecret, appUrl,
    redirectUri: `${appUrl}${MS_CALLBACK_PATH}`,
    encryptionKey,
    stateKey: deriveStateKey(encryptionKey),
  };
}

export function buildMicrosoftAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string | null;
}): string {
  const u = new URL(MS_AUTH_URL);
  u.searchParams.set('client_id', opts.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('response_mode', 'query');
  u.searchParams.set('scope', MS_OAUTH_SCOPES.join(' '));
  u.searchParams.set('state', opts.state);
  u.searchParams.set('code_challenge', opts.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  // People often have a personal and a school account signed in; let them pick.
  u.searchParams.set('prompt', 'select_account');
  if (opts.loginHint) u.searchParams.set('login_hint', opts.loginHint);
  return u.toString();
}

async function postForm(fetchImpl: FetchLike, form: Record<string, string>): Promise<Response> {
  return fetchImpl(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    cache: 'no-store',
  });
}

export async function exchangeMicrosoftCode(
  cfg: Pick<CalendarConfig, 'clientId' | 'clientSecret' | 'redirectUri'>,
  code: string,
  codeVerifier: string,
  fetchImpl: FetchLike = fetch,
): Promise<TokenResponse> {
  const res = await postForm(fetchImpl, {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
    code_verifier: codeVerifier,
    scope: MS_OAUTH_SCOPES.join(' '),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Microsoft token exchange failed: ${json.error ?? res.status}`);
  return json as TokenResponse;
}

export async function refreshMicrosoftToken(
  cfg: Pick<CalendarConfig, 'clientId' | 'clientSecret'>,
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<TokenResponse> {
  const res = await postForm(fetchImpl, {
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: MS_OAUTH_SCOPES.join(' '),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  // invalid_grant: revoked, expired, or invalidated by a password or policy
  // change. interaction_required: the tenant now needs the user (MFA, consent).
  // Either way only a new sign-in helps.
  if (json.error === 'invalid_grant' || json.error === 'interaction_required' || json.error === 'unauthorized_client') {
    throw new ReconnectRequiredError('Outlook calendar access was revoked or expired');
  }
  if (!res.ok || !json.access_token) throw new Error(`Microsoft token refresh failed: ${json.error ?? res.status}`);
  return json as TokenResponse;
}

/** The account from the id_token, for display only (read from the token endpoint over TLS). */
export function microsoftEmailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const p = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: string; preferred_username?: string };
    const v = p.email || p.preferred_username;
    return typeof v === 'string' ? v.slice(0, 320) : null;
  } catch {
    return null;
  }
}

/** Microsoft may list Graph scopes short ("Calendars.ReadWrite") or as full URIs. */
export function hasMicrosoftCalendarScope(scope: string | undefined): boolean {
  return !!scope && scope.split(/\s+/).some((s) => s.toLowerCase().endsWith(MS_CALENDAR_SCOPE.toLowerCase()));
}
