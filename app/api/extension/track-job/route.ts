// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

export const runtime = 'nodejs';

// ── Shared auth helper ────────────────────────────────────────────────────────
async function resolveUserId(request: NextRequest): Promise<string | null> {
  const extensionToken = request.headers.get('x-extension-token');
  const headerUserId   = request.headers.get('x-user-id');
  const headerEmail    = request.headers.get('x-user-email');

  if (extensionToken) {
    try {
      const decoded = await auth.verifyIdToken(extensionToken);
      console.log('[track-job] ✅ Auth via ID token:', decoded.uid);
      return decoded.uid;
    } catch (e) {
      console.log('[track-job] ID token verify failed:', (e as Error).message);
    }
  }

  if (headerUserId && headerUserId.length >= 20) {
    console.log('[track-job] ✅ Auth via x-user-id:', headerUserId);
    return headerUserId;
  }

  if (headerEmail) {
    try {
      const userRecord = await auth.getUserByEmail(headerEmail);
      console.log('[track-job] ✅ Auth via email lookup:', userRecord.uid);
      return userRecord.uid;
    } catch { /* ignore */ }
  }

  return null;
}

// ── GET /api/extension/track-job ─────────────────────────────────────────────
// Returns all tracked LinkedIn job IDs for the user so the extension can
// restore "Saved" / "Applied" chip labels on page load without re-saving.
// Response: { success: true, jobIds: { "linkedInJobId": "saved" | "applied" } }
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      console.error('[track-job GET] ❌ Unauthorized');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await db
      .collection('jobApplications')
      .where('userId', '==', userId)
      .where('linkedInJobId', '!=', null)
      .select('linkedInJobId', 'status')
      .get();

    const jobIds: Record<string, 'saved' | 'applied'> = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      const jobId = data.linkedInJobId as string | undefined;
      if (!jobId) return;
      // Statuses that mean the user actively applied (vs just saved/tracking)
      const appliedStatuses = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];
      jobIds[jobId] = appliedStatuses.includes(data.status) ? 'applied' : 'saved';
    });

    console.log(`[track-job GET] ✅ Returning ${Object.keys(jobIds).length} tracked jobs for:`, userId);
    return NextResponse.json({ success: true, jobIds });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tracked jobs';
    console.error('[track-job GET] ❌ Error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST /api/extension/track-job ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      console.error('[track-job] ❌ Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ──
    // banner.js sends:         { title, company, location, url, jobId, description }
    // external-apply.js sends: { jobTitle, company, jobBoard, jobUrl, appliedAt, status, source }
    const body = await request.json() as Record<string, unknown>;

    const jobTitle = (
      (typeof body.jobTitle === 'string' && body.jobTitle.trim()) ||
      (typeof body.title    === 'string' && body.title.trim())    ||
      ''
    );
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const jobUrl  = (
      (typeof body.jobUrl === 'string' && body.jobUrl) ||
      (typeof body.url    === 'string' && body.url)    ||
      null
    );
    const location      = typeof body.location === 'string' ? body.location.trim() || null : null;
    const jobBoard      = typeof body.jobBoard  === 'string' ? body.jobBoard  : 'Other';
    const source        = typeof body.source    === 'string' ? body.source    : 'chrome_extension';
    // LinkedIn numeric job ID — e.g. "1234567890" extracted from the job URL
    const linkedInJobId = typeof body.jobId === 'string' && body.jobId.trim()
      ? body.jobId.trim()
      : null;

    // appliedDate: convert ISO string to date-only YYYY-MM-DD
    const rawDate     = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();
    const appliedDate = rawDate.split('T')[0];

    console.log('[track-job] Saving:', jobTitle, '@', company, '| linkedInJobId:', linkedInJobId, '| userId:', userId);

    if (!jobTitle || !company) {
      return NextResponse.json(
        { error: 'jobTitle and company are required' },
        { status: 400 }
      );
    }

    // ── Deduplicate by LinkedIn job ID (fastest, most reliable) ──────────────
    if (linkedInJobId) {
      const existing = await db
        .collection('jobApplications')
        .where('userId', '==', userId)
        .where('linkedInJobId', '==', linkedInJobId)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log('[track-job] ⚠️ Duplicate by linkedInJobId, skipping:', linkedInJobId);
        return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
      }
    }

    // ── Fallback deduplicate by URL within 24h (for non-LinkedIn sources) ────
    if (!linkedInJobId && jobUrl) {
      const recent = await db
        .collection('jobApplications')
        .where('userId', '==', userId)
        .where('jobUrl', '==', jobUrl)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!recent.empty) {
        const docData = recent.docs[0].data() as { createdAt: FirebaseFirestore.Timestamp | string };
        const ts = docData.createdAt;
        let savedAt: number;
        if (ts && typeof ts === 'object' && 'toDate' in ts) {
          savedAt = (ts as FirebaseFirestore.Timestamp).toDate().getTime();
        } else {
          savedAt = new Date(ts as string).getTime();
        }
        if (Date.now() - savedAt < 24 * 60 * 60 * 1000) {
          console.log('[track-job] ⚠️ Duplicate within 24h by URL, skipping:', jobUrl);
          return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
        }
      }
    }

    // ── Save to Firestore ──
    // IMPORTANT: createdAt saved as Firestore Timestamp (new Date()), NOT an ISO string.
    // This is required for the orderBy('createdAt', 'desc') query in job-tracker GET to work.
    // Mixed types (Timestamp + string) in the same field break Firestore ordering.
    const now    = new Date();
    const docRef = db.collection('jobApplications').doc();

    await docRef.set({
      id:            docRef.id,
      userId,
      company:       company.slice(0, 100),
      jobTitle:      jobTitle.slice(0, 150),
      jobUrl:        jobUrl ?? null,
      linkedInJobId: linkedInJobId ?? null,   // ← stored for GET deduplication + chip restore
      location:      location ?? null,
      salary:        null,
      workType:      'onsite',
      source:        jobBoard !== 'Other' ? jobBoard : source,
      notes:         null,
      status:        'applied',
      appliedDate,
      createdAt:     now,
      updatedAt:     now,
    });

    console.log('[track-job] ✅ Saved:', docRef.id, '—', jobTitle, '@', company, '| linkedInJobId:', linkedInJobId);

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track job application';
    console.error('[track-job] ❌ Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}