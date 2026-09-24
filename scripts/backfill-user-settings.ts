// scripts/backfill-user-settings.ts
// Phase 3e: copy Firestore's `users/{uid}/settings/app_settings` docs into
// Postgres `user_settings`, remapping the legacy Firebase uid to the real
// Supabase auth UUID.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-user-settings.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-user-settings.ts -- --commit    -> write
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

  const uidMap = await buildFirebaseUidToSupabaseIdMap();
  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} Firestore users docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;
  let skippedNoSettings = 0;
  const rows: Array<{ user_id: string; settings: Record<string, unknown>; updated_at: string }> = [];

  for (const userDoc of usersSnap.docs) {
    const settingsSnap = await userDoc.ref.collection("settings").doc("app_settings").get();
    if (!settingsSnap.exists) { skippedNoSettings++; continue; }

    const supabaseUserId = uidMap.get(userDoc.id) ?? null;
    if (!supabaseUserId) { skippedNoUser++; continue; }

    const data = settingsSnap.data()!;
    const { updatedAt, ...settings } = data;
    rows.push({
      user_id: supabaseUserId,
      settings,
      updated_at: toISO(updatedAt) ?? new Date().toISOString(),
    });
  }

  console.log(`${rows.length} valid rows to insert (${skippedNoSettings} users skipped - no app_settings doc, ${skippedNoUser} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin.from("user_settings").upsert(rows, { onConflict: "user_id", count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  console.log(`✅ Inserted/updated ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
