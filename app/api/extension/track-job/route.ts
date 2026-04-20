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
      return decoded.uid;
    } catch (e) {
      console.log('[track-job] ID token verify failed:', (e as Error).message);
    }
  }
  if (headerUserId && headerUserId.length >= 20) return headerUserId;
  if (headerEmail) {
    try { return (await auth.getUserByEmail(headerEmail)).uid; } catch {}
  }
  return null;
}

// ── GET /api/extension/track-job ─────────────────────────────────────────────
// Returns { success: true, jobIds: { "linkedInJobId": "saved" | "applied" } }
// Handles BOTH new records (linkedInJobId field) and legacy records (extract from jobUrl)
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch ALL jobs for this user (we need to handle legacy records too)
    const snapshot = await db
      .collection('jobApplications')
      .where('userId', '==', userId)
      .select('linkedInJobId', 'jobUrl', 'url', 'status')
      .get();

    const jobIds: Record<string, 'saved' | 'applied'> = {};
    const appliedStatuses = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

    snapshot.forEach(doc => {
      const data = doc.data();
      const label: 'saved' | 'applied' = appliedStatuses.includes(data.status) ? 'applied' : 'saved';

      // Strategy 1: explicit linkedInJobId field (new records)
      if (data.linkedInJobId) {
        jobIds[String(data.linkedInJobId)] = label;
        return;
      }

      // Strategy 2: extract from jobUrl / url (legacy records)
      const rawUrl: string = data.jobUrl || data.url || '';
      if (rawUrl) {
        const match = rawUrl.match(/\/jobs\/view\/(\d+)/);
        if (match) {
          jobIds[match[1]] = label;
          return;
        }
        // Also try query param ?currentJobId=
        try {
          const u = new URL(rawUrl);
          const cj = u.searchParams.get('currentJobId') || u.searchParams.get('jobId');
          if (cj) { jobIds[cj] = label; return; }
        } catch {}
      }
    });

    console.log(`[track-job GET] ✅ userId=${userId} found ${Object.keys(jobIds).length} LinkedIn jobs (${snapshot.size} total records)`);
    return NextResponse.json({ success: true, jobIds });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[track-job GET] ❌', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST /api/extension/track-job ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const linkedInJobId = typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId.trim() : null;

    const rawDate     = typeof body.appliedAt === 'string' ? body.appliedAt : new Date().toISOString();
    const appliedDate = rawDate.split('T')[0];

    console.log('[track-job] Saving:', jobTitle, '@', company, '| linkedInJobId:', linkedInJobId, '| userId:', userId);

    if (!jobTitle || !company) {
      return NextResponse.json({ error: 'jobTitle and company are required' }, { status: 400 });
    }

    // ── Deduplicate by LinkedIn job ID (permanent, no time window) ────────────
    if (linkedInJobId) {
      const existing = await db
        .collection('jobApplications')
        .where('userId', '==', userId)
        .where('linkedInJobId', '==', linkedInJobId)
        .limit(1)
        .get();
      if (!existing.empty) {
        console.log('[track-job] ⚠️ Duplicate by linkedInJobId:', linkedInJobId);
        return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
      }
    }

    // ── Fallback deduplicate by URL within 24h ────────────────────────────────
    if (!linkedInJobId && jobUrl) {
      const recent = await db
        .collection('jobApplications')
        .where('userId', '==', userId)
        .where('jobUrl', '==', jobUrl)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!recent.empty) {
        const ts = recent.docs[0].data().createdAt as FirebaseFirestore.Timestamp | string;
        const savedAt = ts && typeof ts === 'object' && 'toDate' in ts
          ? (ts as FirebaseFirestore.Timestamp).toDate().getTime()
          : new Date(ts as string).getTime();
        if (Date.now() - savedAt < 24 * 60 * 60 * 1000) {
          console.log('[track-job] ⚠️ Duplicate by URL within 24h:', jobUrl);
          return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked' });
        }
      }
    }

    const now    = new Date();
    const docRef = db.collection('jobApplications').doc();

    await docRef.set({
      id:            docRef.id,
      userId,
      company:       company.slice(0, 100),
      jobTitle:      jobTitle.slice(0, 150),
      jobUrl:        jobUrl ?? null,
      linkedInJobId: linkedInJobId ?? null,
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

    console.log('[track-job] ✅ Saved:', docRef.id, '—', jobTitle, '@', company);
    return NextResponse.json({ success: true, id: docRef.id });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to track job application';
    console.error('[track-job] ❌', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}