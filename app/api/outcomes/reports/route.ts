// app/api/outcomes/report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { recordOutcome } from '@/lib/ai/outcome-tracking';

export async function POST(request: NextRequest) {
  try {
    const session = (await cookies()).get('session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let userId: string;
    try { userId = (await auth.verifySessionCookie(session.value, true)).uid; }
    catch { return NextResponse.json({ error: 'Invalid session' }, { status: 401 }); }

    const body = await request.json() as {
      resumeId: string;
      outcome: 'interview' | 'rejection' | 'no_response' | 'hired';
      jobTitle?: string;
      companyName?: string;
      daysAfterApplication?: number;
    };

    if (!body.resumeId || !body.outcome) return NextResponse.json({ error: 'resumeId and outcome required' }, { status: 400 });

    let resumeScore = 0, atsScore = 0, benchmarkPercentile: number | undefined;
    try {
      const doc = await db.collection('resumes').doc(body.resumeId).get();
      if (doc.exists) {
        const d = doc.data() as Record<string, unknown>;
        const fb = d.feedback as Record<string, unknown> | undefined;
        resumeScore = (fb?.overallScore as number) ?? 0;
        atsScore = ((fb?.ATS as Record<string, number>)?.score) ?? 0;
        benchmarkPercentile = (d.benchmarkResult as Record<string, unknown>)?.overallPercentile as number | undefined;
      }
    } catch {}

    await recordOutcome({
      userId, resumeId: body.resumeId, resumeScore, atsScore,
      jobTitle: body.jobTitle || '', companyName: body.companyName,
      outcome: body.outcome, daysAfterApplication: body.daysAfterApplication || 0,
      reportedAt: new Date().toISOString(), benchmarkPercentile,
      actuallyGotInterview: body.outcome === 'interview' || body.outcome === 'hired',
    });

    return NextResponse.json({ success: true, message: 'Thank you! Your outcome helps improve accuracy for all users.' });
  } catch (error) {
    console.error('❌ Outcome report error:', error);
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 });
  }
}