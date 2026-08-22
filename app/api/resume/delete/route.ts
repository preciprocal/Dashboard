// app/api/resume/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';

const SUPABASE_BUCKET = 'user-files';

interface ResumeRow {
  user_id: string;
  resume_path: string | null;
  image_path: string | null;
  file_path: string | null;
  content_hash: string | null;
  cache_hash: string | null;
  resume_text: string | null;
  feedback: Record<string, unknown> | null;
}

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId, supabaseUserId } = authedUser;

    // ── Parse body ────────────────────────────────────────────────
    const { resumeId } = await request.json() as { resumeId?: string };
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

    console.log(`\n🗑️  ════════════════════════════════════════════`);
    console.log(`🗑️  DELETE RESUME: ${resumeId}`);
    console.log(`🗑️  User: ${supabaseUserId}`);
    console.log(`🗑️  ════════════════════════════════════════════`);

    // ── Verify ownership & get data before deleting ───────────────
    const { data: row, error: fetchError } = await supabaseAdmin
      .from('resumes')
      .select('user_id, resume_path, image_path, file_path, content_hash, cache_hash, resume_text, feedback')
      .eq('id', resumeId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!row) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    const data = row as ResumeRow;
    if (data.user_id !== supabaseUserId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // ── 1. Delete files from Supabase Storage ──────────────────────
    // All resumes are on Supabase Storage as of the Phase 1 legacy-file
    // migration (scripts/migrate-legacy-resume-storage.ts) - every path here
    // is a bare "resumes/{uid}/{id}/..." key, never a Firebase download URL.
    const storageFilesDeleted: string[] = [];

    const deleteStorageFile = async (path: string, label: string) => {
      if (!path || path.startsWith('data:')) return;
      try {
        const { error } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).remove([path]);
        if (!error) {
          storageFilesDeleted.push(path);
          console.log(`   ✅ ${label} (Supabase): ${path}`);
        } else {
          console.warn(`   ⚠️  ${label} (Supabase) failed:`, error);
        }
      } catch (err) {
        console.warn(`   ⚠️  ${label} (Supabase) failed:`, err);
      }
    };

    if (data.resume_path) await deleteStorageFile(data.resume_path, 'PDF');
    if (data.image_path) await deleteStorageFile(data.image_path, 'Image');
    if (data.file_path) await deleteStorageFile(data.file_path, 'File');

    // Pattern-based cleanup: resumes/{userId}/{resumeId}/* (Supabase - the current convention)
    // Storage paths are written using the legacy-resolved userId (see app/api/storage/upload/route.ts),
    // so pattern matching must use the same identifier, not the Supabase auth UUID.
    try {
      const { data: supabaseFiles } = await supabaseAdmin.storage
        .from(SUPABASE_BUCKET)
        .list(`resumes/${userId}/${resumeId}`);
      for (const file of supabaseFiles ?? []) {
        const fullPath = `resumes/${userId}/${resumeId}/${file.name}`;
        if (!storageFilesDeleted.includes(fullPath)) {
          const { error } = await supabaseAdmin.storage.from(SUPABASE_BUCKET).remove([fullPath]);
          if (!error) {
            storageFilesDeleted.push(fullPath);
            console.log(`   ✅ Pattern match (Supabase): ${fullPath}`);
          }
        }
      }
    } catch {}

    console.log(`   📦 Storage: ${storageFilesDeleted.length} file(s) deleted`);

    // ── 2. Clear ALL related Redis caches ─────────────────────────
    if (redis) {
      const keysDeleted: string[] = [];

      try {
        // A. Direct key: resume:{userId}:{resumeId}
        const userResumeKey = `resume:${supabaseUserId}:${resumeId}`;
        await redis.del(userResumeKey);
        keysDeleted.push(userResumeKey);

        // B. Resumes list cache
        const listKey = `resumes-list:${supabaseUserId}`;
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
        //    The content hash might be stored on the resume row or derivable
        //    from feedback data. Check common fields.
        const hashesToClear = [data.content_hash, data.cache_hash].filter(Boolean) as string[];

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
                    const resumeText = data.resume_text || (data.feedback as Record<string, unknown>)?.resumeText || '';
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

    // ── 3. Delete from Postgres ────────────────────────────────────
    const { error: deleteError } = await supabaseAdmin.from('resumes').delete().eq('id', resumeId);
    if (deleteError) throw deleteError;
    console.log(`   📄 Resume row deleted`);

    // ── 4. Delete related tailored resumes ─────────────────────────
    try {
      const { data: deletedTailored, error: tailoredError } = await supabaseAdmin
        .from('tailored_resumes')
        .delete()
        .eq('resume_id', resumeId)
        .select('id');
      if (!tailoredError && deletedTailored && deletedTailored.length > 0) {
        console.log(`   📄 Deleted ${deletedTailored.length} tailored resume(s)`);
      }
    } catch {}

    console.log(`\n✅ RESUME FULLY DELETED: ${resumeId}`);
    console.log(`   Storage: ${storageFilesDeleted.length} files | Postgres: deleted | Redis: cleaned\n`);

    return NextResponse.json({ success: true, resumeId });

  } catch (err) {
    console.error('❌ Delete resume error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete resume' },
      { status: 500 },
    );
  }
}
