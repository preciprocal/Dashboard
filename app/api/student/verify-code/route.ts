// app/api/student/verify-code/route.ts
// Step 2 of the .edu student perk: check the code, then redeem.
//
// The Firestore runTransaction this replaces could not span both databases, so
// the claim ledger (Firestore) and the granted plan (Postgres) could diverge
// on a partial failure. Both now happen inside the redeem_student_perk RPC in
// a single Postgres transaction - see 0022_student_verifications.sql.
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import Stripe from "stripe";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { invalidateUserCache } from "@/lib/actions/auth.action";
import { supabaseAdmin } from "@/supabase/admin";
import { evaluateEduEmail } from "@/lib/config/student-domains";
import {
  TRIAL_DAYS,
  OTP_MAX_ATTEMPTS,
  REQUIRE_CARD,
  STUDENT_CONVERSION_PRICE_ID,
} from "@/lib/config/student-perk";
import { z } from "zod";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

const schema = z.object({
  eduEmail:    z.string().email(),
  code:        z.string().length(6),
  fingerprint: z.string().max(128).optional(),
});

class VerificationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Both operands are fixed-length hex digests, so lengths always match and the
// comparison is constant-time - a plain === leaks position-of-first-difference
// via timing.
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

// redeem_student_perk returns a machine-readable reason; map it to what the
// user should actually see.
const REDEMPTION_ERRORS: Record<string, { status: number; message: string }> = {
  no_verification: {
    status: 404,
    message: "No pending verification found. Please request a new code.",
  },
  already_redeemed: {
    status: 409,
    message: "The student offer has already been claimed on this account.",
  },
  email_claimed: {
    status: 409,
    message: "This university email has already been used for a student trial.",
  },
  device_claimed: {
    status: 409,
    message:
      "The student offer has already been claimed on this device. " +
      "If you share this computer with another student, contact support@preciprocal.com and we'll sort it out.",
  },
};

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, supabaseUserId, email } = authedUser;

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const eduEmail    = parsed.data.eduEmail.trim().toLowerCase();
    const { code }    = parsed.data;
    const fingerprint = parsed.data.fingerprint ?? null;

    // ── Load the pending verification ───────────────────────────────────────
    const { data: row, error: fetchError } = await supabaseAdmin
      .from("student_verifications")
      .select("edu_email, code_hash, code_expires_at, attempts, edu_perk_redeemed")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (!row || !row.code_hash) {
      throw new VerificationError(404, "No pending verification found. Please request a new code.");
    }
    if (row.edu_perk_redeemed) {
      throw new VerificationError(409, "The student offer has already been claimed on this account.");
    }
    if (row.edu_email !== eduEmail) {
      throw new VerificationError(400, "Email mismatch. Please restart verification.");
    }
    if (new Date() > new Date(row.code_expires_at as string)) {
      throw new VerificationError(410, "Code expired. Please request a new one.");
    }
    if ((row.attempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new VerificationError(429, "Too many incorrect attempts. Please request a new code.");
    }

    // ── Re-check eligibility ────────────────────────────────────────────────
    // Deliberately re-run rather than trusting send-verification: tightening
    // the denylist must also invalidate codes already sitting in inboxes.
    const evaluation = evaluateEduEmail(eduEmail);
    if (!evaluation.ok) {
      throw new VerificationError(400, evaluation.message!);
    }

    // ── Check the code ──────────────────────────────────────────────────────
    if (!hashesMatch(row.code_hash as string, hashCode(code))) {
      // Read-modify-write, so concurrent wrong guesses can lose an increment
      // and buy an attacker a few extra tries past OTP_MAX_ATTEMPTS. Harmless
      // at this scale: brute-forcing a 6-digit code needs ~500k guesses, and
      // the 15-minute expiry caps the window regardless. Not worth an RPC.
      await supabaseAdmin
        .from("student_verifications")
        .update({ attempts: (row.attempts ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("user_id", supabaseUserId);
      throw new VerificationError(400, "Invalid code. Please check your email and try again.");
    }

    // ── Card-on-file branch ─────────────────────────────────────────────────
    // Off by default. When enabled, the address is confirmed but the perk is
    // NOT redeemed here - the ledger entry is only written once the card is
    // saved, in activate-perk. Redeeming first would let someone burn the
    // address and the device slot without ever attaching a card.
    if (REQUIRE_CARD) {
      await supabaseAdmin
        .from("student_verifications")
        .update({
          verified_at:        new Date().toISOString(),
          device_fingerprint: fingerprint ?? undefined,
          code_hash:          null,
          code_expires_at:    null,
          updated_at:         new Date().toISOString(),
        })
        .eq("user_id", supabaseUserId);

      const clientSecret = await createStudentSetupIntent(supabaseUserId, email);
      return NextResponse.json({ success: true, requiresCard: true, clientSecret });
    }

    // ── Redeem ──────────────────────────────────────────────────────────────
    const trialEndsISO = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: reason, error: rpcError } = await supabaseAdmin.rpc("redeem_student_perk", {
      p_user_id:       supabaseUserId,
      p_fingerprint:   fingerprint,
      p_trial_ends_at: trialEndsISO,
    });
    if (rpcError) throw rpcError;

    if (reason) {
      const mapped = REDEMPTION_ERRORS[reason as string]
        ?? { status: 409, message: "Could not claim the student offer. Please contact support." };
      throw new VerificationError(mapped.status, mapped.message);
    }

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

/**
 * Get-or-create the Stripe customer and open a SetupIntent to collect a card
 * at $0. Mirrors the customer handling in
 * app/api/subscription/create-subscription so both paths converge on one
 * customer per user. No subscription is created here - that happens in
 * activate-perk once the card actually exists.
 */
async function createStudentSetupIntent(
  supabaseUserId: string,
  email: string | null,
): Promise<string> {
  const { data: subRow } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", supabaseUserId)
    .maybeSingle();

  let customerId = subRow?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    email ?? undefined,
      metadata: { userId: supabaseUserId },
    });
    customerId = customer.id;
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("user_id", supabaseUserId);
    if (error) throw error;
  }

  const setupIntent = await stripe.setupIntents.create({
    customer:                  customerId,
    automatic_payment_methods: { enabled: true },
    usage:                     "off_session",
    metadata: {
      userId:  supabaseUserId,
      purpose: "student_perk",
      priceId: STUDENT_CONVERSION_PRICE_ID,
    },
  });

  if (!setupIntent.client_secret) {
    throw new VerificationError(500, "Failed to initialize payment setup.");
  }
  return setupIntent.client_secret;
}
