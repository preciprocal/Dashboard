// scripts/verify-google-calendar.ts
// Google Calendar: OAuth plumbing, token sealing, refresh handling, the event
// payload and the .ics file.
//
//   npm run verify:google-calendar
//
// No Google, no database: network calls run against a mocked fetch. What it
// cannot cover is a real consent screen, which needs the owner's OAuth client.

import { randomBytes } from 'node:crypto';
import { encryptToken, decryptToken, loadEncryptionKey, deriveStateKey } from '../lib/calendar/crypto';
import {
  getCalendarConfig, buildAuthorizeUrl, createPkcePair, pkceChallenge, signState, verifyState, safeReturnPath,
  refreshAccessToken, exchangeCode, revokeToken, emailFromIdToken, hasCalendarScope, ReconnectRequiredError,
  CALENDAR_SCOPE, STATE_TTL_MS, type FetchLike,
} from '../lib/calendar/oauth';
import { getValidAccessToken, AAD_ACCESS, AAD_REFRESH, type StoredConnection } from '../lib/calendar/tokens';
import {
  buildGoogleEvent, resolveSchedule, eventTitle, eventDescription, isInterviewStatus, stageForStatus, stageLabel,
  parseStage, cleanMeetingUrl, reconcileEvent, type ScheduleInput,
} from '../lib/calendar/events';
import { buildIcs, escapeIcsText, foldLine, icsDateTime, icsFileName } from '../lib/calendar/ics';
import { zonedWallTimeToUtc, utcToZonedWallTime, isValidTimeZone } from '../lib/calendar/time';
import { insertEvent, deleteEvent, listOurEvents, GoogleApiError } from '../lib/calendar/google-api';
import { callbackMessage, connectHref, upcomingWithin } from '../lib/calendar/status';

let pass = 0;
let fail = 0;
function eq<T>(label: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`}`);
}
const truthy = (label: string, v: unknown) => eq(label, !!v, true);
async function throwsAsync(label: string, fn: () => Promise<unknown>, cls?: new (...a: never[]) => Error) {
  try { await fn(); eq(label, 'no throw', 'throws'); } catch (e) { eq(label, cls ? e instanceof cls : true, true); }
}

// Mock fetch: records calls, answers from a queue.
function mockFetch(responses: { status: number; body?: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { status: 500, body: {} };
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  };
  return { f, calls };
}

