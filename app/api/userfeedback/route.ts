// app/api/usersfeedback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { getCurrentUser } from "@/lib/actions/auth.action";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// GET /api/userfeedback?page=... - has this user already submitted the
// survey for this page?
export async function GET(req: NextRequest) {
  try {
    const page = req.nextUrl.searchParams.get("page");
    if (!page) return NextResponse.json({ error: "page is required" }, { status: 400 });

    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ alreadySubmitted: false });

    const { data } = await supabaseAdmin
      .from("product_surveys")
      .select("id")
      .eq("user_id", authedUser.supabaseUserId)
      .eq("page", page)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ alreadySubmitted: !!data });
  } catch (err) {
    console.error("[usersfeedback] Error checking prior submission:", err);
    return NextResponse.json({ alreadySubmitted: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields from the new payload shape
    if (
      !body ||
      typeof body.overallRating !== "number" ||
      typeof body.page !== "string"
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // getCurrentUser() gives us the Firestore-compatible profile (name/email);
    // getAuthedUser() gives us the real Supabase auth UUID - Postgres rows
    // should always store the latter, not the legacy-resolved id.
    const [user, authedUser] = await Promise.all([
      getCurrentUser(),
      getAuthedUser(req),
    ]);

    const {
      overallRating,
      nps,
      featureRatings,   // [{ id, label, rating }]
      usageOptions,     // string[]
      specificAnswers,  // Record<string, string> - agree/disagree per page
      topImprovement,   // string
      freeText,
      page,
      submittedAt,
    } = body;

    const { error } = await supabaseAdmin.from("product_surveys").insert({
      user_id: authedUser?.supabaseUserId ?? null,
      user_email: user?.email ?? null,
      user_name: user?.name ?? null,
      page,
      overall_rating: overallRating,
      nps: nps ?? null,
      feature_ratings: featureRatings ?? [],
      usage_options: usageOptions ?? [],
      specific_answers: specificAnswers ?? {},
      top_improvement: topImprovement ?? "",
      free_text: freeText ?? "",
      user_agent: req.headers.get("user-agent") ?? "unknown",
      submitted_at: submittedAt ?? new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[usersfeedback] Error saving feedback:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
