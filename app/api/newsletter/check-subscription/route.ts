import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/supabase/admin";

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

    const { data: existingSubscriber } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("subscribed", true)
      .limit(1)
      .maybeSingle();

    return NextResponse.json(
      { subscribed: !!existingSubscriber },
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
