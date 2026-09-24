// scripts/backfill-newsletter-subscribers.ts
// Phase 3a: one-time copy of the Firestore `newsletter_subscribers`
// collection into the Postgres table of the same name. Safe to re-run
// (upserts on the unique `email` column).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-newsletter-subscribers.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-newsletter-subscribers.ts -- --commit    -> write
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

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const snap = await db.collection("newsletter_subscribers").get();
  console.log(`Found ${snap.size} Firestore newsletter_subscribers docs`);

  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      email: (d.email as string)?.toLowerCase().trim(),
      subscribed: d.status ? d.status === "active" : true,
      source: (d.source as string) ?? null,
      created_at: d.subscribedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    };
  }).filter((r) => !!r.email);

  console.log(`${rows.length} valid rows to upsert`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 3), null, 2));
    return;
  }

  const { error, count } = await supabaseAdmin
    .from("newsletter_subscribers")
    .upsert(rows, { onConflict: "email", ignoreDuplicates: false, count: "exact" });

  if (error) {
    console.error("❌ Upsert failed:", error);
    process.exit(1);
  }

  console.log(`✅ Upserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
