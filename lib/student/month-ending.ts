// lib/student/month-ending.ts
//
// "Your free month of Pro ends on <date>" for the no-card student offer
// (lib/config/student-perk.ts). The carded trial gets Stripe's
// customer.subscription.trial_will_end and sendTrialEndingEmail; the no-card
// month has no Stripe subscription, so this is its only heads-up. Runs daily
// from the application-coaching cron.
//
// Sent once, about three days out: the window is three to four days before
// trial_ends_at, and the send is skipped when email_sends already has one for
// this account since the month began.

import { supabaseAdmin } from '@/supabase/admin';
import { sendStudentMonthEndingEmail } from '@/lib/email/billing';

const DAY_MS = 86_400_000;

export async function notifyStudentMonthEnding(opts: { now?: number } = {}): Promise<number> {
  const now = opts.now ?? Date.now();
  const { data: rows, error } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id, trial_ends_at, student_verified_at')
    .eq('status', 'trialing')
    .is('stripe_subscription_id', null)
    .gte('trial_ends_at', new Date(now + 3 * DAY_MS).toISOString())
    .lt('trial_ends_at', new Date(now + 4 * DAY_MS).toISOString());
  if (error) throw error;

  let sent = 0;
  for (const r of rows ?? []) {
    const since = new Date(Date.parse(r.trial_ends_at as string) - 31 * DAY_MS).toISOString();
    const { data: already } = await supabaseAdmin
      .from('email_sends').select('id').eq('user_id', r.user_id).eq('email_type', 'billing_trial_ending')
      .gte('sent_at', since).limit(1).maybeSingle();
    if (already) continue;
    if (await sendStudentMonthEndingEmail(r.user_id as string, Date.parse(r.trial_ends_at as string))) sent += 1;
  }
  return sent;
}
