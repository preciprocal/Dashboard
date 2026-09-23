// lib/session/registry.ts
// The session layer sitting alongside Supabase Auth: records sessions, caps
// how many run at once, and notices accounts spread across many devices.
//
// See supabase/migrations/0026_user_sessions.sql for why this exists at all
// (GoTrue exposes neither a cap nor a way to list a user's sessions) and for
// the important caveat that revocation here is enforced by our middleware on
// the next navigation, not instantly at the token layer.
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { flagAccount } from '@/lib/abuse/flag-account';
import { FLAG_REASONS } from '@/lib/config/abuse-guard';
import { sendNewDeviceEmail } from '@/lib/email/new-device';
import { revokedKey } from '@/lib/session/keys';
import {
  MAX_CONCURRENT_SESSIONS,
  SESSION_ACTIVE_DAYS,
  DEVICE_SPREAD_WINDOW_DAYS,
  DEVICE_SPREAD_THRESHOLD,
} from '@/lib/config/session-guard';

const DAY_MS = 24 * 60 * 60 * 1000;

// 60 days: long enough to outlive any session the cap would have evicted, so a
// revoked session cannot come back simply because the marker expired first.
const REVOKED_TTL_SECONDS = 60 * 24 * 60 * 60;

export interface SessionContext {
  userId: string;          // Supabase auth uuid
  sessionId: string;       // `session_id` claim from the access token
  email: string | null;
  fingerprint: string | null;
  ip: string | null;
  geoCountry: string | null;
  geoCity: string | null;
  userAgent: string | null;
}

export interface SyncResult {
  /** True when THIS session has been revoked and should be signed out. */
  revoked: boolean;
}

/**
 * Record a heartbeat for the current session, then enforce the cap.
 *
 * Safe to call on every page load: the upsert is idempotent, and the expensive
 * work (cap enforcement, spread check) only runs when the session row is newly
 * created.
 */
export async function syncSession(ctx: SessionContext): Promise<SyncResult> {
  try {
    // Was this session already evicted while it was away?
    const { data: existing } = await supabaseAdmin
      .from('user_sessions')
      .select('session_id, revoked_at')
      .eq('session_id', ctx.sessionId)
      .maybeSingle();

    if (existing?.revoked_at) return { revoked: true };

    const now = new Date().toISOString();

    if (existing) {
      // ── Geolocation is only overwritten when we actually have one ───────
      //
      // geoCountry/geoCity come from Vercel edge headers, which are absent off
      // Vercel and on local requests. This used to write them unconditionally,
      // so a session that recorded a good location at creation lost it on the
      // first headerless heartbeat. checkDeviceSpread's location set then
      // degraded toward empty and the geography half of the rule quietly
      // stopped firing - the failure mode being that an abuse control appears
      // to run while having nothing left to compare.
      //
      // ip is treated the same way for the same reason.
      const patch: Record<string, unknown> = { last_seen_at: now };
      if (ctx.ip)         patch.ip          = ctx.ip;
      if (ctx.geoCountry) patch.geo_country = ctx.geoCountry;
      if (ctx.geoCity)    patch.geo_city    = ctx.geoCity;

      await supabaseAdmin
        .from('user_sessions')
        .update(patch)
        .eq('session_id', ctx.sessionId);

      // ── Re-evaluated on heartbeats too, not only at login ───────────────
      //
      // Both checks used to run on the new-session branch only, and this path
      // returns before them. An account that crosses the device or location
      // threshold through activity on already-registered sessions was not
      // looked at again until someone logged in fresh - which a sharer has no
      // reason to do.
      //
      // Only the spread check runs here. enforceSessionCap evicts the oldest
      // session, and running that on every heartbeat would let two tabs take
      // turns evicting each other; it belongs where a session is actually
      // added.
      await checkDeviceSpread(ctx.userId);

      return { revoked: false };
    }

    // ── New session ─────────────────────────────────────────────────────────
    await supabaseAdmin.from('user_sessions').insert({
      session_id:         ctx.sessionId,
      user_id:            ctx.userId,
      device_fingerprint: ctx.fingerprint,
      ip:                 ctx.ip,
      geo_country:        ctx.geoCountry,
      geo_city:           ctx.geoCity,
      user_agent:         ctx.userAgent,
      created_at:         now,
      last_seen_at:       now,
    });

    await enforceSessionCap(ctx);
    await checkDeviceSpread(ctx.userId);

    return { revoked: false };
  } catch (err) {
    // Fails OPEN. A registry outage must not lock anyone out of the product -
    // the worst case of skipping this is that account sharing goes unnoticed
    // for a while, which is strictly better than signing out paying users
    // because a table was unreachable.
    console.error('⚠️ Session sync failed (non-fatal):', err);
    return { revoked: false };
  }
}

