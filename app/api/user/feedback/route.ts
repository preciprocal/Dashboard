// app/api/user/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

// ─── GET: Check use count + whether user has already submitted feedback ────────
// Called on component mount to decide whether to show the modal
// Query params: ?serviceKey=resume-analyzer

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const serviceKey = req.nextUrl.searchParams.get("serviceKey");
    if (!serviceKey) {
      return NextResponse.json({ error: "serviceKey is required" }, { status: 400 });
    }

    const userRef = db.collection("users").doc(user.id);

    // Check if user already submitted feedback for this service
    const feedbackSnap = await db
      .collection("feedback")
      .where("userId", "==", user.id)
      .where("serviceKey", "==", serviceKey)
      .limit(1)
      .get();

    const hasFeedback = !feedbackSnap.empty;

    // Get current use count from user doc (stored under serviceUsage map)
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const useCount = userData?.serviceUsage?.[serviceKey] ?? 0;

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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { serviceKey } = await req.json();
    if (!serviceKey) {
      return NextResponse.json({ error: "serviceKey is required" }, { status: 400 });
    }

    const { FieldValue } = await import("firebase-admin/firestore");

    await db
      .collection("users")
      .doc(user.id)
      .set(
        {
          serviceUsage: {
            [serviceKey]: FieldValue.increment(1),
          },
        },
        { merge: true }
      );

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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { serviceKey, rating, nps, tags, comment } = body;

    if (!serviceKey || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Invalid feedback data" }, { status: 400 });
    }

    await db.collection("feedback").add({
      userId: user.id,
      userEmail: user.email ?? null,
      userName: user.name ?? null,
      serviceKey,
      rating,
      nps: nps ?? null,
      tags: tags ?? [],
      comment: comment ?? "",
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Feedback POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}