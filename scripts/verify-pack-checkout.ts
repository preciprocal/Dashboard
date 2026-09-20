// scripts/verify-pack-checkout.ts
// Exercises app/api/packs/purchase as a signed-in user.
//
//   PACKS_CHECKOUT_ENABLED=true npm run dev     (in another terminal)
//   npm run verify:pack-checkout
//
// The other two scripts leave this route's authenticated path untested:
// verify:pack-purchase calls the config and Stripe directly, and
// verify:pack-webhook starts after payment. Nothing had ever run the customer
// lookup, the Stripe Price verification or the Checkout Session creation
// through the route itself with a real session attached.
//
// Auth uses a throwaway user and a Bearer token rather than a browser cookie.
// getAuthedUser accepts Authorization: Bearer, so this reaches exactly the same
// code path a signed-in request does.
//
// CREATES a temporary auth user, a Stripe test customer and Checkout Sessions.
// All are removed in the finally block; sessions are expired rather than left
// holding a PaymentIntent open.

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/supabase/admin";
import { PACKS, packAmountCents, type PackKey } from "@/lib/config/packs";

const BASE   = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-07-30.basil" });

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else    { fail++; console.log("  FAIL  " + name + (detail ? "  -> " + detail : "")); }
}

let testUserId: string | null = null;
let customerId: string | null = null;
const createdSessions: string[] = [];

async function main() {
  try { await fetch(BASE + "/api/packs/quote"); }
  catch { console.error(`\nNo server at ${BASE}. Start it with: npm run dev`); process.exit(1); }

  // ── A throwaway verified user ────────────────────────────────────────────
  const email    = `packtest+${Date.now()}@example.com`;
  const password = "Test-" + Math.random().toString(36).slice(2) + "-Aa1!";

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr || !created.user) {
    console.error("Could not create the test user:", createErr?.message);
    process.exit(1);
  }
  testUserId = created.user.id;
  console.log("Base: " + BASE);
  console.log("Test user: " + testUserId.slice(0, 8) + "...\n");

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: session, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  const token = session?.session?.access_token;
  if (signInErr || !token) {
    console.error("Could not sign in as the test user:", signInErr?.message);
    process.exit(1);
  }

  const purchase = async (body: unknown, withAuth = true) => {
    const res = await fetch(BASE + "/api/packs/purchase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(withAuth ? { Authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  // Checked before the kill switch, because the route rejects anonymous callers
  // first either way: an unauthenticated scan must not be able to learn which
  // features are switched off.
  console.log("[1] auth");
  check("no token is 401", (await purchase({ packKey: "starter_pack" }, false)).status === 401);

  // ── 2. Either the kill switch is on, or every pack sells ─────────────────
  //
  // Both are valid states, so the script checks whichever one the server is in
  // rather than failing. Run it once with PACKS_CHECKOUT_ENABLED=true and once
  // without to cover both.
  //
  // Body validation is deliberately NOT asserted in the disabled branch. The
  // route returns 503 before it parses the body, which is the right order: a
  // switched-off endpoint should not be doing work, and it should answer the
  // same way whatever is posted to it.
  const probe = await purchase({ packKey: "starter_pack" });
  if (probe.status === 503 && probe.data?.code === "CHECKOUT_DISABLED") {
    console.log("\n[2] checkout is DISABLED on this server");
    check("503 rather than a crash or a silent 200", true);
    check("carries a machine-readable code", probe.data.code === "CHECKOUT_DISABLED");
    check("carries a message fit to show a user", typeof probe.data.error === "string" && probe.data.error.length > 0,
      JSON.stringify(probe.data.error));

    const { data: leaked } = await supabaseAdmin
      .from("credit_packs").select("id").eq("user_id", testUserId);
    check("nothing was granted while disabled", (leaked?.length ?? 0) === 0);
    console.log("\n  Re-run with PACKS_CHECKOUT_ENABLED=true to test the selling path.");
    return;
  }

  // The probe opened a real session; register it so cleanup expires it too.
  if (probe.status === 200 && probe.data?.sessionId) createdSessions.push(probe.data.sessionId);

  console.log("\n[2] input validation");
  const unknown = await purchase({ packKey: "definitely_not_a_pack" });
  check("unknown pack key is 400", unknown.status === 400, "got " + unknown.status);

  const empty = await purchase({});
  check("missing packKey is 400", empty.status === 400, "got " + empty.status);

  // Each one is checked against Stripe rather than trusting the 200: the route
  // could return a session for the wrong price and still look healthy.
  console.log("\n[3] a real Checkout Session per pack");
  for (const key of Object.keys(PACKS) as PackKey[]) {
    const res = await purchase({ packKey: key });

    if (res.status !== 200 || !res.data?.url) {
      check(key + " returns a checkout url", false,
        "status " + res.status + " " + JSON.stringify(res.data));
      continue;
    }
    check(key + " returns a checkout url", true);
    createdSessions.push(res.data.sessionId);

    const s = await stripe.checkout.sessions.retrieve(res.data.sessionId);
    if (typeof s.customer === "string") customerId = s.customer;

    check(key + " charges the catalog price", s.amount_total === packAmountCents(key),
      `${s.amount_total} vs ${packAmountCents(key)}`);
    check(key + " is a one-time payment session", s.mode === "payment");
    // Without both of these the webhook cannot tell who bought what, and the
    // payment succeeds while the credits never arrive.
    check(key + " metadata carries packKey", s.metadata?.packKey === key);
    check(key + " metadata carries userId", s.metadata?.userId === testUserId);
    check(key + " is attached to a customer", typeof s.customer === "string");
    check(key + " url points at Stripe Checkout",
      typeof res.data.url === "string" && res.data.url.includes("stripe.com"));
  }

  // ── 3. The customer is reused, not recreated ─────────────────────────────
  // A fresh Stripe customer per purchase would scatter one person's billing
  // history across many records.
  console.log("\n[4] customer reuse");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions").select("stripe_customer_id").eq("user_id", testUserId).maybeSingle();
  check("customer id persisted to subscriptions", !!sub?.stripe_customer_id, JSON.stringify(sub));
  check("the same customer was reused for every pack",
    !!customerId && sub?.stripe_customer_id === customerId,
    `${sub?.stripe_customer_id} vs ${customerId}`);

  // ── 4. Nothing was granted yet ───────────────────────────────────────────
  // Starting checkout must not create credits; only a paid webhook does.
  console.log("\n[5] no credits before payment");
  const { data: rows } = await supabaseAdmin
    .from("credit_packs").select("id").eq("user_id", testUserId);
  check("no credit_packs rows exist yet", (rows?.length ?? 0) === 0, "found " + (rows?.length ?? 0));
}

main()
  .catch((err) => { console.error("\nHarness error:", err); fail++; })
  .finally(async () => {
    console.log("\n[6] cleanup");

    for (const id of createdSessions) {
      try { await stripe.checkout.sessions.expire(id); } catch { /* already expired */ }
    }
    console.log("  expired " + createdSessions.length + " checkout sessions");

    if (customerId) {
      try { await stripe.customers.del(customerId); console.log("  deleted stripe customer"); }
      catch (e) { console.log("  could not delete stripe customer: " + (e as Error).message); }
    }

    if (testUserId) {
      await supabaseAdmin.from("credit_packs").delete().eq("user_id", testUserId);
      await supabaseAdmin.from("subscriptions").delete().eq("user_id", testUserId);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(testUserId);
      check("test user removed", !error, error?.message);
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
