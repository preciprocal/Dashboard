// app/api/cron/product-update/route.ts
//
// Sends the current "what's new" email (lib/email/product-update.ts) once.
// Not scheduled in vercel.json: it is run by hand, behind CRON_SECRET.
//
//   ?mode=dry              (default) who would get it, sends nothing
//   ?mode=test&user=<uuid> one copy to that account, "[Test]" subject,
//                          logged apart so it never counts as the real send
//   ?mode=send             everyone eligible
//
// Eligible: an account with an email, product updates not switched off
// (newsletter_subscribers.subscribed = false), and no email_sends row for
// this campaign yet. That last check is what makes a rerun safe after a
// timeout or a partial failure: it picks up only the people not yet sent.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { CAMPAIGN, buildProductUpdateEmail, sendProductUpdateEmail } from '@/lib/email/product-update';
import { unsubscribeUrl } from '@/lib/email/unsubscribe';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Same check as the other crons: fails closed without CRON_SECRET. */
function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function pageAll<T>(table: string, cols: string, filter?: (q: any) => any): Promise<T[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabaseAdmin.from(table).select(cols);
    if (filter) q = filter(q);
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const mode = req.nextUrl.searchParams.get('mode') ?? 'dry';

  if (mode === 'test') {
    const user = req.nextUrl.searchParams.get('user') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(user)) return NextResponse.json({ error: 'user=<uuid> required' }, { status: 400 });
    const { data: p } = await supabaseAdmin.from('profiles').select('user_id, email').eq('user_id', user).maybeSingle();
    if (!p?.email) return NextResponse.json({ error: 'no such account' }, { status: 404 });
    const unsub = unsubscribeUrl(p.user_id as string, 'productUpdates');
    const ok = await sendProductUpdateEmail(p.email as string, p.user_id as string, buildProductUpdateEmail(unsub), unsub, { test: true });
    return NextResponse.json({ campaign: CAMPAIGN.id, mode, sent: ok ? 1 : 0 });
  }

  type Profile = { user_id: string; email: string | null };
  const [profiles, offRows, sentRows] = await Promise.all([
    pageAll<Profile>('profiles', 'user_id, email'),
    pageAll<{ email: string }>('newsletter_subscribers', 'email', q => q.eq('subscribed', false)),
    pageAll<{ user_id: string | null }>('email_sends', 'user_id', q => q.eq('email_type', CAMPAIGN.id)),
  ]);
  const off = new Set(offRows.map(r => String(r.email).toLowerCase().trim()));
  const already = new Set(sentRows.map(r => r.user_id).filter(Boolean));
  const withEmail = profiles.filter(p => p.email);
  const optedOut = withEmail.filter(p => off.has(String(p.email).toLowerCase().trim())).length;
  const eligible = withEmail.filter(p => !off.has(String(p.email).toLowerCase().trim()) && !already.has(p.user_id));

  const summary = { campaign: CAMPAIGN.id, mode, accounts: profiles.length, optedOut, alreadySent: already.size, eligible: eligible.length };
  if (mode !== 'send') return NextResponse.json(summary);

  let sent = 0, failed = 0;
  for (const p of eligible) {
    const unsub = unsubscribeUrl(p.user_id, 'productUpdates');
    if (await sendProductUpdateEmail(p.email as string, p.user_id, buildProductUpdateEmail(unsub), unsub)) sent += 1;
    else failed += 1;
    await sleep(600); // Resend allows a few requests a second
  }
  return NextResponse.json({ ...summary, sent, failed });
}
