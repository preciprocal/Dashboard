// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's full data from Firestore
    const userDoc = await db.collection("users").doc(user.id).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const interviews = await getInterviewsByUserId(user.id);

    // Construct complete user object with all profile fields
    const completeUser = {
      id: user.id,
      name: userData?.name || user.name || "",
      email: userData?.email || user.email || "",
      phone: userData?.phone || "",
      
      // New separate address fields
      streetAddress: userData?.streetAddress || "",
      city: userData?.city || "",
      state: userData?.state || "",
      
      bio: userData?.bio || "",
      targetRole: userData?.targetRole || "",
      experienceLevel: userData?.experienceLevel || "mid",
      preferredTech: userData?.preferredTech || [],
      careerGoals: userData?.careerGoals || "",
      linkedIn: userData?.linkedIn || "",
      github: userData?.github || "",
      website: userData?.website || "",
      provider: userData?.provider || "email",
      createdAt: userData?.createdAt || new Date().toISOString(),
      lastLogin: userData?.lastLogin || new Date().toISOString(),
      
      subscription: {
        plan: userData?.subscription?.plan || "free",
        status: userData?.subscription?.status || "active",
        interviewsUsed: userData?.subscription?.interviewsUsed || 0,
        interviewsLimit: userData?.subscription?.interviewsLimit || 1,
        createdAt:
          userData?.subscription?.createdAt ||
          userData?.createdAt ||
          new Date().toISOString(),
        trialEndsAt: userData?.subscription?.trialEndsAt || null,
        subscriptionEndsAt: userData?.subscription?.subscriptionEndsAt || null,
        currentPeriodStart: userData?.subscription?.currentPeriodStart || null,
        currentPeriodEnd: userData?.subscription?.currentPeriodEnd || null,
        stripeCustomerId: userData?.subscription?.stripeCustomerId || null,
        stripeSubscriptionId:
          userData?.subscription?.stripeSubscriptionId || null,
        canceledAt: userData?.subscription?.canceledAt || null,
        lastPaymentAt: userData?.subscription?.lastPaymentAt || null,
      },
    };

    return NextResponse.json({
      user: completeUser,
      interviews: interviews || [],
    });
  } catch (error) {
    console.error("Error fetching profile data:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}