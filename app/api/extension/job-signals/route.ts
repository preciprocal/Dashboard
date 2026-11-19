// app/api/extension/job-signals/route.ts
// "Is this posting worth applying to?" for the job the user is looking at.
//
// The extension posts the raw text LinkedIn prints (posting age, applicant
// count, the description) and gets back a ghost-job risk, the reasons for it,
// pooled company odds when enough users have applied there, and the user's
// own history with the company.
//
// No model call and no quota: this is a couple of indexed queries, and
// charging someone to find out a posting is stale would be backwards.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { getJobSignals } from '@/lib/jobs/job-signals';
import { recordExtensionEvent } from '@/lib/extension/telemetry';

export const runtime = 'nodejs';

const str = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      recordExtensionEvent(request, null, 'job_signals', { detail: { ok: false, error: 'unauthorized' } });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = authedUser.supabaseUserId;

    // 'light': one call per job viewed, and people click through job lists fast.
    const limited = await applyRateLimit(request, authedUser.supabaseUserId, 'light');
    if (limited) {
      recordExtensionEvent(request, userId, 'job_signals', { detail: { ok: false, error: 'rate_limited' } });
      return limited;
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const company = str(body.company, 200);
    if (!company || company === 'Unknown Company') {
      return NextResponse.json({ error: 'company is required' }, { status: 400 });
    }

    const signals = await getJobSignals(
      authedUser.supabaseUserId,
      company,
      {
        postedText: str(body.postedText, 300),
        applicantsText: str(body.applicantsText, 300),
        closed: body.closed === true,
        description: str(body.description, 20_000),
      },
      str(body.jobId, 40),
    );

    recordExtensionEvent(request, userId, 'job_signals', {
      detail: { ok: true, ghost_risk: signals.ghostRisk, company_odds: !!signals.companyOdds },
    });
    return NextResponse.json({ success: true, ...signals });
  } catch (error) {
    console.error('❌ job-signals error:', error);
    recordExtensionEvent(request, userId, 'job_signals', { detail: { ok: false, error: 'server_error' } });
    return NextResponse.json({ error: 'Failed to load job signals' }, { status: 500 });
  }
}
