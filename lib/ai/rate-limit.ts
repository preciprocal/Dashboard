// lib/ai/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis/redis-client';

export type RateLimitTier = 'heavy' | 'medium' | 'light' | 'global';

const TIER_CONFIG: Record<RateLimitTier, { maxRequests: number; windowSeconds: number }> = {
  heavy:  { maxRequests: 10, windowSeconds: 120 },   // was 3/60 - too tight for multi-call flows
  medium: { maxRequests: 15, windowSeconds: 60 },     // was 5/60
  light:  { maxRequests: 30, windowSeconds: 60 },     // was 10/60
  global: { maxRequests: 60, windowSeconds: 60 },     // was 30/60 - unauthenticated fallback
};

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(identifier: string, tier: RateLimitTier): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds } = TIER_CONFIG[tier];
  if (!redis) return { allowed: true, limit: maxRequests, remaining: maxRequests, retryAfterSeconds: 0 };

  try {
    // Use a sliding window key based on the current time bucket
    const windowKey = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rl:${tier}:${identifier}:${windowKey}`;
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, windowSeconds + 1);

    const allowed = current <= maxRequests;
    const remaining = Math.max(0, maxRequests - current);
    const retryAfterSeconds = allowed
      ? 0
      : Math.max(1, windowSeconds - Math.floor((Date.now() / 1000) % windowSeconds));

    return { allowed, limit: maxRequests, remaining, retryAfterSeconds };
  } catch (error) {
    console.error('⚠️ Rate limit Redis error (failing open):', error);
    return { allowed: true, limit: maxRequests, remaining: maxRequests, retryAfterSeconds: 0 };
  }
}

function getIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function applyRateLimit(
  request: NextRequest,
  userId: string | null,
  tier: RateLimitTier,
): Promise<NextResponse | null> {
  const identifier = userId || `ip:${getIP(request)}`;
  const effectiveTier = userId ? tier : 'global';
  const result = await rateLimit(identifier, effectiveTier);

  if (!result.allowed) {
    const seconds = result.retryAfterSeconds;
    const waitMsg = seconds >= 60
      ? `${Math.ceil(seconds / 60)} minute${Math.ceil(seconds / 60) > 1 ? 's' : ''}`
      : `${seconds} second${seconds !== 1 ? 's' : ''}`;

    console.log(`🚫 Rate limited: ${identifier} on ${effectiveTier} (retry in ${seconds}s)`);

    return NextResponse.json(
      {
        error: `You're moving fast! Please wait ${waitMsg} before trying again.`,
        code: 'RATE_LIMIT',
        retryAfter: seconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(seconds),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
        },
      },
    );
  }

  return null;
}