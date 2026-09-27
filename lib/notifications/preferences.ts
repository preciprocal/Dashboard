// lib/notifications/preferences.ts
//
// What a user has agreed to receive, and the single place that answers it.
//
// The Settings > Notifications tab used to write three toggles - email,
// interviewReminders, systemUpdates - into user_settings.settings and NOTHING
// read them. Turning off "Email Notifications" still sent every email. Two of
// the three also controlled features that do not exist: nothing in this
// codebase sends an interview reminder or a system update.
//
// Meanwhile the one opt-out that did work, profiles.weekly_digest_opt_out,
// had no toggle in the UI at all - it was reachable only from the unsubscribe
// link in the digest footer.
//
// So the toggles are now named after senders that exist, and each one is
// stored where the sender already looks:
//
//   supportReplies  user_settings.settings.notifications.supportReplies
//                   read by app/api/support/inbound-email
//   weeklyDigest    profiles.weekly_digest_opt_out (inverted)
//                   read by app/api/cron/weekly-digest
//   productUpdates  newsletter_subscribers.subscribed, keyed by email
//
// Deliberately NOT gated, and there is no toggle for them: password reset,
// email verification, new-device security alerts and billing receipts. Those
// are transactional or security mail. A product that lets you switch off the
// alert telling you someone signed in from a new device has a worse problem
// than an unwanted email.

import { supabaseAdmin } from "@/supabase/admin";

export interface NotificationPrefs {
  supportReplies: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

/** Opt-out semantics: absent preferences mean "yes", never "no". */
export const DEFAULT_PREFS: NotificationPrefs = {
  supportReplies: true,
  weeklyDigest: true,
  productUpdates: false, // opt-IN, unlike the other two
};

/**
 * Read a single preference. Fails OPEN for the two opt-out channels: a
 * database hiccup should not silently swallow a support reply the user is
 * waiting on. productUpdates fails closed, because it is opt-in.
 */
export async function canSend(
  supabaseUserId: string,
  channel: keyof NotificationPrefs,
): Promise<boolean> {
  try {
    if (channel === "weeklyDigest") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("weekly_digest_opt_out")
        .eq("user_id", supabaseUserId)
        .maybeSingle();
      return data?.weekly_digest_opt_out !== true;
    }

    if (channel === "productUpdates") {
      const { data: profile } = await supabaseAdmin
        .from("profiles").select("email").eq("user_id", supabaseUserId).maybeSingle();
      if (!profile?.email) return false;
      const { data } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("subscribed")
        .eq("email", String(profile.email).toLowerCase().trim())
        .maybeSingle();
      return data?.subscribed === true;
    }

    const { data } = await supabaseAdmin
      .from("user_settings")
      .select("settings")
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    const prefs = (data?.settings as { notifications?: Partial<NotificationPrefs> } | null)?.notifications;
    return prefs?.supportReplies !== false;
  } catch (err) {
    console.error(`⚠️ notification preference check failed (${channel}):`, err);
    return channel !== "productUpdates";
  }
}
