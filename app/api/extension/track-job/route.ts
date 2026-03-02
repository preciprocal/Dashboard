// app/api/extension/track-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

const TAG = '[EXT-TRACK]';
function log(level: '✅'|'⚠️'|'❌'|'📊'|'🔍', step: string, detail?: unknown) {
  const ts = new Date().toISOString();
  if (detail !== undefined) console.log(`${TAG} ${level} [${ts}] ${step}`, detail);
  else console.log(`${TAG} ${level} [${ts}] ${step}`);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-extension-token, x-user-email, x-user-id, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders() });
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token   = request.headers.get('x-extension-token') || '';
  const email   = request.headers.get('x-user-email') || '';
  const userId  = request.headers.get('x-user-id') || '';

  log('🔍', 'Auth attempt', { tokenLen: token.length, email, userId });

  // Try 1: Firebase session cookie
  if (token) {
    try {
      const decoded = await auth.verifySessionCookie(token, true);
      log('✅', 'Session cookie valid', { uid: decoded.uid });
      return decoded.uid;
    } catch { /* not a session cookie */ }

    // Try 2: Firebase ID token
    try {
      const decoded = await auth.verifyIdToken(token, true);
      log('✅', 'ID token valid', { uid: decoded.uid });
      return decoded.uid;
    } catch { /* not an ID token */ }
  }

  // Try 3: Direct userId header (sent by banner from CHECK_AUTH response)
  if (userId && /^[a-zA-Z0-9]{20,40}$/.test(userId)) {
    try {
      await auth.getUser(userId);
      log('✅', 'Direct userId valid', { uid: userId });
      return userId;
    } catch { /* invalid uid */ }
  }

  // Try 4: Look up by email (most reliable fallback — email comes from CHECK_AUTH)
  if (email) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      log('✅', 'Found user by email', { uid: userRecord.uid, email });
      return userRecord.uid;
    } catch (e) {
      log('❌', 'Email lookup failed', { email, error: e instanceof Error ? e.message : String(e) });
    }
  }

  log('❌', 'AUTH_FAILED — all methods exhausted', { tokenLen: token.length, email, userId });
  return null;
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  log('🔍', 'Track-job request received');

  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_TOKEN' },
      { status: 401, headers: corsHeaders() }
    );
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders() });
  }

  const { title, company, location, description, url, jobId } = body as Record<string, string>;
  log('📊', 'Job data received', { title, company, location });

  if (!company?.trim() || !title?.trim()) {
    return NextResponse.json(
      { error: 'company and title are required' },
      { status: 400, headers: corsHeaders() }
    );
  }

  // Duplicate check
  try {
    if (url) {
      const existing = await db.collection('jobApplications')
        .where('userId', '==', userId)
        .where('jobUrl', '==', url)
        .limit(1)
        .get();
      if (!existing.empty) {
        const doc = existing.docs[0];
        log('⚠️', 'DUPLICATE', { docId: doc.id });
        return NextResponse.json(
          { success: true, duplicate: true, id: doc.id, message: 'Already in your tracker' },
          { headers: corsHeaders() }
        );
      }
    }
  } catch (e) {
    log('⚠️', 'Duplicate check failed', { error: e instanceof Error ? e.message : String(e) });
  }

  try {
    const docRef = await db.collection('jobApplications').add({
      userId,
      company:       company.trim(),
      jobTitle:      title.trim(),
      jobUrl:        url          || null,
      location:      location?.trim() || null,
      salary:        null,
      workType:      'onsite',
      source:        'LinkedIn',
      notes:         description ? `Job description:\n${description.slice(0, 1000)}` : null,
      status:        'applied',
      appliedDate:   new Date().toISOString().split('T')[0],
      linkedInJobId: jobId || null,
      createdAt:     new Date(),
      updatedAt:     new Date(),
    });
    log('✅', 'Job tracked', { docId: docRef.id, ms: Date.now() - start });
    return NextResponse.json(
      { success: true, duplicate: false, id: docRef.id, message: 'Job added to your tracker' },
      { headers: corsHeaders() }
    );
  } catch (e) {
    log('❌', 'SAVE_FAILED', { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: 'Failed to save job' }, { status: 500, headers: corsHeaders() });
  }
}