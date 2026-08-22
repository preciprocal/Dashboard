// scripts/backfill-contact-searches.ts
// Phase 3a: copy Firestore's `contactSearches` collection into Postgres
// `contact_searches`. Remaps the legacy Firebase uid to the real Supabase
// auth UUID via legacy_user_id_map - contact_searches.user_id has a NOT
// NULL FK to auth.users, so rows with no mappable user are skipped
// (this is best-effort analytics data, not worth blocking the backfill for).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-contact-searches.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-contact-searches.ts -- --commit    -> write
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
    db.collection("contactSearches").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore contactSearches docs, ${uidMap.size} legacy uid mappings`);

  let skipped = 0;
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skipped++; return null; }

    return {
      user_id: supabaseUserId,
      query: { company: d.company ?? null, domain: d.domain ?? null, jobTitle: d.jobTitle ?? null },
      results: { contactCount: d.contactCount ?? 0, emailsGenerated: d.emailsGenerated ?? 0 },
      created_at: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skipped} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin
    .from("contact_searches")
    .insert(rows, { count: "exact" });

  if (error) {
    console.error("❌ Insert failed:", error);
    process.exit(1);
  }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
