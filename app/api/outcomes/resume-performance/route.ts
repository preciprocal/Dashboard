// app/api/outcomes/resume-performance/route.ts
// "Which of my resumes is actually getting callbacks?"
//
// Read-only aggregation over data the user already has. No model call, so this
// is cheap enough to load on a dashboard without metering it - which is also
// why it is deliberately NOT behind checkUsage: charging a credit to look at
// your own results would be an odd thing to do.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getResumePerformance } from '@/lib/outcomes/resume-performance';
import { getFollowUps } from '@/lib/outcomes/follow-ups';
import { MIN_APPLICATIONS_FOR_RATE } from '@/lib/config/outcomes';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [outcomes, followUps] = await Promise.all([
      getResumePerformance(authedUser.supabaseUserId),
      getFollowUps(authedUser.supabaseUserId),
    ]);

    return NextResponse.json({
      success: true,
      ...outcomes,
      followUps,
      // Sent so the client can explain WHY a rate is null rather than
      // rendering a blank cell that looks like a bug.
      minApplicationsForRate: MIN_APPLICATIONS_FOR_RATE,
    });
  } catch (error) {
    console.error('❌ resume-performance error:', error);
    return NextResponse.json({ error: 'Failed to load outcomes' }, { status: 500 });
  }
}
