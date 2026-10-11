// lib/account-events.ts — server only.
// One row in account_events (migration 0052) for security-relevant things
// that happen to an account. Best effort: a missing table or a failed insert
// is logged and never fails the action being recorded.

import { createHash } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';

export type AccountEventType =
  | 'password_changed' | 'email_change_requested' | 'email_changed'
  | 'login_failed' | 'data_export' | 'account_closure_requested';

export const hashEmail = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');

export async function recordAccountEvent(e: {
  type: AccountEventType;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('account_events').insert({
      type: e.type,
      user_id: e.userId ?? null,
      email_hash: e.email ? hashEmail(e.email) : null,
      ip: e.ip?.split(',')[0]?.trim().slice(0, 64) || null,
      user_agent: e.userAgent?.slice(0, 300) || null,
      detail: e.detail ?? {},
    });
    if (error) console.error('⚠️ account_events insert failed:', e.type, error.message);
  } catch (err) {
    console.error('⚠️ account_events insert failed:', e.type, err);
  }
}
