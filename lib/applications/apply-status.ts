// lib/applications/apply-status.ts
// Move an application to a new status the same way the tracker does: stamp the
// first employer response and the first interview once (write-once, see
// app/api/job-tracker PATCH), and record the change for coaching emails.
//
// Used where a status changes without the user dragging a card, such as a
// forwarded recruiter email (lib/inbound/process.ts).
import { supabaseAdmin } from '@/supabase/admin';
import { hasResponded, isInterview } from '@/lib/config/outcomes';
import { recordStatusChange } from '@/lib/applications/status-events';

export async function applyStatus(
  supabaseUserId: string,
  applicationId: string,
  toStatus: string,
): Promise<{ previous: string } | null> {
  const { data: existing } = await supabaseAdmin
    .from('job_applications')
    .select('user_id, status, first_response_at, reached_interview_at')
    .eq('id', applicationId)
    .maybeSingle();
  if (!existing || existing.user_id !== supabaseUserId) return null;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('job_applications')
    .update({
      status: toStatus,
      ...(hasResponded(toStatus) && !existing.first_response_at ? { first_response_at: now } : {}),
      ...(isInterview(toStatus) && !existing.reached_interview_at ? { reached_interview_at: now } : {}),
      updated_at: now,
    })
    .eq('id', applicationId);
  if (error) throw error;

  const previous = (existing.status as string | null) ?? 'applied';
  await recordStatusChange(supabaseUserId, applicationId, previous, toStatus);
  return { previous };
}
