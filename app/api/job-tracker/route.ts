// app/api/job-tracker/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { checkJobTrackerCapacity } from '@/lib/ai/job-tracker-capacity';
import { hasResponded } from '@/lib/config/outcomes';

// ─── Types matching the page exactly ─────────────────────────────────────────

type AppStatus =
  | 'wishlist' | 'applied' | 'phone-screen' | 'technical'
  | 'final' | 'offer' | 'rejected' | 'ghosted' | 'withdrew';

type WorkType = 'remote' | 'hybrid' | 'onsite';

interface Application {
  id:          string;
  userId:      string;
  company:     string;
  jobTitle:    string;
  jobUrl:      string | null;
  location:    string | null;
  salary:      string | null;
  workType:    WorkType;
  source:      string | null;
  notes:       string | null;
  status:      AppStatus;
  appliedDate: string;
  /** Which resume was sent. Null for applications logged without one. */
  resumeId:    string | null;
  createdAt:   string;
  updatedAt:   string;
}

interface JobApplicationRow {
  id: string;
  user_id: string;
  company: string | null;
  job_title: string | null;
  job_url: string | null;
  location: string | null;
  salary: string | null;
  work_type: string | null;
  source: string | null;
  notes: string | null;
  status: string | null;
  applied_date: string | null;
  resume_id: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_STATUSES: AppStatus[] = [
  'wishlist','applied','phone-screen','technical',
  'final','offer','rejected','ghosted','withdrew',
];
const VALID_WORK_TYPES: WorkType[] = ['remote','hybrid','onsite'];

// ─── Sanitize body fields ─────────────────────────────────────────────────────

type AppFields = Omit<Application, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

function sanitize(body: Record<string, unknown>): Partial<AppFields> {
  const out: Partial<AppFields> = {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() || null : null);

  if (typeof body.company  === 'string' && body.company.trim())
    out.company  = body.company.trim().slice(0, 200);
  if (typeof body.jobTitle === 'string' && body.jobTitle.trim())
    out.jobTitle = body.jobTitle.trim().slice(0, 200);

  if ('jobUrl'   in body) out.jobUrl   = str(body.jobUrl);
  if ('location' in body) out.location = str(body.location);
  if ('salary'   in body) out.salary   = str(body.salary);
  if ('source'   in body) out.source   = str(body.source);
  if ('notes'    in body) out.notes    = str(body.notes);

  if (typeof body.appliedDate === 'string' && body.appliedDate)
    out.appliedDate = body.appliedDate;
  if (typeof body.workType === 'string' && VALID_WORK_TYPES.includes(body.workType as WorkType))
    out.workType = body.workType as WorkType;
  if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status as AppStatus))
    out.status = body.status as AppStatus;
  // Not validated as a real resume here: the FK does that, and an id belonging
  // to someone else fails the constraint rather than silently attributing one
  // user's outcomes to another's resume.
  if ('resumeId' in body) out.resumeId = str(body.resumeId);

  return out;
}

// ─── Normalise a Postgres row into an Application ────────────────────────────

