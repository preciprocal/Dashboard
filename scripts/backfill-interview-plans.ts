// scripts/backfill-interview-plans.ts
// Phase 3b: copy Firestore's `interviewPlans` collection into Postgres
// `interview_plans`, remapping the legacy Firebase uid to the real Supabase
// auth UUID. Firestore doc IDs here are Firestore auto-IDs (not UUIDs, unlike
// resumes), so a fresh Postgres UUID is generated per row - nothing else has
// an FK dependency on the old ID (the interviewPlans/quizResults subcollection
// this doc's plan.id would key into is confirmed empty in production).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-interview-plans.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-interview-plans.ts -- --commit    -> write
import crypto from "crypto";
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

  const [snap, uidMap] = await Promise.all([
    db.collection("interviewPlans").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore interviewPlans docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;

  const rows = snap.docs.map((doc) => {
    const d = doc.data();

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skippedNoUser++; return null; }

    // New Postgres row id - the old Firestore auto-ID can't be reused (not a
    // UUID), so `data.id` must be remapped to match or client code reading
    // `plan.id` (e.g. PlanCard's delete button) would target a nonexistent row.
    const newId = crypto.randomUUID();
    const planData = { ...d, id: newId, userId: supabaseUserId };

    return {
      id: newId,
      user_id: supabaseUserId,
      archived: d.status === "archived",
      data: planData,
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
      updated_at: toISO(d.updatedAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 1), null, 2)?.slice(0, 2000));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin.from("interview_plans").insert(rows, { count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
