// app/api/interview/[id]/retake/route.ts
// POST: start a fresh attempt at one of the caller's finished interviews.
//
// A retake is a new interview row with the same role, type, level, company,
// tech stack and questions, so the first attempt keeps its feedback (feedback
// is unique per interview, and re-running the same id would overwrite it).
// It uses one interview from the plan, the same as generating a new one.
//
// Mixed interviews are two rows made together (technical, plus a behavioral
// companion whose id the client keeps in sessionStorage). When the original
// has a companion, it is copied too and its new id returned.

import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { supabaseAdmin } from "@/supabase/admin";
import { checkUsage, checkAndIncrementUsage } from "@/lib/ai/usage-guard";
import { applyRateLimit } from "@/lib/ai/rate-limit";

const COPY = "role, type, level, company, position, duration, techstack, questions, metadata, created_at";

type Row = Record<string, unknown> & { created_at: string };

const fresh = (r: Row, userId: string) => ({
  user_id: userId,
  role: r.role, type: r.type, level: r.level, company: r.company, position: r.position, duration: r.duration,
  techstack: r.techstack ?? [], questions: r.questions, finalized: true,
  metadata: { ...((r.metadata as Record<string, unknown> | null) ?? {}), retakeOf: undefined },
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authed = await getAuthedUser(request);
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rateLimited = await applyRateLimit(request, authed.userId, "medium");
    if (rateLimited) return rateLimited;

    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: original } = await supabaseAdmin.from("interviews").select(COPY)
      .eq("id", id).eq("user_id", authed.supabaseUserId).maybeSingle();
    if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const orig = original as Row;

    const usage = await checkUsage(authed.userId, "interviews");
    if (!usage.allowed) return NextResponse.json({ error: usage.message || "You have used all your interviews on this plan." }, { status: 403 });

    // The behavioral half of a mixed interview, made within a minute of it.
    let companion: Row | null = null;
    if (orig.type === "technical") {
      const at = Date.parse(orig.created_at);
      const { data } = await supabaseAdmin.from("interviews").select(COPY)
        .eq("user_id", authed.supabaseUserId).eq("role", orig.role as string)
        .in("type", ["behavioural", "behavioral"])
        .gte("created_at", new Date(at - 60_000).toISOString())
        .lte("created_at", new Date(at + 60_000).toISOString())
        .limit(1);
      companion = (data?.[0] as Row | undefined) ?? null;
    }

    const rows = [
      { ...fresh(orig, authed.supabaseUserId), metadata: { ...(fresh(orig, authed.supabaseUserId).metadata), retakeOf: id } },
      ...(companion ? [fresh(companion, authed.supabaseUserId)] : []),
    ];
    const { data: made, error } = await supabaseAdmin.from("interviews").insert(rows).select("id, type");
    if (error || !made?.length) throw error ?? new Error("insert failed");

    await checkAndIncrementUsage(authed.userId, "interviews");

    const primary = made.find(m => m.type === orig.type) ?? made[0];
    const behavioral = companion ? made.find(m => m.id !== primary.id) : undefined;
    return NextResponse.json({ success: true, id: primary.id, behavioralId: behavioral?.id ?? null }, { status: 201 });
  } catch (err) {
    console.error("interview retake:", err);
    return NextResponse.json({ error: "Could not start the retake. Try again." }, { status: 500 });
  }
}
