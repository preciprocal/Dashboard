// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

export const runtime = 'nodejs';

// ── GET /api/extension/track-job ─────────────────────────────────────────────
// Returns { success: true, jobIds: { "linkedInJobId": "saved" | "applied" } }
// Handles BOTH new records (linkedin_job_id column) and legacy records (extract from job_url)
export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('job_applications')
      .select('linkedin_job_id, job_url, status')
      .eq('user_id', authedUser.supabaseUserId);
    if (error) throw error;

    const jobIds: Record<string, 'saved' | 'applied'> = {};
    const appliedStatuses = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

    for (const row of rows ?? []) {
      const label: 'saved' | 'applied' = appliedStatuses.includes(row.status ?? '') ? 'applied' : 'saved';

      // Strategy 1: explicit linkedin_job_id column (new records)
      if (row.linkedin_job_id) {
        jobIds[String(row.linkedin_job_id)] = label;
        continue;
      }

      // Strategy 2: extract from job_url (legacy records)
      const rawUrl: string = row.job_url || '';
      if (rawUrl) {
        const match = rawUrl.match(/\/jobs\/view\/(\d+)/);
        if (match) {
          jobIds[match[1]] = label;
          continue;
        }
        // Also try query param ?currentJobId=
        try {
          const u = new URL(rawUrl);
          const cj = u.searchParams.get('currentJobId') || u.searchParams.get('jobId');
          if (cj) { jobIds[cj] = label; continue; }
        } catch {}
      }
    }

    console.log(`[track-job GET] ✅ uid=${authedUser.supabaseUserId} found ${Object.keys(jobIds).length} LinkedIn jobs (${rows?.length ?? 0} total records)`);
    return NextResponse.json({ success: true, jobIds });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[track-job GET] ❌', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST /api/extension/track-job ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = authedUser.supabaseUserId;

    const body = await request.json() as Record<string, unknown>;

    const jobTitle = (
      (typeof body.jobTitle === 'string' && body.jobTitle.trim()) ||
      (typeof body.title    === 'string' && body.title.trim())    ||
      ''
    );
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const jobUrl  = (
      (typeof body.jobUrl === 'string' && body.jobUrl) ||
      (typeof body.url    === 'string' && body.url)    ||
      null
    );
    const location      = typeof body.location === 'string' ? body.location.trim() || null : null;
    const jobBoard      = typeof body.jobBoard  === 'string' ? body.jobBoard  : 'Other';
    const source        = typeof body.source    === 'string' ? body.source    : 'chrome_extension';
    const linkedInJobId = typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId.trim() : null;

    const rawDate     = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();
    const appliedDate = rawDate.split('T')[0];

    console.log('[track-job] Saving:', jobTitle, '@', company, '| linkedInJobId:', linkedInJobId, '| uid:', uid);

    if (!jobTitle || !company) {
      return NextResponse.json({ error: 'jobTitle and company are required' }, { status: 400 });
    }

    // ── Deduplicate by LinkedIn job ID (permanent, no time window) ────────────
    if (linkedInJobId) {
      const { data: existing } = await supabaseAdmin
        .from('job_applications')
        .select('id')
        .eq('user_id', uid)
        .eq('linkedin_job_id', linkedInJobId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        console.log('[track-job] ⚠️ Duplicate by linkedInJobId:', linkedInJobId);
        return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
      }
    }

    // ── Fallback deduplicate by URL within 24h ────────────────────────────────
    if (!linkedInJobId && jobUrl) {
      const { data: recent } = await supabaseAdmin
        .from('job_applications')
        .select('created_at')
        .eq('user_id', uid)
        .eq('job_url', jobUrl)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent) {
        const savedAt = new Date(recent.created_at).getTime();
        if (Date.now() - savedAt < 24 * 60 * 60 * 1000) {
          console.log('[track-job] ⚠️ Duplicate by URL within 24h:', jobUrl);
          return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
        }
      }
    }

    const { data: created, error } = await supabaseAdmin
      .from('job_applications')
      .insert({
        user_id:         uid,
        company:         company.slice(0, 100),
        job_title:       jobTitle.slice(0, 150),
        job_url:         jobUrl ?? null,
        linkedin_job_id: linkedInJobId ?? null,
        location:        location ?? null,
        salary:          null,
        work_type:       'onsite',
        source:          jobBoard !== 'Other' ? jobBoard : source,
        notes:           null,
        status:          'applied',
        applied_date:    appliedDate,
      })
      .select('id')
      .single();
    if (error) throw error;

    console.log('[track-job] ✅ Saved:', created.id, '-', jobTitle, '@', company);
    return NextResponse.json({ success: true, id: created.id });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to track job application';
    console.error('[track-job] ❌', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
