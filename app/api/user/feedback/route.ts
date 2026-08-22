// app/api/user/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { supabaseAdmin } from "@/supabase/admin";

// ─── GET: Check use count + whether user has already submitted feedback ────────
// Called on component mount to decide whether to show the modal
// Query params: ?serviceKey=resume-analyzer

export async function GET(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabaseUserId } = authedUser;

    const serviceKey = req.nextUrl.searchParams.get("serviceKey");
    if (!serviceKey) {
      return NextResponse.json({ error: "serviceKey is required" }, { status: 400 });
    }

    const [{ count: feedbackCount }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("feature_ratings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", supabaseUserId)
        .eq("feature", serviceKey),
      supabaseAdmin
        .from("profiles")
        .select("extended_data")
        .eq("user_id", supabaseUserId)
        .maybeSingle(),
    ]);

    const hasFeedback = !!feedbackCount && feedbackCount > 0;
    const ext = (profile?.extended_data as Record<string, unknown>) || {};
    const serviceUsage = (ext.serviceUsage as Record<string, number>) || {};
    const useCount = serviceUsage[serviceKey] ?? 0;

    return NextResponse.json({ useCount, hasFeedback });
  } catch (error) {
    console.error("[Feedback GET] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PATCH: Increment the use counter for a service ──────────────────────────
// Called by recordServiceUse() after every successful service action
// Body: { serviceKey: string }

export async function PATCH(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabaseUserId } = authedUser;

    const { serviceKey } = await req.json();
    if (!serviceKey) {
      return NextResponse.json({ error: "serviceKey is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.rpc("increment_service_usage", {
      p_user_id: supabaseUserId,
      p_service_key: serviceKey,
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Feedback PATCH] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST: Save submitted feedback to Firestore ───────────────────────────────
// Called on form submit
// Body: FeedbackData

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { serviceKey, rating, nps, tags, comment } = body;

    if (!serviceKey || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid feedback data" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("feature_ratings").insert({
      user_id: authedUser.supabaseUserId,
      feature: serviceKey,
      rating,
      nps: nps ?? null,
      tags: tags ?? [],
      comment: comment ?? "",
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Feedback POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}