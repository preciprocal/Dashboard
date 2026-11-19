// app/api/extension/companies/route.ts
//
// POST { companies: string[] } (up to 30) ->
//   { success, everify: { [name]: state | null } | null, h1b: { [name]: { year, approvals } | null } | null }
// For the extension's chips on LinkedIn's job list (extension/banner.js
// CardFacts): each visible employer's E-Verify state and its latest H-1B
// approvals, from the USCIS copies. Only the names on screen are asked for,
// signed in and rate limited, so it cannot page through either list. null
// for a whole source means it has not synced yet; the chips then leave it out.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { lookupEverify } from '@/lib/jobs/everify';
import { lookupH1b } from '@/lib/jobs/h1b';

export const runtime = 'nodejs';
export const maxDuration = 20;

const MAX = 30;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = await applyRateLimit(request, user.supabaseUserId, 'light');
    if (limited) return limited;

    const body = (await request.json().catch(() => ({}))) as { companies?: unknown };
    const names = [...new Set((Array.isArray(body.companies) ? body.companies : [])
      .filter((c): c is string => typeof c === 'string')
      .map(c => c.trim().slice(0, 200))
      .filter(c => c && c !== 'Unknown Company'))].slice(0, MAX);
    if (!names.length) return NextResponse.json({ error: 'companies is required' }, { status: 400 });

    const [ev, h1b] = await Promise.all([
      lookupEverify(names).catch(() => null),
      lookupH1b(names).catch(() => null),
    ]);
    return NextResponse.json({
      success: true,
      everify: ev?.available ? Object.fromEntries(names.map(n => [n, ev.statuses[n]?.state ?? null])) : null,
      h1b: h1b?.pointer ? Object.fromEntries(names.map(n => {
        const y = h1b.histories[n]?.years?.[0];
        return [n, h1b.histories[n] ? { year: y?.year ?? null, approvals: y?.approvals ?? 0 } : null];
      })) : null,
    });
  } catch (error) {
    console.error('❌ extension companies:', error);
    return NextResponse.json({ error: 'Could not look up these companies' }, { status: 500 });
  }
}
