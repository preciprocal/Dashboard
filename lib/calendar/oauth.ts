// lib/calendar/oauth.ts
// Google OAuth 2.0 for Calendar: authorization code flow with PKCE and a
// signed state, offline access for a refresh token.
//
// Separate from sign-in on purpose. Sign-in is Supabase Auth's Google
// provider (components/AuthForm.tsx) and asks for nothing beyond identity;
// someone who signed up with a password can still connect a calendar, and
// someone who signed in with Google is not asked for calendar access until
// they choose it. Different client id, different consent, different tokens.
//
// Server only. Network calls take an injectable fetch so the verify script
// can exercise refresh and revocation without Google.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { deriveStateKey, hmac, loadEncryptionKey } from './crypto';

// ─── Scopes ──────────────────────────────────────────────────────────────────
// calendar.events.owned: "See, create, change, and delete events on Google
// calendars you own." It is the narrowest scope that covers both things the
// feature does on the user's primary calendar: write the interview event, and
// read our own events back (to show upcoming interviews and to follow an event
// the user moved or deleted in Google). Calendars merely shared with the user
// are out of reach, unlike calendar.events.
//
// Considered and rejected:
//   calendar.events      also reaches every calendar shared with the user.
//   calendar.readonly    reads everything; not needed, since listing filters
//                        to events carrying our private marker property.
//   calendar.app.created narrower still, but only works on a secondary
//                        calendar the app creates. Interviews would land on a
//                        separate "Preciprocal" calendar many people never
//                        notice or have hidden on their phone, which defeats
//                        the point of a reminder.
//
// openid + email: non-sensitive, only to show which Google account is
// connected (people often have a personal and a work one).
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
export const OAUTH_SCOPES = ['openid', 'email', CALENDAR_SCOPE];

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export const STATE_TTL_MS = 10 * 60 * 1000;
export const CALLBACK_PATH = '/api/integrations/google-calendar/callback';
/** httpOnly cookie that carries the PKCE verifier and the state nonce between connect and callback. */
export const FLOW_COOKIE = 'prc_gcal_flow';

export interface CalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appUrl: string;
  encryptionKey: Buffer;
  stateKey: Buffer;
}

/**
 * Everything the feature needs, or null if any piece is missing. Every route
 * and the UI check this first, so an unset variable hides the feature rather
 * than failing at the first click.
 */
export function getCalendarConfig(env: Record<string, string | undefined> = process.env): CalendarConfig | null {
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  const encryptionKey = loadEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  if (!clientId || !clientSecret || !appUrl || !encryptionKey) return null;
  try { new URL(appUrl); } catch { return null; }
  return {
    clientId, clientSecret, appUrl,
    redirectUri: `${appUrl}${CALLBACK_PATH}`,
    encryptionKey,
    stateKey: deriveStateKey(encryptionKey),
  };
}

// ─── PKCE (RFC 7636) ─────────────────────────────────────────────────────────

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url'); // 64 chars, within 43-128
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ─── State ───────────────────────────────────────────────────────────────────
// payload.signature, both base64url. The payload names the signed-in user and
// a nonce that must also match the flow cookie: the signature stops a forged
// state, the user id stops a state minted for one account completing on
// another, and the nonce stops a stolen-but-valid state being replayed from a
// different browser.

export interface StatePayload {
  /** Supabase auth user id. */
  uid: string;
  nonce: string;
  /** Issued at, ms. */
  iat: number;
  /** Where to send the user afterwards; a same-origin path only. */
  ret: string;
}

export function safeReturnPath(v: unknown): string {
  if (typeof v !== 'string') return '/settings?section=integrations';
  // Same-origin paths only: "//evil.com" and "/\evil.com" are protocol-relative.
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || v.length > 200) return '/settings?section=integrations';
  return v;
}

export function signState(p: StatePayload, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return `${body}.${hmac(key, body)}`;
}

