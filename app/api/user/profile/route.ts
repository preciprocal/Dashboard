// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's subscription data from Firestore
    const userDoc = await db.collection("users").doc(user.id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();

    // Construct user object with subscription data
    const userWithSubscription = {
      id: user.id,
      name: userData?.name || user.name,
      email: userData?.email || user.email,
      subscription: {
        plan: userData?.subscription?.plan || "starter",
        status: userData?.subscription?.status || "active",
        interviewsUsed: userData?.subscription?.interviewsUsed || 0,
        interviewsLimit: userData?.subscription?.interviewsLimit || 10,
        createdAt:
          userData?.subscription?.createdAt ||
          userData?.createdAt ||
          new Date().toISOString(),
        trialEndsAt: userData?.subscription?.trialEndsAt || null,
        subscriptionEndsAt: userData?.subscription?.subscriptionEndsAt || null,
        stripeCustomerId: userData?.subscription?.stripeCustomerId || null,
        stripeSubscriptionId:
          userData?.subscription?.stripeSubscriptionId || null,
      },
    };

    return NextResponse.json(userWithSubscription);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}