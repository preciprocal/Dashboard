// app/api/integrations/google-calendar/callback/route.ts
// Google sends the browser back here with ?code&state (or ?error). Checks the
// state against the signed-in user and the flow cookie, swaps the code for
// tokens with the PKCE verifier, seals the refresh token and stores it.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import {
  getCalendarConfig, verifyState, exchangeCode, revokeToken, emailFromIdToken, hasCalendarScope,
  FLOW_COOKIE, CALLBACK_PATH,
} from '@/lib/calendar/oauth';
import { encryptToken } from '@/lib/calendar/crypto';
import { AAD_ACCESS, AAD_REFRESH } from '@/lib/calendar/tokens';
import { saveConnection } from '@/lib/calendar/store';
import { removeMicrosoftConnection } from '@/lib/calendar/microsoft-store';

export const runtime = 'nodejs';

const DEFAULT_RETURN = '/settings?section=integrations';

export async function GET(req: NextRequest) {
  const cfg = getCalendarConfig();
  const origin = cfg?.appUrl ?? req.nextUrl.origin;
  const done = (path: string, value: string) => {
    const u = new URL(path, origin);
    u.searchParams.set('calendar', value);
    const res = NextResponse.redirect(u);
    // One use only, whatever the outcome.
    res.cookies.set(FLOW_COOKIE, '', { path: CALLBACK_PATH, maxAge: 0 });
    return res;
  };

  if (!cfg) return done(DEFAULT_RETURN, 'unavailable');
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.redirect(new URL(`/sign-in?redirect=${encodeURIComponent(DEFAULT_RETURN)}`, origin));

  const params = req.nextUrl.searchParams;
  const [nonce, verifier] = (req.cookies.get(FLOW_COOKIE)?.value ?? '').split('.');
  const checked = verifyState(params.get('state'), cfg.stateKey, { uid: user.supabaseUserId, nonce });
  if (!checked.ok) {
    console.warn('google-calendar callback: state rejected:', checked.reason);
    return done(DEFAULT_RETURN, 'expired');
  }
  const ret = checked.payload.ret;

  // The user pressed Cancel on Google's screen.
  if (params.get('error')) return done(ret, 'denied');
  const code = params.get('code');
  if (!code || !verifier) return done(ret, 'error');

  try {
    const tokens = await exchangeCode(cfg, code, verifier);
    // Google lets people untick individual permissions. Without the calendar
    // one the connection would be useless, so give back what was granted.
    if (!hasCalendarScope(tokens.scope)) {
      await revokeToken(tokens.refresh_token ?? tokens.access_token);
      return done(ret, 'missing-scope');
    }
    if (!tokens.refresh_token) {
      // prompt=consent should always produce one; without it we could only
      // act for an hour, which is worse than not connecting.
      await revokeToken(tokens.access_token);
      return done(ret, 'error');
    }
    await saveConnection({
      user_id: user.supabaseUserId,
      google_email: emailFromIdToken(tokens.id_token),
      scopes: (tokens.scope ?? '').split(/\s+/).filter(Boolean),
      refresh_token_enc: encryptToken(tokens.refresh_token, cfg.encryptionKey, AAD_REFRESH),
      access_token_enc: encryptToken(tokens.access_token, cfg.encryptionKey, AAD_ACCESS),
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      calendar_id: 'primary',
    });
    // One calendar at a time: a Google connection replaces Outlook.
    await removeMicrosoftConnection(user.supabaseUserId);
    return done(ret, 'connected');
  } catch (err) {
    console.error('google-calendar callback:', err instanceof Error ? err.message : err);
    return done(ret, 'error');
  }
}
