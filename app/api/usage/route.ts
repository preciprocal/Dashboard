// app/api/usage/route.ts
// Read-only usage summary for the client-side useUsageTracking hook - one
// round trip covering all gated features, instead of each page hand-rolling
// its own usage_counters query. Actual increments happen server-side inside
// each feature's own route via lib/ai/usage-guard.ts; this route never writes.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { USAGE_LIMITS, normalisePlan } from '@/lib/config/usage-limits';
import { renewalUnpaid } from '@/lib/billing/renewal-gate';
import { computeUsagePeriod, pickAnchor } from '@/lib/usage/period';

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { supabaseUserId } = authedUser;

    // The counter row can no longer be fetched in the same batch: its
    // period_start is derived from the subscription's billing anchor, so the
    // subscription and profile have to resolve first.
    const [{ data: sub }, { data: profile }] = await Promise.all([
      supabaseAdmin.from('subscriptions').select('plan, status, current_period_start, subscription_started_at, stripe_subscription_id, last_payment_at').eq('user_id', supabaseUserId).maybeSingle(),
      supabaseAdmin.from('profiles').select('is_admin, created_at').eq('user_id', supabaseUserId).maybeSingle(),
    ]);

    const { periodStart } = computeUsagePeriod(
      pickAnchor(sub?.subscription_started_at, sub?.current_period_start, profile?.created_at),
    );

    const { data: usageRow } = await supabaseAdmin
      .from('usage_counters')
      .select('*')
      .eq('user_id', supabaseUserId)
      .eq('period_start', periodStart)
      .maybeSingle();

    // Admin accounts always see unlimited, regardless of subscriptions.plan -
    // mirrors the override in lib/ai/usage-guard.ts.
    // An unpaid renewal is on Free limits until paid (lib/billing/renewal-gate.ts).
    const awaitingPayment = profile?.is_admin !== true && renewalUnpaid(sub);
    const plan = profile?.is_admin === true ? 'admin' : awaitingPayment ? 'free' : normalisePlan(sub?.plan || 'free');

    return NextResponse.json({
      plan,
      awaitingPayment,
      limits: USAGE_LIMITS[plan],
      usage: {
        applicationsUsed:          usageRow?.applications_used           || 0,
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
