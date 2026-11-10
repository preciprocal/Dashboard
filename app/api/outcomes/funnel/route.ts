// app/api/outcomes/funnel/route.ts
// The funnel doctor: where this user loses applications, why, and what to do.
//
// Read-only aggregation, no model call, not metered (same reasoning as
// resume-performance): looking at your own results should never cost a credit.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { buildFunnel } from '@/lib/outcomes/funnel';
import { loadFunnelRows } from '@/lib/outcomes/funnel-data';
import { getResumePerformance } from '@/lib/outcomes/resume-performance';
import { getFollowUps } from '@/lib/outcomes/follow-ups';
import { MIN_APPLICATIONS_FOR_RATE } from '@/lib/config/outcomes';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const [rows, resumes, followUps] = await Promise.all([
      loadFunnelRows(uid),
      getResumePerformance(uid),
      getFollowUps(uid, { includeRecentlyNudged: true }),
    ]);

    return NextResponse.json({
      success: true,
      funnel: buildFunnel(rows),
      resumes,
      followUps,
      minApplicationsForRate: MIN_APPLICATIONS_FOR_RATE,
    });
  } catch (error) {
    console.error('❌ funnel error:', error);
    return NextResponse.json({ error: 'Failed to load your funnel' }, { status: 500 });
  }
}
