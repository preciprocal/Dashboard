// app/api/resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin'; // Use your actual export names
import { revalidatePath } from 'next/cache';

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

// GET /api/resume - Get all resumes for user
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await db
      .collection('resumes')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const resumes: Resume[] = [];
    snapshot.forEach(doc => {
      resumes.push(doc.data() as Resume);
    });

    return NextResponse.json({ success: true, data: resumes });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 });
  }
}

// POST /api/resume - Create new resume
export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, jobTitle, jobDescription, fileName, fileSize, fileUrl } = body;

    if (!companyName || !jobTitle || !jobDescription || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const docRef = db.collection('resumes').doc();
    const now = new Date().toISOString();
    
    const resume: Resume = {
      id: docRef.id,
      userId: user.uid,
      companyName,
      jobTitle,
      jobDescription,
      fileName,
      fileSize: fileSize || 0,
      fileUrl,
      createdAt: now,
      updatedAt: now,
      status: 'analyzing'
    };

    await docRef.set(resume);
    revalidatePath('/resume');
    
    return NextResponse.json({ success: true, data: resume });
  } catch (error) {
    console.error('Error creating resume:', error);
    return NextResponse.json({ error: 'Failed to create resume' }, { status: 500 });
  }
}