// app/api/debrief/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { checkAndIncrementUsage } from '@/lib/ai/usage-guard';

interface DebriefRow {
  id: string;
  user_id: string;
  company_name: string;
  job_title: string;
  interview_date: string | null;
  stage: string | null;
  outcome: string | null;
  emotional_state_before: string | null;
  emotional_state_after: string | null;
  difficulty_rating: number | null;
  duration_minutes: number | null;
  interviewer_count: number | null;
  questions_asked: string[] | null;
  what_went_well: string | null;
  what_went_poorly: string | null;
  surprises: string | null;
  follow_up_actions: string | null;
  overall_notes: string | null;
  self_score: number | null;
  created_at: string;
  updated_at: string;
}

function toEntry(row: DebriefRow) {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    jobTitle: row.job_title,
    interviewDate: row.interview_date,
    stage: row.stage,
    outcome: row.outcome,
    emotionalStateBefore: row.emotional_state_before,
    emotionalStateAfter: row.emotional_state_after,
    difficultyRating: row.difficulty_rating,
    durationMinutes: row.duration_minutes,
    interviewerCount: row.interviewer_count,
    questionsAsked: row.questions_asked || [],
    whatWentWell: row.what_went_well,
    whatWentPoorly: row.what_went_poorly,
    surprises: row.surprises,
    followUpActions: row.follow_up_actions,
    overallNotes: row.overall_notes,
    selfScore: row.self_score,
    createdAt: row.created_at,
  };
}

interface EntryFields {
  companyName?: string; jobTitle?: string; interviewDate?: string; stage?: string; outcome?: string;
  emotionalStateBefore?: string; emotionalStateAfter?: string; difficultyRating?: number;
  durationMinutes?: number; interviewerCount?: number; questionsAsked?: string[];
  whatWentWell?: string; whatWentPoorly?: string; surprises?: string; followUpActions?: string;
  overallNotes?: string; selfScore?: number;
}

function toColumns(f: EntryFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.companyName !== undefined)          out.company_name = f.companyName;
  if (f.jobTitle !== undefined)             out.job_title = f.jobTitle;
  if (f.interviewDate !== undefined)        out.interview_date = f.interviewDate;
  if (f.stage !== undefined)                out.stage = f.stage;
  if (f.outcome !== undefined)              out.outcome = f.outcome;
  if (f.emotionalStateBefore !== undefined) out.emotional_state_before = f.emotionalStateBefore;
  if (f.emotionalStateAfter !== undefined)  out.emotional_state_after = f.emotionalStateAfter;
  if (f.difficultyRating !== undefined)     out.difficulty_rating = f.difficultyRating;
  if (f.durationMinutes !== undefined)      out.duration_minutes = f.durationMinutes;
  if (f.interviewerCount !== undefined)     out.interviewer_count = f.interviewerCount;
  if (f.questionsAsked !== undefined)       out.questions_asked = f.questionsAsked;
  if (f.whatWentWell !== undefined)         out.what_went_well = f.whatWentWell;
  if (f.whatWentPoorly !== undefined)       out.what_went_poorly = f.whatWentPoorly;
  if (f.surprises !== undefined)            out.surprises = f.surprises;
  if (f.followUpActions !== undefined)      out.follow_up_actions = f.followUpActions;
  if (f.overallNotes !== undefined)         out.overall_notes = f.overallNotes;
  if (f.selfScore !== undefined)            out.self_score = f.selfScore;
  return out;
}

// ─── GET - list entries ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('interview_debriefs')
      .select('*')
      .eq('user_id', authedUser.supabaseUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ entries: (data as DebriefRow[]).map(toEntry) });
  } catch (error) {
    console.error('❌ debrief GET:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

// ─── POST - create a new entry ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    const body = await request.json() as EntryFields;
    if (!body.companyName?.trim() || !body.jobTitle?.trim()) {
      return NextResponse.json({ error: 'companyName and jobTitle are required' }, { status: 400 });
    }

    const { data: created, error } = await supabaseAdmin
      .from('interview_debriefs')
      .insert({ user_id: supabaseUserId, ...toColumns(body) })
      .select('id')
      .single();
    if (error) throw error;

    // Matches the original combined counter this replaces - both a manual
    // journal entry and the separate AI-insights analysis (app/api/debrief/analyze)
    // draw down the same interviewDebriefs limit.
    await checkAndIncrementUsage(userId, 'interviewDebriefs');

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error('❌ debrief POST:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}

// ─── PATCH - update an entry ──────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const body = await request.json() as EntryFields & { id?: string };
    const id = body.id?.trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('interview_debriefs')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing)                return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.user_id !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabaseAdmin
      .from('interview_debriefs')
      .update({ ...toColumns(body), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ debrief PATCH:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}

// ─── DELETE - delete an entry ─────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const uid = authedUser.supabaseUserId;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: existing } = await supabaseAdmin
      .from('interview_debriefs')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing)                return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.user_id !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabaseAdmin.from('interview_debriefs').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ debrief DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
