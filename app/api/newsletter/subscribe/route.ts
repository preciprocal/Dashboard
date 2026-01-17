import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingSubscriber = await db
      .collection("newsletter_subscribers")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existingSubscriber.empty) {
      return NextResponse.json(
        { error: "This email is already subscribed" },
        { status: 409 }
      );
    }

    // Add subscriber to Firestore
    const subscriberData = {
      email: normalizedEmail,
      subscribedAt: Timestamp.now(),
      status: "active",
      source: "subscription_page",
    };

    await db.collection("newsletter_subscribers").add(subscriberData);

    // TODO: Optional - Send welcome email via SendGrid/Mailgun
    // await sendWelcomeEmail(normalizedEmail);

    return NextResponse.json(
      { 
        success: true, 
        message: "Successfully subscribed to newsletter" 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return NextResponse.json(
      { error: "Failed to subscribe. Please try again." },
      { status: 500 }
    );
  }
}