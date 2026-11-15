// lib/applications/resume-text.ts
import { supabaseAdmin } from '@/supabase/admin';
import { extractFileText } from '@/lib/ai/user-context';
import { DEFAULT_RESUME_ID } from '@/lib/resume/default-resume';

/**
 * The text of one of the user's own resumes, or '' when it has none.
 * DEFAULT_RESUME_ID means the default resume in Profile settings.
 */
export async function loadOwnResumeText(user: { userId: string; supabaseUserId: string }, resumeId: string): Promise<string> {
  if (resumeId === DEFAULT_RESUME_ID) return (await extractFileText(user.userId, 'resume')) ?? '';
  const { data, error } = await supabaseAdmin
    .from('resumes')
    .select('user_id, resume_text, feedback')
    .eq('id', resumeId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.user_id !== user.supabaseUserId) return '';
  const feedback = data.feedback as { resumeText?: string } | null;
  return (data.resume_text as string | null) || feedback?.resumeText || '';
}
