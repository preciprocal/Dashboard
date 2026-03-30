// app/api/user/update-subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser, invalidateUserCache } from "@/lib/actions/auth.action";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subscriptionData } = await request.json();

    if (!subscriptionData) {
      return NextResponse.json(
        { error: "Subscription data is required" },
        { status: 400 }
      );
    }

    // FIXED: Use dot-notation to avoid stale nested object merging
    const dotUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(subscriptionData)) {
      dotUpdates[`subscription.${key}`] = value;
    }
    dotUpdates["subscription.updatedAt"] = new Date().toISOString();

    await db.collection("users").doc(user.id).update(dotUpdates);

    // FIXED: Invalidate cache so next read gets fresh data
    await invalidateUserCache(user.id);

    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully",
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}