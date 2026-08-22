// scripts/backfill-product-surveys.ts
// Phase 3a: copy Firestore's `usersfeedback` collection into the Postgres
// `product_surveys` table. The old collection stored the legacy-resolved
// userId (Firebase uid for migrated users); this remaps it to the real
// Supabase auth UUID via legacy_user_id_map so the new table is
// consistently keyed. Rows with no mappable user_id keep it null rather
// than guessing.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-product-surveys.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-product-surveys.ts -- --commit    -> write
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
    db.collection("usersfeedback").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore usersfeedback docs, ${uidMap.size} legacy uid mappings`);

  let unmapped = 0;
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    const legacyUserId = d.userId as string | null;
    const supabaseUserId = legacyUserId ? (uidMap.get(legacyUserId) ?? null) : null;
    if (legacyUserId && !supabaseUserId) unmapped++;

    return {
      user_id: supabaseUserId,
      user_email: d.userEmail ?? null,
      user_name: d.userName ?? null,
      page: d.page,
      overall_rating: d.overallRating,
      nps: d.nps ?? null,
      feature_ratings: d.featureRatings ?? [],
      usage_options: d.usageOptions ?? [],
      specific_answers: d.specificAnswers ?? {},
      top_improvement: d.topImprovement ?? "",
      free_text: d.freeText ?? "",
      user_agent: d.userAgent ?? "unknown",
      submitted_at: d.submittedAt ?? new Date().toISOString(),
      created_at: d.createdAt ?? new Date().toISOString(),
    };
  }).filter((r) => !!r.page && typeof r.overall_rating === "number");

  console.log(`${rows.length} valid rows to insert (${unmapped} had an unmappable legacy userId -> user_id left null)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  const { error, count } = await supabaseAdmin
    .from("product_surveys")
    .insert(rows, { count: "exact" });

  if (error) {
    console.error("❌ Insert failed:", error);
    process.exit(1);
  }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
