// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    // background.js sends x-extension-token (Firebase ID token) + x-user-id (raw UID)
    let userId: string | null = null;

    const extensionToken = request.headers.get('x-extension-token');
    const headerUserId   = request.headers.get('x-user-id');

    if (extensionToken) {
      try {
        const decoded = await auth.verifyIdToken(extensionToken);
        userId = decoded.uid;
        console.log('[track-job] ✅ Auth via ID token:', userId);
      } catch {
        console.log('[track-job] ID token verify failed, falling back to x-user-id');
      }
    }

    // Fall back to raw UID — safe since it comes from our own extension storage
    if (!userId && headerUserId && headerUserId.length >= 20) {
      userId = headerUserId;
      console.log('[track-job] ✅ Auth via x-user-id:', userId);
    }

    if (!userId) {
      console.error('[track-job] ❌ Unauthorized — token:', extensionToken?.slice(0, 20), 'uid:', headerUserId);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ──
    // banner.js sends:       { title, company, location, url, jobId, description }
    // external-apply.js sends: { jobTitle, company, jobBoard, jobUrl, appliedAt, status, source }
    const body = await request.json() as Record<string, unknown>;

    const jobTitle = (
      (typeof body.jobTitle === 'string' && body.jobTitle) ||
      (typeof body.title    === 'string' && body.title)    ||
      ''
    );
    const company = typeof body.company === 'string' ? body.company : '';
    const jobUrl  = (
      (typeof body.jobUrl === 'string' && body.jobUrl) ||
      (typeof body.url    === 'string' && body.url)    ||
      null
    );
    const jobBoard = typeof body.jobBoard === 'string' ? body.jobBoard : 'Other';
    const source   = typeof body.source   === 'string' ? body.source   : 'chrome_extension';

    // appliedDate: the tracker page Application interface uses "appliedDate" (YYYY-MM-DD string)
    // extension sends "appliedAt" as ISO string — convert to date-only
    const rawDate    = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();
    const appliedDate = rawDate.split('T')[0]; // "2025-03-18"

    console.log('[track-job] Saving:', jobTitle, '@', company, '| url:', jobUrl?.slice(0, 60));

    if (!jobTitle || !company) {
      console.error('[track-job] ❌ Missing fields — jobTitle:', jobTitle, 'company:', company);
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
        const lastTs = new Date(
          (recent.docs[0].data() as { createdAt: string }).createdAt
        ).getTime();
        if (Date.now() - lastTs < 24 * 60 * 60 * 1000) {
          console.log('[track-job] ⚠️ Duplicate within 24h, skipping:', jobUrl);
          return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
        }
      }
    }

    // ── Save to Firestore ──
    // Fields match the Application interface in job-tracker/page.tsx exactly:
    // company, jobTitle, jobUrl, location, salary, workType, source,
    // notes, status, appliedDate, createdAt, updatedAt, userId
    const now    = new Date().toISOString();
    const docRef = db.collection('jobApplications').doc();

    await docRef.set({
      id:          docRef.id,
      userId,
      company:     company.trim().slice(0, 100),
      jobTitle:    jobTitle.trim().slice(0, 150),
      jobUrl:      jobUrl ?? null,
      location:    null,
      salary:      null,
      workType:    'onsite',     // default — user can edit in tracker
      source:      jobBoard !== 'Other' ? jobBoard : source,
      notes:       null,
      status:      'applied',   // matches AppStatus type in tracker page
      appliedDate,
      createdAt:   now,
      updatedAt:   now,
    });

    console.log('[track-job] ✅ Saved:', docRef.id, '—', jobTitle, '@', company, 'for user:', userId);

    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to track job application';
    console.error('[track-job] ❌ Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}