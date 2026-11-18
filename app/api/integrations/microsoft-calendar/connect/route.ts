// app/api/integrations/microsoft-calendar/connect/route.ts
// Starts the Microsoft sign-in for Outlook calendar. A top-level navigation,
// ending in a redirect to the Microsoft consent screen. Same CSRF design as the
// Google connect route: signed state naming the user and a nonce, with the
// nonce and the PKCE verifier in an httpOnly cookie scoped to the callback.
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { createPkcePair, signState, safeReturnPath, STATE_TTL_MS } from '@/lib/calendar/oauth';
import { getMicrosoftConfig, buildMicrosoftAuthorizeUrl, MS_FLOW_COOKIE, MS_CALLBACK_PATH } from '@/lib/calendar/microsoft-oauth';
import { microsoftSchemaReady } from '@/lib/calendar/store';

export const runtime = 'nodejs';

function withParam(base: string, path: string, value: string): URL {
  const u = new URL(path, base);
  u.searchParams.set('calendar', value);
  return u;
}

export async function GET(req: NextRequest) {
  const ret = safeReturnPath(req.nextUrl.searchParams.get('return'));
  const cfg = getMicrosoftConfig();
  const origin = cfg?.appUrl ?? req.nextUrl.origin;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.redirect(new URL(`/sign-in?redirect=${encodeURIComponent(ret)}`, origin));
  if (!cfg) return NextResponse.redirect(withParam(origin, ret, 'outlook-unavailable'));
  // Refuse before sending anyone to Microsoft if there is nowhere to keep the token.
  if (!(await microsoftSchemaReady().catch(() => false))) return NextResponse.redirect(withParam(origin, ret, 'outlook-unavailable'));

  const { verifier, challenge } = createPkcePair();
  const nonce = randomBytes(16).toString('base64url');
  const state = signState({ uid: user.supabaseUserId, nonce, iat: Date.now(), ret }, cfg.stateKey);

  const res = NextResponse.redirect(buildMicrosoftAuthorizeUrl({
    clientId: cfg.clientId, redirectUri: cfg.redirectUri, state, codeChallenge: challenge, loginHint: user.email,
  }));
  res.cookies.set(MS_FLOW_COOKIE, `${nonce}.${verifier}`, {
    httpOnly: true,
    secure: cfg.appUrl.startsWith('https://'),
    sameSite: 'lax',
    path: MS_CALLBACK_PATH,
    maxAge: STATE_TTL_MS / 1000,
  });
  return res;
}
