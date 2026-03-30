import { NextRequest, NextResponse } from "next/server";
import { auth, db } from "@/firebase/admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await auth.verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decoded.uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ subscription: null });
    }

    const data = userDoc.data();
    return NextResponse.json({ subscription: data?.subscription ?? null });

  } catch (err) {
    console.error("❌ user/subscription GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}