// lib/applications/tailored-file.ts
//
// The tailored resume as a file: the student's own PDF with the approved
// changes made in it (lib/applications/pdf-edit.ts), under the file name they
// gave it. Also the two marked views the Apply flow shows: the original with
// the replaced lines in red, and the edited file with the new lines in green.

import { editResumePdf, markPdf, type PdfChange } from '@/lib/applications/pdf-edit';
import { loadSourcePdf, type ApplyPack } from '@/lib/applications/pack';

export type TailoredView = 'file' | 'before' | 'after';

/** The changes that go into the file: approved ones, in order. */
export function approvedChanges(pack: ApplyPack): PdfChange[] {
  const t = pack.tailor;
  if (!t) return [];
  return t.changes.filter(c => t.decisions[c.id] === 'approved').map(c => ({ id: c.id, original: c.original, rewrite: c.rewrite }));
}

/**
 * The tailored resume PDF, or null when this application's resume is tailored
 * as text only (it had no editable PDF).
 */
export async function tailoredResumeFile(userId: string, pack: ApplyPack, view: TailoredView = 'file'): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const source = pack.tailor?.source;
  if (!source) return null;
  const original = await loadSourcePdf(userId, pack.applicationId);
  if (!original) return null;
  const changes = approvedChanges(pack);
  if (!changes.length) return { bytes: original, fileName: source.fileName };
  const edited = await editResumePdf(original, changes);
  const bytes = view === 'before'
    ? await markPdf(original, edited.placements.flatMap(p => p.before), 'removed')
    : view === 'after'
      ? await markPdf(edited.bytes, edited.placements.flatMap(p => p.after), 'added')
      : edited.bytes;
  return { bytes, fileName: source.fileName };
}
