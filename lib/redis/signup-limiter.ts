// lib/redis/signup-limiter.ts
// Rolling 30-day signup counters keyed by IP and by device fingerprint, held
// in the Upstash Redis already used for caching and usage counters.
//
// Redis rather than Postgres because these are pure TTL counters: they expire
// on their own, never need joining against anything, and a lost count costs a
// duplicate account rather than a correctness bug.
import { redis } from '@/lib/redis/redis-client';
import {
  MAX_SIGNUPS_PER_IP,
  MAX_SIGNUPS_PER_DEVICE,
  SIGNUP_WINDOW_DAYS,
} from '@/lib/config/abuse-guard';

const WINDOW_SECONDS = SIGNUP_WINDOW_DAYS * 24 * 60 * 60;

const keyForIp     = (ip: string)          => `signup:ip:${ip}`;
const keyForDevice = (fingerprint: string) => `signup:fp:${fingerprint}`;

export interface SignupGuardResult {
  allowed: boolean;
  /** Which signal tripped - for logs, so collateral damage is measurable. */
  blockedBy?: 'ip' | 'device';
}

/**
 * Read-only pre-check. Does NOT consume quota - call recordSignup() after the
 * account actually gets created, so an abandoned or failed signup attempt
 * doesn't lock the visitor out for 30 days.
 *
 * FAILS OPEN. If Redis is unreachable or errors, signups proceed unchecked.
 * This is the opposite of lib/ai/usage-guard.ts, which fails closed, and the
 * asymmetry is deliberate: a usage-guard outage overcharges one existing
 * account, whereas a signup-guard outage that failed closed would take the
 * entire top of the funnel to zero for as long as Redis is down.
 */
export async function checkSignupAllowed(
  ip: string | null,
  fingerprint: string | null,
): Promise<SignupGuardResult> {
  if (!redis) return { allowed: true };

  try {
    const [ipCount, deviceCount] = await Promise.all([
      ip          ? redis.get<number>(keyForIp(ip))              : Promise.resolve(null),
      fingerprint ? redis.get<number>(keyForDevice(fingerprint)) : Promise.resolve(null),
    ]);

    // Device first: it's the more precise signal, so when both trip it's the
    // more accurate thing to attribute the block to.
    if (fingerprint && (deviceCount ?? 0) >= MAX_SIGNUPS_PER_DEVICE) {
      return { allowed: false, blockedBy: 'device' };
    }
    if (ip && (ipCount ?? 0) >= MAX_SIGNUPS_PER_IP) {
      return { allowed: false, blockedBy: 'ip' };
    }

    return { allowed: true };
  } catch (err) {
    console.error('⚠️ Signup guard check failed - allowing signup:', err);
    return { allowed: true };
  }
}

/**
 * Consume quota. Call only once the account exists.
 *
 * Each key's TTL is set on first increment and not extended afterwards, which
 * makes the window fixed-from-first-signup rather than sliding. A sliding
 * window would let a steady trickle of attempts keep a legitimate visitor
 * locked out indefinitely.
 */
export async function recordSignup(
  ip: string | null,
  fingerprint: string | null,
): Promise<void> {
  if (!redis) return;

  try {
    await Promise.all([
      ip          ? bumpWithTtl(keyForIp(ip))              : Promise.resolve(),
      fingerprint ? bumpWithTtl(keyForDevice(fingerprint)) : Promise.resolve(),
    ]);
  } catch (err) {
    // Non-fatal: the account is already created, and failing here would turn
    // a missed count into a failed signup for a user who did nothing wrong.
    console.error('⚠️ Failed to record signup counters (non-fatal):', err);
  }
}

async function bumpWithTtl(key: string): Promise<void> {
  const count = await redis!.incr(key);
  if (count === 1) await redis!.expire(key, WINDOW_SECONDS);
}
