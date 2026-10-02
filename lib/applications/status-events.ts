// lib/applications/status-events.ts
// Records that an application moved to a new status, for the daily coaching
// email (app/api/cron/application-coaching). Nothing is sent from here: see
// migration 0045 for why sending waits for the cron.

import { supabaseAdmin } from '@/supabase/admin';

/**
 * Best effort and never throws. The user's tracker update has already been
 * saved, and a missed coaching email must never turn into a failed save.
 */
export async function recordStatusChange(
  userId: string,
  applicationId: string,
  fromStatus: string | null,
  toStatus: string,
): Promise<void> {
  if (fromStatus === toStatus) return;
  try {
    const { error } = await supabaseAdmin.from('application_status_events').insert({
      user_id: userId,
      application_id: applicationId,
      from_status: fromStatus,
      to_status: toStatus,
    });
    if (error) console.error('⚠️ status event not recorded:', error.message);
  } catch (err) {
    console.error('⚠️ status event not recorded:', err);
  }
}
