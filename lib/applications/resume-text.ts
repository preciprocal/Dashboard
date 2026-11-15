// lib/applications/resume-text.ts
import { supabaseAdmin } from '@/supabase/admin';

/** The text of one of the user's own resumes, or '' when it has none. */
export async function loadOwnResumeText(userId: string, resumeId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('resumes')
    .select('user_id, resume_text, feedback')
    .eq('id', resumeId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.user_id !== userId) return '';
  const feedback = data.feedback as { resumeText?: string } | null;
  return (data.resume_text as string | null) || feedback?.resumeText || '';
}
