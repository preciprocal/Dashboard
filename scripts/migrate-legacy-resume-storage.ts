// scripts/migrate-legacy-resume-storage.ts
//
// Phase 1 cleanup: copies resume PDFs that are still sitting in Firebase
// Storage (uploaded before the Storage cutover) over to Supabase Storage,
// then repoints `resumes.resume_path` at the new bare Supabase path so the
// app stops depending on the Firebase Storage read-fallback in
// app/api/resume/proxy-pdf and lib/resume/resolve-pdf-url.ts.
//
// The Firebase file itself is left untouched (not deleted) - same
// "copy forward, freeze the old data" approach used by every other backfill
// in this migration, so this is safe to re-run and cheap to roll back.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/migrate-legacy-resume-storage.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/migrate-legacy-resume-storage.ts -- --commit    -> write
import { supabaseAdmin } from "../supabase/admin";

const COMMIT = process.argv.includes("--commit");
const BUCKET = "user-files";

interface ResumeRow {
  id: string;
  user_id: string;
  resume_path: string | null;
  file_path: string | null;
}

function isFirebaseUrl(v: string | null): v is string {
  return !!v && v.startsWith("http") && (v.includes("firebasestorage.googleapis.com") || v.includes("/o/"));
}

// file_path already follows the canonical resumes/{legacyUid}/{resumeId}/resume.pdf
// scheme (see app/api/storage/upload/route.ts) for every row checked so far -
// reuse it directly rather than re-deriving the legacy uid ourselves.
function isCanonicalPath(v: string | null, resumeId: string): v is string {
  return !!v && v.startsWith("resumes/") && v.endsWith(`/${resumeId}/resume.pdf`);
}

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const { data, error } = await supabaseAdmin
    .from("resumes")
    .select("id, user_id, resume_path, file_path");
  if (error) throw error;

  const legacy = (data as ResumeRow[]).filter(r => isFirebaseUrl(r.resume_path));
  console.log(`${(data as ResumeRow[]).length} total resumes, ${legacy.length} still on Firebase Storage`);

  let migrated = 0;
  let skippedBadPath = 0;
  let failed = 0;

  for (const row of legacy) {
    if (!isCanonicalPath(row.file_path, row.id)) {
      console.log(`⚠️  Skipping ${row.id} - file_path doesn't match expected shape: ${row.file_path}`);
      skippedBadPath++;
      continue;
    }
    const targetPath = row.file_path;

    if (!COMMIT) {
      console.log(`Would migrate ${row.id}: ${row.resume_path!.slice(0, 80)}... -> ${targetPath}`);
      migrated++;
      continue;
    }

    try {
      const res = await fetch(row.resume_path!);
      if (!res.ok) throw new Error(`Firebase fetch failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(targetPath, buffer, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabaseAdmin
        .from("resumes")
        .update({ resume_path: targetPath })
        .eq("id", row.id);
      if (updateError) throw updateError;

      console.log(`✅ Migrated ${row.id} (${buffer.byteLength} bytes) -> ${targetPath}`);
      migrated++;
    } catch (err) {
      console.error(`❌ Failed to migrate ${row.id}:`, err);
      failed++;
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, skipped (bad path): ${skippedBadPath}, failed: ${failed}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
