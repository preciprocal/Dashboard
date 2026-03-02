// app/api/extension/debug-files/route.ts
// TEMPORARY DEBUG ENDPOINT — shows exactly what fields are in Firestore
// Remove this after debugging the resume/transcript issue
// Access: GET /api/extension/debug-files (with same auth headers as auto-apply)

import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const extensionToken = request.headers.get('x-extension-token');
  const headerUserId   = request.headers.get('x-user-id');
  if (extensionToken && extensionToken.length > 100) {
    try { return (await auth.verifyIdToken(extensionToken)).uid; } catch {}
  }
  if (extensionToken && extensionToken.length > 5) return extensionToken;
  if (headerUserId   && headerUserId.length   > 5) return headerUserId;
  return null;
}

export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result: Record<string, any> = { userId, found: {} };

  // 1. Check user doc
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const data = userDoc.data()!;
    // Show all fields that mention file/resume/transcript
    result.found.userDoc = {
      id: userDoc.id,
      allFields: Object.keys(data),
      fileRelatedFields: Object.fromEntries(
        Object.entries(data).filter(([k]) =>
          /resume|transcript|file|path|url|upload/i.test(k)
        ).map(([k, v]) => [k, typeof v === 'string' && v.length > 100
          ? v.substring(0, 80) + `...(${v.length} chars)`
          : v
        ])
      ),
    };
  } else {
    result.found.userDoc = 'NOT FOUND';
  }

  // 2. Check resumes collection
  const resumeSnap = await db.collection('resumes')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(3)
    .get();

  result.found.resumes = resumeSnap.docs.map(doc => {
    const d = doc.data();
    return {
      docId: doc.id,
      allFields: Object.keys(d),
      keyFields: {
        status:           d.status,
        fileName:         d.fileName,
        originalFileName: d.originalFileName,
        fileUrl:          d.fileUrl ? `${String(d.fileUrl).substring(0,80)}...(${String(d.fileUrl).length})` : 'MISSING',
        resumePath:       d.resumePath ? `${String(d.resumePath).substring(0,80)}...(${String(d.resumePath).length})` : 'MISSING',
        imagePath:        d.imagePath  ? `${String(d.imagePath).substring(0,80)}...(${String(d.imagePath).length})` : 'MISSING',
        resumeText:       d.resumeText ? `(${d.resumeText.length} chars)` : 'MISSING',
        type:             d.type || 'not set',
        createdAt:        d.createdAt,
      }
    };
  });

  // 3. Check transcripts collection
  const transcriptSnap = await db.collection('transcripts')
    .where('userId', '==', userId)
    .limit(3)
    .get();

  result.found.transcripts = transcriptSnap.empty
    ? 'COLLECTION EMPTY or NO DOCS for this user'
    : transcriptSnap.docs.map(doc => ({ docId: doc.id, fields: Object.keys(doc.data()), data: doc.data() }));

  // 4. Any other collections that might store files
  for (const col of ['userFiles', 'files', 'documents', 'uploads']) {
    try {
      const snap = await db.collection(col).where('userId', '==', userId).limit(1).get();
      if (!snap.empty) {
        result.found[col] = snap.docs.map(d => ({ id: d.id, fields: Object.keys(d.data()) }));
      }
    } catch {}
  }

  return NextResponse.json(result, { status: 200 });
}