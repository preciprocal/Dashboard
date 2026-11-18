// scripts/verify-microsoft-calendar.ts
// Checks the Outlook calendar pieces without Microsoft: config, the authorize
// URL, the token requests, refresh and revocation handling, the Graph event
// payload, read-back and the Graph calls, all against a mocked fetch.
// Run: npx tsx --tsconfig tsconfig.json scripts/verify-microsoft-calendar.ts
import { randomBytes } from 'node:crypto';
import {
  getMicrosoftConfig, buildMicrosoftAuthorizeUrl, exchangeMicrosoftCode, refreshMicrosoftToken,
  microsoftEmailFromIdToken, hasMicrosoftCalendarScope, MS_TOKEN_URL, MS_AAD_ACCESS, MS_AAD_REFRESH,
} from '../lib/calendar/microsoft-oauth';
import { ReconnectRequiredError } from '../lib/calendar/oauth';
import { encryptToken } from '../lib/calendar/crypto';
import { getValidAccessToken } from '../lib/calendar/tokens';
import { buildOutlookEvent, outlookToLite, reconcileEvent, resolveSchedule, OUTLOOK_MARKER_ID } from '../lib/calendar/events';
import { insertOutlookEvent, deleteOutlookEvent, getOutlookEvents, GraphApiError } from '../lib/calendar/microsoft-api';
import { connectHref, callbackMessage } from '../lib/calendar/status';

let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
};
async function throwsAsync(name: string, fn: () => Promise<unknown>, cls?: new (...a: never[]) => Error) {
  try { await fn(); eq(name, 'no throw', 'throw'); } catch (e) { eq(name, cls ? e instanceof cls : true, true); }
}
type Call = { url: string; init?: RequestInit };
function mockFetch(responses: { status: number; body?: unknown }[]) {
  const calls: Call[] = [];
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift() ?? { status: 500, body: {} };
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  };
  return { f, calls };
}

