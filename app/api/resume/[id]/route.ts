// app/api/resume/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';
import { revalidatePath } from 'next/cache';

// FIXED: Add error property to Resume interface
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
  error?: string; // ADDED: error property for failed status
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
  try {
    const { id } = await params;
    
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const doc = await db.collection('resumes').doc(id).get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    const resume = doc.data() as Resume;
    
    // Verify user owns this resume
    if (resume.userId !== user.uid) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: resume });
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
    revalidatePath('/resume');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 });
  }
}