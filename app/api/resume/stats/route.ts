// app/api/resume/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

// GET /api/resume/stats - Get resume statistics for user
export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('resumes')
      .select('status, score, created_at')
      .eq('user_id', authedUser.supabaseUserId)
      .eq('deleted', false);

    if (error) throw error;

    const resumes = (data ?? []) as { status: string; score: number | null; created_at: string }[];

    const totalResumes = resumes.length;
    const completedResumes = resumes.filter(r => r.status === 'complete' && r.score);

    const averageScore = completedResumes.length > 0
      ? Math.round(completedResumes.reduce((sum, r) => sum + (r.score || 0), 0) / completedResumes.length)
      : 0;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUploads = resumes.filter(r => new Date(r.created_at) >= weekAgo).length;

    const topScore = completedResumes.length > 0
      ? Math.max(...completedResumes.map(r => r.score || 0))
      : 0;

    const stats = {
      totalResumes,
      averageScore,
      recentUploads,
      topScore,
      resumesUsed: totalResumes,
      resumesLimit: 10, // Adjust based on your subscription logic
    };

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting resume stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get resume stats',
      data: {
        totalResumes: 0,
        averageScore: 0,
        recentUploads: 0,
        topScore: 0,
        resumesUsed: 0,
        resumesLimit: 10,
      }
    }, { status: 500 });
  }
}
