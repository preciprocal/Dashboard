// app/api/resume/default/route.ts
//
// GET  -> DefaultResumeInfo: the default resume in settings, and a newer
//         resume in the app when there is one (for the banner and pickers).
// POST { resumeId } -> make that app resume the default in settings.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { getDefaultResumeInfo, makeDefaultResume } from '@/lib/resume/default-resume';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await getDefaultResumeInfo(user));
  } catch (e) {
    console.error('default resume info failed', e);
    return NextResponse.json({ error: 'Could not load your default resume' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { resumeId } = (await request.json().catch(() => ({}))) as { resumeId?: string };
  if (!resumeId || typeof resumeId !== 'string') return NextResponse.json({ error: 'resumeId is required' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await makeDefaultResume(user, resumeId)) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not set the default resume';
    return NextResponse.json({ error: msg }, { status: msg === 'Resume not found' ? 404 : 400 });
  }
}
