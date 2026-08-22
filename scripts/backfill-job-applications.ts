// scripts/backfill-job-applications.ts
// Phase 3b: copy Firestore's `jobApplications` collection into Postgres
// `job_applications`, remapping the legacy Firebase uid to the real
// Supabase auth UUID. Rows with no mappable user are skipped (NOT NULL FK).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-job-applications.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-job-applications.ts -- --commit    -> write
import { db } from "../firebase/admin";
import { supabaseAdmin } from "../supabase/admin";

const COMMIT = process.argv.includes("--commit");

const VALID_STATUSES = new Set([
  'wishlist','applied','phone-screen','technical',
  'final','offer','rejected','ghosted','withdrew',
]);
const LEGACY_STATUS_MAP: Record<string, string> = {
  'Applied': 'applied', 'Under Review': 'applied', 'Interview': 'phone-screen',
  'Offer': 'offer', 'Rejected': 'rejected', 'Withdrawn': 'withdrew',
};
const VALID_WORK_TYPES = new Set(['remote', 'hybrid', 'onsite']);

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

function toISO(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const [snap, uidMap] = await Promise.all([
    db.collection("jobApplications").get(),
    buildFirebaseUidToSupabaseIdMap(),
  ]);
  console.log(`Found ${snap.size} Firestore jobApplications docs, ${uidMap.size} legacy uid mappings`);

  let skipped = 0;
  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    const supabaseUserId = d.userId ? (uidMap.get(d.userId as string) ?? null) : null;
    if (!supabaseUserId) { skipped++; return null; }

    let status = (d.status as string) || "applied";
    if (!VALID_STATUSES.has(status) && LEGACY_STATUS_MAP[status]) status = LEGACY_STATUS_MAP[status];
    if (!VALID_STATUSES.has(status)) status = "applied";

    const workType = VALID_WORK_TYPES.has(d.workType) ? d.workType : "onsite";
    const appliedDate = d.appliedDate
      || (typeof d.appliedAt === "string" ? d.appliedAt.split("T")[0] : null)
      || new Date().toISOString().split("T")[0];

    return {
      user_id: supabaseUserId,
      company: d.company || "",
      job_title: d.jobTitle || "",
      job_url: d.jobUrl ?? null,
      location: d.location ?? null,
      salary: d.salary ?? null,
      work_type: workType,
      source: d.source ?? null,
      notes: d.notes ?? null,
      status,
      applied_date: appliedDate,
      linkedin_job_id: d.linkedInJobId ?? null,
      created_at: toISO(d.createdAt),
      updated_at: toISO(d.updatedAt),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  console.log(`${rows.length} valid rows to insert (${skipped} skipped - no mappable Supabase user)`);

  if (!COMMIT) {
    console.log("Sample:", JSON.stringify(rows.slice(0, 2), null, 2));
    return;
  }

  if (rows.length === 0) { console.log("Nothing to insert."); return; }

  const { error, count } = await supabaseAdmin
    .from("job_applications")
    .insert(rows, { count: "exact" });

  if (error) {
    console.error("❌ Insert failed:", error);
    process.exit(1);
  }

  console.log(`✅ Inserted ${count ?? rows.length} rows`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
