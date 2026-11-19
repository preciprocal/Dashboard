// app/api/attribution/route.ts
// POST: saves where a new account came from (profiles.signup_attribution).
//
// Written once: only when the column is still empty and the account is less
// than two days old, so an existing user signing in from a new link is not
// re-attributed. See supabase/migrations/0071_signup_attribution.sql.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { supabaseAdmin } from '@/supabase/admin';

export const runtime = 'nodejs';

const NEW_ACCOUNT_MS = 2 * 86_400_000;
const str = (n: number) => z.string().trim().max(n).optional();

const Body = z.object({
  sid: z.string().uuid().optional(),
  vid: z.string().uuid().optional(),
  referrer: z.string().trim().max(300).url().optional(),
  utm_source: str(120),
  utm_medium: str(120),
  utm_campaign: str(120),
  utm_term: str(120),
  utm_content: str(120),
  click_id: str(20),
  landing: str(120),
  at: z.string().datetime().optional(),
  direct: z.boolean().optional(),
}).strict();

async function userId(req: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return req.cookies.getAll(); }, setAll() { /* middleware refreshes */ } } },
  );
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid attribution' }, { status: 400 });

  // Strip empty keys so the stored row only says what is known.
  const attribution = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined && v !== ''));

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ signup_attribution: attribution })
    .eq('user_id', uid)
    .is('signup_attribution', null)
    .gte('created_at', new Date(Date.now() - NEW_ACCOUNT_MS).toISOString())
    .select('user_id');

  if (error) {
    console.error('[attribution] save failed:', error.message);
    return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: (data?.length ?? 0) > 0 });
}
