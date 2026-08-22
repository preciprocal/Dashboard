// app/api/resume/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { revalidatePath } from 'next/cache';
import { redis } from '@/lib/redis/redis-client';

// Cache TTL for resume data (30 days - resumes don't change often after creation)
const RESUME_CACHE_TTL = 30 * 24 * 60 * 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Resume {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  fileName: string;
  originalFileName?: string;
  fileSize: number;

  // Storage - new records store a bare Supabase Storage path here, resolved
  // to a signed URL on read (see lib/resume/resolve-pdf-url.ts). Legacy
  // records may have a Firebase download URL or a base64 data-URL; both
  // are still supported by the reader.
  resumePath?: string;
  imagePath?:  string;   // no longer written for new records, kept for legacy reads
  filePath?:   string;   // Storage path (not the download URL)
  fileUrl?:    string;   // alias used by some older records

  createdAt:   string;
  updatedAt:   string;
  analyzedAt?: string;
  status:      'pending' | 'analyzing' | 'complete' | 'failed';
  score?:      number;
  feedback?:   Record<string, unknown>;
  error?:      string;

  resumeText?: string;
  resumeHtml?: string;
  cacheHash?:  string;

  benchmarkResult?: Record<string, unknown>;
  benchmarkGeneratedAt?: number;
  recruiterSimulation?: Record<string, unknown>;
  recruiterSimulationGeneratedAt?: number;
  interviewIntel?: Record<string, unknown>;
  interviewIntelGeneratedAt?: string;
  interviewIntelCompany?: string;
  interviewIntelRole?: string;
  deepAnalysis?: Record<string, unknown>;
  deepAnalysisGeneratedAt?: number;
  tailorResult?: Record<string, unknown>;
  tailorResultGeneratedAt?: number;
  tailorJobTitle?: string;
  tailorCompanyName?: string;
}

interface ResumeRow {
  id: string;
  user_id: string;
  company_name: string | null;
  job_title: string | null;
  job_description: string | null;
  file_name: string | null;
  original_file_name: string | null;
  file_size: number | null;
  resume_path: string | null;
  image_path: string | null;
  file_path: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
  status: string;
  score: number | null;
  feedback: Record<string, unknown> | null;
  error: string | null;
  resume_text: string | null;
  resume_html: string | null;
  cache_hash: string | null;
  benchmark_result: Record<string, unknown> | null;
  benchmark_generated_at: string | null;
  recruiter_simulation: Record<string, unknown> | null;
  recruiter_simulation_generated_at: string | null;
  interview_intel: Record<string, unknown> | null;
  interview_intel_generated_at: string | null;
  interview_intel_company: string | null;
  interview_intel_role: string | null;
  deep_analysis: Record<string, unknown> | null;
  deep_analysis_generated_at: string | null;
  tailor_result: Record<string, unknown> | null;
  tailor_result_generated_at: string | null;
  tailor_job_title: string | null;
  tailor_company_name: string | null;
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
    resumePath: row.resume_path ?? undefined,
    imagePath: row.image_path ?? undefined,
    filePath: row.file_path ?? undefined,
    fileUrl: row.file_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analyzedAt: row.analyzed_at ?? undefined,
    status: row.status as Resume['status'],
    score: row.score ?? undefined,
    feedback: row.feedback ?? undefined,
    error: row.error ?? undefined,
    resumeText: row.resume_text ?? undefined,
    resumeHtml: row.resume_html ?? undefined,
    cacheHash: row.cache_hash ?? undefined,
    benchmarkResult: row.benchmark_result ?? undefined,
    benchmarkGeneratedAt: row.benchmark_generated_at ? new Date(row.benchmark_generated_at).getTime() : undefined,
    recruiterSimulation: row.recruiter_simulation ?? undefined,
    recruiterSimulationGeneratedAt: row.recruiter_simulation_generated_at ? new Date(row.recruiter_simulation_generated_at).getTime() : undefined,
    interviewIntel: row.interview_intel ?? undefined,
    interviewIntelGeneratedAt: row.interview_intel_generated_at ?? undefined,
    interviewIntelCompany: row.interview_intel_company ?? undefined,
    interviewIntelRole: row.interview_intel_role ?? undefined,
    deepAnalysis: row.deep_analysis ?? undefined,
    deepAnalysisGeneratedAt: row.deep_analysis_generated_at ? new Date(row.deep_analysis_generated_at).getTime() : undefined,
    tailorResult: row.tailor_result ?? undefined,
    tailorResultGeneratedAt: row.tailor_result_generated_at ? new Date(row.tailor_result_generated_at).getTime() : undefined,
    tailorJobTitle: row.tailor_job_title ?? undefined,
    tailorCompanyName: row.tailor_company_name ?? undefined,
  };
}

