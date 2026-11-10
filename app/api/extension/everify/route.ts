// app/api/extension/everify/route.ts
// E-Verify enrolment for the company on the job the user is looking at, shown
// by the extension on LinkedIn (banner.js) and on application portals
// (external-apply.js). STEM OPT requires an E-Verify employer, so this is the
// moment it matters: before the application goes in.
//
// POST { company } -> { success, available, status, syncedAt, searchUrl }
// One name per request, signed in and rate limited, so the endpoint cannot be
// used to page through the list. `available: false` (migration 0058 not
// applied, or no successful daily sync yet) means the extension shows nothing
// rather than a guess.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { lookupEverify, EVERIFY_SEARCH_URL } from '@/lib/jobs/everify';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 'light': one call per job viewed, and people click through job lists fast.
    const limited = await applyRateLimit(request, authedUser.supabaseUserId, 'light');
    if (limited) return limited;

    const body = (await request.json().catch(() => ({}))) as { company?: unknown };
    const company = typeof body.company === 'string' ? body.company.trim().slice(0, 200) : '';
    if (!company || company === 'Unknown Company') {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
    }

    const result = await lookupEverify([company]);
    return NextResponse.json({
      success: true,
      available: result.available,
      status: result.available ? result.statuses[company] ?? null : null,
      syncedAt: result.syncedAt,
      searchUrl: EVERIFY_SEARCH_URL,
    });
  } catch (error) {
    console.error('❌ extension everify:', error);
    return NextResponse.json({ error: 'Failed to look up E-Verify status' }, { status: 500 });
  }
}
