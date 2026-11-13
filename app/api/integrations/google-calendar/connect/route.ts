// app/api/integrations/google-calendar/connect/route.ts
// Starts the Google OAuth flow for Calendar. A top-level navigation (a link),
// not a fetch: it ends in a redirect to Google's consent screen.
//
// CSRF: the state is HMAC-signed and names the signed-in user and a nonce;
// the nonce and the PKCE verifier ride in an httpOnly cookie scoped to the
// callback path. The callback accepts the code only when all three agree.
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getAuthedUser } from '@/lib/auth/verify-request';
import {
  getCalendarConfig, createPkcePair, signState, buildAuthorizeUrl, safeReturnPath,
  FLOW_COOKIE, CALLBACK_PATH, STATE_TTL_MS,
} from '@/lib/calendar/oauth';
import { getConnection, SchemaMissingError } from '@/lib/calendar/store';

export const runtime = 'nodejs';

function withParam(base: string, path: string, value: string): URL {
  const u = new URL(path, base);
  u.searchParams.set('calendar', value);
  return u;
}

export async function GET(req: NextRequest) {
  const ret = safeReturnPath(req.nextUrl.searchParams.get('return'));
  const cfg = getCalendarConfig();
  const origin = cfg?.appUrl ?? req.nextUrl.origin;

  const user = await getAuthedUser(req);
  if (!user) return NextResponse.redirect(new URL(`/sign-in?redirect=${encodeURIComponent(ret)}`, origin));
  if (!cfg) return NextResponse.redirect(withParam(origin, ret, 'unavailable'));

  // Refuse before sending anyone to Google if there is nowhere to keep the token.
  try {
    await getConnection(user.supabaseUserId);
  } catch (err) {
    if (!(err instanceof SchemaMissingError)) console.error('google-calendar connect:', err);
    return NextResponse.redirect(withParam(origin, ret, 'unavailable'));
  }

  const { verifier, challenge } = createPkcePair();
  const nonce = randomBytes(16).toString('base64url');
  const state = signState({ uid: user.supabaseUserId, nonce, iat: Date.now(), ret }, cfg.stateKey);

  const res = NextResponse.redirect(buildAuthorizeUrl({
    clientId: cfg.clientId, redirectUri: cfg.redirectUri, state, codeChallenge: challenge, loginHint: user.email,
  }));
  res.cookies.set(FLOW_COOKIE, `${nonce}.${verifier}`, {
    httpOnly: true,
    secure: cfg.appUrl.startsWith('https://'),
    // Lax, not Strict: the callback is a top-level redirect from Google, and
    // Strict would drop the cookie on that cross-site navigation.
    sameSite: 'lax',
    path: CALLBACK_PATH,
    maxAge: STATE_TTL_MS / 1000,
  });
  return res;
}
