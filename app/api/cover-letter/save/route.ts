// app/api/cover-letter/save/route.ts
// Persists an already-generated cover letter to history. Generation itself
// (and the usage-counter increment) happens in POST /api/cover-letter -
// saving to history is a separate, ungated step, matching the original
// two-step generate-then-save flow.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

interface SaveBody {
  jobRole?: string;
  companyName?: string;
  jobDescription?: string;
  tone?: string;
  content?: string;
  wordCount?: number;
  usedResume?: boolean;
  linkedInJobUrl?: string;
  linkedInJobId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as SaveBody;
    if (!body.jobRole?.trim() || !body.content?.trim()) {
      return NextResponse.json({ error: 'jobRole and content are required' }, { status: 400 });
    }

    const { data: created, error } = await supabaseAdmin
      .from('cover_letters')
      .insert({
        user_id: authedUser.supabaseUserId,
        job_role: body.jobRole.trim(),
        company_name: body.companyName?.trim() || null,
        job_description: body.jobDescription?.trim() || null,
        tone: body.tone || null,
        content: body.content,
        word_count: body.wordCount ?? null,
        used_resume: body.usedResume ?? false,
        linkedin_job_url: body.linkedInJobUrl || null,
        linkedin_job_id: body.linkedInJobId || null,
      })
      .select('id')
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, id: created.id }, { status: 201 });
  } catch (error) {
    console.error('❌ cover-letter save POST:', error);
    return NextResponse.json({ error: 'Failed to save cover letter' }, { status: 500 });
  }
}
