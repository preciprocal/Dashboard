// scripts/verify-pack-webhook.ts
// Drives real, correctly-signed Stripe events at the live webhook route.
//
//   npm run dev                     (in another terminal)
//   npm run verify:pack-webhook
//
// Why this exists separately from verify:pack-purchase: that script tests
// grantPack() by calling it directly, which leaves the entire webhook route
// untested - signature verification, event routing, metadata extraction, the
// mode and payment_status guards, and the PaymentIntent lookup. Those only run
// when a signed event arrives over HTTP, and until this script existed the
// first time they would ever have run was against a real customer payment.
//
// The signature is produced by stripe.webhooks.generateTestHeaderString with
// the real STRIPE_WEBHOOK_SECRET, so constructEvent validates it exactly as it
// would a genuine delivery. Nothing is stubbed and no check is bypassed.
//
// WRITES TO THE CONFIGURED DATABASE. Rows are tagged with PI_PREFIX and removed
// in a finally block. It never contacts Stripe at all - the events are built
// locally - so it cannot touch a real charge.

import Stripe from "stripe";
import { supabaseAdmin } from "@/supabase/admin";
import { PACKS, packAmountCents, type PackKey } from "@/lib/config/packs";

const PI_PREFIX  = "pi_webhookharness_";
const WEBHOOK_URL = process.env.VERIFY_WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-07-30.basil" });
const secret = process.env.STRIPE_WEBHOOK_SECRET!;

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else    { fail++; console.log("  FAIL  " + name + (detail ? "  -> " + detail : "")); }
}

/** A checkout.session.completed event shaped like a real one. */
function buildEvent(opts: {
  packKey?: string;
  userId?: string;
  paymentIntent?: string | null;
  amountTotal?: number;
  mode?: string;
  paymentStatus?: string;
}) {
  const metadata: Record<string, string> = {};
  if (opts.packKey) metadata.packKey = opts.packKey;
  if (opts.userId)  metadata.userId  = opts.userId;

  return {
    id: "evt_" + Math.random().toString(36).slice(2, 14),
    object: "event",
    api_version: "2025-07-30.basil",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: "cs_test_" + Math.random().toString(36).slice(2, 14),
        object: "checkout.session",
        mode: opts.mode ?? "payment",
        payment_status: opts.paymentStatus ?? "paid",
        status: "complete",
        // Stripe sends this unexpanded, as a bare id string. The handler must
        // cope with that rather than assuming an expanded object.
        payment_intent: opts.paymentIntent === undefined
          ? PI_PREFIX + Date.now() + Math.floor(Math.random() * 1000)
          : opts.paymentIntent,
        amount_total: opts.amountTotal ?? 499,
        currency: "usd",
        customer: "cus_test_harness",
        metadata,
      },
    },
  };
}

async function post(event: object, opts: { badSignature?: boolean } = {}) {
  const payload   = JSON.stringify(event);
  const signature = opts.badSignature
    ? "t=1,v1=" + "0".repeat(64)
    : stripe.webhooks.generateTestHeaderString({ payload, secret });

  const res  = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": signature },
    body: payload,
  });
  const body = await res.text();
  return { status: res.status, body };
}

const rowFor = async (pi: string) =>
  (await supabaseAdmin.from("credit_packs").select("*").eq("stripe_payment_intent_id", pi).maybeSingle()).data;

