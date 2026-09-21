// app/api/interview/abandoned/route.ts
// Called by the interview panel when a session produced nothing usable.
//
// The case this exists for: the candidate's microphone was muted, or their
// network dropped, or they never spoke. The call ran, Vapi billed us for the
// minutes, and the transcript came back empty - so there is no feedback to
// generate and nothing for the candidate to read. Before this, the panel
// silently pushed them to the dashboard with their interview credit spent and
// no explanation at all.
//
// Refunding is the right call even though the minutes cost us real money. The
// candidate did not get an interview, and the most likely cause is a muted mic
// that our own UI failed to warn them about until recently. Charging for that
// is charging for our bug.
//
// Abuse is bounded and not worth guarding against here: refunds only apply to
// an interview the caller owns, only once, and only when no feedback exists.
// Someone determined to farm it would have to sit through silent calls that
// cost them far more time than the credit is worth.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import { refundUsage } from "@/lib/ai/usage-refund";

export const runtime = "nodejs";

const schema = z.object({
  interviewId: z.string().min(1),
  /** Why it was abandoned. Recorded for support, not trusted for logic. */
  reason: z.enum(["no_transcript", "too_short", "connection_failed", "start_failed"]),
});

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { supabaseUserId, userId } = authedUser;

    const rateLimited = await applyRateLimit(req, userId, "light");
    if (rateLimited) return rateLimited;

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send { interviewId, reason }" }, { status: 400 });
    }

    const { interviewId, reason } = parsed.data;

    // Ownership. Without this, any authenticated user could name someone
    // else's interview id and have a refund applied to their own account.
    const { data: interview } = await supabaseAdmin
      .from("interviews")
      .select("id, user_id, abandoned_at")
      .eq("id", interviewId)
      .maybeSingle();

    if (!interview || interview.user_id !== supabaseUserId) {
      // Same answer for "does not exist" and "not yours", so the endpoint
      // cannot be used to test whether an interview id is real.
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }

    // Already refunded. The panel can fire this more than once - a retry, a
    // remount, a double-click - and each would otherwise return another credit.
    if (interview.abandoned_at) {
      return NextResponse.json({ refunded: false, reason: "already_refunded" });
    }

    // If feedback exists the interview delivered what it was charged for,
    // whatever the client believes about the transcript.
    const { data: feedback } = await supabaseAdmin
      .from("interview_feedback")
      .select("id")
      .eq("interview_id", interviewId)
      .maybeSingle();

    if (feedback) {
      return NextResponse.json({ refunded: false, reason: "feedback_exists" });
    }

    // Marked BEFORE refunding. If the refund then fails the user keeps a spent
    // credit, which support can fix; if it were marked after, a crash between
    // the two would leave the interview refundable again and hand out a second
    // credit on the next call.
    const { error: markErr } = await supabaseAdmin
      .from("interviews")
      .update({ abandoned_at: new Date().toISOString(), abandoned_reason: reason })
      .eq("id", interviewId)
      .is("abandoned_at", null);

    if (markErr) {
      console.error("⚠️ could not mark interview abandoned:", markErr.message);
      return NextResponse.json({ refunded: false, reason: "mark_failed" });
    }

    const outcome = await refundUsage(userId, "interviews", `abandoned: ${reason}`);

    return NextResponse.json({
      refunded: outcome === "counter" || outcome === "pack",
      source: outcome,
    });
  } catch (err) {
    console.error("❌ interview abandoned route error:", err);
    // Deliberately not a 500 to the client. The interview already failed; a
    // second error on the recovery path would be the only thing the candidate
    // sees, and there is nothing they could do about it.
    return NextResponse.json({ refunded: false, reason: "error" });
  }
}
