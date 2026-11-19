// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { checkJobTrackerCapacity } from '@/lib/ai/job-tracker-capacity';
import { recordStatusChange } from '@/lib/applications/status-events';
import { parsePosting } from '@/lib/jobs/posting-signals';
import { recordExtensionEvent } from '@/lib/extension/telemetry';
import { canonicalPostingUrl, companyFromPostingUrl, isBoardName, isConfirmationTitle, isSpecificPosting, parseApplicationTitle, stripCompanySuffix, titleFromPostingUrl } from '@/lib/jobs/posting-url';

/** Statuses before applying: a submit moves these cards to Applied. */
const NOT_YET_APPLIED = new Set(['wishlist', 'saved', '']);

/** Escapes LIKE wildcards so a URL matches only itself as a prefix. */
const likePrefix = (s: string) => s.replace(/[\\%_]/g, m => '\\' + m) + '%';

export const runtime = 'nodejs';

/** Postgres undefined_column, or PostgREST's schema-cache miss for a column. */
function isMissingColumn(err: { code?: string; message?: string }): boolean {
  return err.code === '42703' || err.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(err.message ?? '');
}

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
// Each outcome is also one job_tracked event (lib/extension/telemetry.ts):
// detail.result says what happened to the card, never which job it was.
export async function POST(request: NextRequest) {
  let trackedUserId: string | null = null;
  let platform: string | null = null;
  const track = (detail: Record<string, string | number | boolean | null>) =>
    recordExtensionEvent(request, trackedUserId, 'job_tracked', { platform, detail });
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      track({ ok: false, error: 'unauthorized' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const uid = authedUser.supabaseUserId;
    trackedUserId = uid;

    const body = await request.json() as Record<string, unknown>;

    const rawTitle = (
      (typeof body.jobTitle === 'string' && body.jobTitle.trim()) ||
      (typeof body.title    === 'string' && body.title.trim())    ||
      ''
    );
    const rawCompany = typeof body.company === 'string' ? body.company.trim() : '';
    const rawUrl  = (
      (typeof body.jobUrl === 'string' && body.jobUrl) ||
      (typeof body.url    === 'string' && body.url)    ||
      null
    );
    // After submitting, the extension is often on the board's thank-you page:
    // its title is "Thank you for applying" and its host is the board, not the
    // employer. The posting's own address and the employer in it are used
    // instead (lib/jobs/posting-url).
    // The banner's Save sends status 'saved': kept as Wishlist, never as
    // Applied. Everything else here is a submitted application.
    const saveOnly = body.status === 'saved' || body.status === 'wishlist';
    const jobUrl   = canonicalPostingUrl(rawUrl);
    const specific = isSpecificPosting(rawUrl);
    const fromTitle = parseApplicationTitle(rawTitle);
    const company  = isBoardName(rawCompany) ? (companyFromPostingUrl(rawUrl) || fromTitle?.company || rawCompany) : rawCompany;
    const jobTitle = stripCompanySuffix(
      fromTitle?.role || (isConfirmationTitle(rawTitle) ? (titleFromPostingUrl(rawUrl) || 'Job application') : rawTitle),
      company,
    );
    const location      = typeof body.location === 'string' ? body.location.trim() || null : null;
    const jobBoard      = typeof body.jobBoard  === 'string' ? body.jobBoard  : 'Other';
    const source        = typeof body.source    === 'string' ? body.source    : 'chrome_extension';
    const linkedInJobId = typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId.trim() : null;
    // jobBoard is the extension's platform name ('LinkedIn', 'Greenhouse'...).
    // 'Other' says nothing, so the host decides then.
    if (jobBoard !== 'Other') platform = jobBoard;

    const rawDate     = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();
    const appliedDate = rawDate.split('T')[0];

    console.log('[track-job] Saving:', jobTitle, '@', company, '| linkedInJobId:', linkedInJobId, '| uid:', uid);

    // ── The card the student already has for this posting ────────────────────
    // Saved from Jobs or the Apply flow before they went to the employer's
    // site. Submitting moves that card to Applied instead of adding another.
    // Only for an address that names one posting: a shared apply page is the
    // same for every role at that employer.
    if (jobUrl && specific) {
      const { data: matches } = await supabaseAdmin
        .from('job_applications')
        .select('id, status, job_url, company, job_title, created_at')
        .eq('user_id', uid)
        .ilike('job_url', likePrefix(jobUrl))
        .order('created_at', { ascending: false })
        .limit(20);
      // The prefix query only narrows: the same posting must come out of it
      // (so /jobs/12 never matches a save for /jobs/1).
      const same = (matches ?? []).filter(m => canonicalPostingUrl(m.job_url)?.toLowerCase() === jobUrl.toLowerCase());
      const card = same.find(m => NOT_YET_APPLIED.has(m.status ?? '')) ?? same[0];
      if (card && saveOnly) {
        return NextResponse.json({ success: true, duplicate: true, id: card.id, company: card.company, jobTitle: card.job_title, message: 'Already tracked' });
      }
      if (card) {
        if (!NOT_YET_APPLIED.has(card.status ?? '')) {
          console.log('[track-job] already applied:', card.id);
          track({ ok: true, result: 'duplicate' });
          return NextResponse.json({ success: true, duplicate: true, id: card.id, company: card.company, jobTitle: card.job_title, message: 'Already tracked' });
        }
        const { error: upErr } = await supabaseAdmin.from('job_applications')
          .update({ status: 'applied', applied_date: appliedDate, updated_at: new Date().toISOString() })
          .eq('id', card.id).eq('user_id', uid);
        if (upErr) throw upErr;
        await recordStatusChange(uid, card.id, card.status ?? null, 'applied');
        console.log('[track-job] moved to applied:', card.id);
        track({ ok: true, result: 'moved_to_applied' });
        return NextResponse.json({ success: true, id: card.id, updated: true, company: card.company, jobTitle: card.job_title });
      }
    }

    if (!jobTitle || !company) {
      track({ ok: false, error: 'missing_fields' });
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
        track({ ok: true, result: 'duplicate' });
        return NextResponse.json({ success: true, duplicate: true, company, jobTitle, message: 'Already tracked' });
      }
    }

    // ── A shared apply page: the same address within 24h is a double save ────
    if (!linkedInJobId && jobUrl && !specific) {
      const { data: recent } = await supabaseAdmin
        .from('job_applications')
        .select('created_at')
        .eq('user_id', uid)
        .eq('job_url', jobUrl)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent && Date.now() - new Date(recent.created_at).getTime() < 24 * 60 * 60 * 1000) {
        console.log('[track-job] duplicate by URL within 24h:', jobUrl);
        track({ ok: true, result: 'duplicate' });
        return NextResponse.json({ success: true, duplicate: true, company, jobTitle, message: 'Already tracked' });
      }
    }


    // After both duplicate checks: a re-save of something already tracked
    // consumes no slot, so it must not be refused for being at capacity.
    //
    // The 403 and JOB_TRACKER_FULL code matter more here than on the dashboard
    // route. The extension retries failed saves from an offline queue, and a
    // quota refusal is permanent - retrying it forever would spin against a
    // wall. extension/background.js drops the item on this code specifically.
    const capacity = await checkJobTrackerCapacity(authedUser.userId);
    if (!capacity.allowed) {
      console.log(`[track-job] tracker full for ${uid}: ${capacity.used}/${capacity.limit}`);
      track({ ok: false, error: 'tracker_full' });
      return NextResponse.json({
        error: capacity.message,
        code: 'JOB_TRACKER_FULL',
        used: capacity.used,
        limit: capacity.limit,
      }, { status: 403 });
    }

    const baseRow = {
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
      status:          saveOnly ? 'wishlist' : 'applied',
      applied_date:    appliedDate,
    };

    // What the posting looked like when saved (migration 0055), so the funnel
    // report can later compare callbacks on fresh postings against stale ones.
    const posting = parsePosting({
      postedText:     typeof body.postedText === 'string' ? body.postedText.slice(0, 300) : null,
      applicantsText: typeof body.applicantsText === 'string' ? body.applicantsText.slice(0, 300) : null,
    });
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 12000) : '';
    const postingCols = {
      posted_days_ago: posting.postedDaysAgo,
      reposted:        typeof body.postedText === 'string' ? posting.reposted : null,
      applicant_count: posting.applicantCount,
      // Migration 0056: lets "Practise this interview" use the real posting.
      job_description: description || null,
    };

    let { data: created, error } = await supabaseAdmin
      .from('job_applications')
      .insert({ ...baseRow, ...postingCols })
      .select('id')
      .single();
    // Before 0055/0056 are applied those columns do not exist. Saving the job
    // matters far more than the posting details, so retry without them
    // rather than losing the application.
    if (error && isMissingColumn(error)) {
      ({ data: created, error } = await supabaseAdmin
        .from('job_applications')
        .insert(baseRow)
        .select('id')
        .single());
    }
    if (error) throw error;
    if (!created) throw new Error('Insert returned no row');

    await recordStatusChange(uid, created.id, null, saveOnly ? 'wishlist' : 'applied');

    console.log('[track-job] ✅ Saved:', created.id, '-', jobTitle, '@', company);
    track({ ok: true, result: 'created' });
    return NextResponse.json({ success: true, id: created.id, company: baseRow.company, jobTitle: baseRow.job_title });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to track job application';
    console.error('[track-job] ❌', error);
    track({ ok: false, error: 'server_error' });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
