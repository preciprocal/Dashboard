// scripts/backfill-interviews.ts
// Phase 3b/3c: copy Firestore's `interviews` collection into Postgres
// `interviews`, remapping the legacy Firebase uid to the real Supabase auth
// UUID. Firestore doc IDs here are Firestore auto-IDs (not UUIDs), so a fresh
// Postgres UUID is generated per row. The old-id -> new-id map is written to
// a JSON file so scripts/backfill-interview-feedback.ts (run afterward) can
// resolve `feedback.interviewId` references to the new interview rows.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-interviews.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-interviews.ts -- --commit    -> write
import crypto from "crypto";
import { writeFileSync } from "fs";
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
const ID_MAP_PATH = path.join(__dirname, ".interview-id-map.json");

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
    db.collection("interviews").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore interviews docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;
  const idMap: Record<string, string> = {};

  const rows = snap.docs.map((doc) => {
    const d = doc.data();

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId || d.userId === "anonymous") { skippedNoUser++; return null; }

    const newId = crypto.randomUUID();
    idMap[doc.id] = newId;

    return {
      id: newId,
      user_id: supabaseUserId,
      role: d.role ?? null,
      type: d.type ?? null,
      techstack: Array.isArray(d.techstack) ? d.techstack : [],
      level: d.level ?? null,
      duration: d.duration != null ? String(d.duration) : null,
      finalized: d.finalized === true,
      questions: d.questions ?? [],
      metadata: {
        technicalQuestions: d.technicalQuestions ?? undefined,
        behavioralQuestions: d.behavioralQuestions ?? undefined,
        questionCounts: d.questionCounts ?? undefined,
        interviewMetadata: d.interviewMetadata ?? undefined,
        coverImage: d.coverImage ?? undefined,
        templateId: d.templateId ?? undefined,
        templateName: d.templateName ?? undefined,
        category: d.category ?? undefined,
        difficulty: d.difficulty ?? undefined,
        rating: d.rating ?? undefined,
        completions: d.completions ?? undefined,
        tags: d.tags ?? undefined,
        fromTemplate: d.fromTemplate ?? undefined,
      },
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
      updated_at: toISO(d.updatedAt) ?? toISO(d.createdAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user or anonymous)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 1), null, 2)?.slice(0, 1500));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabaseAdmin.from("interviews").insert(chunk, { count: "exact" });
    if (error) { console.error(`❌ Insert failed at offset ${i}:`, error); process.exit(1); }
    inserted += count ?? chunk.length;
  }

  writeFileSync(ID_MAP_PATH, JSON.stringify(idMap, null, 2));
  console.log(`✅ Inserted ${inserted} rows`);
  console.log(`✅ Wrote id map (${Object.keys(idMap).length} entries) to ${ID_MAP_PATH}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
