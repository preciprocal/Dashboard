// scripts/backfill-feature-ratings.ts
// Phase 3c: copy the feature-rating subset of Firestore's polymorphic
// `feedback` collection (written by app/api/user/feedback/route.ts POST,
// backing components/ServiceFeedback.tsx) into Postgres `feature_ratings`.
// The interview-assessment subset was already handled by
// scripts/backfill-interview-feedback.ts.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-feature-ratings.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-feature-ratings.ts -- --commit    -> write
import { getFirebaseDb } from "../firebase/admin";

// Lazy getter rather than a module-scope `db` export. The old export ran
// cert() on import, and a missing credential threw before any script could
// print a useful message. Scripts SHOULD hard-fail without Firebase, hence
// the throw, but it happens here where the reason is legible.
const db = (() => {
  const d = getFirebaseDb();
  if (!d) throw new Error(
    "Firebase is not configured. This backfill reads Firestore, so set " +
    "FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and " +
    "FIREBASE_ADMIN_PRIVATE_KEY before running it.",
  );
  return d;
})();
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
    db.collection("feedback").where("type", "==", "feature-rating").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore feature-rating docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;

  const rows = snap.docs.map((doc) => {
    const d = doc.data();

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skippedNoUser++; return null; }

    return {
      user_id: supabaseUserId,
      feature: d.serviceKey ?? "unknown",
      rating: d.rating ?? null,
      nps: d.nps ?? null,
      tags: Array.isArray(d.tags) ? d.tags : [],
      comment: d.comment ?? "",
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin.from("feature_ratings").insert(rows, { count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
