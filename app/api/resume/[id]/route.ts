// app/api/resume/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';
import { redis } from '@/lib/redis/redis-client';

// Cache TTL for resume data (30 days - resumes don't change often after creation)
const RESUME_CACHE_TTL = 30 * 24 * 60 * 60;

export interface Resume {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  fileName: string;
  fileSize: number;
  fileUrl?: string;
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
  error?: string;
}

interface CachedResume {
  resume: Resume;
  cachedAt: string;
}

/**
 * Get cached resume
 */
async function getCachedResume(resumeId: string, userId: string): Promise<Resume | null> {
  if (!redis) return null;

  try {
    const key = `resume:${userId}:${resumeId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - Resume ${resumeId} found`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedResume).resume;
    }

    console.log(`❌ Cache MISS - Resume ${resumeId} not found`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache resume
 */
async function cacheResume(resumeId: string, userId: string, resume: Resume): Promise<void> {
  if (!redis) return;

  try {
    const key = `resume:${userId}:${resumeId}`;
    const data: CachedResume = {
      resume,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, RESUME_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached resume ${resumeId} for ${RESUME_CACHE_TTL / 86400} days`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Invalidate resume cache
 */
async function invalidateResumeCache(resumeId: string, userId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `resume:${userId}:${resumeId}`;
    await redis.del(key);
    console.log(`✅ Invalidated cache for resume ${resumeId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

// Verify Firebase Auth token
async function verifyToken(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// GET /api/resume/[id] - Get single resume
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id } = await params;
    
    console.log(`📄 Fetching resume ${id}`);
    console.log('   Redis available:', !!redis);

    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache first
    const cachedResume = await getCachedResume(id, user.uid);
    
    if (cachedResume) {
      const responseTime = Date.now() - startTime;
      console.log(`⚡ Returning cached resume in ${responseTime}ms`);
      
      return NextResponse.json({ 
        success: true, 
        data: cachedResume,
        metadata: {
          cached: true,
          responseTime
        }
      });
    }

    // Fetch from database
    console.log('🔍 Fetching resume from database...');
    const doc = await db.collection('resumes').doc(id).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume: Resume = {
      id: doc.id,
      ...(doc.data() as Omit<Resume, 'id'>)
    };
    
    // Verify user owns this resume
    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Cache the resume
    await cacheResume(id, user.uid, resume);

    const responseTime = Date.now() - startTime;
    console.log(`✅ Resume fetched from database in ${responseTime}ms`);

    return NextResponse.json({ 
      success: true, 
      data: resume,
      metadata: {
        cached: false,
        responseTime
      }
    });
  } catch (error) {
    console.error('Error fetching resume:', error);
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 });
  }
}

// PUT /api/resume/[id] - Update resume (for analysis results)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`📝 Updating resume ${id}`);

    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status, score, feedback, error: analysisError } = body;

    const docRef = db.collection('resumes').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume = doc.data() as Resume;
    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Partial<Resume> = {
      status,
      updatedAt: new Date().toISOString(),
    };

    if (status === 'complete') {
      updateData.score = score;
      updateData.feedback = feedback;
      updateData.analyzedAt = new Date().toISOString();
    } else if (status === 'failed') {
      updateData.error = analysisError;
    }

    await docRef.update(updateData);
    
    // Invalidate cache since resume was updated
    await invalidateResumeCache(id, user.uid);
    console.log('🔄 Cache invalidated after update');

    revalidatePath('/resume');
    revalidatePath(`/resume/${id}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating resume:', error);
    return NextResponse.json({ error: 'Failed to update resume' }, { status: 500 });
  }
}

// DELETE /api/resume/[id] - Delete resume
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    console.log(`🗑️ Deleting resume ${id}`);

    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const docRef = db.collection('resumes').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume = doc.data() as Resume;
    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete document
    await docRef.delete();
    
    // Invalidate cache
    await invalidateResumeCache(id, user.uid);
    console.log('🔄 Cache invalidated after deletion');

    revalidatePath('/resume');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}
