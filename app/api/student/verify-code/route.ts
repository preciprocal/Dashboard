import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/firebase/admin";
import Stripe from "stripe";
import { z } from "zod";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-07-30.basil" });

const schema = z.object({
  eduEmail: z.string().email(),
  code:     z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await auth.verifyIdToken(authHeader.split("Bearer ")[1]);

    // Validate body
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { eduEmail, code } = parsed.data;

    // Fetch pending verification doc
    const verDoc = await db.collection("studentVerifications").doc(decoded.uid).get();
    if (!verDoc.exists) {
      return NextResponse.json({ error: "No pending verification found. Please request a new code." }, { status: 404 });
    }

    const ver = verDoc.data()!;

    // Guard: already used
    if (ver.used) {
      return NextResponse.json({ error: "This code has already been used" }, { status: 409 });
    }

    // Guard: email mismatch
    if (ver.eduEmail !== eduEmail) {
      return NextResponse.json({ error: "Email mismatch. Please restart verification." }, { status: 400 });
    }

    // Guard: expired
    if (new Date() > new Date(ver.expiresAt)) {
      return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 410 });
    }

    // Guard: wrong code
    if (ver.code !== code) {
      return NextResponse.json({ error: "Invalid code. Please check your email and try again." }, { status: 400 });
    }

    // ── All checks passed — create a Stripe coupon for 100% off first invoice ──

    // Create a one-off coupon: 100% off, applies once, expires after 30 days
    const coupon = await stripe.coupons.create({
      percent_off:        100,
      duration:           "once",          // only applies to the first invoice
      max_redemptions:    1,               // single use
      redeem_by:          Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days to redeem
      name:               "Student — 1 month free",
      metadata:           { userId: decoded.uid, eduEmail },
    });

    // Mark verification as used
    await verDoc.ref.update({ used: true, verifiedAt: new Date().toISOString(), couponId: coupon.id });

    // Mark user as student-verified in Firestore
    await db.collection("users").doc(decoded.uid).update({
      "subscription.studentVerified": true,
      "subscription.studentEduEmail": eduEmail,
      "subscription.studentVerifiedAt": new Date().toISOString(),
    });

    console.log(`✅ Student verified: uid=${decoded.uid} edu=${eduEmail} coupon=${coupon.id}`);

    return NextResponse.json({ success: true, couponId: coupon.id });
  } catch (err) {
    console.error("❌ verify-code error:", err);
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}