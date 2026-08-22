// scripts/backfill-notifications.ts
// Phase 3d: copy Firestore's `notifications` collection into Postgres
// `notifications`, remapping the legacy Firebase uid to the real Supabase
// auth UUID.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-notifications.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-notifications.ts -- --commit    -> write
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
    db.collection("notifications").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore notifications docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;

  const rows = snap.docs.map((doc) => {
    const d = doc.data();

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skippedNoUser++; return null; }

    return {
      user_id: supabaseUserId,
      type: d.type ?? null,
      title: d.title ?? null,
      body: d.message ?? null,
      read: d.isRead === true,
      action_url: d.actionUrl ?? null,
      action_label: d.actionLabel ?? null,
      metadata: d.metadata ?? null,
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
      updated_at: toISO(d.updatedAt) ?? toISO(d.createdAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin.from("notifications").insert(chunk, { count: "exact" });
    if (error) { console.error(`❌ Insert failed at offset ${i}:`, error); process.exit(1); }
    inserted += count ?? chunk.length;
  }

  console.log(`✅ Inserted ${inserted} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
