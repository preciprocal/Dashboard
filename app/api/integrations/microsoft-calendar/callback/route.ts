// app/api/integrations/microsoft-calendar/callback/route.ts
// Microsoft sends the browser back here with ?code&state (or ?error). Checks
// the state against the signed-in user and the flow cookie, swaps the code for
// tokens with the PKCE verifier, seals the refresh token and stores it. An
// Outlook connection replaces a Google one (one calendar at a time).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { verifyState } from '@/lib/calendar/oauth';
import {
  getMicrosoftConfig, exchangeMicrosoftCode, microsoftEmailFromIdToken, hasMicrosoftCalendarScope,
  MS_FLOW_COOKIE, MS_CALLBACK_PATH, MS_AAD_ACCESS, MS_AAD_REFRESH,
} from '@/lib/calendar/microsoft-oauth';
import { encryptToken } from '@/lib/calendar/crypto';
import { saveMicrosoftConnection } from '@/lib/calendar/microsoft-store';

export const runtime = 'nodejs';

const DEFAULT_RETURN = '/settings?section=integrations';

export async function GET(req: NextRequest) {
  const cfg = getMicrosoftConfig();
  const origin = cfg?.appUrl ?? req.nextUrl.origin;
  const done = (path: string, value: string) => {
    const u = new URL(path, origin);
    u.searchParams.set('calendar', value);
    const res = NextResponse.redirect(u);
    res.cookies.set(MS_FLOW_COOKIE, '', { path: MS_CALLBACK_PATH, maxAge: 0 });
    return res;
  };

  if (!cfg) return done(DEFAULT_RETURN, 'outlook-unavailable');
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.redirect(new URL(`/sign-in?redirect=${encodeURIComponent(DEFAULT_RETURN)}`, origin));

  const params = req.nextUrl.searchParams;
  const [nonce, verifier] = (req.cookies.get(MS_FLOW_COOKIE)?.value ?? '').split('.');
  const checked = verifyState(params.get('state'), cfg.stateKey, { uid: user.supabaseUserId, nonce });
  if (!checked.ok) {
    console.warn('microsoft-calendar callback: state rejected:', checked.reason);
    return done(DEFAULT_RETURN, 'outlook-expired');
  }
  const ret = checked.payload.ret;

  // Cancelled on the Microsoft screen, or a school admin has not allowed the app.
  if (params.get('error')) return done(ret, 'outlook-denied');
  const code = params.get('code');
  if (!code || !verifier) return done(ret, 'outlook-error');

  try {
    const tokens = await exchangeMicrosoftCode(cfg, code, verifier);
    if (!hasMicrosoftCalendarScope(tokens.scope)) return done(ret, 'outlook-missing-scope');
    if (!tokens.refresh_token) return done(ret, 'outlook-error');
    await saveMicrosoftConnection({
      user_id: user.supabaseUserId,
      account_email: microsoftEmailFromIdToken(tokens.id_token),
      scopes: (tokens.scope ?? '').split(/\s+/).filter(Boolean),
      refresh_token_enc: encryptToken(tokens.refresh_token, cfg.encryptionKey, MS_AAD_REFRESH),
      access_token_enc: encryptToken(tokens.access_token, cfg.encryptionKey, MS_AAD_ACCESS),
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    });
    return done(ret, 'outlook-connected');
  } catch (err) {
    console.error('microsoft-calendar callback:', err instanceof Error ? err.message : err);
    return done(ret, 'outlook-error');
  }
}
