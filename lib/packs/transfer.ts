// lib/packs/transfer.ts
//
// Send unused pack credits to a friend's account (migration 0069). Only pack
// credits move: paid packs, group pack shares and credits someone sent. The
// monthly plan allowance does not, or free accounts could be made just to pass
// theirs on, and bonus credits from the team stay with the person they were
// given to.
import { supabaseAdmin } from "@/supabase/admin";
import { UNIT_PRICE_USD } from "@/lib/config/custom-pack";
import type { FeatureType } from "@/lib/config/usage-limits";

/** Categories that can be sent: the ones packs are sold in. */
export const TRANSFERABLE = Object.keys(UNIT_PRICE_USD) as FeatureType[];

/** Transfers a person can send in a day, to keep this from becoming a market. */
export const TRANSFERS_PER_DAY = 5;

interface Row {
  pack_key: string;
  stripe_payment_intent_id: string | null;
  refunded_at: string | null;
  granted: Record<string, number> | null;
  consumed: Record<string, number> | null;
}

const transferable = (r: Row) =>
  !r.refunded_at && (!!r.stripe_payment_intent_id || r.pack_key.startsWith("group_") || r.pack_key === "transfer");

/** Credits this user could send now, by category. */
export async function sendableBalance(userId: string): Promise<Partial<Record<FeatureType, number>>> {
  const { data } = await supabaseAdmin.from("credit_packs")
    .select("pack_key, stripe_payment_intent_id, refunded_at, granted, consumed").eq("user_id", userId).is("refunded_at", null);
  const out: Partial<Record<FeatureType, number>> = {};
  for (const r of (data ?? []) as Row[]) {
    if (!transferable(r)) continue;
    for (const k of TRANSFERABLE) {
      const left = Number(r.granted?.[k] ?? 0) - Number(r.consumed?.[k] ?? 0);
      if (left > 0) out[k] = (out[k] ?? 0) + left;
    }
  }
  return out;
}

/** The account for an email, or null. Matches the whole address, any case. */
export async function accountByEmail(email: string): Promise<{ userId: string; name: string } | null> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return null;
  // ilike without wildcards: escape them so the address matches only itself.
  const { data } = await supabaseAdmin.from("profiles").select("user_id, name")
    .ilike("email", clean.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
  return data ? { userId: data.user_id as string, name: ((data.name as string | null) ?? "").trim() } : null;
}

export async function transfersToday(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin.from("credit_transfers").select("*", { count: "exact", head: true })
    .eq("from_user_id", userId).gte("created_at", since);
  return count ?? 0;
}

export async function sendCredits(fromId: string, toId: string, grants: Partial<Record<FeatureType, number>>): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("transfer_pack_credits", { p_from: fromId, p_to: toId, p_grants: grants });
  if (error) throw error;
  return data as string;
}
