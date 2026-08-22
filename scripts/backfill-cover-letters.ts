// scripts/backfill-cover-letters.ts
// Migrates the Firestore `coverLetters` collection into Postgres
// `cover_letters`, remapping the legacy Firebase uid to the real Supabase
// auth UUID. This collection was missed by the original Phase 3a-3f domain
// inventory - discovered live during a post-3f sweep.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-cover-letters.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-cover-letters.ts -- --commit    -> write
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

function toISO(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof v === "string") return v;
  return null;
}

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const uidMap = await buildFirebaseUidToSupabaseIdMap();
  const snap = await db.collection("coverLetters").get();
  console.log(`Found ${snap.size} Firestore coverLetters docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;
  const rows: Array<Record<string, unknown>> = [];

  for (const d of snap.docs) {
    const data = d.data();
    const supabaseUserId = uidMap.get(data.userId as string) ?? null;
    if (!supabaseUserId) { skippedNoUser++; continue; }

    rows.push({
      user_id: supabaseUserId,
      job_role: data.jobRole || "",
      company_name: data.companyName || null,
      job_description: data.jobDescription || null,
      tone: data.tone || null,
      content: data.content || "",
      word_count: data.wordCount ?? null,
      used_resume: data.usedResume === true,
      linkedin_job_url: data.linkedInJobUrl || null,
      linkedin_job_id: data.linkedInJobId || null,
      created_at: toISO(data.createdAt) ?? new Date().toISOString(),
    });
  }

  console.log(`${rows.length} rows to insert (${skippedNoUser} docs skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  // Plain insert, not upsert - Firestore's auto-generated doc IDs aren't
  // valid uuids, so there's no natural conflict key to dedupe on. Safe to
  // run only once (matches every other non-idempotent-by-necessity backfill).
  const { error, count } = await supabaseAdmin.from("cover_letters").insert(rows, { count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  console.log(`✅ Inserted/updated ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
