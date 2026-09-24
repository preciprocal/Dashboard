// app/api/student/send-verification/route.ts
// Step 1 of the .edu student perk: validate eligibility, then email a code.
//
// Previously stored pending codes and the claim ledger in Firestore - the last
// runtime Firestore dependency in the app, missed by the bulk Supabase
// migration. Both now live in student_verifications (0022).
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { supabaseAdmin } from "@/supabase/admin";
import { evaluateEduEmail } from "@/lib/config/student-domains";
import { OTP_TTL_MINUTES } from "@/lib/config/student-perk";
import { z } from "zod";
import { Resend } from "resend";
import { renderEmail, renderText } from "@/lib/email/layout";

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  eduEmail: z.string().email(),
  // Optional: absent on SSR/insecure contexts and when the browser blocks the
  // APIs it is built from. See lib/fingerprint.ts on why that must not block.
  fingerprint: z.string().max(128).optional(),
});

// randomInt is rejection-sampled and CSPRNG-backed; Math.random is neither,
// and this code is the only thing standing between an attacker and a free
// month of Pro.
function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

async function sendVerificationEmail(to: string, code: string) {
  // The code is rendered as its own oversized block rather than a panel row:
  // it is the entire purpose of the email, and people copy it at a glance.
  const codeBlock =
    `<div class="t-fg" style="font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;` +
    `font-size:34px;font-weight:700;letter-spacing:10px;line-height:1.2;color:#ffffff;">${code}</div>`;

  const html = renderEmail({
    preheader: `Your verification code is ${code}`,
    eyebrow: "Student verification",
    heading: "Here is your code",
    paragraphs: [
      "Enter this code in Preciprocal to claim your free month of Pro.",
    ],
    panel: {
      title: "Verification code",
      rows: [
        { label: "Code", value: codeBlock },
        { label: "Expires", value: `${OTP_TTL_MINUTES} minutes from now` },
      ],
    },
    signoff: "The Preciprocal team",
    footerNote:
      "You are receiving this because someone entered this address to verify student status on Preciprocal. " +
      "If that was not you, ignore this email and nothing will happen.",
  });

  const text = renderText({
    heading: "Here is your code",
    paragraphs: ["Enter this code in Preciprocal to claim your free month of Pro."],
    panel: { title: "Verification code", lines: [code, `Expires in ${OTP_TTL_MINUTES} minutes`] },
    signoff: "The Preciprocal team",
    footerNote: "If you did not request this, ignore this email and nothing will happen.",
  });

  await resend.emails.send({
    from: "Preciprocal <noreply@preciprocal.com>",
    to,
    subject: `${code} is your Preciprocal verification code`,
    html,
    text,
  });
}

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabaseUserId } = authedUser;

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const eduEmail    = parsed.data.eduEmail.trim().toLowerCase();
    const fingerprint = parsed.data.fingerprint ?? null;

    // ── Eligibility: suffix, denylisted subdomain/local-part/domain ─────────
    // Runs before anything else so an ineligible address costs us neither a
    // Resend send nor a row. verify-code re-checks, so tightening this config
    // also invalidates codes already in flight.
    const evaluation = evaluateEduEmail(eduEmail);
    if (!evaluation.ok) {
      return NextResponse.json({ error: evaluation.message }, { status: 400 });
    }

    // ── One perk per account ────────────────────────────────────────────────
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("student_verified")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (sub?.student_verified) {
      return NextResponse.json(
        { error: "Student status already verified on this account" },
        { status: 409 },
      );
    }

    // Belt-and-braces against the upsert below: if this account already holds
    // a redeemed ledger row, overwriting it would silently rewrite which
    // address was claimed and free the original for reuse. Normally implied by
    // the subscriptions check above, but the two can drift - a Stripe webhook
    // can reset subscriptions.student_verified, the ledger is permanent.
    const { data: ownClaim } = await supabaseAdmin
      .from("student_verifications")
      .select("edu_perk_redeemed")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (ownClaim?.edu_perk_redeemed) {
      return NextResponse.json(
        { error: "The student offer has already been claimed on this account" },
        { status: 409 },
      );
    }

    // ── One perk per address, and one per device ────────────────────────────
    // Both are enforced atomically at redemption by partial unique indexes;
    // checking here too is purely so the user finds out now rather than after
    // fetching a code from their inbox. A race between this check and
    // redemption is harmless - the index still wins.
    const { data: addressClaim } = await supabaseAdmin
      .from("student_verifications")
      .select("user_id")
      .eq("edu_email", eduEmail)
      .eq("edu_perk_redeemed", true)
      .maybeSingle();
    if (addressClaim) {
      return NextResponse.json(
        { error: "This university email has already been used for a student trial" },
        { status: 409 },
      );
    }

    if (fingerprint) {
      const { data: deviceClaim } = await supabaseAdmin
        .from("student_verifications")
        .select("user_id")
        .eq("device_fingerprint", fingerprint)
        .eq("edu_perk_redeemed", true)
        .maybeSingle();
      if (deviceClaim) {
        return NextResponse.json(
          {
            error:
              "The student offer has already been claimed on this device. " +
              "If you share this computer with another student, contact support@preciprocal.com and we'll sort it out.",
          },
          { status: 409 },
        );
      }
    }

    // ── Issue the code ──────────────────────────────────────────────────────
    // Stored as sha256(code): a read of this table never yields a usable code,
    // unlike the plaintext Firestore doc this replaces. Upsert (rather than
    // insert) so "change email" and "resend" overwrite the pending state and
    // reset attempts, matching what StudentModal lets the user do.
    const code      = generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("student_verifications")
      .upsert({
        user_id:            supabaseUserId,
        edu_email:          eduEmail,
        email_domain:       evaluation.domain,
        device_fingerprint: fingerprint,
        signup_ip:          getClientIp(req),
        code_hash:          hashCode(code),
        code_expires_at:    expiresAt,
        attempts:           0,
        updated_at:         new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    await sendVerificationEmail(eduEmail, code);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ send-verification error:", err);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
