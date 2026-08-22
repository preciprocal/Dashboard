// app/api/student/send-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { supabaseAdmin } from "@/supabase/admin";
import { z } from "zod";
import { Resend } from "resend";  // ← swap nodemailer for Resend

const resend = new Resend(process.env.RESEND_API_KEY);

const schema = z.object({
  eduEmail: z.string().email().refine(e => e.endsWith(".edu"), {
    message: "Only .edu email addresses are accepted",
  }),
});

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(to: string, code: string) {
  await resend.emails.send({
    from:    "Preciprocal <noreply@preciprocal.com>",
    to,
    subject: "Your student verification code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="margin:0 0 8px;color:#1e1e2e;">Preciprocal student verification</h2>
        <p style="color:#64748b;margin:0 0 24px;">Enter this code to claim your free month of Pro.</p>
        <div style="background:#f1f5f9;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1e1e2e;">${code}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, supabaseUserId } = authedUser;

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const eduEmail = parsed.data.eduEmail.trim().toLowerCase();

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("student_verified")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (sub?.student_verified) {
      return NextResponse.json({ error: "Student status already verified on this account" }, { status: 409 });
    }

    // Doc ID is the normalised email itself, so this is a single point read -
    // no race window between checking and claiming (claim happens atomically in verify-code).
    const claimDoc = await db.collection("studentEmailClaims").doc(eduEmail).get();
    if (claimDoc.exists) {
      return NextResponse.json({ error: "This university email has already been used for a student trial" }, { status: 409 });
    }

    const code      = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.collection("studentVerifications").doc(userId).set({
      userId, eduEmail, code, expiresAt,
      used: false, attempts: 0, createdAt: new Date().toISOString(),
    });

    await sendVerificationEmail(eduEmail, code);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ send-verification error:", err);
    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}