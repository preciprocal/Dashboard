// lib/ai/job-tracker-capacity.ts
// The job tracker limit, enforced as CAPACITY rather than as a monthly rate.
//
// ─── Why this does not use usage_counters ───────────────────────────────────
//
// Every other gated feature is metered by checkAndIncrementUsage against
// usage_counters, which is a per-period counter that resets every 30 days.
// That shape answers "how many did you do this month".
//
// The job tracker is a different product. The UI says "8 tracked jobs", the
// pricing page renders it as a capacity rather than a rate
// (lib/config/plan-features.ts NOT_MONTHLY), and a tracker is a list you
// curate: deleting an application you did not get should give the slot back.
// A monthly counter cannot express that, because deleting a row does not
// decrement a counter and waiting a month gives you slots without freeing any.
//
// So the limit is a COUNT of live rows. Nothing is incremented and nothing
// resets; capacity is whatever the plan allows minus what currently exists.
// This is why jobTracker was never wired into checkAndIncrementUsage and why
// job_tracker_used is permanently 0 - it was the wrong instrument, not a
// forgotten call.
//
// ─── Consequence for credit packs ───────────────────────────────────────────
//
// A pack cannot grant tracked jobs under this model. Pack credits are consumed
// one at a time through consume_pack_credit, which suits a rate and means
// nothing for a capacity - "+20 tracked jobs" would have to raise the cap
// permanently, which is a different mechanism. jobTracker therefore stays in
// UNENFORCED_GRANT_CATEGORIES in lib/config/packs.ts, and the assertion there
// keeps anyone from selling a grant that cannot be honoured.

import { supabaseAdmin } from "@/supabase/admin";
import { resolvePlanKey, USAGE_LIMITS, isUnlimited } from "@/lib/config/usage-limits";
import { toSupabaseUserId } from "@/lib/auth/verify-request";

export interface CapacityResult {
  allowed: boolean;
  used: number;
  /** -1 for unlimited. */
  limit: number;
  /** User-facing sentence, present only when blocked. */
  message?: string;
}

/**
 * Whether this user may track one more job.
 *
 * FAILS OPEN on any error. A tracker row is cheap - it is a database insert
 * with no model call behind it - so refusing to save someone's application
 * because a plan lookup failed costs them real work to punish a fault that is
 * ours. Every other guard in this codebase takes the same position.
 */
export async function checkJobTrackerCapacity(userId: string): Promise<CapacityResult> {
  try {
    const supabaseUserId = await toSupabaseUserId(userId);
    if (!supabaseUserId) return { allowed: true, used: 0, limit: -1 };

    const [{ data: profile }, { data: sub }] = await Promise.all([
      supabaseAdmin.from("profiles").select("is_admin").eq("user_id", supabaseUserId).maybeSingle(),
      supabaseAdmin.from("subscriptions").select("plan, legacy_quotas").eq("user_id", supabaseUserId).maybeSingle(),
    ]);

    const planKey = resolvePlanKey(sub?.plan, {
      isAdmin: profile?.is_admin === true,
      legacyQuotas: sub?.legacy_quotas === true,
    });

    const limit = USAGE_LIMITS[planKey].jobTracker;
    if (isUnlimited(limit)) return { allowed: true, used: 0, limit };

    // head + exact: the count without transferring any rows.
    const { count, error } = await supabaseAdmin
      .from("job_applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", supabaseUserId);

    if (error) {
      console.error("⚠️ job tracker capacity check failed, allowing:", error.message);
      return { allowed: true, used: 0, limit };
    }

    const used = count ?? 0;
    if (used < limit) return { allowed: true, used, limit };

    return {
      allowed: false,
      used,
      limit,
      // Says what to do about it. Under a capacity model deleting genuinely
      // works, which is the whole reason this shape was chosen - telling
      // someone to "wait until next month" would be false here.
      message:
        `Your plan tracks up to ${limit} jobs at a time, and you have ${used}. ` +
        `Remove one you are no longer pursuing to free a slot, or upgrade for unlimited tracking.`,
    };
  } catch (err) {
    console.error("⚠️ job tracker capacity check threw, allowing:", err);
    return { allowed: true, used: 0, limit: -1 };
  }
}
