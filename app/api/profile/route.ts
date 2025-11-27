// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const interviews = await getInterviewsByUserId(currentUser.id);

    return NextResponse.json({
      user: currentUser,
      interviews: interviews || [],
    });
  } catch (_error) {
    console.error("Error fetching profile data:", _error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}