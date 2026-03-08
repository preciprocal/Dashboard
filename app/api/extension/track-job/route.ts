// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization, Accept',
  'Access-Control-Max-Age':       '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token  = request.headers.get('x-extension-token') || '';
  const email  = request.headers.get('x-user-email')      || '';
  const userId = request.headers.get('x-user-id')         || '';
  if (token) {
    try { const d = await auth.verifyIdToken(token, true);       return d.uid; } catch {}
    try { const d = await auth.verifySessionCookie(token, true); return d.uid; } catch {}
  }
  if (userId && /^[a-zA-Z0-9]{20,40}$/.test(userId)) {
    try { await auth.getUser(userId); return userId; } catch {}
  }
  if (email) {
    try { const u = await auth.getUserByEmail(email); return u.uid; } catch {}
  }
  return null;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

  const { title, company, location, description, url, jobId } = body as Record<string, string>;

  if (!company?.trim() || !title?.trim()) {
    return NextResponse.json({ error: 'company and title are required' }, { status: 400, headers: CORS });
  }

  try {
    if (url) {
      const existing = await db.collection('jobApplications')
        .where('userId', '==', userId).where('jobUrl', '==', url).limit(1).get();
      if (!existing.empty) {
        return NextResponse.json(
          { success: true, duplicate: true, id: existing.docs[0].id, message: 'Already in your tracker' },
          { headers: CORS }
        );
      }
    }
  } catch {}

  try {
    const docRef = await db.collection('jobApplications').add({
      userId,
      company:       company.trim(),
      jobTitle:      title.trim(),
      jobUrl:        url              || null,
      location:      location?.trim() || null,
      salary:        null,
      workType:      'onsite',
      source:        'LinkedIn',
      notes:         description ? `Job description:\n${description.slice(0, 1000)}` : null,
      status:        'applied',
      appliedDate:   new Date().toISOString().split('T')[0],
      linkedInJobId: jobId           || null,
      createdAt:     new Date(),
      updatedAt:     new Date(),
    });
    return NextResponse.json(
      { success: true, duplicate: false, id: docRef.id, message: 'Job added to your tracker' },
      { headers: CORS }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to save job' }, { status: 500, headers: CORS });
  }
}