// scripts/backfill-interview-feedback.ts
// Phase 3b/3c: copy the interview-assessment subset of Firestore's
// polymorphic `feedback` collection into Postgres `interview_feedback`.
// The feature-rating subset (type:'feature-rating', written by
// app/api/user/feedback/route.ts and app/api/feedback/route.ts) is
// deliberately left in Firestore for the later Phase 3c `feature_ratings`
// migration - this script only touches docs that are unambiguously
// interview-assessment feedback (type==='interview-assessment', or no type
// field at all with the assessment shape, from before `type` was added).
//
// Run scripts/backfill-interviews.ts FIRST - this script reads the id map
// it writes to resolve `feedback.interviewId` to the new Postgres interview
// row. Feedback docs whose interview didn't migrate (unmappable user,
// anonymous, or the interview doc itself missing) are skipped, since
// interview_feedback.interview_id is NOT NULL.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-interview-feedback.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-interview-feedback.ts -- --commit    -> write
import { readFileSync } from "fs";
import path from "path";
import { db } from "../firebase/admin";
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

function isInterviewAssessment(d: FirebaseFirestore.DocumentData): boolean {
  if (d.type === "interview-assessment") return true;
  if (d.type === "feature-rating") return false;
  // No `type` field (pre-dates the polymorphic split) - identify by shape.
  return typeof d.totalScore === "number" && typeof d.interviewId === "string";
}

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  let interviewIdMap: Record<string, string>;
  try {
    interviewIdMap = JSON.parse(readFileSync(ID_MAP_PATH, "utf-8"));
  } catch {
    console.error(`❌ Could not read ${ID_MAP_PATH} - run scripts/backfill-interviews.ts --commit first.`);
    process.exit(1);
  }

  const [snap, uidMap] = await Promise.all([
    db.collection("feedback").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  const assessmentDocs = snap.docs.filter((doc) => isInterviewAssessment(doc.data()));
  console.log(`Found ${snap.size} Firestore feedback docs (${assessmentDocs.length} interview-assessment), ${uidMap.size} legacy uid mappings, ${Object.keys(interviewIdMap).length} interview id mappings`);

  let skippedNoUser = 0;
  let skippedNoInterview = 0;

  const rows = assessmentDocs.map((doc) => {
    const d = doc.data();

    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skippedNoUser++; return null; }

    const newInterviewId = interviewIdMap[d.interviewId as string];
    if (!newInterviewId) { skippedNoInterview++; return null; }

    let categoryScores: Record<string, number> = {};
    if (Array.isArray(d.categoryScores)) {
      (d.categoryScores as Array<{ name: string; score: number }>).forEach((c) => { categoryScores[c.name] = c.score; });
    } else if (d.categoryScores && typeof d.categoryScores === "object") {
      categoryScores = d.categoryScores as Record<string, number>;
    }

    return {
      interview_id: newInterviewId,
      user_id: supabaseUserId,
      total_score: d.totalScore ?? null,
      category_scores: categoryScores,
      strengths: Array.isArray(d.strengths) ? d.strengths : [],
      areas_for_improvement: Array.isArray(d.areasForImprovement) ? d.areasForImprovement : [],
      final_assessment: d.finalAssessment ?? null,
      created_at: toISO(d.createdAt) ?? new Date().toISOString(),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // interview_feedback has a unique (interview_id, user_id) constraint, but a
  // handful of interviews accumulated multiple Firestore feedback docs
  // (retakes, before feedbackId-reuse was added) - keep only the most recent.
  let dupesDropped = 0;
  const dedupedByKey = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const key = `${row.interview_id}:${row.user_id}`;
    const existing = dedupedByKey.get(key);
    if (!existing || row.created_at > existing.created_at) {
      if (existing) dupesDropped++;
      dedupedByKey.set(key, row);
    } else {
      dupesDropped++;
    }
  }
  const dedupedRows = [...dedupedByKey.values()];

  console.log(`${dedupedRows.length} valid rows to insert (${skippedNoUser} skipped - no mappable Supabase user, ${skippedNoInterview} skipped - source interview not migrated, ${dupesDropped} duplicate feedback docs for the same interview dropped)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(dedupedRows.slice(0, 2), null, 2));
    return;
  }

  if (dedupedRows.length === 0) { console.log("Nothing to insert."); return; }

  // (interview_id, user_id) is unique - upsert in case of a re-run.
  const { error, count } = await supabaseAdmin
    .from("interview_feedback")
    .upsert(dedupedRows, { onConflict: "interview_id,user_id", count: "exact" });
  if (error) { console.error("❌ Insert failed:", error); process.exit(1); }

  console.log(`✅ Inserted/updated ${count ?? dedupedRows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
