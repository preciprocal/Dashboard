// scripts/backfill-newsletter-subscribers.ts
// Phase 3a: one-time copy of the Firestore `newsletter_subscribers`
// collection into the Postgres table of the same name. Safe to re-run
// (upserts on the unique `email` column).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-newsletter-subscribers.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-newsletter-subscribers.ts -- --commit    -> write
import { db } from "../firebase/admin";
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
