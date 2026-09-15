// app/api/resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { revalidatePath } from 'next/cache';
import { hashResumeText, checkDuplicateResume } from '@/lib/abuse/resume-hash';

export interface Resume {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  fileName: string;
  originalFileName?: string;
  fileSize: number;
  fileUrl?: string;
  resumePath?: string;
  imagePath?: string;
  filePath?: string;
  createdAt: string;
  updatedAt: string;
  status: 'analyzing' | 'complete' | 'failed';
  score?: number;
  feedback?: {
    overallScore: number;
    strengths: string[];
    improvements: string[];
    suggestions: string[];
  };
  analyzedAt?: string;
}

const RESUME_COLUMNS = 'id, user_id, company_name, job_title, job_description, file_name, original_file_name, file_size, file_url, resume_path, image_path, file_path, status, score, feedback, analyzed_at, created_at, updated_at';

interface ResumeRow {
  id: string;
  user_id: string;
  company_name: string | null;
  job_title: string | null;
  job_description: string | null;
  file_name: string | null;
  original_file_name: string | null;
  file_size: number | null;
  file_url: string | null;
  resume_path: string | null;
  image_path: string | null;
  file_path: string | null;
  status: string;
  score: number | null;
  feedback: Resume['feedback'] | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

function toResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name ?? '',
    jobTitle: row.job_title ?? '',
    jobDescription: row.job_description ?? '',
    fileName: row.file_name ?? '',
    originalFileName: row.original_file_name ?? undefined,
    fileSize: row.file_size ?? 0,
    fileUrl: row.file_url ?? undefined,
    resumePath: row.resume_path ?? undefined,
    imagePath: row.image_path ?? undefined,
    filePath: row.file_path ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as Resume['status'],
    score: row.score ?? undefined,
    feedback: row.feedback ?? undefined,
    analyzedAt: row.analyzed_at ?? undefined,
  };
}

// GET /api/resume - Get all resumes for user
export async function GET(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('resumes')
      .select(RESUME_COLUMNS)
      .eq('user_id', authedUser.supabaseUserId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: (data as ResumeRow[]).map(toResume) });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 });
  }
}

// POST /api/resume - Create new resume. Accepts either a bare "pending"
// record (analysis not run yet) or a fully-analyzed one in one shot - the
// resume upload flow (lib/services/firebase-service.ts saveResumeWithFiles)
// already has the AI feedback by the time it calls this, since analysis
// happens client-side against /api/analyze-resume first.
export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id, companyName, jobTitle, jobDescription, fileName, originalFileName, fileSize,
      fileUrl, resumePath, filePath, resumeText, cacheHash,
      status, score, feedback, analyzedAt,
    } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      user_id: authedUser.supabaseUserId,
      company_name: companyName,
      job_title: jobTitle,
      job_description: jobDescription,
      file_name: fileName,
      original_file_name: originalFileName ?? null,
      file_size: fileSize || 0,
      file_url: fileUrl ?? null,
      resume_path: resumePath ?? null,
      file_path: filePath ?? null,
      resume_text: resumeText ?? null,
      cache_hash: cacheHash ?? null,
      // Populates the content_hash column added in 0009 but never written
      // until now. Null for short/failed extractions - see resume-hash.ts.
      content_hash: hashResumeText(resumeText),
      status: status ?? 'analyzing',
    };
    if (id) insertData.id = id;
    if (status === 'complete') {
      insertData.score = score ?? null;
      insertData.feedback = feedback ?? null;
      insertData.analyzed_at = analyzedAt ?? new Date().toISOString();
    }

    const { data: created, error } = await supabaseAdmin
      .from('resumes')
      .insert(insertData)
      .select(RESUME_COLUMNS)
      .single();

    if (error) throw error;

    // Duplicate-content detection. Awaited rather than fire-and-forget because
    // serverless freezes the process once the response is returned, which
    // would leave the check half-run. It only ever writes to the review queue,
    // never blocks the upload, and swallows its own errors.
    const contentHash = insertData.content_hash as string | null;
    if (contentHash) {
      await checkDuplicateResume(
        authedUser.supabaseUserId,
        contentHash,
        (created as ResumeRow).id,
      );
    }

    revalidatePath('/resume');

    return NextResponse.json({ success: true, data: toResume(created as ResumeRow) });
  } catch (error) {
    console.error('Error creating resume:', error);
    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 });
  }
}
