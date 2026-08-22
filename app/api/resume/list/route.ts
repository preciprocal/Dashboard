// app/api/resume/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

interface ResumeListItem {
  id: string;
  fileName: string;
  uploadDate: string;
}

export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('resumes')
      .select('id, file_name, created_at')
      .eq('user_id', authedUser.supabaseUserId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const resumes: ResumeListItem[] = (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name || 'Unnamed Resume',
      uploadDate: row.created_at,
    }));

    return NextResponse.json({ resumes });

  } catch (error) {
    console.error('Error fetching resumes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    );
  }
}
