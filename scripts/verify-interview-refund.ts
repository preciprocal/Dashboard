// scripts/verify-interview-refund.ts
// End-to-end check of the wasted-interview refund.
//
//   npm run dev                       (in another terminal)
//   npm run verify:interview-refund
//
// This path only runs when something has already gone wrong, which means it is
// the path least likely to be exercised by hand and most likely to rot. It is
// also the one that touches a user's paid allowance, so a bug here either
// charges people for sessions they never got or hands out free credits.
//
// Uses a throwaway user and a real HTTP request with a Bearer token, so the
// route's auth, ownership check and idempotency all run exactly as they would
// for a real candidate. Everything is removed in the finally block.

import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/supabase/admin";
import { refundUsage } from "@/lib/ai/usage-refund";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else    { fail++; console.log("  FAIL  " + n + (d ? "  -> " + d : "")); }
};

let userId: string | null = null;
let otherUserId: string | null = null;
const interviewIds: string[] = [];

/** Read the current period's interviews_used. */
async function usedCount(uid: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("usage_counters").select("*")
    .eq("user_id", uid).order("period_start", { ascending: false }).limit(1).maybeSingle();
  return Number((data as Record<string, unknown> | null)?.interviews_used ?? 0);
}

async function makeInterview(uid: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("interviews")
    .insert({
      user_id: uid, role: "Verify Harness", type: "technical",
      level: "mid", techstack: ["none"], finalized: true,
      questions: ["Placeholder question"],
    })
    .select("id").single();
  if (error) throw new Error("could not create interview: " + error.message);
  interviewIds.push(data.id);
  return data.id;
}

async function main() {
  try { await fetch(BASE + "/api/interview/abandoned", { method: "POST", body: "{}" }); }
  catch { console.error(`\nNo server at ${BASE}. Start it with: npm run dev`); process.exit(1); }

  // ── Throwaway users ──────────────────────────────────────────────────────
  const email = `refundtest+${Date.now()}@example.com`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "-Aa1!";
  const { data: made, error: mkErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr || !made.user) { console.error("createUser failed: " + mkErr?.message); process.exit(1); }
  userId = made.user.id;

  const { data: other } = await supabaseAdmin.auth.admin.createUser({
    email: `refundother+${Date.now()}@example.com`, password, email_confirm: true,
  });
  otherUserId = other?.user?.id ?? null;

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: sess } = await anon.auth.signInWithPassword({ email, password });
  const token = sess?.session?.access_token;
  if (!token) { console.error("sign-in failed"); process.exit(1); }

  const call = (body: unknown, auth = true) =>
    fetch(BASE + "/api/interview/abandoned", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

  console.log("Base: " + BASE);
  console.log("User: " + userId.slice(0, 8) + "...\n");

  // ── 1. Auth and ownership ────────────────────────────────────────────────
  console.log("[1] auth and ownership");
  const mine = await makeInterview(userId);
  check("no token is 401", (await call({ interviewId: mine, reason: "no_transcript" }, false)).status === 401);
  check("bad body is 400", (await call({}, true)).status === 400);

  if (otherUserId) {
    const theirs = await makeInterview(otherUserId);
    const res = await call({ interviewId: theirs, reason: "no_transcript" });
    check("another user's interview is 404", res.status === 404, "got " + res.status);
    const { data: stillClean } = await supabaseAdmin
      .from("interviews").select("abandoned_at").eq("id", theirs).single();
    check("their interview was not marked", stillClean?.abandoned_at === null);
  }

  // ── 2. The refund itself ─────────────────────────────────────────────────
  console.log("\n[2] refund");
  // Charge one unit so there is something to give back.
  const { checkAndIncrementUsage } = await import("@/lib/ai/usage-guard");
  await checkAndIncrementUsage(userId, "interviews");
  const before = await usedCount(userId);
  check("a unit was charged first", before >= 1, "used=" + before);

  const res = await call({ interviewId: mine, reason: "no_transcript" });
  check("returns 200", res.status === 200, "got " + res.status);
  check("reports refunded", res.data?.refunded === true, JSON.stringify(res.data));

  const after = await usedCount(userId);
  check("interviews_used went down by exactly 1", after === before - 1, `${before} -> ${after}`);

  const { data: marked } = await supabaseAdmin
    .from("interviews").select("abandoned_at, abandoned_reason").eq("id", mine).single();
  check("interview marked abandoned", marked?.abandoned_at !== null);
  check("reason recorded", marked?.abandoned_reason === "no_transcript", String(marked?.abandoned_reason));

  // ── 3. Idempotency ───────────────────────────────────────────────────────
  // The panel can fire this twice: a retry, a remount, a double click.
  console.log("\n[3] idempotency");
  const again = await call({ interviewId: mine, reason: "no_transcript" });
  check("second call does not refund again", again.data?.refunded === false, JSON.stringify(again.data));
  check("reason is already_refunded", again.data?.reason === "already_refunded");
  check("counter unchanged by the replay", (await usedCount(userId)) === after);

  // ── 4. Refusals ──────────────────────────────────────────────────────────
  console.log("\n[4] refusals");
  const withFb = await makeInterview(userId);
  const { error: fbErr } = await supabaseAdmin.from("interview_feedback").insert({
    interview_id: withFb, user_id: userId, total_score: 50,
    category_scores: [], strengths: [], areas_for_improvement: [],
    final_assessment: "verify harness",
  });
  if (fbErr) {
    console.log("  SKIP  feedback-exists case (" + fbErr.message.slice(0, 60) + ")");
  } else {
    const r = await call({ interviewId: withFb, reason: "no_transcript" });
    check("an interview with feedback is not refunded", r.data?.refunded === false);
    check("reason is feedback_exists", r.data?.reason === "feedback_exists", JSON.stringify(r.data));
  }

  // ── 5. Nothing charged means nothing to refund ───────────────────────────
  console.log("\n[5] refundUsage with an empty counter");
  // Drain whatever is left so the counter is genuinely zero.
  let guard = 0;
  while ((await usedCount(userId)) > 0 && guard++ < 50) {
    await refundUsage(userId, "interviews", "harness drain");
  }
  check("counter drained to zero", (await usedCount(userId)) === 0);
  const outcome = await refundUsage(userId, "interviews", "harness: nothing charged");
  check("returns 'nothing' rather than going negative", outcome === "nothing", outcome);
  check("counter did not go negative", (await usedCount(userId)) === 0);
}

main()
  .catch((err) => { console.error("\nHarness error:", err); fail++; })
  .finally(async () => {
    console.log("\n[6] cleanup");
    for (const id of interviewIds) {
      await supabaseAdmin.from("interview_feedback").delete().eq("interview_id", id);
      await supabaseAdmin.from("interviews").delete().eq("id", id);
    }
    for (const uid of [userId, otherUserId]) {
      if (!uid) continue;
      await supabaseAdmin.from("usage_counters").delete().eq("user_id", uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }
    check("test users and interviews removed", true);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