/**
 * Evict oldest-first until the account is back under the cap.
 *
 * Ordered by last_seen_at rather than created_at deliberately: "oldest" should
 * mean least recently used, not first created. Otherwise someone's main
 * everyday browser gets evicted simply because they logged in on it first.
 */
async function enforceSessionCap(ctx: SessionContext): Promise<void> {
  const activeSince = new Date(Date.now() - SESSION_ACTIVE_DAYS * DAY_MS).toISOString();

  const { data: active } = await supabaseAdmin
    .from('user_sessions')
    .select('session_id, last_seen_at')
    .eq('user_id', ctx.userId)
    .is('revoked_at', null)
    .gte('last_seen_at', activeSince)
    .order('last_seen_at', { ascending: false });

  if (!active || active.length <= MAX_CONCURRENT_SESSIONS) return;

  // Keep the most recent MAX, drop the rest. The just-created session is the
  // newest, so it is never the one evicted.
  const toRevoke = active.slice(MAX_CONCURRENT_SESSIONS).map(s => s.session_id as string);
  if (toRevoke.length === 0) return;

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('user_sessions')
    .update({ revoked_at: now, revoked_reason: 'concurrent_session_cap' })
    .in('session_id', toRevoke);

  // Redis is what middleware actually checks, so a failure here means the
  // eviction is recorded but not enforced until that session's next heartbeat.
  // Logged rather than thrown: partial enforcement beats failing the login.
  if (redis) {
    try {
      await Promise.all(
        toRevoke.map(id => redis!.set(revokedKey(id), '1', { ex: REVOKED_TTL_SECONDS })),
      );
    } catch (err) {
      console.error('⚠️ Failed to publish session revocations to Redis:', err);
    }
  }

  console.log(
    `🔐 Session cap: revoked ${toRevoke.length} session(s) for user=${ctx.userId} ` +
    `(cap=${MAX_CONCURRENT_SESSIONS})`,
  );

  if (ctx.email) {
    const location = [ctx.geoCity, ctx.geoCountry].filter(Boolean).join(', ') || null;
    await sendNewDeviceEmail({ email: ctx.email, location, userAgent: ctx.userAgent });
  }
}

/**
 * Flag accounts running on many distinct devices or in many distinct cities in
 * a short window. Log only, per the spec: no eviction, no block, no
 * degradation. Lands in the same review queue as the Task 2 and Task 3 flags.
 */
async function checkDeviceSpread(userId: string): Promise<void> {
  const since = new Date(Date.now() - DEVICE_SPREAD_WINDOW_DAYS * DAY_MS).toISOString();

  const { data: recent } = await supabaseAdmin
    .from('user_sessions')
    .select('device_fingerprint, geo_city, geo_country, created_at')
    .eq('user_id', userId)
    .gte('created_at', since);

  if (!recent || recent.length === 0) return;

  const devices = new Set(
    recent.map(r => r.device_fingerprint as string | null).filter(Boolean) as string[],
  );
  const locations = new Set(
    recent
      .map(r => [r.geo_city, r.geo_country].filter(Boolean).join(', '))
      .filter(s => s.length > 0),
  );

  if (devices.size < DEVICE_SPREAD_THRESHOLD && locations.size < DEVICE_SPREAD_THRESHOLD) return;

  await flagAccount(userId, FLAG_REASONS.multiDevice, {
    distinctDevices:   devices.size,
    distinctLocations: locations.size,
    locations:         [...locations],
    windowDays:        DEVICE_SPREAD_WINDOW_DAYS,
    threshold:         DEVICE_SPREAD_THRESHOLD,
    sessionsInWindow:  recent.length,
    // Spelled out for whoever works the queue, because this detector has a
    // genuinely high false-positive rate.
    note: 'Log-only signal. One person with a laptop, a phone on mobile data, '
        + 'and a work machine can legitimately produce this.',
  });
}
