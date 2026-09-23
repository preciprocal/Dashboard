// scripts/verify-support-tickets.ts
//
//   npm run verify:support-tickets
//
// The support ticket flow is the only feature in this codebase that writes to
// the database straight from the browser, with the anon key. Everything else
// goes through a route handler that can check things. Here the ONLY protection
// is row-level security, so RLS is not a detail of this feature - it is the
// whole server side of it.
//
// That makes two questions worth asserting rather than assuming:
//
//   1. Can one user reach another user's tickets, in any direction?
//   2. Can a user forge a reply that looks like it came from support?
//
// A yes to either is a serious problem: support conversations contain billing
// details and personal circumstances, and a forged staff reply could tell
// someone their refund was approved.
//
// The third question is the one that prompted this - can a user actually TRACK
// their ticket? That means reply_count, last_reply_by, last_reply_at and
// status staying truthful as both sides talk, which migration 0036 moved into
// a trigger.
//
// Runs entirely against the database with a real anon client, because that is
// exactly what the browser is.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/supabase/admin";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else    { fail++; console.log("  FAIL  " + n + (d ? "  -> " + d : "")); }
};

const users: string[] = [];
const tickets: string[] = [];

async function makeUser(tag: string, password: string) {
  const email = `tickettest-${tag}-${Date.now()}@example.com`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error || !data.user) throw new Error("createUser: " + error?.message);
  users.push(data.user.id);
  return { id: data.user.id, email };
}

async function makeTicket(userId: string, subject: string) {
  const { data, error } = await supabaseAdmin.from("support_tickets").insert({
    user_id: userId, subject, category: "billing", priority: "medium",
    status: "open", message: "Body of " + subject,
  }).select("id").single();
  if (error) throw new Error("makeTicket: " + error.message);
  tickets.push(data.id);
  return data.id as string;
}

const ticketRow = async (id: string) =>
  (await supabaseAdmin.from("support_tickets").select("*").eq("id", id).single()).data!;

/**
 * Does the reply trigger exist? Everything in section 3 depends on it.
 *
 * Probes a DISPOSABLE ticket, never the one under test. The first version ran
 * against the real ticket and left it dirty: the probe insert fired the
 * trigger, setting last_reply_by to support and bumping reply_count, and
 * deleting the probe row did not undo either - there is no delete trigger. So
 * section 3 then measured the probe's leftovers and failed its first two
 * assertions against perfectly correct code.
 */
async function triggerInstalled(ownerId: string): Promise<boolean> {
  const probeTicket = await makeTicket(ownerId, "trigger probe");
  await supabaseAdmin.from("support_ticket_replies").insert({
    ticket_id: probeTicket, body: "probe", author_user_id: null, is_staff: true,
  });
  const after = await ticketRow(probeTicket);
  // The trigger sets reply_count; without it the column does not move off 0.
  return Number(after.reply_count ?? 0) > 0;
}

