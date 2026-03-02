// app/api/job-tracker/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/firebase/admin';

// ─── Types matching the page exactly ─────────────────────────────────────────

type AppStatus =
  | 'wishlist' | 'applied' | 'phone-screen' | 'technical'
  | 'final' | 'offer' | 'rejected' | 'ghosted' | 'withdrew';

type WorkType = 'remote' | 'hybrid' | 'onsite';

interface Application {
  id:          string;
  userId:      string;
  company:     string;
  jobTitle:    string;
  jobUrl:      string | null;
  location:    string | null;
  salary:      string | null;
  workType:    WorkType;
  source:      string | null;
  notes:       string | null;
  status:      AppStatus;
  appliedDate: string;
  createdAt:   string;
  updatedAt:   string;
}

const VALID_STATUSES: AppStatus[] = [
  'wishlist','applied','phone-screen','technical',
  'final','offer','rejected','ghosted','withdrew',
];
const VALID_WORK_TYPES: WorkType[] = ['remote','hybrid','onsite'];

// ─── Auth — session cookie first, then Bearer token ───────────────────────────

async function getUid(request: NextRequest): Promise<string | null> {
  // 1. Session cookie (web app — no Authorization header sent)
  const session = request.cookies.get('session')?.value;
  if (session) {
    try {
      const decoded = await auth.verifySessionCookie(session, true);
      return decoded.uid;
    } catch { /* fall through */ }
  }

  // 2. Bearer token (extension / API clients)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      return (await auth.verifyIdToken(authHeader.slice(7))).uid;
    } catch { /* fall through */ }
  }

  // 3. Extension custom headers
  const extToken = request.headers.get('x-extension-token');
  const userId   = request.headers.get('x-user-id');
  const email    = request.headers.get('x-user-email');
  if (extToken) {
    try { return (await auth.verifyIdToken(extToken)).uid; } catch { /* fall through */ }
    if (userId) return userId;
    if (email) {
      try { return (await auth.getUserByEmail(email)).uid; } catch { /* fall through */ }
    }
  }

  return null;
}

// ─── Sanitize body fields ─────────────────────────────────────────────────────

type AppFields = Omit<Application, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

function sanitize(body: Record<string, unknown>): Partial<AppFields> {
  const out: Partial<AppFields> = {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() || null : null);

  if (typeof body.company     === 'string' && body.company.trim())
    out.company   = body.company.trim().slice(0, 200);
  if (typeof body.jobTitle    === 'string' && body.jobTitle.trim())
    out.jobTitle  = body.jobTitle.trim().slice(0, 200);

  const jobUrl   = str(body.jobUrl);
  if ('jobUrl'   in body) out.jobUrl   = jobUrl;
  const location = str(body.location);
  if ('location' in body) out.location = location;
  const salary   = str(body.salary);
  if ('salary'   in body) out.salary   = salary;
  const source   = str(body.source);
  if ('source'   in body) out.source   = source;
  const notes    = str(body.notes);
  if ('notes'    in body) out.notes    = notes;

  if (typeof body.appliedDate === 'string' && body.appliedDate)
    out.appliedDate = body.appliedDate;
  if (typeof body.workType === 'string' && VALID_WORK_TYPES.includes(body.workType as WorkType))
    out.workType = body.workType as WorkType;
  if (typeof body.status   === 'string' && VALID_STATUSES.includes(body.status as AppStatus))
    out.status   = body.status as AppStatus;

  return out;
}

// ─── GET — list applications ──────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const uid = await getUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const snap = await db
      .collection('jobApplications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    const data: Application[] = snap.docs.map(doc => {
      const d = doc.data();
      // Normalise legacy records that used old status values from the extension
      let status = d.status as string;
      const legacyMap: Record<string, AppStatus> = {
        'Applied':      'applied',
        'Under Review': 'applied',
        'Interview':    'phone-screen',
        'Offer':        'offer',
        'Rejected':     'rejected',
        'Withdrawn':    'withdrew',
      };
      if (!VALID_STATUSES.includes(status as AppStatus) && legacyMap[status]) {
        status = legacyMap[status];
      }

      return {
        id:          doc.id,
        userId:      uid,
        company:     d.company   || '',
        jobTitle:    d.jobTitle  || '',
        jobUrl:      d.jobUrl    ?? null,
        location:    d.location  ?? null,
        salary:      d.salary    ?? null,
        workType:    (VALID_WORK_TYPES.includes(d.workType) ? d.workType : 'onsite') as WorkType,
        source:      d.source    ?? null,
        notes:       d.notes     ?? null,
        status:      (VALID_STATUSES.includes(status as AppStatus) ? status : 'applied') as AppStatus,
        // appliedDate: prefer explicit field, fall back to appliedAt (extension format)
        appliedDate: d.appliedDate
          || d.appliedAt?.split?.('T')?.[0]
          || new Date().toISOString().split('T')[0],
        createdAt:   d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? new Date().toISOString(),
        updatedAt:   d.updatedAt?.toDate?.()?.toISOString?.() ?? d.updatedAt ?? new Date().toISOString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('❌ job-tracker GET:', error);
    return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 });
  }
}

// ─── POST — create a new application ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const uid = await getUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const data = sanitize(body);

    if (!data.company || !data.jobTitle)
      return NextResponse.json({ error: 'company and jobTitle are required' }, { status: 400 });

    // Deduplicate: same user + URL submitted within 10 min
    if (data.jobUrl) {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const dup = await db
        .collection('jobApplications')
        .where('userId',  '==', uid)
        .where('jobUrl',  '==', data.jobUrl)
        .where('createdAt', '>=', tenMinAgo)
        .limit(1)
        .get();
      if (!dup.empty)
        return NextResponse.json({ success: true, duplicate: true, message: 'Already tracked recently' });
    }

    const now    = new Date();
    const docRef = db.collection('jobApplications').doc();

    await docRef.set({
      userId:      uid,
      company:     data.company,
      jobTitle:    data.jobTitle,
      jobUrl:      data.jobUrl      ?? null,
      location:    data.location    ?? null,
      salary:      data.salary      ?? null,
      workType:    data.workType    ?? 'onsite',
      source:      data.source      ?? null,
      notes:       data.notes       ?? null,
      status:      data.status      ?? 'applied',
      appliedDate: data.appliedDate ?? now.toISOString().split('T')[0],
      createdAt:   now,
      updatedAt:   now,
    });

    return NextResponse.json({ success: true, id: docRef.id }, { status: 201 });
  } catch (error) {
    console.error('❌ job-tracker POST:', error);
    return NextResponse.json({ error: 'Failed to create application' }, { status: 500 });
  }
}

// ─── PATCH — update an application ───────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const uid = await getUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const id   = typeof body.id === 'string' ? body.id.trim() : null;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const docRef = db.collection('jobApplications').doc(id);
    const snap   = await docRef.get();
    if (!snap.exists)                return NextResponse.json({ error: 'Not found' },  { status: 404 });
    if (snap.data()?.userId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updates = sanitize(body);
    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

    await docRef.update({ ...updates, updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ job-tracker PATCH:', error);
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 });
  }
}

// ─── DELETE — delete an application ──────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const uid = await getUid(request);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const docRef = db.collection('jobApplications').doc(id);
    const snap   = await docRef.get();
    if (!snap.exists)                return NextResponse.json({ error: 'Not found' },  { status: 404 });
    if (snap.data()?.userId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ job-tracker DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 });
  }
}