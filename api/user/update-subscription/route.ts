// app/api/user/update-subscription/route.ts
import { NextRequest, NextResponse } from "next/server";
// Adjust path to your auth file
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

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

    // Update user's subscription data in Firestore
    await db
      .collection("users")
      .doc(user.id)
      .update({
        subscription: {
          ...subscriptionData,
          updatedAt: new Date().toISOString(),
        },
      });

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
