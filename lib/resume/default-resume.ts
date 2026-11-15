// lib/resume/default-resume.ts
//
// The default resume is the one in Profile settings (users/<uid>/resume.pdf).
// Auto-apply, the Apply flow and the extension all use it. This module says
// what it is, whether a newer resume exists in the app (Resume Analyzer
// uploads), and can make one of those the default.

import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { uploadUserFile } from '@/lib/storage/file-storage';
import { invalidateUserTextCache } from '@/lib/ai/user-context';
import { downloadResumeRowPdf } from '@/lib/applications/resume-source';

/** The id the Apply flow uses for "the default resume from settings". */
export { DEFAULT_RESUME_ID } from '@/lib/resume/default-client';

export interface DefaultResumeInfo {
  /** The resume in settings, or null when none is uploaded. */
  current: { fileName: string; uploadedAt: string | null } | null;
  /** The newest resume in the app, when it is newer than the one in settings. */
  newer: { id: string; fileName: string; uploadedAt: string } | null;
}

type Ids = { userId: string; supabaseUserId: string };

async function settingsResume({ userId, supabaseUserId }: Ids) {
  const [{ data: profile }, { data: files }] = await Promise.all([
    supabaseAdmin.from('profiles').select('resume_path, resume_file_name').eq('user_id', supabaseUserId).maybeSingle(),
    supabaseAdmin.storage.from('user-files').list(`users/${userId}`, { search: 'resume.pdf' }),
  ]);
  const file = files?.find(f => f.name === 'resume.pdf');
  if (!profile?.resume_path || !file) return null;
  return { fileName: (profile.resume_file_name as string) || 'Resume.pdf', uploadedAt: file.updated_at || file.created_at || null };
}

export async function getDefaultResumeInfo(ids: Ids): Promise<DefaultResumeInfo> {
  const [current, { data: rows }] = await Promise.all([
    settingsResume(ids),
    supabaseAdmin.from('resumes')
      .select('id, file_name, original_file_name, created_at, resume_path, file_url')
      .eq('user_id', ids.supabaseUserId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  const top = rows?.[0];
  // Only a resume with a file can become the default: the extension uploads it.
  const usable = top && (top.resume_path || top.file_url);
  const isNewer = usable && (!current?.uploadedAt || new Date(top.created_at).getTime() > new Date(current.uploadedAt).getTime() + 60_000);
  return {
    current,
    newer: isNewer ? { id: top.id, fileName: top.file_name || top.original_file_name || 'Resume.pdf', uploadedAt: top.created_at } : null,
  };
}

/** Copies one of the user's app resumes into settings as the default. */
export async function makeDefaultResume(ids: Ids, resumeId: string): Promise<{ fileName: string }> {
  const { data: row } = await supabaseAdmin.from('resumes')
    .select('user_id, file_name, original_file_name, resume_path, file_url')
    .eq('id', resumeId).maybeSingle();
  if (!row || row.user_id !== ids.supabaseUserId) throw new Error('Resume not found');

  const bytes = await downloadResumeRowPdf(row);
  if (!bytes) throw new Error('That resume has no PDF file to use.');

  const fileName = row.file_name || row.original_file_name || 'Resume.pdf';
  const path = await uploadUserFile(ids.userId, 'resume', Buffer.from(bytes), fileName);
  const { error } = await supabaseAdmin.from('profiles')
    .update({ resume_path: path, resume_file_name: fileName })
    .eq('user_id', ids.supabaseUserId);
  if (error) throw error;
  await invalidateUserTextCache(ids.userId, 'resume');
  if (redis) await redis.del(`profile-complete:${ids.userId}`).catch(() => {});
  return { fileName };
}
