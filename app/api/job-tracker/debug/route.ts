// app/api/job-tracker/debug/route.ts
// TEMPORARY — delete after debugging
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUid(request: NextRequest): Promise<string | null> {
  const session = request.cookies.get('session')?.value;
  if (session) {
    try {
      const decoded = await auth.verifySessionCookie(session, true);
      return decoded.uid;
    } catch { /* fall through */ }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const uid = await getUid(request);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results: Record<string, unknown> = { uid };

  // Check every plausible collection name
  const collections = [
    'jobApplications',
    'jobTracker',
    'applications',
    'jobs',
    'trackedJobs',
    'job_applications',
    'job_tracker',
  ];

  for (const col of collections) {
    try {
      // Try WITHOUT orderBy first to avoid index errors
      const snap = await db
        .collection(col)
        .where('userId', '==', uid)
        .limit(10)
        .get();

      if (!snap.empty) {
        results[col] = {
          count: snap.size,
          sample: snap.docs.slice(0, 3).map(doc => {
            const d = doc.data();
            return {
              id: doc.id,
              company: d.company,
              jobTitle: d.jobTitle,
              status: d.status,
              createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt,
              userId: d.userId,
            };
          }),
        };
      } else {
        results[col] = { count: 0 };
      }
    } catch (e) {
      results[col] = { error: (e as Error).message };
    }
  }

  // Also check if orderBy works on jobApplications
  try {
    const orderedSnap = await db
      .collection('jobApplications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    results['jobApplications_ordered'] = {
      count: orderedSnap.size,
      works: true,
    };
  } catch (e) {
    results['jobApplications_ordered'] = {
      works: false,
      error: (e as Error).message,
    };
  }

  return NextResponse.json(results, { status: 200 });
}