async function main() {
  // Fail loudly rather than reporting phantom passes against a dead port.
  try {
    await fetch(WEBHOOK_URL, { method: "POST", body: "{}" });
  } catch {
    console.error(`\nNo server at ${WEBHOOK_URL}. Start it with: npm run dev`);
    process.exit(1);
  }

  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
  const userId = users?.users?.[0]?.id;
  if (!userId) { console.error("No users in auth.users."); process.exit(1); }
  console.log("Webhook: " + WEBHOOK_URL);
  console.log("User:    " + userId.slice(0, 8) + "...\n");

  // ── 1. Signature verification ────────────────────────────────────────────
  console.log("[1] signature");
  const bad = await post(buildEvent({ packKey: "application_boost", userId }), { badSignature: true });
  check("forged signature rejected with 400", bad.status === 400, "got " + bad.status + " " + bad.body);

  // ── 2. The happy path ────────────────────────────────────────────────────
  console.log("\n[2] a real purchase event");
  const pk: PackKey = "application_boost";
  const pi = PI_PREFIX + "happy" + Date.now();
  const ok = await post(buildEvent({
    packKey: pk, userId, paymentIntent: pi, amountTotal: packAmountCents(pk),
  }));
  check("accepted with 200", ok.status === 200, "got " + ok.status + " " + ok.body);

  const row = await rowFor(pi);
  check("credit_packs row created", !!row);
  if (row) {
    check("granted matches the catalog",
      JSON.stringify(row.granted) === JSON.stringify(PACKS[pk].grants), JSON.stringify(row.granted));
    check("belongs to the right user", row.user_id === userId);
    check("price_cents from amount_total", row.price_cents === packAmountCents(pk));
    check("pack_key recorded", row.pack_key === pk);
  }

  // ── 3. Redelivery ────────────────────────────────────────────────────────
  // Stripe retries on its own schedule and re-sends everything when an endpoint
  // is re-pointed. Granting twice would be giving away paid credits.
  console.log("\n[3] redelivery");
  const again = await post(buildEvent({
    packKey: pk, userId, paymentIntent: pi, amountTotal: packAmountCents(pk),
  }));
  check("second delivery still 200", again.status === 200, "got " + again.status);

  const { data: dupes } = await supabaseAdmin
    .from("credit_packs").select("id").eq("stripe_payment_intent_id", pi);
  check("still exactly one row", (dupes?.length ?? 0) === 1, "found " + (dupes?.length ?? 0));

  // ── 4. Events that must NOT grant ────────────────────────────────────────
  console.log("\n[4] events that must not grant");

  const unpaidPi = PI_PREFIX + "unpaid" + Date.now();
  const unpaid = await post(buildEvent({
    packKey: pk, userId, paymentIntent: unpaidPi, paymentStatus: "unpaid",
  }));
  check("unpaid session returns 200", unpaid.status === 200);
  check("unpaid session granted nothing", !(await rowFor(unpaidPi)));

  const subPi = PI_PREFIX + "submode" + Date.now();
  const subMode = await post(buildEvent({
    packKey: pk, userId, paymentIntent: subPi, mode: "subscription",
  }));
  check("subscription-mode session returns 200", subMode.status === 200);
  check("subscription-mode granted nothing", !(await rowFor(subPi)));

  const noMetaPi = PI_PREFIX + "nometa" + Date.now();
  const noMeta = await post(buildEvent({ userId, paymentIntent: noMetaPi }));
  check("missing packKey returns 200", noMeta.status === 200);
  check("missing packKey granted nothing", !(await rowFor(noMetaPi)));

  const badPackPi = PI_PREFIX + "badpack" + Date.now();
  const badPack = await post(buildEvent({
    packKey: "not_a_real_pack", userId, paymentIntent: badPackPi,
  }));
  check("unknown pack key returns 200", badPack.status === 200);
  check("unknown pack key granted nothing", !(await rowFor(badPackPi)));

  // No payment_intent means the unique index cannot dedupe, so the handler
  // must refuse rather than insert an ungated row.
  const noPi = await post(buildEvent({ packKey: pk, userId, paymentIntent: null }));
  check("missing payment_intent returns 200", noPi.status === 200);

  // ── 5. Price drift still grants, on the charged amount ───────────────────
  // If Stripe and the catalog disagree the customer has already paid, so the
  // credits must still be issued; the mismatch is a logged warning, not a
  // refusal that silently keeps their money.
  console.log("\n[5] price drift");
  const driftPi = PI_PREFIX + "drift" + Date.now();
  const drift = await post(buildEvent({
    packKey: pk, userId, paymentIntent: driftPi, amountTotal: 999,
  }));
  check("drifted amount still 200", drift.status === 200);
  const driftRow = await rowFor(driftPi);
  check("drifted purchase still granted", !!driftRow);
  check("records what was actually charged", driftRow?.price_cents === 999, String(driftRow?.price_cents));
}

main()
  .catch((err) => { console.error("\nHarness error:", err); fail++; })
  .finally(async () => {
    const { data: deleted } = await supabaseAdmin
      .from("credit_packs").delete()
      .like("stripe_payment_intent_id", PI_PREFIX + "%").select("id");
    console.log("\n[6] cleanup: deleted " + (deleted?.length ?? 0) + " rows");

    const { data: left } = await supabaseAdmin
      .from("credit_packs").select("id").like("stripe_payment_intent_id", PI_PREFIX + "%");
    check("no test rows left behind", (left?.length ?? 0) === 0);

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
