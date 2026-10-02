// app/api/activity/route.ts
// Receives batches of in-app activity from components/ActivityTracker.tsx and
// stores them in activity_events (migration 0046).
//
// The user and session come from the verified auth cookie, never the body, so
// nobody can write activity into someone else's history. Signed-out requests
// get a 204 and are dropped: the tracker only runs inside the signed-in app.
//
// Uses getClaims(), which verifies the JWT locally, rather than getUser(),
// which is a round trip to Supabase Auth. This route is hit every few seconds
// per open tab, and a write that only appends analytics does not need the
// stronger check.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { supabaseAdmin } from '@/supabase/admin';
import { featureOf } from '@/lib/analytics/features';

export const runtime = 'nodejs';

const MAX_BATCH = 50;

const eventSchema = z.object({
  event: z.enum(['page_view', 'click', 'time']),
  path: z.string().min(1).max(300),
  label: z.string().max(80).optional(),
  target: z.string().max(300).optional(),
  // A single time event never covers more than ten minutes; the tracker
  // flushes long before that, so anything bigger is a bug or a forgery.
  durationMs: z.number().int().min(0).max(600_000).optional(),
  source: z.string().max(60).optional(),
  at: z.number().int().optional(),
});

const bodySchema = z.object({ events: z.array(eventSchema).min(1).max(MAX_BATCH) });

/** Path only: strips query strings, which can carry ids and search terms. */
function cleanPath(p: string): string {
  const path = p.split('?')[0].split('#')[0];
  return path.startsWith('/') ? path : `/${path}`;
}

export async function POST(req: NextRequest) {
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
  const claims = claimsData?.claims as { sub?: string; session_id?: string } | undefined;
  if (!claims?.sub) return new NextResponse(null, { status: 204 });

  // sendBeacon posts text/plain, so parse the raw body rather than req.json().
  let raw: unknown;
  try { raw = JSON.parse(await req.text()); } catch { raw = null; }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid batch' }, { status: 400 });

  const now = Date.now();
  const rows = parsed.data.events.map(e => {
    const path = cleanPath(e.path);
    // Client timestamps are trusted only within a day, so a skewed or
    // forged clock cannot backdate history.
    const at = e.at && Math.abs(now - e.at) < 86_400_000 ? e.at : now;
    return {
      user_id: claims.sub,
      session_id: claims.session_id ?? null,
      event: e.event,
      feature: featureOf(path),
      path,
      label: e.label?.trim() || null,
      target: e.target || null,
      duration_ms: e.event === 'time' ? e.durationMs ?? 0 : null,
      source: e.source || null,
      created_at: new Date(at).toISOString(),
    };
  });

  const { error } = await supabaseAdmin.from('activity_events').insert(rows);
  if (error) {
    console.error('⚠️ activity insert failed:', error.message);
    return NextResponse.json({ error: 'Not recorded' }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
