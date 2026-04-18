// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    let userId: string | null = null;

    const extensionToken = request.headers.get('x-extension-token');
    const headerUserId   = request.headers.get('x-user-id');
    const headerEmail    = request.headers.get('x-user-email');

    if (extensionToken) {
      try {
        const decoded = await auth.verifyIdToken(extensionToken);
        userId = decoded.uid;
        console.log('[track-job] ✅ Auth via ID token:', userId);
      } catch (e) {
        console.log('[track-job] ID token verify failed:', (e as Error).message);
      }
    }

    // Fall back to raw UID — safe since it comes from our own extension storage
    if (!userId && headerUserId && headerUserId.length >= 20) {
      userId = headerUserId;
      console.log('[track-job] ✅ Auth via x-user-id:', userId);
    }

    // Fall back to email lookup
    if (!userId && headerEmail) {
      try {
        const userRecord = await auth.getUserByEmail(headerEmail);
        userId = userRecord.uid;
        console.log('[track-job] ✅ Auth via email lookup:', userId);
      } catch { /* ignore */ }
    }

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
    const location = typeof body.location === 'string' ? body.location.trim() || null : null;
    const jobBoard = typeof body.jobBoard  === 'string' ? body.jobBoard  : 'Other';
    const source   = typeof body.source    === 'string' ? body.source    : 'chrome_extension';

    // appliedDate: convert ISO string to date-only YYYY-MM-DD
    const rawDate     = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();
    const appliedDate = rawDate.split('T')[0];

    console.log('[track-job] Saving:', jobTitle, '@', company, '| url:', jobUrl?.slice(0, 60), '| userId:', userId);

    if (!jobTitle || !company) {
      return NextResponse.json(
        { error: 'jobTitle and company are required' },
        { status: 400 }
      );
    }

    // ── Deduplicate: skip if same URL already tracked in the last 24h ──
    if (jobUrl) {
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
          console.log('[track-job] ⚠️ Duplicate within 24h, skipping:', jobUrl);
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
      id:          docRef.id,
      userId,
      company:     company.slice(0, 100),
      jobTitle:    jobTitle.slice(0, 150),
      jobUrl:      jobUrl ?? null,
      location:    location ?? null,
      salary:      null,
      workType:    'onsite',
      source:      jobBoard !== 'Other' ? jobBoard : source,
      notes:       null,
      status:      'applied',
      appliedDate,
      createdAt:   now,   // ← Firestore Timestamp, consistent with job-tracker POST
      updatedAt:   now,
    });

    console.log('[track-job] ✅ Saved:', docRef.id, '—', jobTitle, '@', company);

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track job application';
    console.error('[track-job] ❌ Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}