export function verifyState(
  state: string | null | undefined,
  key: Buffer,
  expect: { uid: string; nonce: string | null | undefined },
  now = Date.now(),
): { ok: true; payload: StatePayload } | { ok: false; reason: string } {
  if (!state) return { ok: false, reason: 'missing' };
  const [body, sig] = state.split('.');
  if (!body || !sig) return { ok: false, reason: 'malformed' };
  const want = Buffer.from(hmac(key, body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, reason: 'bad-signature' };
  let p: StatePayload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (typeof p.iat !== 'number' || now - p.iat > STATE_TTL_MS || p.iat - now > 60_000) return { ok: false, reason: 'expired' };
  if (p.uid !== expect.uid) return { ok: false, reason: 'wrong-user' };
  if (!expect.nonce || p.nonce !== expect.nonce) return { ok: false, reason: 'nonce-mismatch' };
  return { ok: true, payload: { ...p, ret: safeReturnPath(p.ret) } };
}

// ─── Authorize URL ───────────────────────────────────────────────────────────

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string | null;
}): string {
  const u = new URL(GOOGLE_AUTH_URL);
  u.searchParams.set('client_id', opts.clientId);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', OAUTH_SCOPES.join(' '));
  u.searchParams.set('state', opts.state);
  u.searchParams.set('code_challenge', opts.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  // offline + consent: Google only returns a refresh token on a consent
  // screen, and a connect is always a fresh grant (disconnect revokes).
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  if (opts.loginHint) u.searchParams.set('login_hint', opts.loginHint);
  return u.toString();
}

// ─── Token endpoint ──────────────────────────────────────────────────────────

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  token_type?: string;
}

/** Google said the grant is gone (revoked, expired, password change): reconnect needed. */
export class ReconnectRequiredError extends Error {
  constructor(message = 'Google Calendar access was revoked or expired') {
    super(message);
    this.name = 'ReconnectRequiredError';
  }
}

async function postForm(fetchImpl: FetchLike, url: string, form: Record<string, string>): Promise<Response> {
  return fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    cache: 'no-store',
  });
}

export async function exchangeCode(
  cfg: Pick<CalendarConfig, 'clientId' | 'clientSecret' | 'redirectUri'>,
  code: string,
  codeVerifier: string,
  fetchImpl: FetchLike = fetch,
): Promise<TokenResponse> {
  const res = await postForm(fetchImpl, GOOGLE_TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Token exchange failed: ${json.error ?? res.status}`);
  return json as TokenResponse;
}

export async function refreshAccessToken(
  cfg: Pick<CalendarConfig, 'clientId' | 'clientSecret'>,
  refreshToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<TokenResponse> {
  const res = await postForm(fetchImpl, GOOGLE_TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  // invalid_grant is Google's answer for a revoked, expired (7 days for apps
  // still in testing) or password-reset-invalidated refresh token. Retrying
  // cannot help; only a new consent can.
  if (json.error === 'invalid_grant' || json.error === 'unauthorized_client') throw new ReconnectRequiredError();
  if (!res.ok || !json.access_token) throw new Error(`Token refresh failed: ${json.error ?? res.status}`);
  return json as TokenResponse;
}

/** Best effort: a token Google already forgot returns 400, which is still "revoked". */
export async function revokeToken(token: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const res = await postForm(fetchImpl, GOOGLE_REVOKE_URL, { token });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

/**
 * The account email from the id_token. Read without verifying the signature,
 * which OpenID Connect Core 3.1.3.7 permits when the token came straight from
 * the token endpoint over TLS, as here. Used for display only.
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { email?: string };
    return typeof payload.email === 'string' ? payload.email.slice(0, 320) : null;
  } catch {
    return null;
  }
}

/** Did the user untick the calendar box on the consent screen? Google lets them. */
export function hasCalendarScope(scope: string | undefined): boolean {
  return !!scope && scope.split(/\s+/).includes(CALENDAR_SCOPE);
}
