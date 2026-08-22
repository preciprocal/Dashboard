// scripts/backfill-resumes.ts
// Phase 3b: copy Firestore's `resumes` collection into Postgres `resumes`,
// remapping the legacy Firebase uid to the real Supabase auth UUID. Firestore
// resume doc IDs were already client-generated via crypto.randomUUID() (see
// app/(root)/resume/upload/page.tsx), so the `id` column is preserved as-is -
// this keeps `tailored_resumes.resume_id` FK-compatible without a separate
// id-remapping step in scripts/backfill-tailored-resumes.ts.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-resumes.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-resumes.ts -- --commit    -> write
import { db } from "../firebase/admin";
import { supabaseAdmin } from "../supabase/admin";

const COMMIT = process.argv.includes("--commit");

const VALID_STATUSES = new Set(["analyzing", "complete", "failed"]);

async function buildFirebaseUidToSupabaseIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("legacy_user_id_map")
      .select("firebase_uid, user_id")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data ?? []) map.set(row.firebase_uid as string, row.user_id as string);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

// Firestore fields on `resumes` are a mix of Timestamp objects (from
// Timestamp.fromDate), raw Date.now() epoch-ms numbers, and ISO strings
// depending on which route wrote them over time - normalise all to ISO.
function toISO(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string") return v;
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const [snap, uidMap] = await Promise.all([
    db.collection("resumes").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore resumes docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;
  let skippedBadId = 0;

  const rows = snap.docs.map((doc) => {
    const d = doc.data();

    if (!UUID_RE.test(doc.id)) { skippedBadId++; return null; }

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skippedNoUser++; return null; }

    let status = (d.status as string) || "complete";
    if (!VALID_STATUSES.has(status)) status = "complete";

    return {
      id: doc.id,
      user_id: supabaseUserId,
      company_name: d.companyName ?? null,
      job_title: d.jobTitle ?? null,
      job_description: d.jobDescription ?? null,
      file_name: d.fileName ?? null,
      original_file_name: d.originalFileName ?? null,
      file_size: d.fileSize ?? null,
      file_url: d.fileUrl ?? null,
      resume_path: d.resumePath ?? null,
      image_path: d.imagePath ?? null,
      file_path: d.filePath ?? null,
      status,
      score: d.score ?? null,
      feedback: d.feedback ?? null,
      analyzed_at: toISO(d.analyzedAt),
      error: d.error ?? null,
      resume_text: d.resumeText ?? null,
      resume_html: d.resumeHtml ?? null,
      cache_hash: d.cacheHash ?? null,
      content_hash: d.contentHash ?? null,
      benchmark_result: d.benchmarkResult ?? null,
      benchmark_generated_at: toISO(d.benchmarkGeneratedAt),
      recruiter_simulation: d.recruiterSimulation ?? null,
      recruiter_simulation_generated_at: toISO(d.recruiterSimulationGeneratedAt),
      interview_intel: d.interviewIntel ?? null,
      interview_intel_generated_at: toISO(d.interviewIntelGeneratedAt),
      interview_intel_company: d.interviewIntelCompany ?? null,
      interview_intel_role: d.interviewIntelRole ?? null,
      deep_analysis: d.deepAnalysis ?? null,
      deep_analysis_generated_at: toISO(d.deepAnalysisGeneratedAt),
      tailor_result: d.tailorResult ?? null,
      tailor_result_generated_at: toISO(d.tailorResultGeneratedAt),
      tailor_job_title: d.tailorJobTitle ?? null,
      tailor_company_name: d.tailorCompanyName ?? null,
      deleted: d.deleted === true,
      deleted_at: toISO(d.deletedAt),
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
      updated_at: toISO(d.updatedAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user, ${skippedBadId} skipped - non-UUID doc id)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  // Insert in chunks - a handful of resume rows carry large jsonb blobs
  // (deepAnalysis, benchmarkResult) that make single-batch inserts risky.
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin.from("resumes").insert(chunk, { count: "exact" });
    if (error) { console.error(`❌ Insert failed at offset ${i}:`, error); process.exit(1); }
    inserted += count ?? chunk.length;
    console.log(`   inserted ${inserted}/${rows.length}`);
  }

  console.log(`✅ Inserted ${inserted} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