function normaliseRow(row: JobApplicationRow): Application {
  // Normalise legacy status values sent by older extension versions
  let status = row.status as string;
  const legacyMap: Record<string, AppStatus> = {
    'Applied':      'applied',
    'Under Review': 'applied',
    'Interview':    'phone-screen',
    'Offer':        'offer',
    'Rejected':     'rejected',
    'Withdrawn':    'withdrew',
  };
  if (!VALID_STATUSES.includes(status as AppStatus) && legacyMap[status]) {
    status = legacyMap[status];
  }

  return {
    id:          row.id,
    userId:      row.user_id,
    company:     row.company   || '',
    jobTitle:    row.job_title || '',
    jobUrl:      row.job_url   ?? null,
    location:    row.location  ?? null,
    salary:      row.salary    ?? null,
    workType:    (VALID_WORK_TYPES.includes(row.work_type as WorkType) ? row.work_type : 'onsite') as WorkType,
    source:      row.source ?? null,
    notes:       row.notes  ?? null,
    status:      (VALID_STATUSES.includes(status as AppStatus) ? status : 'applied') as AppStatus,
    appliedDate: row.applied_date ?? new Date().toISOString().split('T')[0],
    resumeId:    row.resume_id ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

const fieldsToColumns: Record<keyof AppFields, string> = {
  company: 'company', jobTitle: 'job_title', jobUrl: 'job_url',
  location: 'location', salary: 'salary', workType: 'work_type',
  source: 'source', notes: 'notes', status: 'status', appliedDate: 'applied_date',
  resumeId: 'resume_id',
};

function toColumns(fields: Partial<AppFields>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[fieldsToColumns[key as keyof AppFields]] = value;
  }
  return out;
}

// ─── GET - list applications ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('job_applications')
      .select('*')
      .eq('user_id', authedUser.supabaseUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const result = (data as JobApplicationRow[]).map(normaliseRow);
    console.log(`[job-tracker GET] uid=${authedUser.supabaseUserId} found=${result.length}`);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ job-tracker GET:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

// ─── POST - create a new application ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const body = await request.json() as Record<string, unknown>;
    const data = sanitize(body);

    if (!data.company || !data.jobTitle)
      return NextResponse.json({ error: 'company and jobTitle are required' }, { status: 400 });

    // Deduplicate: same user + URL submitted within 10 min
    if (data.jobUrl) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: dup } = await supabaseAdmin
        .from('job_applications')
        .select('id')
        .eq('user_id', uid)
        .eq('job_url', data.jobUrl)
        .gte('created_at', tenMinAgo)
        .limit(1)
        .maybeSingle();
      if (dup)
        return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked recently' });
    }

    // Capacity check AFTER the duplicate check, deliberately. A re-submit of
    // something already tracked adds no row, so refusing it for being at
    // capacity would block a request that was never going to consume a slot.
    const capacity = await checkJobTrackerCapacity(authedUser.userId);
    if (!capacity.allowed) {
      return NextResponse.json({
        error: capacity.message,
        code: 'JOB_TRACKER_FULL',
        used: capacity.used,
        limit: capacity.limit,
      }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: created, error } = await supabaseAdmin
      .from('job_applications')
      .insert({
        user_id:      uid,
        company:      data.company,
        job_title:    data.jobTitle,
        job_url:      data.jobUrl      ?? null,
        location:     data.location    ?? null,
        salary:       data.salary      ?? null,
        work_type:    data.workType    ?? 'onsite',
        source:       data.source      ?? null,
        notes:        data.notes       ?? null,
        status:       data.status      ?? 'applied',
        applied_date: data.appliedDate ?? now.split('T')[0],
        // Which resume was actually sent. Without it the product can store a
        // whole job search and still not answer "which version is working",
        // which is the one question this data is uniquely able to answer.
        // Nullable: plenty of applications are logged without one.
        resume_id:    data.resumeId    ?? null,
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error('❌ job-tracker POST:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}

// ─── PATCH - update an application ───────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const body = await request.json() as Record<string, unknown>;
    const id   = typeof body.id === 'string' ? body.id.trim() : null;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('job_applications')
      .select('user_id, first_response_at')
      .eq('id', id)
      .maybeSingle();
    if (!existing)                return NextResponse.json({ error: 'Not found' },  { status: 404 });
    if (existing.user_id !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updates = sanitize(body);
    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    // Record the first employer response. Write-once: an application that goes
    // phone-screen -> rejected keeps the phone-screen timestamp, because the
    // question this answers is "how long until they got back to me", not "when
    // did this end".
    //
    // updated_at cannot stand in for it - that moves every time the user edits
    // a note, months later.
    const becameResponsive =
      updates.status !== undefined &&
      hasResponded(updates.status) &&
      !existing.first_response_at;

    const { error } = await supabaseAdmin
      .from('job_applications')
      .update({
        ...toColumns(updates),
        ...(becameResponsive ? { first_response_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ job-tracker PATCH:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

// ─── DELETE - delete an application ──────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('job_applications')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing)                return NextResponse.json({ error: 'Not found' },  { status: 404 });
    if (existing.user_id !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabaseAdmin.from('job_applications').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ job-tracker DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}
