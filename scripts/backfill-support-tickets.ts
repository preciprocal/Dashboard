// scripts/backfill-support-tickets.ts
// Phase 3d: copy Firestore's `supportTickets` collection into Postgres
// `support_tickets`, remapping the legacy Firebase uid to the real Supabase
// auth UUID. Firestore doc IDs are Firestore auto-IDs (not UUIDs), so a
// fresh Postgres UUID is generated per row. The old-id -> new-id map is
// written to a JSON file so scripts/backfill-support-ticket-replies.ts (run
// afterward) can resolve `replies` subcollection parents to the new rows.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-support-tickets.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-support-tickets.ts -- --commit    -> write
import crypto from "crypto";
import { writeFileSync } from "fs";
import path from "path";
import { db } from "../firebase/admin";
import { supabaseAdmin } from "../supabase/admin";

const COMMIT = process.argv.includes("--commit");
const ID_MAP_PATH = path.join(__dirname, ".ticket-id-map.json");

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
    db.collection("supportTickets").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore supportTickets docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;
  const idMap: Record<string, string> = {};

  const rows = snap.docs.map((doc) => {
    const d = doc.data();

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skippedNoUser++; return null; }

    const newId = crypto.randomUUID();
    idMap[doc.id] = newId;

    return {
      id: newId,
      user_id: supabaseUserId,
      user_email: d.userEmail ?? null,
      user_name: d.userName ?? null,
      subject: d.subject ?? null,
      message: d.message ?? null,
      category: d.category ?? null,
      priority: d.priority ?? "medium",
      status: d.status ?? "open",
      attachments: d.attachments ?? [],
      last_reply_by: d.lastReplyBy ?? null,
      last_reply_at: toISO(d.lastReplyAt),
      reply_count: typeof d.replyCount === "number" ? d.replyCount : 0,
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
      updated_at: toISO(d.updatedAt) ?? toISO(d.createdAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin.from("support_tickets").insert(rows, { count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  writeFileSync(ID_MAP_PATH, JSON.stringify(idMap, null, 2));
  console.log(`✅ Inserted ${count ?? rows.length} rows`);
  console.log(`✅ Wrote id map (${Object.keys(idMap).length} entries) to ${ID_MAP_PATH}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
