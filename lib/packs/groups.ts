// lib/packs/groups.ts
//
// Group packs (lib/config/packs.ts, group_*): the buyer's paid credit_packs
// row gets a pack_groups row with an invite link (migration 0068). Anyone who
// opens the link and signs in joins through join_pack_group(), which gives
// them their own full set of the pack's credits while seats are left.
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/supabase/admin";
import { PACKS, isGroupPack, type PackKey } from "@/lib/config/packs";

export type JoinStatus = "joined" | "already" | "owner" | "full" | "closed" | "not_found";

const newToken = () => randomBytes(16).toString("base64url");

/** The invite page for a token, on the app's own host. */
export const inviteUrl = (origin: string, token: string) => `${origin}/join/${token}`;

/**
 * Make sure a paid group pack has its group. Idempotent: owner_pack_id is
 * unique, so a webhook redelivery (or a lazy call from the panel) finds the
 * row the first call made.
 */
export async function ensureGroup(ownerId: string, packId: string, packKey: string): Promise<{ id: string; token: string } | null> {
  if (!isGroupPack(packKey)) return null;
  const { data: existing } = await supabaseAdmin.from("pack_groups").select("id, invite_token").eq("owner_pack_id", packId).maybeSingle();
  if (existing) return { id: existing.id as string, token: existing.invite_token as string };
  const { data, error } = await supabaseAdmin.from("pack_groups")
    .insert({ owner_id: ownerId, pack_key: packKey, owner_pack_id: packId, invite_token: newToken(), seats: PACKS[packKey].seats ?? 4 })
    .select("id, invite_token").single();
  if (error) {
    if (error.code === "23505") return ensureGroup(ownerId, packId, packKey);
    throw error;
  }
  return { id: data.id as string, token: data.invite_token as string };
}

export async function joinGroup(token: string, userId: string): Promise<{ status: JoinStatus; packKey?: PackKey }> {
  const { data: g } = await supabaseAdmin.from("pack_groups").select("pack_key").eq("invite_token", token).maybeSingle();
  if (!g) return { status: "not_found" };
  const pack = PACKS[g.pack_key as PackKey];
  if (!pack) return { status: "not_found" };
  const { data, error } = await supabaseAdmin.rpc("join_pack_group", { p_token: token, p_user_id: userId, p_granted: pack.grants });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { status: JoinStatus } | undefined;
  return { status: row?.status ?? "not_found", packKey: pack.key };
}

export interface GroupView {
  groupId: string;
  packKey: PackKey;
  name: string;
  seats: number;
  token: string;
  /** People who joined, not counting the buyer. */
  members: { name: string; joinedAt: string }[];
  refunded: boolean;
}

/** Groups the user bought, with who has joined. */
export async function ownedGroups(ownerId: string): Promise<GroupView[]> {
  // A paid group pack whose group was never written (webhook hiccup) gets one now.
  const { data: packs } = await supabaseAdmin.from("credit_packs")
    .select("id, pack_key, refunded_at").eq("user_id", ownerId).like("pack_key", "group_%").not("stripe_payment_intent_id", "is", null);
  for (const p of packs ?? []) await ensureGroup(ownerId, p.id as string, p.pack_key as string).catch(() => null);

  const { data: groups } = await supabaseAdmin.from("pack_groups")
    .select("id, pack_key, seats, invite_token, owner_pack_id, created_at").eq("owner_id", ownerId).order("created_at", { ascending: false });
  if (!groups?.length) return [];
  const ids = groups.map(g => g.id as string);
  const { data: members } = await supabaseAdmin.from("pack_group_members").select("group_id, user_id, joined_at").in("group_id", ids).order("joined_at");
  const userIds = [...new Set((members ?? []).map(m => m.user_id as string))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("user_id, name").in("user_id", userIds)
    : { data: [] as { user_id: string; name: string | null }[] };
  const nameOf = new Map((profiles ?? []).map(p => [p.user_id as string, ((p.name as string | null) ?? "").trim()]));
  const refunded = new Set((packs ?? []).filter(p => p.refunded_at).map(p => p.id as string));

  return groups.map(g => ({
    groupId: g.id as string,
    packKey: g.pack_key as PackKey,
    name: PACKS[g.pack_key as PackKey]?.name ?? "Group pack",
    seats: g.seats as number,
    token: g.invite_token as string,
    members: (members ?? []).filter(m => m.group_id === g.id).map(m => ({
      // First name only: members see each other through the buyer's panel.
      name: (nameOf.get(m.user_id as string) || "A friend").split(/\s+/)[0],
      joinedAt: m.joined_at as string,
    })),
    refunded: refunded.has(g.owner_pack_id as string),
  }));
}

/** True when someone has joined the group made from this paid pack. */
export async function groupHasMembers(ownerPackId: string): Promise<boolean> {
  const { data: g } = await supabaseAdmin.from("pack_groups").select("id").eq("owner_pack_id", ownerPackId).maybeSingle();
  if (!g) return false;
  const { count } = await supabaseAdmin.from("pack_group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id);
  return (count ?? 0) > 0;
}

/** What the invite page shows before someone joins. */
export async function inviteInfo(token: string): Promise<{ packKey: PackKey; name: string; ownerName: string; seatsLeft: number; closed: boolean } | null> {
  const { data: g } = await supabaseAdmin.from("pack_groups").select("id, owner_id, pack_key, seats, owner_pack_id").eq("invite_token", token).maybeSingle();
  if (!g) return null;
  const pack = PACKS[g.pack_key as PackKey];
  if (!pack) return null;
  const [{ count }, { data: owner }, { data: ownerPack }] = await Promise.all([
    supabaseAdmin.from("pack_group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id),
    supabaseAdmin.from("profiles").select("name").eq("user_id", g.owner_id).maybeSingle(),
    supabaseAdmin.from("credit_packs").select("refunded_at").eq("id", g.owner_pack_id).maybeSingle(),
  ]);
  return {
    packKey: pack.key,
    name: pack.name,
    ownerName: (((owner?.name as string | null) ?? "").trim().split(/\s+/)[0]) || "A friend",
    seatsLeft: Math.max(0, (g.seats as number) - 1 - (count ?? 0)),
    closed: !!ownerPack?.refunded_at,
  };
}
