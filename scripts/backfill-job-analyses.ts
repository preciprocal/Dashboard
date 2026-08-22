// scripts/backfill-job-analyses.ts
// Phase 3a: copy Firestore's `job_analyses` collection into Postgres
// `job_analyses`, remapping the legacy Firebase uid to the real Supabase
// auth UUID. Rows with no mappable user are skipped (NOT NULL FK).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-job-analyses.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-job-analyses.ts -- --commit    -> write
import { db } from "../firebase/admin";
import { supabaseAdmin } from "../supabase/admin";

const COMMIT = process.argv.includes("--commit");

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

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const [snap, uidMap] = await Promise.all([
    db.collection("job_analyses").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore job_analyses docs, ${uidMap.size} legacy uid mappings`);

  let skipped = 0;
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skipped++; return null; }

    return {
      user_id: supabaseUserId,
      job_description: `${d.jobTitle ?? ''} @ ${d.jobCompany ?? ''}`.trim(),
      result: { jobTitle: d.jobTitle ?? null, jobCompany: d.jobCompany ?? null, overallScore: d.overallScore ?? null, source: d.source ?? null },
      created_at: d.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skipped} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 1), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin
    .from("job_analyses")
    .insert(rows, { count: "exact" });

  if (error) {
    console.error("❌ Insert failed:", error);
    process.exit(1);
  }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
