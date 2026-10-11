// lib/account-email-sync.ts — server only.
// After someone confirms a new email address: profiles.email (read by every
// email we send and by the ERP) and their Stripe customer (receipts) follow
// it straight away. Previously profiles.email only caught up at the next
// email-and-password sign-in, so billing and digest emails kept going to the
// old address. Best effort; never throws.
import { supabaseAdmin } from '@/supabase/admin';
import { stripe } from '@/lib/stripe/billing';
import { recordAccountEvent } from '@/lib/account-events';

export async function syncChangedEmail(userId: string, newEmail: string): Promise<void> {
  try {
    const { data: before } = await supabaseAdmin.from('profiles').select('email').eq('user_id', userId).maybeSingle();
    if (before?.email && String(before.email).toLowerCase() === newEmail.toLowerCase()) return;
    await supabaseAdmin.from('profiles').update({ email: newEmail, updated_at: new Date().toISOString() }).eq('user_id', userId);
    const { data: sub } = await supabaseAdmin.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
    if (sub?.stripe_customer_id) {
      await stripe.customers.update(sub.stripe_customer_id, { email: newEmail }).catch(err => console.error('⚠️ Stripe email sync failed:', err));
    }
    await recordAccountEvent({ type: 'email_changed', userId, detail: { from: before?.email ?? null, to: newEmail } });
  } catch (err) {
    console.error('⚠️ email change sync failed:', err);
  }
}