(async () => {
  const keyB64 = randomBytes(32).toString('base64');
  const key = loadEncryptionKey(keyB64)!;

  // ─── Config ─────────────────────────────────────────────────────────────────
  const env = { GOOGLE_CALENDAR_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CALENDAR_CLIENT_SECRET: 'sec', NEXT_PUBLIC_APP_URL: 'https://app.preciprocal.com/', TOKEN_ENCRYPTION_KEY: keyB64 };
  const cfg = getCalendarConfig(env)!;
  eq('config: redirect URI from NEXT_PUBLIC_APP_URL', cfg.redirectUri, 'https://app.preciprocal.com/api/integrations/google-calendar/callback');
  eq('config: hidden without client id', getCalendarConfig({ ...env, GOOGLE_CALENDAR_CLIENT_ID: '' }), null);
  eq('config: hidden without secret', getCalendarConfig({ ...env, GOOGLE_CALENDAR_CLIENT_SECRET: undefined }), null);
  eq('config: hidden without app url', getCalendarConfig({ ...env, NEXT_PUBLIC_APP_URL: undefined }), null);
  eq('config: hidden with a 16-byte key', getCalendarConfig({ ...env, TOKEN_ENCRYPTION_KEY: randomBytes(16).toString('base64') }), null);
  eq('config: hidden with no key', getCalendarConfig({ ...env, TOKEN_ENCRYPTION_KEY: undefined }), null);
  eq('config: empty env hides the feature', getCalendarConfig({}), null);

  // ─── Encryption ─────────────────────────────────────────────────────────────
  const sealed = encryptToken('1//refresh-token-value', key, AAD_REFRESH);
  eq('crypto: round trip', decryptToken(sealed, key, AAD_REFRESH), '1//refresh-token-value');
  truthy('crypto: ciphertext does not contain the token', !sealed.includes('refresh-token-value'));
  truthy('crypto: fresh IV each time', encryptToken('x', key) !== encryptToken('x', key));
  await throwsAsync('crypto: wrong key fails', async () => decryptToken(sealed, randomBytes(32), AAD_REFRESH));
  await throwsAsync('crypto: wrong purpose (AAD) fails', async () => decryptToken(sealed, key, AAD_ACCESS));
  const parts = sealed.split('.');
  const flipped = [parts[0], parts[1], parts[2], (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)].join('.');
  await throwsAsync('crypto: tampered ciphertext fails', async () => decryptToken(flipped, key, AAD_REFRESH));
  await throwsAsync('crypto: unknown format fails', async () => decryptToken('v0.a.b.c', key));
  truthy('crypto: state key differs from encryption key', !deriveStateKey(key).equals(key));

  // ─── PKCE + authorize URL ───────────────────────────────────────────────────
  eq('pkce: RFC 7636 appendix B vector', pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const pair = createPkcePair();
  truthy('pkce: verifier length 43-128', pair.verifier.length >= 43 && pair.verifier.length <= 128);
  const url = new URL(buildAuthorizeUrl({ clientId: cfg.clientId, redirectUri: cfg.redirectUri, state: 'S', codeChallenge: pair.challenge, loginHint: 'sam@example.com' }));
  eq('authorize: Google endpoint', `${url.origin}${url.pathname}`, 'https://accounts.google.com/o/oauth2/v2/auth');
  eq('authorize: params', ['client_id', 'redirect_uri', 'response_type', 'state', 'code_challenge_method', 'access_type', 'prompt', 'login_hint'].map((k) => url.searchParams.get(k)),
    [cfg.clientId, cfg.redirectUri, 'code', 'S', 'S256', 'offline', 'consent', 'sam@example.com']);
  eq('authorize: scopes are exactly openid, email, calendar.events.owned', url.searchParams.get('scope'), `openid email ${CALENDAR_SCOPE}`);
  truthy('authorize: no Gmail scope', !url.toString().includes('gmail') && !url.toString().includes('mail.google'));
  eq('authorize: challenge matches verifier', url.searchParams.get('code_challenge'), pkceChallenge(pair.verifier));

  // ─── State ──────────────────────────────────────────────────────────────────
  const now = Date.now();
  const st = signState({ uid: 'u1', nonce: 'n1', iat: now, ret: '/job-tracker' }, cfg.stateKey);
  const ok = verifyState(st, cfg.stateKey, { uid: 'u1', nonce: 'n1' }, now + 1000);
  eq('state: valid', ok.ok && ok.payload.ret, '/job-tracker');
  eq('state: other user rejected', verifyState(st, cfg.stateKey, { uid: 'u2', nonce: 'n1' }, now).ok, false);
  eq('state: nonce mismatch rejected (other browser)', verifyState(st, cfg.stateKey, { uid: 'u1', nonce: 'nX' }, now).ok, false);
  eq('state: missing cookie rejected', verifyState(st, cfg.stateKey, { uid: 'u1', nonce: undefined }, now).ok, false);
  eq('state: expired rejected', verifyState(st, cfg.stateKey, { uid: 'u1', nonce: 'n1' }, now + STATE_TTL_MS + 1).ok, false);
  eq('state: wrong key rejected', verifyState(st, deriveStateKey(randomBytes(32)), { uid: 'u1', nonce: 'n1' }, now).ok, false);
  const [body, sig] = st.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ uid: 'u1', nonce: 'n1', iat: now, ret: '//evil.com' })).toString('base64url');
  eq('state: edited payload rejected', verifyState(`${forgedBody}.${sig}`, cfg.stateKey, { uid: 'u1', nonce: 'n1' }, now).ok, false);
  eq('state: garbage rejected', verifyState('nope', cfg.stateKey, { uid: 'u1', nonce: 'n1' }, now).ok, false);
  void body;
  eq('return path: protocol-relative refused', safeReturnPath('//evil.com/x'), '/settings?section=integrations');
  eq('return path: backslash trick refused', safeReturnPath('/\\evil.com'), '/settings?section=integrations');
  eq('return path: absolute URL refused', safeReturnPath('https://evil.com'), '/settings?section=integrations');
  eq('return path: same-origin kept', safeReturnPath('/job-tracker'), '/job-tracker');
  const signedBad = signState({ uid: 'u1', nonce: 'n1', iat: now, ret: '//evil.com' }, cfg.stateKey);
  const sb = verifyState(signedBad, cfg.stateKey, { uid: 'u1', nonce: 'n1' }, now);
  eq('state: even a signed bad return path is sanitised', sb.ok && sb.payload.ret, '/settings?section=integrations');
  eq('connect href encodes return', connectHref('/settings?section=integrations'), '/api/integrations/google-calendar/connect?return=%2Fsettings%3Fsection%3Dintegrations');
  eq('callback message: connected', callbackMessage('connected')?.ok, true);
  eq('callback message: unknown ignored', callbackMessage('lol'), null);

  // ─── Token endpoint ─────────────────────────────────────────────────────────
  {
    const m = mockFetch([{ status: 200, body: { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: `openid ${CALENDAR_SCOPE} https://www.googleapis.com/auth/userinfo.email`, id_token: `x.${Buffer.from(JSON.stringify({ email: 'sam@gmail.com' })).toString('base64url')}.y` } }]);
    const t = await exchangeCode(cfg, 'CODE', 'VERIFIER', m.f);
    const sent = new URLSearchParams(String(m.calls[0].init?.body));
    eq('exchange: sends code, verifier, redirect', [sent.get('grant_type'), sent.get('code'), sent.get('code_verifier'), sent.get('redirect_uri')], ['authorization_code', 'CODE', 'VERIFIER', cfg.redirectUri]);
    eq('exchange: email from id_token', emailFromIdToken(t.id_token), 'sam@gmail.com');
    eq('exchange: calendar scope detected', hasCalendarScope(t.scope), true);
    eq('exchange: unticked calendar scope detected', hasCalendarScope('openid email'), false);
    await throwsAsync('exchange: error response throws', () => exchangeCode(cfg, 'C', 'V', mockFetch([{ status: 400, body: { error: 'invalid_grant' } }]).f));
  }
  await throwsAsync('refresh: invalid_grant means reconnect', () => refreshAccessToken(cfg, 'rt', mockFetch([{ status: 400, body: { error: 'invalid_grant' } }]).f), ReconnectRequiredError);
  await throwsAsync('refresh: 500 is not a reconnect', async () => {
    try { await refreshAccessToken(cfg, 'rt', mockFetch([{ status: 500, body: {} }]).f); } catch (e) { if (e instanceof ReconnectRequiredError) return; throw e; }
  });
  eq('revoke: ok', await revokeToken('t', mockFetch([{ status: 200 }]).f), true);
  eq('revoke: already revoked (400) still counts', await revokeToken('t', mockFetch([{ status: 400, body: { error: 'invalid_token' } }]).f), true);
  eq('revoke: network error is false, not a throw', await revokeToken('t', async () => { throw new Error('offline'); }), false);

  // ─── Access token cache + refresh ───────────────────────────────────────────
  const baseConn = (over: Partial<StoredConnection> = {}): StoredConnection => ({
    user_id: 'u1', google_email: 'sam@gmail.com', scopes: [CALENDAR_SCOPE], calendar_id: 'primary', connected_at: new Date().toISOString(),
    refresh_token_enc: encryptToken('RT', key, AAD_REFRESH), access_token_enc: null, access_token_expires_at: null, last_error: null, broken_at: null, ...over,
  });
  {
    const saves: Record<string, string>[] = [];
    const broken: string[] = [];
    const deps = (f: FetchLike) => ({ fetch: f, now: () => now, save: async (u: Record<string, string>) => { saves.push(u); }, markBroken: async (r: string) => { broken.push(r); } });

    const cached = baseConn({ access_token_enc: encryptToken('CACHED', key, AAD_ACCESS), access_token_expires_at: new Date(now + 30 * 60_000).toISOString() });
    const m0 = mockFetch([]);
    eq('tokens: fresh cached token used, no network', [await getValidAccessToken(cached, cfg, deps(m0.f)), m0.calls.length], ['CACHED', 0]);

    const nearlyExpired = baseConn({ access_token_enc: encryptToken('OLD', key, AAD_ACCESS), access_token_expires_at: new Date(now + 30_000).toISOString() });
    const m1 = mockFetch([{ status: 200, body: { access_token: 'NEW', expires_in: 3600 } }]);
    eq('tokens: refreshes inside the expiry skew', await getValidAccessToken(nearlyExpired, cfg, deps(m1.f)), 'NEW');
    eq('tokens: refresh sends the decrypted refresh token', new URLSearchParams(String(m1.calls[0].init?.body)).get('refresh_token'), 'RT');
    eq('tokens: new access token saved encrypted', decryptToken(saves[0].access_token_enc, key, AAD_ACCESS), 'NEW');
    eq('tokens: expiry saved', saves[0].access_token_expires_at, new Date(now + 3600_000).toISOString());
    eq('tokens: refresh token untouched when Google does not rotate it', saves[0].refresh_token_enc, undefined);

    const m2 = mockFetch([{ status: 200, body: { access_token: 'NEW2', expires_in: 3600, refresh_token: 'RT2' } }]);
    await getValidAccessToken(baseConn(), cfg, deps(m2.f));
    eq('tokens: rotated refresh token stored', decryptToken(saves[1].refresh_token_enc, key, AAD_REFRESH), 'RT2');

    const m3 = mockFetch([{ status: 400, body: { error: 'invalid_grant' } }]);
    await throwsAsync('tokens: revoked grant throws ReconnectRequired', () => getValidAccessToken(baseConn(), cfg, deps(m3.f)), ReconnectRequiredError);
    eq('tokens: revoked grant marks the connection broken', broken, ['revoked']);

    const m4 = mockFetch([]);
    await throwsAsync('tokens: broken connection does not call Google', () => getValidAccessToken(baseConn({ broken_at: new Date().toISOString(), last_error: 'revoked' }), cfg, deps(m4.f)), ReconnectRequiredError);
    eq('tokens: ...no network call', m4.calls.length, 0);

    await throwsAsync('tokens: key rotated, refresh token unreadable -> reconnect', () => getValidAccessToken(baseConn({ refresh_token_enc: encryptToken('RT', randomBytes(32), AAD_REFRESH) }), cfg, deps(mockFetch([]).f)), ReconnectRequiredError);
    eq('tokens: ...and marked broken', broken[broken.length - 1], 'encryption-key-changed');

    const m5 = mockFetch([{ status: 503, body: {} }]);
    const before = broken.length;
    await throwsAsync('tokens: Google outage throws', () => getValidAccessToken(baseConn(), cfg, deps(m5.f)));
    eq('tokens: ...but does not mark broken', broken.length, before);

    const m6 = mockFetch([{ status: 200, body: { access_token: 'FORCED', expires_in: 3600 } }]);
    eq('tokens: forceRefresh skips a valid cache', await getValidAccessToken(cached, cfg, deps(m6.f), { forceRefresh: true }), 'FORCED');
  }

  // ─── Time zones ─────────────────────────────────────────────────────────────
  eq('tz: New York winter (EST, -5)', zonedWallTimeToUtc({ date: '2026-12-01', time: '14:00' }, 'America/New_York')?.toISOString(), '2026-12-01T19:00:00.000Z');
  eq('tz: New York summer (EDT, -4)', zonedWallTimeToUtc({ date: '2026-07-01', time: '14:00' }, 'America/New_York')?.toISOString(), '2026-07-01T18:00:00.000Z');
  eq('tz: Kolkata (+5:30)', zonedWallTimeToUtc({ date: '2026-11-20', time: '09:30' }, 'Asia/Kolkata')?.toISOString(), '2026-11-20T04:00:00.000Z');
  eq('tz: London on its DST-end day after the change', zonedWallTimeToUtc({ date: '2026-10-25', time: '12:00' }, 'Europe/London')?.toISOString(), '2026-10-25T12:00:00.000Z');
  eq('tz: UTC', zonedWallTimeToUtc({ date: '2026-11-20', time: '00:00' }, 'UTC')?.toISOString(), '2026-11-20T00:00:00.000Z');
  eq('tz: spring-forward gap resolves to a real instant', zonedWallTimeToUtc({ date: '2026-03-08', time: '02:30' }, 'America/New_York')?.toISOString(), '2026-03-08T07:30:00.000Z');
  eq('tz: ambiguous fall-back hour picks a real instant', !!zonedWallTimeToUtc({ date: '2026-11-01', time: '01:30' }, 'America/New_York'), true);
  eq('tz: Feb 31 rejected', zonedWallTimeToUtc({ date: '2026-02-31', time: '10:00' }, 'UTC'), null);
  eq('tz: 24:00 rejected', zonedWallTimeToUtc({ date: '2026-02-01', time: '24:00' }, 'UTC'), null);
  eq('tz: unknown zone rejected', isValidTimeZone('Mars/Olympus'), false);
  eq('tz: round trip back to wall time', utcToZonedWallTime(new Date('2026-07-01T18:00:00Z'), 'America/New_York'), { date: '2026-07-01', time: '14:00' });

  // ─── Status mapping ─────────────────────────────────────────────────────────
  eq('stages: interview statuses', ['wishlist', 'applied', 'phone-screen', 'technical', 'final', 'offer', 'rejected'].map(isInterviewStatus), [false, false, true, true, true, false, false]);
  eq('stages: preselect from status', [stageForStatus('technical'), stageForStatus('applied')], ['technical', 'other']);
  eq('stages: labels', [stageLabel('phone-screen'), stageLabel('final'), stageLabel('weird')], ['Phone screen', 'Final round', 'Interview']);
  eq('stages: parse rejects unknown', parseStage('ceo-chat'), 'other');

  // ─── Event payload ──────────────────────────────────────────────────────────
  const input: ScheduleInput = {
    applicationId: '11111111-2222-3333-4444-555555555555', company: 'Stripe, Inc.', jobTitle: 'Senior Software Engineer',
    wall: { date: '2026-12-01', time: '14:00' }, timeZone: 'America/New_York', durationMinutes: 45, stage: 'technical',
    meetingUrl: 'https://meet.google.com/abc-defg-hij', notes: 'Bring: system design; ask about team, on-call\nInterviewer: Priya',
  };
  const r = resolveSchedule(input);
  if ('error' in r) throw new Error(r.error);
  eq('event: end = start + duration', r.end.toISOString(), '2026-12-01T19:45:00.000Z');
  eq('event: title', eventTitle(input.jobTitle, input.company), 'Interview: Senior Software Engineer at Stripe, Inc.');
  eq('event: title without company', eventTitle('Designer', ' '), 'Interview: Designer');
  const g = buildGoogleEvent(r, 'https://app.preciprocal.com');
  eq('event: google start/end + zone', [g.start, g.end], [{ dateTime: '2026-12-01T19:00:00.000Z', timeZone: 'America/New_York' }, { dateTime: '2026-12-01T19:45:00.000Z', timeZone: 'America/New_York' }]);
  eq('event: marker property for listing our own events', g.extendedProperties.private, { preciprocal: 'interview', applicationId: input.applicationId });
  truthy('event: description links to practice', g.description.includes('https://app.preciprocal.com/interview/create?application=11111111-2222-3333-4444-555555555555'));
  truthy('event: description links to the application', g.description.includes('https://app.preciprocal.com/job-tracker?application='));
  truthy('event: description has meeting link and notes', g.description.includes('Join: https://meet.google.com/abc-defg-hij') && g.description.includes('Interviewer: Priya'));
  eq('event: location is the meeting link', g.location, 'https://meet.google.com/abc-defg-hij');
  truthy('event: no em or en dashes in generated copy', !/[\u2013\u2014]/.test(g.description + g.summary));
  eq('event: bad duration rejected', 'error' in resolveSchedule({ ...input, durationMinutes: 0 }), true);
  eq('event: too long rejected', 'error' in resolveSchedule({ ...input, durationMinutes: 9 * 60 }), true);
  eq('event: bad zone rejected', 'error' in resolveSchedule({ ...input, timeZone: 'Nowhere/Land' }), true);
  eq('meeting url: javascript: refused', cleanMeetingUrl('javascript:alert(1)'), null);
  eq('meeting url: https kept', cleanMeetingUrl(' https://zoom.us/j/1 '), 'https://zoom.us/j/1');
  eq('meeting url: empty is null', cleanMeetingUrl(''), null);

  // ─── Reconcile with Google ──────────────────────────────────────────────────
  const stored = { startsAt: '2026-12-01T19:00:00.000Z', endsAt: '2026-12-01T19:45:00.000Z' };
  eq('reconcile: unchanged', reconcileEvent(stored, { id: 'e', status: 'confirmed', start: { dateTime: '2026-12-01T14:00:00-05:00' }, end: { dateTime: '2026-12-01T14:45:00-05:00' } }).kind, 'same');
  eq('reconcile: moved in Google', reconcileEvent(stored, { id: 'e', start: { dateTime: '2026-12-02T15:00:00-05:00' }, end: { dateTime: '2026-12-02T16:00:00-05:00' } }), { kind: 'moved', startsAt: '2026-12-02T20:00:00.000Z', endsAt: '2026-12-02T21:00:00.000Z' });
  eq('reconcile: cancelled', reconcileEvent(stored, { id: 'e', status: 'cancelled' }).kind, 'deleted');
  eq('reconcile: missing', reconcileEvent(stored, undefined).kind, 'deleted');
  eq('reconcile: made all-day, keep ours', reconcileEvent(stored, { id: 'e', start: { date: '2026-12-01' }, end: { date: '2026-12-02' } }).kind, 'same');

  // ─── Calendar API calls ─────────────────────────────────────────────────────
  {
    const m = mockFetch([{ status: 200, body: { id: 'ev1' } }, { status: 200, body: { items: [{ id: 'ev1' }] } }, { status: 404, body: { error: { message: 'Not Found' } } }, { status: 401, body: { error: { message: 'Invalid Credentials' } } }]);
    eq('api: insert returns id', (await insertEvent('AT', 'primary', g, m.f)).id, 'ev1');
    eq('api: bearer token sent', (m.calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer AT');
    await listOurEvents('AT', 'primary', new Date(now), new Date(now + 14 * 86_400_000), m.f);
    const lu = new URL(m.calls[1].url);
    eq('api: list filters to our marker server side', lu.searchParams.get('privateExtendedProperty'), 'preciprocal=interview');
    eq('api: list asks only for id/status/times', lu.searchParams.get('fields'), 'items(id,status,start,end)');
    await deleteEvent('AT', 'primary', 'gone', m.f);
    eq('api: delete of a missing event is fine', m.calls.length, 3);
    await throwsAsync('api: 401 surfaces as GoogleApiError for a retry', () => insertEvent('AT', 'primary', g, m.f), GoogleApiError);
  }

  // ─── .ics ───────────────────────────────────────────────────────────────────
  eq('ics: escaping', escapeIcsText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
  eq('ics: UTC date-time', icsDateTime(new Date('2026-12-01T19:00:00.000Z')), '20261201T190000Z');
  const long = 'DESCRIPTION:' + 'x'.repeat(200);
  const folded = foldLine(long).split('\r\n');
  truthy('ics: folded lines are at most 75 octets', folded.every((l) => Buffer.byteLength(l, 'utf8') <= 75));
  truthy('ics: continuation lines start with one space', folded.slice(1).every((l) => l.startsWith(' ') && !l.startsWith('  ')));
  eq('ics: unfolding restores the line', folded.map((l, i) => (i ? l.slice(1) : l)).join(''), long);
  const multi = 'SUMMARY:' + 'Zürich é ' .repeat(20) + '\u{1F4C5}'.repeat(10);
  const mf = foldLine(multi).split('\r\n');
  truthy('ics: multibyte text folds under 75 octets', mf.every((l) => Buffer.byteLength(l, 'utf8') <= 75));
  eq('ics: multibyte unfold is lossless', mf.map((l, i) => (i ? l.slice(1) : l)).join(''), multi);
  truthy('ics: never splits a surrogate pair', !mf.join('').includes('�'));

  const ics = buildIcs(r, 'https://app.preciprocal.com', { uid: `${input.applicationId}@preciprocal.com`, sequence: 3, now: new Date('2026-11-12T10:00:00Z') });
  const lines = ics.split('\r\n');
  truthy('ics: CRLF line endings throughout', !ics.replace(/\r\n/g, '').includes('\n'));
  eq('ics: ends with CRLF', ics.endsWith('END:VCALENDAR\r\n'), true);
  eq('ics: begins VCALENDAR', lines[0], 'BEGIN:VCALENDAR');
  truthy('ics: has VERSION and PRODID', lines.includes('VERSION:2.0') && lines.some((l) => l.startsWith('PRODID:')));
  const unfolded = ics.replace(/\r\n /g, '').split('\r\n');
  const prop = (n: string) => unfolded.find((l) => l.startsWith(`${n}:`))?.slice(n.length + 1);
  eq('ics: required VEVENT props', [prop('UID'), prop('DTSTAMP'), prop('DTSTART'), prop('DTEND'), prop('SEQUENCE')],
    [`${input.applicationId}@preciprocal.com`, '20261112T100000Z', '20261201T190000Z', '20261201T194500Z', '3']);
  eq('ics: summary escaped (comma in company)', prop('SUMMARY'), 'Interview: Senior Software Engineer at Stripe\\, Inc.');
  truthy('ics: description escapes newlines and semicolons', prop('DESCRIPTION')!.includes('Bring: system design\\; ask about team\\, on-call\\nInterviewer: Priya'));
  eq('ics: description round trips', prop('DESCRIPTION')!.replace(/\\n/g, '\n').replace(/\\([;,\\])/g, '$1'), eventDescription(r, 'https://app.preciprocal.com'));
  eq('ics: balanced BEGIN/END', ['VCALENDAR', 'VEVENT', 'VALARM'].map((c) => unfolded.filter((l) => l === `BEGIN:${c}`).length === unfolded.filter((l) => l === `END:${c}`).length), [true, true, true]);
  truthy('ics: every physical line <= 75 octets', lines.every((l) => Buffer.byteLength(l, 'utf8') <= 75));
  eq('ics: file name', icsFileName('Stripe, Inc.'), 'interview-stripe-inc.ics');
  eq('ics: file name fallback', icsFileName('***'), 'interview-preciprocal.ics');

  // ─── Upcoming strip ─────────────────────────────────────────────────────────
  const mk = (id: string, hoursFromNow: number) => ({ applicationId: id, startsAt: new Date(now + hoursFromNow * 3600_000).toISOString(), endsAt: new Date(now + (hoursFromNow + 1) * 3600_000).toISOString(), timeZone: 'UTC', stage: 'technical', meetingUrl: null, notes: null, onGoogle: false, onCalendar: null });
  eq('upcoming: next 14 days only, soonest first', upcomingWithin([mk('later', 15 * 24), mk('b', 48), mk('past', -5), mk('a', 2), mk('now', -0.5)], 14, now).map((s) => s.applicationId), ['now', 'a', 'b']);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
