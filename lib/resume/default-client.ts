// lib/resume/default-client.ts
//
// Browser side of the default resume: the resumes to choose from, with the
// default from Profile settings first, and which one to use when the student
// has not picked one. Shared by the Apply flow's picker and Auto mode.
import type { ResumeOption } from '@/components/apply/ResumePicker';
import type { DefaultResumeInfo } from '@/lib/resume/default-resume';

export const DEFAULT_RESUME_ID = 'default';

export async function fetchDefaultResumeInfo(): Promise<DefaultResumeInfo | null> {
  try {
    const r = await fetch('/api/resume/default');
    return r.ok ? ((await r.json()) as DefaultResumeInfo) : null;
  } catch {
    return null;
  }
}

/** All resumes, default first, and the id to use: the default when there is one. */
export async function loadResumeOptions(fallbackId?: string | null): Promise<{ options: ResumeOption[]; preferredId: string }> {
  const [list, info] = await Promise.all([
    fetch('/api/resume').then(r => (r.ok ? r.json() : { data: [] })).then(j => (j.data ?? []) as ResumeOption[]).catch(() => [] as ResumeOption[]),
    fetchDefaultResumeInfo(),
  ]);
  const options: ResumeOption[] = info?.current
    ? [{ id: DEFAULT_RESUME_ID, fileName: info.current.fileName, createdAt: info.current.uploadedAt ?? undefined, isDefault: true }, ...list]
    : list;
  const preferredId = info?.current ? DEFAULT_RESUME_ID
    : (fallbackId && list.some(r => r.id === fallbackId) ? fallbackId : list[0]?.id ?? '');
  return { options, preferredId };
}
