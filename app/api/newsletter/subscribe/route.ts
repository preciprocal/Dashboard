import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";

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
    const { data: existingSubscriber } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (existingSubscriber) {
      return NextResponse.json(
        { error: "This email is already subscribed" },
        { status: 409 }
      );
    }

    const { error } = await supabaseAdmin.from("newsletter_subscribers").insert({
      email: normalizedEmail,
      subscribed: true,
      source: "subscription_page",
    });

    if (error) {
      console.error("Newsletter subscription insert error:", error);
      throw error;
    }

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
