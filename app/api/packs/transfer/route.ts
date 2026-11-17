// app/api/packs/transfer/route.ts
//
// GET                   -> { balance, sentToday, perDay }   pack credits this user can send
// POST { email, grants } -> { success }                     send them (lib/packs/transfer.ts)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth/verify-request";
import { applyRateLimit } from "@/lib/ai/rate-limit";
import { supabaseAdmin } from "@/supabase/admin";
import { featureLabel } from "@/lib/config/plan-features";
import type { FeatureType } from "@/lib/config/usage-limits";
import { TRANSFERABLE, TRANSFERS_PER_DAY, accountByEmail, sendCredits, sendableBalance, transfersToday } from "@/lib/packs/transfer";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [balance, sentToday] = await Promise.all([sendableBalance(user.supabaseUserId), transfersToday(user.supabaseUserId).catch(() => 0)]);
    return NextResponse.json({ balance, sentToday, perDay: TRANSFERS_PER_DAY });
  } catch (e) {
    console.error("❌ transfer balance:", e);
    return NextResponse.json({ error: "Could not load your credits." }, { status: 500 });
  }
}

const schema = z.object({
  email: z.string().trim().max(200),
  grants: z.record(z.string(), z.number().int().min(0).max(500)),
});

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await applyRateLimit(req, user.userId, "light");
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter an email and how many credits to send." }, { status: 400 });

  const grants: Partial<Record<FeatureType, number>> = {};
  for (const [k, n] of Object.entries(parsed.data.grants)) {
    if (n > 0 && (TRANSFERABLE as string[]).includes(k)) grants[k as FeatureType] = n;
  }
  if (!Object.keys(grants).length) return NextResponse.json({ error: "Choose at least one credit to send." }, { status: 400 });

  try {
    if (await transfersToday(user.supabaseUserId) >= TRANSFERS_PER_DAY) {
      return NextResponse.json({ error: `You can send credits ${TRANSFERS_PER_DAY} times a day. Try again tomorrow.` }, { status: 429 });
    }
    const to = await accountByEmail(parsed.data.email);
    // The same answer for a typo and for someone without an account.
    if (!to) return NextResponse.json({ error: "No Preciprocal account uses that email. Ask your friend to sign up first, with that address." }, { status: 404 });
    if (to.userId === user.supabaseUserId) return NextResponse.json({ error: "That is your own account." }, { status: 400 });

    const balance = await sendableBalance(user.supabaseUserId);
    for (const [k, n] of Object.entries(grants) as [FeatureType, number][]) {
      if ((balance[k] ?? 0) < n) return NextResponse.json({ error: `You have ${balance[k] ?? 0} ${featureLabel(k, 2).replace(/^2 /, "")} to send.` }, { status: 409 });
    }

    await sendCredits(user.supabaseUserId, to.userId, grants);

    // Tell the friend. Best effort: the credits are theirs either way.
    const { data: me } = await supabaseAdmin.from("profiles").select("name").eq("user_id", user.supabaseUserId).maybeSingle();
    const from = (((me?.name as string | null) ?? "").trim().split(/\s+/)[0]) || "A friend";
    const what = (Object.entries(grants) as [FeatureType, number][]).map(([k, n]) => featureLabel(k, n)).join(", ");
    const { error: nErr } = await supabaseAdmin.from("notifications").insert({
      user_id: to.userId, type: "achievement",
      title: `${from} sent you credits`,
      body: `${what}. They are used once your monthly allowance runs out, and they never expire.`,
      action_url: "/settings?section=billing", action_label: "See credits",
    });
    if (nErr) console.error("⚠️ transfer notification:", nErr.message);

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not enough/.test(msg)) return NextResponse.json({ error: "Some of those credits were just used. Check the numbers and try again." }, { status: 409 });
    console.error("❌ credit transfer:", e);
    return NextResponse.json({ error: "Could not send the credits. Nothing was moved." }, { status: 500 });
  }
}
