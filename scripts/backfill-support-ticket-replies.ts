// scripts/backfill-support-ticket-replies.ts
// Phase 3d: copy each Firestore `supportTickets/{id}/replies` subcollection
// into Postgres `support_ticket_replies`. Run scripts/backfill-support-
// tickets.ts FIRST - this script reads the id map it writes to resolve the
// parent ticket. Replies whose parent ticket didn't migrate are skipped
// (support_ticket_replies.ticket_id is NOT NULL).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-support-ticket-replies.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-support-ticket-replies.ts -- --commit    -> write
import { readFileSync } from "fs";
import path from "path";
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

  let ticketIdMap: Record<string, string>;
  try {
    ticketIdMap = JSON.parse(readFileSync(ID_MAP_PATH, "utf-8"));
  } catch {
    console.error(`❌ Could not read ${ID_MAP_PATH} - run scripts/backfill-support-tickets.ts --commit first.`);
    process.exit(1);
  }

  const uidMap = await buildFirebaseUidToSupabaseIdMap();

  const ticketsSnap = await db.collection("supportTickets").get();
  console.log(`Found ${ticketsSnap.size} Firestore supportTickets docs, ${Object.keys(ticketIdMap).length} ticket id mappings`);

  let skippedNoTicket = 0;
  let skippedNoUser = 0;
  const rows: Array<{
    ticket_id: string; author_user_id: string | null; from_email: string | null;
    is_staff: boolean; body: string; created_at: string;
  }> = [];

  for (const ticketDoc of ticketsSnap.docs) {
    const newTicketId = ticketIdMap[ticketDoc.id];
    if (!newTicketId) { continue; }

    const repliesSnap = await ticketDoc.ref.collection("replies").get();
    for (const replyDoc of repliesSnap.docs) {
      const d = replyDoc.data();
      const isStaff = d.isStaff === true || d.from === "support";

      let authorUserId: string | null = null;
      if (!isStaff) {
        // User replies stored the Firestore uid implicitly (ticket owner) -
        // there's no per-reply userId field, so resolve via the ticket's own
        // userId instead.
        const ticketUserId = ticketDoc.data().userId as string | undefined;
        authorUserId = ticketUserId ? (uidMap.get(ticketUserId) ?? null) : null;
        if (!authorUserId) { skippedNoUser++; continue; }
      }

      rows.push({
        ticket_id: newTicketId,
        author_user_id: authorUserId,
        from_email: d.fromEmail ?? null,
        is_staff: isStaff,
        body: d.message ?? "",
        created_at: toISO(d.createdAt) ?? new Date().toISOString(),
      });
    }
  }
  skippedNoTicket = ticketsSnap.docs.filter((d) => !ticketIdMap[d.id]).length;

  console.log(`${rows.length} valid reply rows to insert (${skippedNoTicket} tickets skipped - not migrated, ${skippedNoUser} user replies skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin.from("support_ticket_replies").insert(rows, { count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
