// app/api/cover-letter/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

interface CoverLetterRow {
  id: string;
  user_id: string;
  job_role: string;
  company_name: string | null;
  job_description: string | null;
  tone: string | null;
  content: string;
  word_count: number | null;
  used_resume: boolean;
  linkedin_job_url: string | null;
  linkedin_job_id: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from('cover_letters')
      .select('*')
      .eq('user_id', authedUser.supabaseUserId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const letters = (data as CoverLetterRow[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      jobRole: row.job_role,
      companyName: row.company_name,
      jobDescription: row.job_description,
      tone: row.tone,
      content: row.content,
      wordCount: row.word_count,
      usedResume: row.used_resume,
      linkedInJobUrl: row.linkedin_job_url,
      linkedInJobId: row.linkedin_job_id,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ coverLetters: letters });
  } catch (error) {
    console.error('❌ cover-letter list GET:', error);
    return NextResponse.json({ error: 'Failed to fetch cover letters' }, { status: 500 });
  }
}
