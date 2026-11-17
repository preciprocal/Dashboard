// app/api/packs/groups/route.ts
//
// GET              -> { groups }   the group packs this user bought, with their invite links
// GET ?token=...   -> { invite }   what an invite link is for, before joining
// POST { token }   -> { status }   join a group (lib/packs/groups.ts)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { inviteInfo, inviteUrl, joinGroup, ownedGroups } from "@/lib/packs/groups";

const TOKEN = z.string().regex(/^[A-Za-z0-9_-]{10,64}$/);

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Sign in to see this invite." }, { status: 401 });
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (token !== null) {
      if (!TOKEN.safeParse(token).success) return NextResponse.json({ error: "This invite link is not valid." }, { status: 404 });
      const invite = await inviteInfo(token);
      if (!invite) return NextResponse.json({ error: "This invite link is not valid." }, { status: 404 });
      return NextResponse.json({ invite });
    }
    const groups = await ownedGroups(user.supabaseUserId);
    return NextResponse.json({
      groups: groups.map(({ token: t, ...g }) => ({ ...g, inviteUrl: inviteUrl(req.nextUrl.origin, t) })),
    });
  } catch (e) {
    console.error("❌ pack groups:", e);
    return NextResponse.json({ error: "Could not load your group packs." }, { status: 500 });
  }
}

const MESSAGES: Record<string, string> = {
  joined: "You are in. The pack's credits are now on your account.",
  already: "You have already joined this group.",
  owner: "This is your own group pack. Share the link with friends instead.",
  full: "All the seats in this group pack have been taken.",
  closed: "This group pack was refunded, so it cannot be joined.",
  not_found: "This invite link is not valid.",
};

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Sign in to join." }, { status: 401 });
  const limited = await applyRateLimit(req, user.userId, "light");
  if (limited) return limited;
  const parsed = z.object({ token: TOKEN }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: MESSAGES.not_found, status: "not_found" }, { status: 404 });
  try {
    const { status } = await joinGroup(parsed.data.token, user.supabaseUserId);
    const ok = status === "joined" || status === "already";
    return NextResponse.json({ status, message: MESSAGES[status] }, { status: ok ? 200 : status === "not_found" ? 404 : 409 });
  } catch (e) {
    console.error("❌ join pack group:", e);
    return NextResponse.json({ error: "Could not join right now. Please try again." }, { status: 500 });
  }
}
