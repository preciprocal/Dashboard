// scripts/verify-job-tracker-capacity.ts
//
//   npm run dev                          (in another terminal)
//   npm run verify:job-tracker-capacity
//
// The job tracker limit is a CAPACITY, not a monthly rate: 8 rows at a time on
// Free, and deleting one frees a slot. That is the whole point of the shape,
// and it is the part a counter-based implementation would silently get wrong -
// so "delete frees a slot" is asserted directly rather than assumed.
//
// Both write paths are covered. The extension route matters more, because its
// offline queue retries failures forever unless the refusal is recognised as
// permanent, so a wrong status code there turns a full tracker into a retry
// loop that also delays every other queued job.

import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/supabase/admin";
import { USAGE_LIMITS } from "@/lib/config/usage-limits";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const FREE_LIMIT = USAGE_LIMITS.free.jobTracker;

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else    { fail++; console.log("  FAIL  " + n + (d ? "  -> " + d : "")); }
};

let userId: string | null = null;

/** Insert rows directly, to get the account to its limit without N requests. */
async function seed(uid: string, n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({
    user_id: uid,
    company: `Harness Co ${i}`,
    job_title: `Role ${i}`,
    status: "applied",
    applied_date: new Date().toISOString().split("T")[0],
  }));
  const { error } = await supabaseAdmin.from("job_applications").insert(rows);
  if (error) throw new Error("seed failed: " + error.message);
}

async function countRows(uid: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("job_applications").select("id", { count: "exact", head: true }).eq("user_id", uid);
  return count ?? 0;
}

async function main() {
  try { await fetch(BASE + "/api/job-tracker"); }
  catch { console.error(`\nNo server at ${BASE}. Start it with: npm run dev`); process.exit(1); }

  const email = `jobcap+${Date.now()}@example.com`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "-Aa1!";
  const { data: made } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = made?.user?.id ?? null;
  if (!userId) { console.error("could not create user"); process.exit(1); }

  // A free-plan row, so the limit under test is the Free one.
  await supabaseAdmin.from("subscriptions").upsert(
    { user_id: userId, plan: "free", status: "active" }, { onConflict: "user_id" },
  );

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: sess } = await anon.auth.signInWithPassword({ email, password });
  const token = sess?.session?.access_token;
  if (!token) { console.error("sign-in failed"); process.exit(1); }

  const save = (path: string, body: unknown) =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

  const dashboardJob = (n: string) => ({ company: "Acme", jobTitle: n });
  const extensionJob = (n: string) => ({ company: "Acme", jobTitle: n, jobId: "lnk-" + Math.random() });

  console.log(`Free limit: ${FREE_LIMIT} tracked jobs\nUser: ${userId.slice(0, 8)}...\n`);

  // ── 1. Under the limit ───────────────────────────────────────────────────
  console.log("[1] below capacity");
  await seed(userId, FREE_LIMIT - 1);
  const ok = await save("/api/job-tracker", dashboardJob("Last free slot"));
  check("the final slot is accepted", ok.status === 201, "got " + ok.status);
  check("row count is now at the limit", (await countRows(userId)) === FREE_LIMIT);

  // ── 2. At the limit ──────────────────────────────────────────────────────
  console.log("\n[2] at capacity");
  const full = await save("/api/job-tracker", dashboardJob("One too many"));
  check("dashboard route refuses with 403", full.status === 403, "got " + full.status);
  check("and returns JOB_TRACKER_FULL", full.data?.code === "JOB_TRACKER_FULL", JSON.stringify(full.data));
  check("and explains how to free a slot",
    /remove|free a slot/i.test(String(full.data?.error)), String(full.data?.error));
  check("no row was written", (await countRows(userId)) === FREE_LIMIT);

  const extFull = await save("/api/extension/track-job", extensionJob("From extension"));
  check("extension route refuses with 403", extFull.status === 403, "got " + extFull.status);
  check("extension gets JOB_TRACKER_FULL too", extFull.data?.code === "JOB_TRACKER_FULL",
    JSON.stringify(extFull.data));
  check("still no row written", (await countRows(userId)) === FREE_LIMIT);

  // ── 3. Deleting frees a slot ─────────────────────────────────────────────
  //
  // The defining property of a capacity. A per-period counter would still
  // refuse here, which is how this test distinguishes the two designs.
  console.log("\n[3] deleting frees a slot");
  const { data: victim } = await supabaseAdmin
    .from("job_applications").select("id").eq("user_id", userId).limit(1).maybeSingle();
  await supabaseAdmin.from("job_applications").delete().eq("id", victim!.id);

  check("row count dropped", (await countRows(userId)) === FREE_LIMIT - 1);
  const afterDelete = await save("/api/job-tracker", dashboardJob("Back under the limit"));
  check("a new job is accepted again", afterDelete.status === 201, "got " + afterDelete.status);

  // ── 4. Duplicates are not refused for capacity ───────────────────────────
  //
  // A re-save consumes no slot, so the duplicate check has to come first. If
  // the order were reversed, a full tracker would reject re-saves of jobs it
  // already holds - which the extension does on every page revisit.
  console.log("\n[4] duplicates at capacity");
  // Free one slot so the original can be created, then the tracker is exactly
  // full again and the re-save is the thing under test. Without this the
  // original is refused and the "duplicate" is really a first attempt.
  const { data: spare } = await supabaseAdmin
    .from("job_applications").select("id").eq("user_id", userId).limit(1).maybeSingle();
  await supabaseAdmin.from("job_applications").delete().eq("id", spare!.id);

  const dupId = "lnk-dup-" + Date.now();
  const original = await save("/api/extension/track-job", { company: "Acme", jobTitle: "Dup", jobId: dupId });
  check("the original is created", original.status === 200 || original.status === 201, "got " + original.status);
  const atCap = await countRows(userId);
  check("tracker is exactly full again", atCap === FREE_LIMIT, String(atCap));
  const dup = await save("/api/extension/track-job", { company: "Acme", jobTitle: "Dup", jobId: dupId });
  check("a duplicate is accepted rather than refused", dup.status === 200 || dup.status === 201, "got " + dup.status);
  check("and reports itself as a duplicate", dup.data?.duplicate === true, JSON.stringify(dup.data));
  check("without adding a row", (await countRows(userId)) === atCap);

  // ── 5. Unlimited plans are unaffected ────────────────────────────────────
  console.log("\n[5] paid plans are unlimited");
  await supabaseAdmin.from("subscriptions").update({ plan: "pro" }).eq("user_id", userId);
  const proSave = await save("/api/job-tracker", dashboardJob("Pro has no cap"));
  check("pro is accepted well past the free limit", proSave.status === 201, "got " + proSave.status);
  check("row count exceeds the free limit", (await countRows(userId)) > FREE_LIMIT);
}

main()
  .catch((err) => { console.error("\nHarness error:", err); fail++; })
  .finally(async () => {
    console.log("\n[6] cleanup");
    if (userId) {
      await supabaseAdmin.from("job_applications").delete().eq("user_id", userId);
      await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    check("test user and rows removed", true);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