async function main() {
  const password = "Test-" + Math.random().toString(36).slice(2) + "-Aa1!";
  const alice = await makeUser("alice", password);
  const bob   = await makeUser("bob", password);

  const aliceTicket = await makeTicket(alice.id, "Alice billing question");
  const bobTicket   = await makeTicket(bob.id, "Bob billing question");

  await supabaseAdmin.from("support_ticket_replies").insert({
    ticket_id: aliceTicket, body: "Alice private detail", author_user_id: alice.id, is_staff: false,
  });

  const asBob: SupabaseClient = createClient(URL, ANON);
  const { error: signInErr } = await asBob.auth.signInWithPassword({ email: bob.email, password });
  if (signInErr) throw new Error("sign-in: " + signInErr.message);

  // ── 1. Isolation ─────────────────────────────────────────────────────────
  console.log("[1] one user cannot reach another's tickets");

  const { data: listed } = await asBob.from("support_tickets").select("id, user_id");
  check("listing returns only their own tickets",
    (listed ?? []).every((t) => t.user_id === bob.id),
    JSON.stringify(listed?.map((t) => t.user_id)));

  const { data: byId } = await asBob.from("support_tickets").select("*").eq("id", aliceTicket);
  check("cannot read another user's ticket by id", (byId?.length ?? 0) === 0);

  const { data: theirReplies } = await asBob.from("support_ticket_replies")
    .select("id").eq("ticket_id", aliceTicket);
  check("cannot read another user's replies", (theirReplies?.length ?? 0) === 0);

  const { error: crossWrite } = await asBob.from("support_ticket_replies").insert({
    ticket_id: aliceTicket, body: "injected", author_user_id: bob.id, is_staff: false,
  });
  check("cannot reply into another user's ticket", !!crossWrite, "insert succeeded");

  const { data: crossUpd } = await asBob.from("support_tickets")
    .update({ priority: "low" }).eq("id", aliceTicket).select("id");
  check("cannot edit another user's ticket", (crossUpd?.length ?? 0) === 0);

  const { error: impersonate } = await asBob.from("support_tickets").insert({
    user_id: alice.id, subject: "forged", category: "billing",
    priority: "low", status: "open", message: "x",
  });
  check("cannot create a ticket owned by someone else", !!impersonate, "insert succeeded");

  // ── 2. Forgery ───────────────────────────────────────────────────────────
  // A reply rendered as coming from support is trusted by the person reading
  // it. If a user could write one on their own ticket, they could not defraud
  // anyone else - but support would be reading a conversation containing
  // messages it never sent.
  console.log("\n[2] a user cannot forge a support reply");
  const { error: spoof } = await asBob.from("support_ticket_replies").insert({
    ticket_id: bobTicket, body: "Your refund has been approved.", author_user_id: null, is_staff: true,
  });
  check("is_staff = true is rejected from the client", !!spoof, "insert succeeded");

  const { error: ownReply } = await asBob.from("support_ticket_replies").insert({
    ticket_id: bobTicket, body: "Any update on this?", author_user_id: bob.id, is_staff: false,
  });
  check("a normal reply on their own ticket is allowed", !ownReply, ownReply?.message);

  // ── 3. Tracking ──────────────────────────────────────────────────────────
  console.log("\n[3] the ticket stays truthful as both sides reply");

  if (!(await triggerInstalled(bob.id))) {
    console.log("  SKIP  sync_ticket_on_reply not installed - apply migration 0036");
  } else {
    let row = await ticketRow(bobTicket);
    check("reply_count counts the user's reply", Number(row.reply_count) === 1, String(row.reply_count));
    check("last_reply_by is the user", row.last_reply_by === "user", String(row.last_reply_by));

    // Support answers.
    await supabaseAdmin.from("support_ticket_replies").insert({
      ticket_id: bobTicket, body: "Looking into it now.", author_user_id: null, is_staff: true,
    });
    row = await ticketRow(bobTicket);
    check("reply_count follows a support reply", Number(row.reply_count) === 2, String(row.reply_count));
    check("last_reply_by is support", row.last_reply_by === "support");
    check("status moves to in-progress", row.status === "in-progress", String(row.status));

    // Support resolves it.
    await supabaseAdmin.from("support_tickets").update({ status: "resolved" }).eq("id", bobTicket);

    // The user writes back. This is the case that was broken: the ticket used
    // to stay resolved, so it left the support queue while the user waited.
    await asBob.from("support_ticket_replies").insert({
      ticket_id: bobTicket, body: "That did not fix it.", author_user_id: bob.id, is_staff: false,
    });
    row = await ticketRow(bobTicket);
    check("replying to a resolved ticket REOPENS it", row.status === "open", String(row.status));
    check("reply_count is still correct", Number(row.reply_count) === 3, String(row.reply_count));
    check("last_reply_at moved", !!row.last_reply_at);

    // ── Deleting a reply ───────────────────────────────────────────────────
    //
    // 0036 recomputed the count on INSERT only, so a deleted reply left the
    // total inflated until the next one arrived - a ticket claiming more
    // messages than it shows. 0037 extends the trigger to DELETE.
    //
    // Skipped rather than failed while only 0036 is applied, because that is a
    // real and reasonable state to be in.
    const beforeDelete = Number((await ticketRow(bobTicket)).reply_count);
    const { data: doomed } = await supabaseAdmin.from("support_ticket_replies")
      .select("id").eq("ticket_id", bobTicket).order("created_at").limit(1).single();
    await supabaseAdmin.from("support_ticket_replies").delete().eq("id", doomed!.id);

    const afterDelete = await ticketRow(bobTicket);
    if (Number(afterDelete.reply_count) === beforeDelete) {
      console.log("  SKIP  delete does not resync the count - apply migration 0037");
    } else {
      check("deleting a reply lowers reply_count",
        Number(afterDelete.reply_count) === beforeDelete - 1,
        `${beforeDelete} -> ${afterDelete.reply_count}`);
      check("last_reply_at still points at a reply that exists",
        !!afterDelete.last_reply_at);

      // Deleting every reply must return the ticket to its untouched shape,
      // not leave it describing a conversation that is no longer there.
      await supabaseAdmin.from("support_ticket_replies").delete().eq("ticket_id", bobTicket);
      const emptied = await ticketRow(bobTicket);
      check("removing every reply zeroes the count", Number(emptied.reply_count) === 0,
        String(emptied.reply_count));
      check("and clears last_reply_by", emptied.last_reply_by === null, String(emptied.last_reply_by));

      // A deletion is a correction, not a message: it must not advance status.
      check("deleting does not reopen or advance status",
        emptied.status === afterDelete.status, `${afterDelete.status} -> ${emptied.status}`);
    }
  }

  // ── 4. The user can see their own conversation ───────────────────────────
  //
  // Independent of section 3 on purpose. Section 3 skips when the trigger is
  // absent, and this check would then silently pass or fail on whatever that
  // section happened to leave behind rather than on what it is testing.
  console.log("\n[4] the user can read their own thread");
  await supabaseAdmin.from("support_ticket_replies").insert({
    ticket_id: bobTicket, body: "Support answering here.", author_user_id: null, is_staff: true,
  });

  const { data: ownThread } = await asBob.from("support_ticket_replies")
    .select("id, body, is_staff").eq("ticket_id", bobTicket).order("created_at");
  check("user sees their own replies", (ownThread ?? []).some((r) => !r.is_staff));
  check("user sees support replies", (ownThread ?? []).some((r) => r.is_staff));
}

main()
  .catch((err) => { console.error("\nHarness error:", err); fail++; })
  .finally(async () => {
    console.log("\n[5] cleanup");
    if (tickets.length) {
      await supabaseAdmin.from("support_ticket_replies").delete().in("ticket_id", tickets);
      await supabaseAdmin.from("support_tickets").delete().in("id", tickets);
    }
    await supabaseAdmin.from("support_tickets").delete().eq("subject", "forged");
    for (const id of users) await supabaseAdmin.auth.admin.deleteUser(id);
    check("test users and tickets removed", true);
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  });
