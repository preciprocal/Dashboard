// lib/stripe/event-ledger.ts
// Makes a Stripe webhook event get handled exactly once.
//
// ─── Claim, handle, confirm ─────────────────────────────────────────────────
//
// The order matters and the obvious orders are both wrong.
//
// Marking an event handled AFTER the work, with no claim first, lets two
// concurrent deliveries of the same event both pass the "have I seen this?"
// check and both run. Stripe retries on its own schedule and will happily have
// two requests in flight.
//
// Marking it handled BEFORE the work means a handler that throws has already
// recorded success, so Stripe's retry is ignored and the event is lost
// silently - the worst outcome, because nothing anywhere says so.
//
// So: claim the id (the primary key rejects a second claimant), do the work,
// then confirm. If the work throws, release the claim so the retry can pick it
// up. A process that dies between claim and confirm leaves handled_at null,
// which the partial index makes findable.

import { supabaseAdmin } from "@/supabase/admin";

export type ClaimResult =
  /** This process owns the event and must handle it. */
  | "claimed"
  /** Already accepted by an earlier delivery. Skip the work, return 200. */
  | "duplicate"
  /** The ledger is unreachable. Handle anyway - see the note below. */
  | "unavailable";

/**
 * Take ownership of an event id.
 *
 * On a database failure this returns "unavailable" and the caller PROCESSES
 * THE EVENT ANYWAY. That is deliberate. The handlers were idempotent before
 * this ledger existed and still are for redelivery of the same event, so
 * running one twice is recoverable. Refusing to run it because a bookkeeping
 * table was unreachable would drop a real subscription change, which is not.
 * Availability of the ledger must not become a dependency of billing working.
 */
export async function claimEvent(eventId: string, type: string): Promise<ClaimResult> {
  try {
    const { error } = await supabaseAdmin
      .from("stripe_events")
      .insert({ event_id: eventId, type });

    if (!error) return "claimed";

    // 23505: primary key violation, so someone got here first.
    if (error.code === "23505") return "duplicate";

    // 42P01: relation does not exist. The migration has not been applied yet,
    // which must not take the webhook down with it.
    if (error.code === "42P01") {
      console.warn("⚠️ stripe_events table missing - apply migration 0035. Processing without dedupe.");
      return "unavailable";
    }

    console.error("⚠️ stripe_events claim failed, processing anyway:", error.message);
    return "unavailable";
  } catch (err) {
    console.error("⚠️ stripe_events claim threw, processing anyway:", err);
    return "unavailable";
  }
}

/** Mark a claimed event as finished. */
export async function confirmEvent(eventId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("stripe_events")
      .update({ handled_at: new Date().toISOString() })
      .eq("event_id", eventId);
  } catch (err) {
    // The work succeeded; only the bookkeeping failed. A redelivery would find
    // the claim row and skip, which is the correct outcome anyway.
    console.error("⚠️ could not confirm stripe event:", err);
  }
}

/**
 * Give up a claim so Stripe's retry can try again.
 *
 * Called when the handler throws. Without it, a transient failure - a
 * database blip mid-handler - would be recorded as accepted and the retry
 * ignored, turning a recoverable error into a permanently missed event.
 */
export async function releaseEvent(eventId: string): Promise<void> {
  try {
    await supabaseAdmin.from("stripe_events").delete().eq("event_id", eventId);
  } catch (err) {
    console.error(`⚠️ could not release stripe event ${eventId}; its retry will be skipped:`, err);
  }
}
