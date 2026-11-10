// app/api/job-tracker/everify/route.ts
// E-Verify enrolment for the companies in the signed-in user's tracker.
//
// POST { companies: string[] } -> { statuses, syncedAt, available }
// The names are looked up in the daily copy of the public E-Verify Employer
// Search (lib/jobs/everify.ts). Only the user's own tracked companies are
// accepted, so the endpoint cannot be used to page through the list.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { lookupEverify } from '@/lib/jobs/everify';

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { companies?: unknown };
    const asked = Array.isArray(body.companies)
      ? body.companies.filter((c): c is string => typeof c === 'string')
      : [];

    // Only companies this user actually tracks.
    const { data, error } = await supabaseAdmin
      .from('job_applications')
      .select('company')
      .eq('user_id', authedUser.supabaseUserId);
    if (error) throw error;
    const tracked = new Set((data ?? []).map((r: { company: string | null }) => (r.company ?? '').trim()));
    const companies = asked.map((c) => c.trim()).filter((c) => tracked.has(c));

    const result = await lookupEverify(companies);
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ job-tracker everify:', error);
    return NextResponse.json({ error: 'Failed to look up E-Verify status' }, { status: 500 });
  }
}