(async () => {
  const key = randomBytes(32).toString('base64');
  const env = { MICROSOFT_CALENDAR_CLIENT_ID: 'cid', MICROSOFT_CALENDAR_CLIENT_SECRET: 'sec', NEXT_PUBLIC_APP_URL: 'https://app.example.com/', TOKEN_ENCRYPTION_KEY: key };
  const cfg = getMicrosoftConfig(env)!;
  eq('config: hidden without the secret', getMicrosoftConfig({ ...env, MICROSOFT_CALENDAR_CLIENT_SECRET: '' }), null);
  eq('config: redirect from app url', cfg.redirectUri, 'https://app.example.com/api/integrations/microsoft-calendar/callback');

  const u = new URL(buildMicrosoftAuthorizeUrl({ clientId: 'cid', redirectUri: cfg.redirectUri, state: 'S', codeChallenge: 'C', loginHint: 'a@b.edu' }));
  eq('authorize: common tenant v2', `${u.origin}${u.pathname}`, 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  eq('authorize: params', ['client_id', 'response_type', 'redirect_uri', 'response_mode', 'scope', 'state', 'code_challenge', 'code_challenge_method', 'prompt', 'login_hint'].map((k) => u.searchParams.get(k)),
    ['cid', 'code', cfg.redirectUri, 'query', 'openid email offline_access User.Read Calendars.ReadWrite', 'S', 'C', 'S256', 'select_account', 'a@b.edu']);

  const m1 = mockFetch([{ status: 200, body: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'Calendars.ReadWrite User.Read openid email' } }]);
  await exchangeMicrosoftCode(cfg, 'CODE', 'VER', m1.f);
  const form = new URLSearchParams(String(m1.calls[0].init?.body));
  eq('exchange: token url', m1.calls[0].url, MS_TOKEN_URL);
  eq('exchange: form', ['grant_type', 'code', 'code_verifier', 'client_id', 'client_secret', 'redirect_uri', 'scope'].map((k) => form.get(k)),
    ['authorization_code', 'CODE', 'VER', 'cid', 'sec', cfg.redirectUri, 'openid email offline_access User.Read Calendars.ReadWrite']);

  await throwsAsync('refresh: invalid_grant -> reconnect', () => refreshMicrosoftToken(cfg, 'RT', mockFetch([{ status: 400, body: { error: 'invalid_grant' } }]).f), ReconnectRequiredError);
  await throwsAsync('refresh: interaction_required -> reconnect', () => refreshMicrosoftToken(cfg, 'RT', mockFetch([{ status: 400, body: { error: 'interaction_required' } }]).f), ReconnectRequiredError);
  await throwsAsync('refresh: outage is not a reconnect', async () => {
    try { await refreshMicrosoftToken(cfg, 'RT', mockFetch([{ status: 503, body: {} }]).f); } catch (e) { if (e instanceof ReconnectRequiredError) return; throw e; }
  });

  const idt = (p: object) => `x.${Buffer.from(JSON.stringify(p)).toString('base64url')}.y`;
  eq('id_token: email claim', microsoftEmailFromIdToken(idt({ email: 's@uni.edu' })), 's@uni.edu');
  eq('id_token: falls back to preferred_username', microsoftEmailFromIdToken(idt({ preferred_username: 's@outlook.com' })), 's@outlook.com');
  eq('scope: short name', hasMicrosoftCalendarScope('openid Calendars.ReadWrite'), true);
  eq('scope: full uri', hasMicrosoftCalendarScope('https://graph.microsoft.com/Calendars.ReadWrite'), true);
  eq('scope: read only is not enough', hasMicrosoftCalendarScope('Calendars.Read User.Read'), false);

  // Token refresh through the shared token code, sealed with the Microsoft AAD.
  let saved: Record<string, string> | null = null;
  const conn = { refresh_token_enc: encryptToken('RT', cfg.encryptionKey, MS_AAD_REFRESH), access_token_enc: null, access_token_expires_at: null, last_error: null, broken_at: null };
  const m2 = mockFetch([{ status: 200, body: { access_token: 'NEW', refresh_token: 'RT2', expires_in: 3600 } }]);
  const tok = await getValidAccessToken(conn, cfg, {
    fetch: m2.f, refresh: (rt, f) => refreshMicrosoftToken(cfg, rt, f), aad: { refresh: MS_AAD_REFRESH, access: MS_AAD_ACCESS },
    save: async (x) => { saved = x as Record<string, string>; }, markBroken: async () => {},
  });
  eq('tokens: refreshed via Microsoft', [tok, m2.calls[0].url, !!saved && 'refresh_token_enc' in saved!], ['NEW', MS_TOKEN_URL, true]);

  // Event payload
  const r = resolveSchedule({ applicationId: '11111111-1111-1111-1111-111111111111', company: 'Stripe', jobTitle: 'Data Analyst', wall: { date: '2026-12-01', time: '10:00' }, timeZone: 'America/New_York', durationMinutes: 45, stage: 'technical', meetingUrl: 'https://zoom.us/j/1', notes: null });
  if ('error' in r) throw new Error(r.error);
  const ev = buildOutlookEvent(r, 'https://app.example.com');
  eq('event: subject', ev.subject, 'Interview: Data Analyst at Stripe');
  eq('event: UTC times', [ev.start, ev.end], [{ dateTime: '2026-12-01T15:00:00.000', timeZone: 'UTC' }, { dateTime: '2026-12-01T15:45:00.000', timeZone: 'UTC' }]);
  eq('event: reminder, location, marker', [ev.isReminderOn, ev.reminderMinutesBeforeStart, ev.location?.displayName, ev.singleValueExtendedProperties[0].id], [true, 30, 'https://zoom.us/j/1', OUTLOOK_MARKER_ID]);
  eq('event: description links back', ev.body.content.includes('https://app.example.com/job-tracker?application=11111111-1111-1111-1111-111111111111'), true);

  // Read back and reconcile
  const lite = outlookToLite({ id: 'E', start: { dateTime: '2026-12-01T16:00:00.0000000' }, end: { dateTime: '2026-12-01T16:45:00.0000000' } });
  eq('readback: moved in Outlook', reconcileEvent({ startsAt: r.start.toISOString(), endsAt: r.end.toISOString() }, lite).kind, 'moved');
  eq('readback: cancelled', reconcileEvent({ startsAt: r.start.toISOString(), endsAt: r.end.toISOString() }, outlookToLite({ id: 'E', isCancelled: true })).kind, 'deleted');
  eq('readback: same time', reconcileEvent({ startsAt: r.start.toISOString(), endsAt: r.end.toISOString() }, outlookToLite({ id: 'E', start: { dateTime: '2026-12-01T15:00:00.0000000' }, end: { dateTime: '2026-12-01T15:45:00.0000000' } })).kind, 'same');

  // Graph calls
  const m3 = mockFetch([{ status: 201, body: { id: 'EV1', start: { dateTime: '2026-12-01T15:00:00.0000000' }, end: { dateTime: '2026-12-01T15:45:00.0000000' } } }]);
  const created = await insertOutlookEvent('TOK', ev, m3.f);
  const h = m3.calls[0].init?.headers as Record<string, string>;
  eq('graph: insert', [m3.calls[0].url, m3.calls[0].init?.method, h.Authorization, h.Prefer, created.id], ['https://graph.microsoft.com/v1.0/me/events', 'POST', 'Bearer TOK', 'outlook.timezone="UTC"', 'EV1']);
  await deleteOutlookEvent('TOK', 'GONE', mockFetch([{ status: 404, body: { error: { message: 'not found' } } }]).f);
  eq('graph: delete of a missing event is fine', true, true);
  const m4 = mockFetch([{ status: 200, body: { id: 'A', start: { dateTime: '2026-12-01T15:00:00' }, end: { dateTime: '2026-12-01T15:45:00' } } }, { status: 404, body: {} }]);
  const got = await getOutlookEvents('TOK', ['A', 'B'], m4.f);
  eq('graph: read back by id, deleted is undefined', [got.get('A')?.id, got.has('B'), got.get('B')], ['A', true, undefined]);
  await throwsAsync('graph: 401 surfaces for a retry', () => insertOutlookEvent('TOK', ev, mockFetch([{ status: 401, body: {} }]).f), GraphApiError);

  // UI helpers
  eq('connect: provider path', connectHref('/job-tracker', 'microsoft'), '/api/integrations/microsoft-calendar/connect?return=%2Fjob-tracker');
  eq('connect: google stays the default', connectHref('/x'), '/api/integrations/google-calendar/connect?return=%2Fx');
  eq('callback: outlook message', callbackMessage('outlook-connected')?.ok, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
