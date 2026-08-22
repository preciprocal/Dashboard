import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { FieldValue } from "firebase-admin/firestore";
import { invalidateUserCache } from "@/lib/actions/auth.action";
import { supabaseAdmin } from "@/supabase/admin";
import { z } from "zod";

const schema = z.object({
  eduEmail: z.string().email(),
  code:     z.string().length(6),
});

const TRIAL_DAYS   = 30;
const MAX_ATTEMPTS = 8;

class VerificationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const authedUser = await getAuthedUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, supabaseUserId } = authedUser;

    // Validate body
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const eduEmail = parsed.data.eduEmail.trim().toLowerCase();
    const { code }  = parsed.data;

    // Pre-check against Postgres (outside the Firestore transaction below,
    // since a transaction can't span both databases - see the Postgres
    // write after the transaction for why this ordering is safe).
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("student_verified")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (existingSub?.student_verified) {
      throw new VerificationError(409, "Student status already verified on this account.");
    }

    const verRef   = db.collection("studentVerifications").doc(userId);
    const claimRef = db.collection("studentEmailClaims").doc(eduEmail);

    const now         = new Date();
    const nowISO       = now.toISOString();
    const trialEndsISO = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Everything below runs in a single transaction so two accounts racing to
    // claim the same .edu email (or the same account double-submitting) can't
    // both win - only one read+write of studentEmailClaims/{eduEmail} succeeds.
    await db.runTransaction(async (txn) => {
      const [verDoc, claimDoc] = await Promise.all([
        txn.get(verRef), txn.get(claimRef),
      ]);

      if (!verDoc.exists) {
        throw new VerificationError(404, "No pending verification found. Please request a new code.");
      }
      const ver = verDoc.data()!;

      if (ver.used) {
        throw new VerificationError(409, "This code has already been used.");
      }
      if (ver.eduEmail !== eduEmail) {
        throw new VerificationError(400, "Email mismatch. Please restart verification.");
      }
      if (new Date() > new Date(ver.expiresAt)) {
        throw new VerificationError(410, "Code expired. Please request a new one.");
      }
      if ((ver.attempts ?? 0) >= MAX_ATTEMPTS) {
        throw new VerificationError(429, "Too many incorrect attempts. Please request a new code.");
      }
      if (ver.code !== code) {
        txn.update(verRef, { attempts: FieldValue.increment(1) });
        throw new VerificationError(400, "Invalid code. Please check your email and try again.");
      }
      if (claimDoc.exists) {
        throw new VerificationError(409, "This university email has already been used for a student trial.");
      }

      txn.set(claimRef, { eduEmail, userId, claimedAt: nowISO });
      txn.update(verRef, { used: true, verifiedAt: nowISO });
    });

    // Grant Pro directly - no Stripe involved, so there's nothing that can
    // get stuck behind checkout while billing is offline.
    const { error: subError } = await supabaseAdmin.from("subscriptions").update({
      plan: "pro",
      status: "trialing",
      student_verified: true,
      student_edu_email: eduEmail,
      student_verified_at: nowISO,
      trial_ends_at: trialEndsISO,
      current_period_end: trialEndsISO,
      subscription_ends_at: trialEndsISO,
      updated_at: nowISO,
    }).eq("user_id", supabaseUserId);
    if (subError) throw subError;

    await invalidateUserCache(userId);

    console.log(`✅ Student verified & Pro granted: uid=${userId} edu=${eduEmail} trialEndsAt=${trialEndsISO}`);

    return NextResponse.json({ success: true, trialEndsAt: trialEndsISO });
  } catch (err) {
    if (err instanceof VerificationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("❌ verify-code error:", err);
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}
