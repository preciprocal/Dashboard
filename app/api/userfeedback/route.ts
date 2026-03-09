// app/api/usersfeedback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
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

    const user = await getCurrentUser();

    // Destructure all known fields for a clean, typed document
    const {
      overallRating,
      nps,
      featureRatings,   // [{ id, label, rating }]
      usageOptions,     // string[]
      specificAnswers,  // Record<string, string> — agree/disagree per page
      topImprovement,   // string
      freeText,
      page,
      submittedAt,
    } = body;

    const doc = {
      // Identity
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,

      // Context
      page,
      submittedAt: submittedAt ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
      userAgent: req.headers.get("user-agent") ?? "unknown",

      // Step 1
      overallRating,
      featureRatings: featureRatings ?? [],
      usageOptions: usageOptions ?? [],

      // Step 2
      nps: nps ?? null,
      specificAnswers: specificAnswers ?? {},
      topImprovement: topImprovement ?? "",

      // Step 3
      freeText: freeText ?? "",
    };

    await db.collection("usersfeedback").add(doc);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[usersfeedback] Error saving feedback:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}