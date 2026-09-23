// app/api/packs/refund/route.ts
// Refund an unused credit pack, in Stripe and in the ledger, together.
//
// ─── Why both halves must happen in one place ───────────────────────────────
//
// Before this there was no pack refund path at all. pack_refund_eligible()
// existed in migration 0030 with zero callers, and app/api/refund/request is
// subscription-only, so the only way to refund a pack was the Stripe
// dashboard. That returns the money and leaves credit_packs untouched: the
// buyer keeps every credit they were refunded for, and nothing anywhere
// reports it.
//
// ─── The eligibility rule, and why it is strict ─────────────────────────────
//
// Unused only, inside a window. first_used_at is set by consume_pack_credit on
// the first draw and never cleared, so "unused" is a fact rather than a
// judgement. FIFO consumption is oldest-first specifically so that spending
// does not quietly destroy refundability on the newest purchase.
//
// Partial refunds are deliberately not offered. A pack is a bundle bought at a
// bundle price, and refunding 7 of 10 resume analyses means deciding what the
// other 3 cost - which the pack price does not say, because the packs are
// priced by position rather than by unit.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import { PACKS, type PackKey } from "@/lib/config/packs";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

/** How long after purchase a pack can be returned. */
export const PACK_REFUND_WINDOW_DAYS = 7;

const schema = z.object({ packId: z.string().uuid() });

interface PackRow {
  id: string;
  user_id: string;
  pack_key: string;
  price_cents: number;
  purchased_at: string;
  first_used_at: string | null;
  refunded_at: string | null;
  stripe_payment_intent_id: string | null;
  consumed: Record<string, number> | null;
}

/** GET: which packs can be returned, and why the others cannot. */
export async function GET(req: NextRequest) {
  const authedUser = await getAuthedUser(req);
  if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: packs } = await supabaseAdmin
    .from("credit_packs")
    .select("*")
    .eq("user_id", authedUser.supabaseUserId)
    .order("purchased_at", { ascending: false })
    .limit(50);

  const items = (packs ?? []).map((p) => {
    const row = p as PackRow;
    const reason = ineligibilityReason(row);
    return {
      packId: row.id,
      packKey: row.pack_key,
      name: PACKS[row.pack_key as PackKey]?.name ?? row.pack_key,
      priceCents: row.price_cents,
      purchasedAt: row.purchased_at,
      used: row.first_used_at !== null,
      refundedAt: row.refunded_at,
      eligible: reason === null,
      // Shown to the user, so it explains rather than just refusing.
      reason,
    };
  });

  return NextResponse.json({ packs: items, windowDays: PACK_REFUND_WINDOW_DAYS });
}

/** POST: refund one pack. */
export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabaseUserId, userId } = authedUser;

    const rateLimited = await applyRateLimit(req, userId, "light");
    if (rateLimited) return rateLimited;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send { packId }" }, { status: 400 });
    }

    const { data: pack } = await supabaseAdmin
      .from("credit_packs").select("*").eq("id", parsed.data.packId).maybeSingle();

    // Same answer for missing and not-yours, so this cannot be used to probe
    // which pack ids exist.
    if (!pack || (pack as PackRow).user_id !== supabaseUserId) {
      return NextResponse.json({ error: "Pack not found." }, { status: 404 });
    }

    const row    = pack as PackRow;
    const reason = ineligibilityReason(row);
    if (reason) {
      return NextResponse.json({ refunded: false, reason }, { status: 409 });
    }

    if (!row.stripe_payment_intent_id) {
      // An admin grant or a migration backfill: there is no payment to return.
      return NextResponse.json(
        { refunded: false, reason: "This pack was not purchased, so there is nothing to refund." },
        { status: 409 },
      );
    }

    // ── Void the credits FIRST ───────────────────────────────────────────
    //
    // Order matters and this is the safe one. If the Stripe refund succeeded
    // first and this update then failed, the buyer would have their money AND
    // their credits. Doing it this way, a failure after the void leaves them
    // with neither for a moment, which support can reverse - and the guard
    // below turns that into a loud error rather than a silent one.
    //
    // `is("refunded_at", null)` makes it a compare-and-set: two concurrent
    // requests cannot both proceed to charge Stripe.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("credit_packs")
      .update({ refunded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("refunded_at", null)
      .select("id");

    if (claimErr || !claimed?.length) {
      return NextResponse.json({ refunded: false, reason: "Already refunded." }, { status: 409 });
    }

    try {
      const refund = await stripe.refunds.create({
        payment_intent: row.stripe_payment_intent_id,
        reason: "requested_by_customer",
        metadata: { packId: row.id, packKey: row.pack_key, userId: supabaseUserId },
      });

      console.log(`💸 Refunded pack ${row.id} (${row.pack_key}) for ${supabaseUserId}: ${refund.id}`);

      return NextResponse.json({
        refunded: true,
        amountCents: row.price_cents,
        refundId: refund.id,
      });
    } catch (stripeErr) {
      // Stripe refused. Put the credits back so the user is not left with
      // neither the money nor the pack.
      await supabaseAdmin
        .from("credit_packs")
        .update({ refunded_at: null, updated_at: new Date().toISOString() })
        .eq("id", row.id);

      console.error(`❌ Stripe refund failed for pack ${row.id}, credits restored:`, stripeErr);
      return NextResponse.json(
        { refunded: false, reason: "We could not process the refund. Your credits are untouched." },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("❌ pack refund error:", err);
    return NextResponse.json({ error: "Could not process that refund." }, { status: 500 });
  }
}

/**
 * Null when refundable, otherwise the sentence to show the user.
 *
 * Mirrors pack_refund_eligible() in migration 0030 rather than calling it,
 * because that function returns a bare boolean and this has to say WHY. The
 * conditions are identical and must stay that way; the SQL is the record of
 * intent, this is the same rule with an explanation attached.
 */
function ineligibilityReason(row: PackRow): string | null {
  if (row.refunded_at) return "This pack has already been refunded.";

  if (row.first_used_at) {
    const used = Object.entries(row.consumed ?? {})
      .filter(([, n]) => Number(n) > 0)
      .map(([k, n]) => `${n} ${k}`)
      .join(", ");
    return `This pack has been used${used ? ` (${used})` : ""}, so it can no longer be returned.`;
  }

  const ageMs   = Date.now() - new Date(row.purchased_at).getTime();
  const ageDays = ageMs / 86_400_000;
  if (ageDays > PACK_REFUND_WINDOW_DAYS) {
    return `Packs can be returned within ${PACK_REFUND_WINDOW_DAYS} days of purchase. This one was bought ${Math.floor(ageDays)} days ago.`;
  }

  return null;
}
