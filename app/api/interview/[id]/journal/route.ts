// app/api/interview/[id]/journal/route.ts
// POST: copy one of the caller's mock interviews into their Interview Journal
// (interview_debriefs), or return the entry already made from it.
//
// Idempotent: a second call, a double click or a second tab all land on the
// same entry (see lib/interview/journal-sync.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { syncInterviewToJournal } from "@/lib/interview/journal-sync";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await getAuthedUser(request);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rateLimited = await applyRateLimit(request, authed.userId, "medium");
    if (rateLimited) return rateLimited;

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Every query inside filters on the caller's Supabase id, so someone
    // else's interview id reads as not found.
    const result = await syncInterviewToJournal(id, authed.supabaseUserId);
    if (result.status === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      { success: true, id: result.id, created: result.status === "created" },
      { status: result.status === "created" ? 201 : 200 },
    );
  } catch (err) {
    console.error("❌ interview journal sync:", err);
    return NextResponse.json({ error: "Could not save to your Interview Journal" }, { status: 500 });
  }
}
