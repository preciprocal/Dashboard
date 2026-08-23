// app/api/usage/route.ts
// Read-only usage summary for the client-side useUsageTracking hook - one
// round trip covering all gated features, instead of each page hand-rolling
// its own usage_counters query. Actual increments happen server-side inside
// each feature's own route via lib/ai/usage-guard.ts; this route never writes.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { USAGE_LIMITS, normalisePlan } from '@/lib/config/usage-limits';

function getCurrentPeriod(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { supabaseUserId } = authedUser;

    const [{ data: sub }, { data: usageRow }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('subscriptions').select('plan').eq('user_id', supabaseUserId).maybeSingle(),
      supabaseAdmin.from('usage_counters').select('*').eq('user_id', supabaseUserId).eq('period_start', getCurrentPeriod()).maybeSingle(),
      supabaseAdmin.from('profiles').select('is_admin').eq('user_id', supabaseUserId).maybeSingle(),
    ]);

    // Admin accounts always see unlimited, regardless of subscriptions.plan -
    // mirrors the override in lib/ai/usage-guard.ts.
    const plan = profile?.is_admin === true ? 'admin' : normalisePlan(sub?.plan || 'free');

    return NextResponse.json({
      plan,
      limits: USAGE_LIMITS[plan],
      usage: {
        coverLettersUsed:          usageRow?.cover_letters_used          || 0,
        resumesUsed:               usageRow?.resumes_used                || 0,
        studyPlansUsed:            usageRow?.study_plans_used            || 0,
        interviewsUsed:            usageRow?.interviews_used             || 0,
        interviewDebriefsUsed:     usageRow?.interview_debriefs_used     || 0,
        debriefAnalysesUsed:       usageRow?.debrief_analyses_used       || 0,
        linkedinOptimisationsUsed: usageRow?.linkedin_optimisations_used || 0,
        coldOutreachUsed:          usageRow?.cold_outreach_used          || 0,
        findContactsUsed:          usageRow?.find_contacts_used          || 0,
        jobTrackerUsed:            usageRow?.job_tracker_used            || 0,
      },
    });
  } catch (error) {
    console.error('[Usage GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
