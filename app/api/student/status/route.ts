// app/api/student/status/route.ts
//
// GET -> { claimed, eduEmail, claimedAt, freeUntil }
// Whether this account has used the student offer, from the permanent ledger
// (student_verifications), not subscriptions.student_verified, which a Stripe
// webhook can reset once the free month ends.
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { supabaseAdmin } from "@/supabase/admin";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [{ data: claim }, { data: sub }] = await Promise.all([
    supabaseAdmin.from("student_verifications").select("edu_email, edu_perk_redeemed, redeemed_at").eq("user_id", user.supabaseUserId).maybeSingle(),
    supabaseAdmin.from("subscriptions").select("status, trial_ends_at, student_verified").eq("user_id", user.supabaseUserId).maybeSingle(),
  ]);
  const claimed = claim?.edu_perk_redeemed === true || sub?.student_verified === true;
  const trialEnd = sub?.status === "trialing" && sub.trial_ends_at && Date.parse(sub.trial_ends_at) > Date.now() ? sub.trial_ends_at : null;
  return NextResponse.json({
    claimed,
    eduEmail: claimed ? (claim?.edu_email ?? null) : null,
    claimedAt: claimed ? (claim?.redeemed_at ?? null) : null,
    freeUntil: claimed ? trialEnd : null,
  });
}
