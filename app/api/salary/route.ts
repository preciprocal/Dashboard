// app/api/salary/route.ts
// Market pay for a job title and location, from BLS OEWS (lib/salary/lookup.ts).
//
// GET ?title=Senior Software Engineer&location=Boston, MA[&occ=15-1252]
//   -> { status: 'ok', occupation, alternatives, area, wages, year, topCode, sourceUrl }
//    | { status: 'unavailable' }   tables not applied or not loaded yet
//    | { status: 'no-match', alternatives }   title not recognised; pick an occupation
//    | { status: 'no-data', occupation, alternatives }
// Signed-in users only, light rate limit: each call is a cached table read,
// and a model call only for a title nothing else matches.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { lookupSalary } from '@/lib/salary/lookup';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = await applyRateLimit(request, user.supabaseUserId, 'light');
    if (limited) return limited;

    const params = request.nextUrl.searchParams;
    const title = (params.get('title') ?? '').trim().slice(0, 200);
    const location = (params.get('location') ?? '').trim().slice(0, 200);
    const occ = (params.get('occ') ?? '').trim();
    if (!title && !/^\d{2}-\d{4}$/.test(occ)) {
      return NextResponse.json({ error: 'Enter a job title' }, { status: 400 });
    }

    const result = await lookupSalary({ title, location, occ: /^\d{2}-\d{4}$/.test(occ) ? occ : null });
    return NextResponse.json(result);
  } catch (error) {
    console.error('salary lookup failed:', error);
    return NextResponse.json({ error: 'Could not look up market pay' }, { status: 500 });
  }
}
