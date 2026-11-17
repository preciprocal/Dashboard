// app/api/jobs/fit/route.ts
//
// POST { url } -> { fit: { strengths, gaps, pitch } }
// Why a feed job fits the student, worked out without a model
// (lib/jobs/fit.ts explainFit): skills both texts name, each with the resume
// line that shows it, and skills only the posting names, each with the
// sentence that asks for it.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { extractFileText } from '@/lib/ai/user-context';
import { cleanResumeText } from '@/lib/ai/claude';
import { postingText } from '@/lib/jobs/posting-cache';
import { explainFit, type FitExplanation } from '@/lib/jobs/fit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export type { FitExplanation };

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'medium');
  if (limited) return limited;

  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  const raw = await extractFileText(user.userId, 'resume').catch(() => null);
  if (!raw) return NextResponse.json({ error: 'Add your default resume in Settings to see how you fit.', code: 'NO_RESUME' }, { status: 400 });
  const posting = await postingText(url).catch(() => null);
  if (!posting?.description) return NextResponse.json({ error: 'Could not read this posting right now.' }, { status: 502 });

  try {
    return NextResponse.json({ fit: explainFit(posting.description, cleanResumeText(raw)) });
  } catch (e) {
    console.error('❌ job fit:', e);
    return NextResponse.json({ error: 'Could not explain the fit right now. Please try again.' }, { status: 500 });
  }
}
