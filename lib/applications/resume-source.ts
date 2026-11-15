// lib/applications/resume-source.ts
//
// The student's own resume file, for editing in place: the default resume
// from Profile settings, or one uploaded to Preciprocal. Returned with the
// file name they gave it, which the tailored copy keeps.

import { supabaseAdmin } from '@/supabase/admin';
import { downloadUserFile } from '@/lib/storage/file-storage';
import { DEFAULT_RESUME_ID } from '@/lib/resume/default-client';

export interface ResumeFile { bytes: Uint8Array; fileName: string }

const isPdf = (b: Uint8Array | null): b is Uint8Array => !!b && Buffer.from(b.subarray(0, 5)).toString() === '%PDF-';
export const pdfName = (name: string | null | undefined) => {
  const n = (name || 'Resume').trim();
  return /\.pdf$/i.test(n) ? n : `${n}.pdf`;
};

/** The PDF of a `resumes` row, from storage or its file URL. */
export async function downloadResumeRowPdf(row: { resume_path?: string | null; file_url?: string | null }): Promise<Uint8Array | null> {
  let bytes: Uint8Array | null = null;
  if (row.resume_path && !/^https?:\/\//i.test(row.resume_path)) {
    const { data } = await supabaseAdmin.storage.from('user-files').download(row.resume_path);
    if (data) bytes = new Uint8Array(await data.arrayBuffer());
  }
  const url = row.file_url || (row.resume_path && /^https?:\/\//i.test(row.resume_path) ? row.resume_path : null);
  if (!isPdf(bytes) && url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (r?.ok) bytes = new Uint8Array(await r.arrayBuffer());
  }
  return isPdf(bytes) ? bytes : null;
}

/** One of the user's own resume PDFs, or null when it has no PDF file. */
export async function loadOwnResumePdf(user: { userId: string; supabaseUserId: string }, resumeId: string): Promise<ResumeFile | null> {
  if (resumeId === DEFAULT_RESUME_ID) {
    const [buf, { data: profile }] = await Promise.all([
      downloadUserFile(user.userId, 'resume'),
      supabaseAdmin.from('profiles').select('resume_file_name').eq('user_id', user.supabaseUserId).maybeSingle(),
    ]);
    const bytes = buf ? new Uint8Array(buf) : null;
    return isPdf(bytes) ? { bytes, fileName: pdfName(profile?.resume_file_name as string | null) } : null;
  }
  const { data: row } = await supabaseAdmin.from('resumes')
    .select('user_id, file_name, original_file_name, resume_path, file_url')
    .eq('id', resumeId).maybeSingle();
  if (!row || row.user_id !== user.supabaseUserId) return null;
  const bytes = await downloadResumeRowPdf(row);
  return bytes ? { bytes, fileName: pdfName(row.original_file_name || row.file_name) } : null;
}
