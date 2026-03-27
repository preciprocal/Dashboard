// app/api/resume/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { redis } from '@/lib/redis/redis-client';

// Cache TTL for resume data (30 days — resumes don't change often after creation)
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

  // Storage — new records store a Firebase Storage HTTPS URL here.
  // Legacy records may have a base64 data-URL; both are supported.
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
      console.log(`⚡ Cache HIT — resume ${resumeId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedResume).resume;
    }
    console.log(`❌ Cache MISS — resume ${resumeId}`);
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
    console.log(`🗑️  Cache invalidated — resume ${resumeId}`);
  } catch (err) {
    console.error('Redis delete error:', err);
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function verifyToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split('Bearer ')[1];
    return await auth.verifyIdToken(token);
  } catch {
    return null;
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

    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const cached = await getCachedResume(id, user.uid);
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        metadata: { cached: true, responseTime: Date.now() - startTime },
      });
    }

    // ── Firestore fetch ──────────────────────────────────────────────────────
    const doc = await db.collection('resumes').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume: Resume = { id: doc.id, ...(doc.data() as Omit<Resume, 'id'>) };

    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await cacheResume(id, user.uid, resume);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Resume fetched from Firestore in ${responseTime}ms`);

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

    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      status:      string;
      score?:      number;
      feedback?:   Record<string, unknown>;
      error?:      string;
      resumePath?: string;
    };
    const { status, score, feedback, error: analysisError, resumePath } = body;

    const docRef = db.collection('resumes').doc(id);
    const doc    = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume = doc.data() as Resume;
    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Partial<Resume> = {
      status:    status as Resume['status'],
      updatedAt: new Date().toISOString(),
    };

    if (status === 'complete') {
      updateData.score      = score;
      updateData.feedback   = feedback;
      updateData.analyzedAt = new Date().toISOString();
      // Persist Storage URL if provided (set after upload)
      if (resumePath) updateData.resumePath = resumePath;
    } else if (status === 'failed') {
      updateData.error = analysisError;
    }

    await docRef.update(updateData);
    await invalidateResumeCache(id, user.uid);

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

    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const docRef = db.collection('resumes').doc(id);
    const doc    = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume = doc.data() as Resume;
    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await docRef.delete();
    await invalidateResumeCache(id, user.uid);

    revalidatePath('/resume');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}