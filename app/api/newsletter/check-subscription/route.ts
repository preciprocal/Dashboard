import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { subscribed: false },
        { status: 200 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email exists in subscribers
    const existingSubscriber = await db
      .collection("newsletter_subscribers")
      .where("email", "==", normalizedEmail)
      .where("status", "==", "active")
      .limit(1)
      .get();

    return NextResponse.json(
      { subscribed: !existingSubscriber.empty },
      { status: 200 }
    );
  } catch (error) {
    console.error("Check subscription error:", error);
    return NextResponse.json(
      { subscribed: false },
      { status: 200 }
    );
  }
}