// app/api/subscription/validate-promo/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

// University Promo Codes - Student Discounts
const PROMO_CODES: Record<string, { 
  discountPercent: number; 
  stripeCouponId?: string;
  university: string;
}> = {
  // Massachusetts Universities
  "NEU15": { discountPercent: 15, stripeCouponId: "NEU15", university: "Northeastern University" },
  "BU15": { discountPercent: 15, stripeCouponId: "BU15", university: "Boston University" },
  "BC15": { discountPercent: 15, stripeCouponId: "BC15", university: "Boston College" },
  "MIT15": { discountPercent: 15, stripeCouponId: "MIT15", university: "MIT" },
  "HARVARD15": { discountPercent: 15, stripeCouponId: "HARVARD15", university: "Harvard University" },
  "UMASS15": { discountPercent: 15, stripeCouponId: "UMASS15", university: "UMass (All Campuses)" },
  "TUFTS15": { discountPercent: 15, stripeCouponId: "TUFTS15", university: "Tufts University" },
  "WENTWORTH15": { discountPercent: 15, stripeCouponId: "WENTWORTH15", university: "Wentworth Institute of Technology" },
  
  // Connecticut Universities
  "YALE15": { discountPercent: 15, stripeCouponId: "YALE15", university: "Yale University" },
  "UCONN15": { discountPercent: 15, stripeCouponId: "UCONN15", university: "University of Connecticut" },
  "WESLEYAN15": { discountPercent: 15, stripeCouponId: "WESLEYAN15", university: "Wesleyan University" },
  "FAIRFIELD15": { discountPercent: 15, stripeCouponId: "FAIRFIELD15", university: "Fairfield University" },
  "QUINNIPIAC15": { discountPercent: 15, stripeCouponId: "QUINNIPIAC15", university: "Quinnipiac University" },
  
  // New York Universities
  "NYU15": { discountPercent: 15, stripeCouponId: "NYU15", university: "New York University" },
  "COLUMBIA15": { discountPercent: 15, stripeCouponId: "COLUMBIA15", university: "Columbia University" },
  "CORNELL15": { discountPercent: 15, stripeCouponId: "CORNELL15", university: "Cornell University" },
  "SYRACUSE15": { discountPercent: 15, stripeCouponId: "SYRACUSE15", university: "Syracuse University" },
  "FORDHAM15": { discountPercent: 15, stripeCouponId: "FORDHAM15", university: "Fordham University" },
  "RIT15": { discountPercent: 15, stripeCouponId: "RIT15", university: "Rochester Institute of Technology" },
  "SUNY15": { discountPercent: 15, stripeCouponId: "SUNY15", university: "SUNY (All Campuses)" },
  "CUNY15": { discountPercent: 15, stripeCouponId: "CUNY15", university: "CUNY (All Campuses)" },
  
  // New Jersey Universities
  "RUTGERS15": { discountPercent: 15, stripeCouponId: "RUTGERS15", university: "Rutgers University" },
  "PRINCETON15": { discountPercent: 15, stripeCouponId: "PRINCETON15", university: "Princeton University" },
  "NJIT15": { discountPercent: 15, stripeCouponId: "NJIT15", university: "New Jersey Institute of Technology" },
  "STEVENS15": { discountPercent: 15, stripeCouponId: "STEVENS15", university: "Stevens Institute of Technology" },
  "SETON15": { discountPercent: 15, stripeCouponId: "SETON15", university: "Seton Hall University" },
  
  // New Hampshire Universities
  "UNH15": { discountPercent: 15, stripeCouponId: "UNH15", university: "University of New Hampshire" },
  "DARTMOUTH15": { discountPercent: 15, stripeCouponId: "DARTMOUTH15", university: "Dartmouth College" },
  
  // General/Promotional Codes
  "STUDENT20": { discountPercent: 20, stripeCouponId: "STUDENT20", university: "General Student Discount" },
  "WELCOME10": { discountPercent: 10, stripeCouponId: "WELCOME10", university: "Welcome Offer" },
  "LAUNCH50": { discountPercent: 50, stripeCouponId: "LAUNCH50", university: "Launch Special" },
};

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { valid: false, error: "Promo code is required" },
        { status: 400 }
      );
    }

    const upperCode = code.toUpperCase().trim();
    const promoData = PROMO_CODES[upperCode];

    if (!promoData) {
      return NextResponse.json(
        { valid: false, error: "Invalid promo code" },
        { status: 400 }
      );
    }

    // Optional: Verify the coupon exists in Stripe
    if (promoData.stripeCouponId) {
      try {
        const coupon = await stripe.coupons.retrieve(promoData.stripeCouponId);
        
        if (!coupon.valid) {
          return NextResponse.json(
            { valid: false, error: "This promo code has expired" },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error("Error verifying Stripe coupon:", err);
        // Continue anyway if coupon doesn't exist in Stripe yet
      }
    }

    return NextResponse.json({
      valid: true,
      code: upperCode,
      discountPercent: promoData.discountPercent,
      stripeCouponId: promoData.stripeCouponId,
      university: promoData.university,
    });
  } catch (error) {
    console.error("Error validating promo code:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate promo code" },
      { status: 500 }
    );
  }
}