interface CachedResume {
  resume:   Resume;
  cachedAt: string;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function getCachedResume(resumeId: string, userId: string): Promise<Resume | null> {
  if (!redis) return null;
  try {
    const cached = await redis.get(`resume:${userId}:${resumeId}`);
    if (cached) {
      console.log(`⚡ Cache HIT - resume ${resumeId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedResume).resume;
    }
    console.log(`❌ Cache MISS - resume ${resumeId}`);
    return null;
  } catch (err) {
    console.error('Redis get error:', err);
    return null;
  }
}

async function cacheResume(resumeId: string, userId: string, resume: Resume): Promise<void> {
  if (!redis) return;
  try {
    const data: CachedResume = { resume, cachedAt: new Date().toISOString() };
    await redis.setex(`resume:${userId}:${resumeId}`, RESUME_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached resume ${resumeId} for ${RESUME_CACHE_TTL / 86400} days`);
  } catch (err) {
    console.error('Redis set error:', err);
  }
}

async function invalidateResumeCache(resumeId: string, userId: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(`resume:${userId}:${resumeId}`);
    console.log(`🗑️  Cache invalidated - resume ${resumeId}`);
  } catch (err) {
    console.error('Redis delete error:', err);
  }
}

// ─── GET /api/resume/[id] ────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const { id } = await params;
    console.log(`📄 GET resume ${id} | Redis: ${!!redis}`);

    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authedUser.supabaseUserId;

    // ── Cache check ──────────────────────────────────────────────────────────
    const cached = await getCachedResume(id, userId);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        metadata: { cached: true, responseTime: Date.now() - startTime },
      });
    }

    // ── Postgres fetch ───────────────────────────────────────────────────────
    const { data: row, error } = await supabaseAdmin
      .from('resumes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume = toResume(row as ResumeRow);

    if (resume.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await cacheResume(id, userId, resume);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Resume fetched from Postgres in ${responseTime}ms`);

    return NextResponse.json({
      success: true,
      data: resume,
      metadata: { cached: false, responseTime },
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 });
  }
}

// ─── PUT /api/resume/[id] ────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log(`📝 PUT resume ${id}`);

    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authedUser.supabaseUserId;

    const body = await request.json() as {
      status?:     string;
      score?:      number;
      feedback?:   Record<string, unknown>;
      error?:      string;
      resumePath?: string;
      resumeHtml?: string;
      resumeText?: string;
    };
    const { status, score, feedback, error: analysisError, resumePath, resumeHtml, resumeText } = body;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updateData.status = status;
    if (status === 'complete') {
      updateData.score = score;
      updateData.feedback = feedback;
      updateData.analyzed_at = new Date().toISOString();
      // Persist Storage path if provided (set after upload)
      if (resumePath) updateData.resume_path = resumePath;
    } else if (status === 'failed') {
      updateData.error = analysisError;
    }
    // Editor auto-save: content edits independent of the status lifecycle above.
    if (resumeHtml !== undefined) updateData.resume_html = resumeHtml;
    if (resumeText !== undefined) updateData.resume_text = resumeText;

    const { error: updateError } = await supabaseAdmin
      .from('resumes')
      .update(updateData)
      .eq('id', id);
    if (updateError) throw updateError;

    await invalidateResumeCache(id, userId);

    revalidatePath('/resume');
    revalidatePath(`/resume/${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating resume:', error);
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 });
  }
}

// ─── DELETE /api/resume/[id] ─────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log(`🗑️  DELETE resume ${id}`);

    const authedUser = await getAuthedUser(request);
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authedUser.supabaseUserId;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin.from('resumes').delete().eq('id', id);
    if (deleteError) throw deleteError;

    await invalidateResumeCache(id, userId);

    revalidatePath('/resume');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}
