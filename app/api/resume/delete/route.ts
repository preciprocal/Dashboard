// app/api/resume/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db, storage } from '@/firebase/admin';
import { redis } from '@/lib/redis/redis-client';

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    let userId: string | null = null;
    const session = (await cookies()).get('session');
    if (session) try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch {}
    if (!userId) {
      const h = request.headers.get('authorization');
      if (h?.startsWith('Bearer ')) try { userId = (await auth.verifyIdToken(h.slice(7))).uid; } catch {}
    }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Parse body ────────────────────────────────────────────────
    const { resumeId } = await request.json() as { resumeId?: string };
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

    console.log(`\n🗑️  ════════════════════════════════════════════`);
    console.log(`🗑️  DELETE RESUME: ${resumeId}`);
    console.log(`🗑️  User: ${userId}`);
    console.log(`🗑️  ════════════════════════════════════════════`);

    // ── Verify ownership & get data before deleting ───────────────
    const docRef = db.collection('resumes').doc(resumeId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    const data = docSnap.data() as Record<string, unknown>;
    if (data.userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // ── 1. Delete files from Firebase Storage ─────────────────────
    const storageFilesDeleted: string[] = [];

    const extractStoragePath = (urlOrPath: string): string | null => {
      if (!urlOrPath) return null;
      if (urlOrPath.startsWith('data:')) return null;
      if (!urlOrPath.startsWith('http')) return urlOrPath;
      if (urlOrPath.includes('firebasestorage.googleapis.com') || urlOrPath.includes('/o/')) {
        try {
          const match = urlOrPath.match(/\/o\/([^?]+)/);
          if (match) return decodeURIComponent(match[1]);
        } catch {}
      }
      return null;
    };

    const deleteStorageFile = async (urlOrPath: string, label: string) => {
      const storagePath = extractStoragePath(urlOrPath);
      if (!storagePath) return;
      try {
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          storageFilesDeleted.push(storagePath);
          console.log(`   ✅ ${label}: ${storagePath}`);
        } else {
          console.log(`   ℹ️  ${label}: already gone`);
        }
      } catch (err) {
        console.warn(`   ⚠️  ${label} failed:`, err);
      }
    };

    if (data.resumePath && typeof data.resumePath === 'string') await deleteStorageFile(data.resumePath, 'PDF');
    if (data.imagePath && typeof data.imagePath === 'string') await deleteStorageFile(data.imagePath, 'Image');
    if (data.filePath && typeof data.filePath === 'string') await deleteStorageFile(data.filePath, 'File');
    if (data.storagePath && typeof data.storagePath === 'string') await deleteStorageFile(data.storagePath, 'Storage');

    // Pattern-based cleanup: resumes/{userId}/{resumeId}/*
    try {
      const bucket = storage.bucket();
      const [files] = await bucket.getFiles({ prefix: `resumes/${userId}/${resumeId}` });
      for (const file of files) {
        if (!storageFilesDeleted.includes(file.name)) {
          await file.delete();
          storageFilesDeleted.push(file.name);
          console.log(`   ✅ Pattern match: ${file.name}`);
        }
      }
    } catch {}

    console.log(`   📦 Storage: ${storageFilesDeleted.length} file(s) deleted`);

    // ── 2. Clear ALL related Redis caches ─────────────────────────
    if (redis) {
      const keysDeleted: string[] = [];

      try {
        // A. Direct key: resume:{userId}:{resumeId}
        const userResumeKey = `resume:${userId}:${resumeId}`;
        await redis.del(userResumeKey);
        keysDeleted.push(userResumeKey);

        // B. Resumes list cache
        const listKey = `resumes-list:${userId}`;
        await redis.del(listKey);
        keysDeleted.push(listKey);

        // C. Content-hash based caches (analysis, text, fixes)
        //    These use SHA-256 hashes of file content as keys,
        //    so we can't find them by resumeId. We use SCAN with
        //    the "resume:" prefix and delete aggressively.
        //    Also scan for any key containing the resumeId.
        const patterns = [
          `*${resumeId}*`,           // any key with resumeId
        ];

        for (const pattern of patterns) {
          let cursor = '0';
          let scanned = 0;
          const MAX_SCAN = 1000;

          do {
            const [nextCursor, keys] = await redis.scan(Number(cursor), { match: pattern, count: 100 });
            cursor = String(nextCursor);
            scanned += 100;

            if (keys.length > 0) {
              const pipeline = redis.pipeline();
              for (const key of keys) {
                pipeline.del(key);
                keysDeleted.push(key as string);
              }
              await pipeline.exec();
            }
          } while (cursor !== '0' && scanned < MAX_SCAN);
        }

        // D. If we can find the content hash, delete analysis/text/fixes caches
        //    The content hash might be stored on the Firestore doc or derivable
        //    from feedback data. Check common fields.
        const contentHash = data.contentHash as string | undefined;
        const cacheHash = data.cacheHash as string | undefined;
        const hashesToClear = [contentHash, cacheHash].filter(Boolean) as string[];

        // Also try to find hash from the feedback.resumeText or resumeText
        // by looking at what keys exist with the resume:analysis: prefix
        // This is a best-effort approach
        if (hashesToClear.length === 0) {
          // Scan for resume:analysis:* and resume:text:* keys
          // and check if the cached data references this user
          let aCursor = '0';
          let aScanned = 0;
          do {
            const [nextCursor, keys] = await redis.scan(Number(aCursor), { match: 'resume:analysis:*', count: 100 });
            aCursor = String(nextCursor);
            aScanned += 100;
            // Delete all analysis cache keys for this user (nuclear but safe - they auto-regenerate)
            if (keys.length > 0) {
              for (const key of keys) {
                try {
                  const cached = await redis.get(key as string);
                  if (cached) {
                    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
                    // Check if this analysis belongs to the deleted resume by matching the resumeText
                    const cachedText = parsed?.resumeText || '';
                    const resumeText = (data.resumeText as string) || (data.feedback as Record<string, unknown>)?.resumeText || '';
                    if (resumeText && cachedText && cachedText.slice(0, 200) === (resumeText as string).slice(0, 200)) {
                      await redis.del(key as string);
                      keysDeleted.push(key as string);
                    }
                  }
                } catch {}
              }
            }
          } while (aCursor !== '0' && aScanned < 500);
        } else {
          // We have the content hash - delete directly
          for (const hash of hashesToClear) {
            const analysisKey = `resume:analysis:${hash}`;
            const textKey = `resume:text:${hash}`;
            const fixesKey = `resume:fixes:${hash}`;
            await redis.del(analysisKey);
            await redis.del(textKey);
            await redis.del(fixesKey);
            keysDeleted.push(analysisKey, textKey, fixesKey);
          }
        }

        console.log(`   🧹 Redis: ${keysDeleted.length} key(s) deleted`);
        if (keysDeleted.length > 0) {
          console.log(`      ${keysDeleted.join('\n      ')}`);
        }
      } catch (cacheErr) {
        console.warn('   ⚠️  Cache cleanup error (non-fatal):', cacheErr);
      }
    } else {
      console.log('   ℹ️  Redis not available - skipping cache cleanup');
    }

    // ── 3. Delete from Firestore ──────────────────────────────────
    await docRef.delete();
    console.log(`   📄 Firestore document deleted`);

    // ── 4. Delete related collections ─────────────────────────────
    try {
      const tailored = await db.collection('tailoredResumes').where('resumeId', '==', resumeId).get();
      if (!tailored.empty) {
        const batch = db.batch();
        tailored.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`   📄 Deleted ${tailored.size} tailored resume(s)`);
      }
    } catch {}

    console.log(`\n✅ RESUME FULLY DELETED: ${resumeId}`);
    console.log(`   Storage: ${storageFilesDeleted.length} files | Firestore: deleted | Redis: cleaned\n`);

    return NextResponse.json({ success: true, resumeId });

  } catch (err) {
    console.error('❌ Delete resume error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete resume' },
      { status: 500 },
    );
  }
}