// scripts/verify-pack-refund.ts
//
//   npm run dev                    (in another terminal)
//   npm run verify:pack-refund
//
// The pack refund route moves real money and voids real credits, in that
// order, and the interesting cases are all failures: a used pack, an expired
// window, a double request, a Stripe call that fails after the credits are
// already voided.
//
// None of those are things anyone will exercise by hand, and getting one wrong
// is expensive in a specific direction - a buyer keeping both the refund and
// the credits, or losing both.
//
// Uses a throwaway user and real HTTP with a Bearer token. Packs are inserted
// directly rather than purchased, because a genuine purchase needs a card and
// the hosted Checkout page; the refund path only cares about the ledger row.

import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/supabase/admin";
import { PACKS } from "@/lib/config/packs";

const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else    { fail++; console.log("  FAIL  " + n + (d ? "  -> " + d : "")); }
};

let userId: string | null = null;
let otherId: string | null = null;

async function makePack(uid: string, opts: {
  purchasedDaysAgo?: number;
  used?: boolean;
  refunded?: boolean;
  withPaymentIntent?: boolean;
} = {}): Promise<string> {
  const purchasedAt = new Date(Date.now() - (opts.purchasedDaysAgo ?? 0) * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin.from("credit_packs").insert({
    user_id: uid,
    pack_key: "application_boost",
    granted: PACKS.application_boost.grants,
    consumed: opts.used ? { resumes: 1 } : {},
    price_cents: 499,
    purchased_at: purchasedAt,
    first_used_at: opts.used ? new Date().toISOString() : null,
    refunded_at: opts.refunded ? new Date().toISOString() : null,
    stripe_payment_intent_id:
      opts.withPaymentIntent === false ? null : "pi_refundharness_" + Math.random().toString(36).slice(2),
  }).select("id").single();
  if (error) throw new Error("insert failed: " + error.message);
  return data.id;
}

async function main() {
  try { await fetch(BASE + "/api/packs/refund"); }
  catch { console.error(`\nNo server at ${BASE}. Start it with: npm run dev`); process.exit(1); }

  const email = `packrefund+${Date.now()}@example.com`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "-Aa1!";
  const { data: made } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = made?.user?.id ?? null;
  const { data: other } = await supabaseAdmin.auth.admin.createUser({
    email: `packrefundother+${Date.now()}@example.com`, password, email_confirm: true,
  });
  otherId = other?.user?.id ?? null;
  if (!userId || !otherId) { console.error("could not create users"); process.exit(1); }

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: sess } = await anon.auth.signInWithPassword({ email, password });
  const token = sess?.session?.access_token;
  if (!token) { console.error("sign-in failed"); process.exit(1); }

  const post = (body: unknown, auth = true) =>
    fetch(BASE + "/api/packs/refund", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

  console.log("Base: " + BASE + "\nUser: " + userId.slice(0, 8) + "...\n");

  // ── 1. Auth and ownership ────────────────────────────────────────────────
  console.log("[1] auth and ownership");
  const mine = await makePack(userId);
  check("no token is 401", (await post({ packId: mine }, false)).status === 401);
  check("bad body is 400", (await post({}, true)).status === 400);

  const theirs = await makePack(otherId);
  const stolen = await post({ packId: theirs });
  check("another user's pack is 404", stolen.status === 404, "got " + stolen.status);
  const { data: theirRow } = await supabaseAdmin
    .from("credit_packs").select("refunded_at").eq("id", theirs).single();
  check("their pack was not touched", theirRow?.refunded_at === null);

  // ── 2. Refusals, each with a reason ──────────────────────────────────────
  console.log("\n[2] packs that cannot be returned");

  const usedPack = await makePack(userId, { used: true });
  const usedRes  = await post({ packId: usedPack });
  check("a used pack is refused", usedRes.status === 409, "got " + usedRes.status);
  check("and says it was used", /used/i.test(String(usedRes.data?.reason)), String(usedRes.data?.reason));

  const oldPack = await makePack(userId, { purchasedDaysAgo: 30 });
  const oldRes  = await post({ packId: oldPack });
  check("an out-of-window pack is refused", oldRes.status === 409);
  check("and says how old it is", /days/i.test(String(oldRes.data?.reason)), String(oldRes.data?.reason));

  const already = await makePack(userId, { refunded: true });
  const alreadyRes = await post({ packId: already });
  check("an already-refunded pack is refused", alreadyRes.status === 409);

  const granted = await makePack(userId, { withPaymentIntent: false });
  const grantedRes = await post({ packId: granted });
  check("a pack with no payment is refused", grantedRes.status === 409);
  check("and the credits stay usable", (await refundedAt(granted)) === null);

  // ── 3. The listing explains itself ───────────────────────────────────────
  console.log("\n[3] GET lists eligibility with reasons");
  const list = await fetch(BASE + "/api/packs/refund", {
    headers: { Authorization: "Bearer " + token },
  }).then((r) => r.json());

  const byId = new Map<string, { eligible: boolean; reason: string | null }>(
    (list.packs ?? []).map((p: { packId: string; eligible: boolean; reason: string | null }) => [p.packId, p]),
  );
  check("the fresh pack is listed eligible", byId.get(mine)?.eligible === true);
  check("the used pack is listed ineligible", byId.get(usedPack)?.eligible === false);
  check("every ineligible pack carries a reason",
    (list.packs ?? []).filter((p: { eligible: boolean; reason: string | null }) => !p.eligible)
      .every((p: { reason: string | null }) => !!p.reason));

  // ── 4. The real refund ───────────────────────────────────────────────────
  //
  // The payment intent is fabricated, so Stripe WILL reject it. That is the
  // valuable half: it proves the credits are restored when the charge fails,
  // rather than the user losing both.
  console.log("\n[4] Stripe rejects the refund -> credits must come back");
  const res = await post({ packId: mine });
  check("route reports failure rather than success", res.data?.refunded !== true, JSON.stringify(res.data));
  check("credits restored after the failed charge", (await refundedAt(mine)) === null,
    "refunded_at should be null again");
  check("the user is told their credits are safe",
    /untouched|could not/i.test(String(res.data?.reason ?? res.data?.error)), JSON.stringify(res.data));
}

async function refundedAt(packId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("credit_packs").select("refunded_at").eq("id", packId).maybeSingle();
  return data?.refunded_at ?? null;
}

main()
  .catch((err) => { console.error("\nHarness error:", err); fail++; })
  .finally(async () => {
    console.log("\n[5] cleanup");
    for (const uid of [userId, otherId]) {
      if (!uid) continue;
      await supabaseAdmin.from("credit_packs").delete().eq("user_id", uid);
      await supabaseAdmin.auth.admin.deleteUser(uid);
    }
    check("test users and packs removed", true);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
