// scripts/backfill-users.ts
// Phase 3f (final domain): split Firestore's `users/{uid}` doc into Postgres
// `profiles` + `subscriptions`, remapping the legacy Firebase uid to the real
// Supabase auth UUID (via legacy_user_id_map).
//
// usage_counters is deliberately NOT backfilled here: the old Firestore
// `usage.*` counters were lifetime-cumulative, while the new usage_counters
// table resets every calendar month (see supabase/migrations/0015). There is
// no meaningful mapping from "lifetime total" to "used this month" - every
// account simply starts the current period at 0, which is what the
// increment_usage_counter RPC already does lazily on first use.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-users.ts               -> dry run
//   npx tsx --env-file=.env.local scripts/backfill-users.ts -- --commit    -> write
import { db } from "../firebase/admin";
import { supabaseAdmin } from "../supabase/admin";

const COMMIT = process.argv.includes("--commit");

// Fields that map onto the growing set of real profiles columns (Firestore
// camelCase -> Postgres snake_case). Everything else on the doc that isn't
// one of these (and isn't `subscription` or `serviceUsage`, handled
// separately) falls into profiles.extended_data, matching the split already
// implemented in app/api/profile/route.ts and app/api/extension/auto-apply/route.ts.
const PROFILE_COLUMN_MAP: Record<string, string> = {
  name: "name",
  email: "email",
  provider: "provider",
  phone: "phone",
  streetAddress: "street_address",
  city: "city",
  state: "state",
  bio: "bio",
  targetRole: "target_role",
  experienceLevel: "experience_level",
  preferredTech: "preferred_tech",
  careerGoals: "career_goals",
  linkedIn: "linked_in",
  github: "github",
  website: "website",
  resumePath: "resume_path",
  resumeFileName: "resume_file_name",
  transcriptPath: "transcript_path",
  transcriptFileName: "transcript_file_name",
  isAdmin: "is_admin",
};

// Doc-level keys that are handled outside the generic column/extended split.
const NON_EXTENDED_KEYS = new Set([
  ...Object.keys(PROFILE_COLUMN_MAP),
  "subscription", "serviceUsage", "createdAt", "updatedAt", "lastLogin",
  // Legacy fallbacks superseded by real columns / Storage paths - not carried forward.
  "location", "address", "resume", "transcript",
  // Lifetime-cumulative usage map - superseded by usage_counters' monthly
  // periods (see the module comment above); stale data, not carried forward.
  "usage", "limits",
]);

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

interface ProfileRow {
  user_id: string;
  [key: string]: unknown;
}

interface SubscriptionRow {
  user_id: string;
  [key: string]: unknown;
}

async function main() {
  console.log(COMMIT ? "⚠️  COMMIT MODE" : "🧪 DRY RUN (pass --commit to write)");

  const uidMap = await buildFirebaseUidToSupabaseIdMap();
  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.size} Firestore users docs, ${uidMap.size} legacy uid mappings`);

  let skippedNoUser = 0;
  let skippedNoEmail = 0;
  const profileRows: ProfileRow[] = [];
  const subscriptionRows: SubscriptionRow[] = [];

  for (const userDoc of usersSnap.docs) {
    const supabaseUserId = uidMap.get(userDoc.id) ?? null;
    if (!supabaseUserId) { skippedNoUser++; continue; }

    const data = userDoc.data();
    if (!data.email) { skippedNoEmail++; continue; } // profiles.email is not-null with no default

    // ── profiles ──
    // Every row in the batch must carry the same set of keys: supabase-js's
    // bulk upsert derives one shared column list for the whole batch, so a
    // key omitted on one row (because that Firestore doc lacked the field)
    // gets sent as an explicit NULL for that row rather than falling back to
    // the column's Postgres default - fatal for the not-null columns below.
    const profileRow: ProfileRow = {
      user_id: supabaseUserId,
      created_at: toISO(data.createdAt) ?? new Date().toISOString(),
      updated_at: toISO(data.updatedAt) ?? new Date().toISOString(),
      last_login: toISO(data.lastLogin ?? null),
      provider: (data.provider as string) || "email",
      is_admin: data.isAdmin === true,
      preferred_tech: Array.isArray(data.preferredTech) ? data.preferredTech : [],
    };

    for (const [key, column] of Object.entries(PROFILE_COLUMN_MAP)) {
      if (key === "provider" || key === "isAdmin" || key === "preferredTech") continue;
      profileRow[column] = data[key] ?? null;
    }

    const extendedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (NON_EXTENDED_KEYS.has(key)) continue;
      extendedData[key] = value;
    }
    if (data.serviceUsage !== undefined) extendedData.serviceUsage = data.serviceUsage;
    if (Object.keys(extendedData).length > 0) profileRow.extended_data = extendedData;

    profileRows.push(profileRow);

    // ── subscriptions ──
    const sub = data.subscription as Record<string, unknown> | undefined;
    if (sub) {
      subscriptionRows.push({
        user_id: supabaseUserId,
        plan: sub.plan || "free",
        status: sub.status || "active",
        stripe_customer_id: sub.stripeCustomerId ?? null,
        stripe_subscription_id: sub.stripeSubscriptionId ?? null,
        trial_ends_at: toISO(sub.trialEndsAt),
        current_period_end: toISO(sub.currentPeriodEnd),
        current_period_start: toISO(sub.currentPeriodStart),
        subscription_ends_at: toISO(sub.subscriptionEndsAt),
        canceled_at: toISO(sub.canceledAt),
        last_payment_at: toISO(sub.lastPaymentAt),
        student_verified: sub.studentVerified === true,
        student_edu_email: sub.studentEduEmail ?? null,
        student_verified_at: toISO(sub.studentVerifiedAt),
        created_at: toISO(sub.createdAt) ?? toISO(data.createdAt) ?? new Date().toISOString(),
        updated_at: toISO(sub.updatedAt) ?? new Date().toISOString(),
      });
    }
  }

  console.log(`${profileRows.length} profile rows, ${subscriptionRows.length} subscription rows to upsert (${skippedNoUser} docs skipped - no mappable Supabase user, ${skippedNoEmail} skipped - no email)`);

  if (!COMMIT) {
    console.log("Sample profile:", JSON.stringify(profileRows.slice(0, 2), null, 2));
    console.log("Sample subscription:", JSON.stringify(subscriptionRows.slice(0, 2), null, 2));
    return;
  }

  if (profileRows.length > 0) {
    const { error, count } = await supabaseAdmin.from("profiles").upsert(profileRows, { onConflict: "user_id", count: "exact" });
    if (error) { console.error("❌ Profiles upsert failed:", error); process.exit(1); }
    console.log(`✅ Upserted ${count ?? profileRows.length} profiles rows`);
  }

  if (subscriptionRows.length > 0) {
    const { error, count } = await supabaseAdmin.from("subscriptions").upsert(subscriptionRows, { onConflict: "user_id", count: "exact" });
    if (error) { console.error("❌ Subscriptions upsert failed:", error); process.exit(1); }
    console.log(`✅ Upserted ${count ?? subscriptionRows.length} subscriptions rows`);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
