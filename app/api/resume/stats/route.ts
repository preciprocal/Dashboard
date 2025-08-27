// app/api/resume/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin'; // Use your actual export names
import type { Resume } from '../route';

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

// GET /api/resume/stats - Get resume statistics for user
export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await db
      .collection('resumes')
      .where('userId', '==', user.uid)
      .get();

    const resumes: Resume[] = [];
    snapshot.forEach(doc => {
      resumes.push(doc.data() as Resume);
    });

    const totalResumes = resumes.length;
    const completedResumes = resumes.filter(r => r.status === 'complete' && r.score);
    
    const averageScore = completedResumes.length > 0 
      ? Math.round(completedResumes.reduce((sum, r) => sum + (r.score || 0), 0) / completedResumes.length)
      : 0;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUploads = resumes.filter(r => {
      const uploadDate = new Date(r.createdAt);
      return uploadDate >= weekAgo;
    }).length;

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