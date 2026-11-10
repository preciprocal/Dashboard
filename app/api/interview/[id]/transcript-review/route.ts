// app/api/interview/[id]/transcript-review/route.ts
// GET: the annotated-transcript critique for one of the caller's interviews.
//
// Generated once per transcript and cached (lib/interview/transcript-review.ts),
// so repeat visits are a cache read. Not charged against any quota: the
// review is part of the interview's results, which the interview itself
// already paid for at app/api/vapi/generate.

import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { getTranscriptReview } from "@/lib/interview/transcript-review";

// One Claude call over a whole interview transcript.
export const maxDuration = 120;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await getAuthedUser(request);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimited = await applyRateLimit(request, authed.userId, "medium");
    if (rateLimited) return rateLimited;

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Ownership is enforced inside: every read filters on the caller's
    // Supabase id, so another user's interview id reads as not found.
    const result = await getTranscriptReview(id, authed.supabaseUserId);
    switch (result.status) {
      case "not_found":
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      case "unavailable":
        return NextResponse.json({ status: "unavailable", error: "AI not configured" }, { status: 503 });
      default:
        return NextResponse.json(result);
    }
  } catch (err) {
    const e = err as Error & { status?: number };
    if (e.status === 429) {
      return NextResponse.json({ error: "The coach is busy right now. Please try again in a minute." }, { status: 429 });
    }
    console.error("❌ transcript-review:", err);
    return NextResponse.json({ error: "Could not review this transcript" }, { status: 500 });
  }
}
