// app/api/session/heartbeat/route.ts
// Called by LayoutClient once per page load. Registers the current session,
// enforces the concurrent-session cap, and records the device/geo signal.
//
// Deliberately NOT done in middleware. Middleware runs on every request
// including prefetches and asset routes, and putting two database round trips
// there would tax every navigation in the app. Middleware keeps only the cheap
// half (a single Redis read to sign out an evicted session); everything
// expensive happens here, once per page load.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { syncSession } from '@/lib/session/registry';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  fingerprint: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Read the session directly rather than via getAuthedUser, because this
    // route needs the `session_id` claim, which getAuthedUser does not return.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll() { /* middleware already refreshed the cookie */ },
        },
      },
    );

    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims as
      | { sub?: string; session_id?: string; email?: string }
      | undefined;

    // Not signed in, or a token shape without a session id. Nothing to record,
    // and not an error worth surfacing to the client.
    if (!claims?.sub || !claims.session_id) {
      return NextResponse.json({ ok: true, tracked: false });
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    const fingerprint = parsed.success ? parsed.data.fingerprint ?? null : null;

    const result = await syncSession({
      userId:      claims.sub,
      sessionId:   claims.session_id,
      email:       claims.email ?? null,
      fingerprint,
      ip:          req.headers.get('x-forwarded-for')?.split(',')[0].trim()
                   ?? req.headers.get('x-real-ip'),
      // Vercel's edge geo headers. Absent locally and on other hosts, in which
      // case the location signal is simply unavailable rather than wrong.
      geoCountry:  req.headers.get('x-vercel-ip-country'),
      geoCity:     safeDecode(req.headers.get('x-vercel-ip-city')),
      userAgent:   req.headers.get('user-agent'),
    });

    return NextResponse.json({ ok: true, tracked: true, revoked: result.revoked });
  } catch (err) {
    // Never surface a failure: a broken heartbeat must not break the page that
    // called it. Matches the fail-open stance in lib/session/registry.ts.
    console.error('⚠️ session heartbeat error (non-fatal):', err);
    return NextResponse.json({ ok: true, tracked: false });
  }
}

// Vercel percent-encodes non-ASCII city names; a malformed value must not
// throw and take the whole heartbeat down with it.
function safeDecode(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
