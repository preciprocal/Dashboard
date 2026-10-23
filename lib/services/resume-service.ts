// lib/services/resume-service.ts
//
// A thin client for resumes: they live in Postgres and are read and written
// through the API routes below. (This was firebase-service.ts before the move
// off Firebase; see git history for the Firestore version.)
import { Resume } from '@/types/resume';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCreatedAt(value: unknown): Date {
  if (value instanceof Date)     return value;
  if (typeof value === 'string') return new Date(value);
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}

// ─── Resume Functions ─────────────────────────────────────────────────────────

/**
 * Upload the resume PDF to Storage and return its bare path. Separate from
 * saving the record so the upload page can run it while the analysis is in
 * progress instead of after it (~2s saved per upload).
 */
export async function uploadResumePdf(pdfFile: File, resumeId: string): Promise<string> {
  const uploadForm = new FormData();
  uploadForm.append('file', pdfFile);
  uploadForm.append('kind', 'resume-pdf');
  uploadForm.append('resumeId', resumeId);
  // No Authorization header needed - the Supabase session cookie is sent
  // automatically for this same-origin request.
  const uploadRes = await fetch('/api/storage/upload', { method: 'POST', body: uploadForm });
  if (!uploadRes.ok) {
    const e = await uploadRes.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(e.error || 'Failed to upload PDF');
  }
  // Bare Supabase Storage path (private bucket) - resolved to a signed
  // URL on read via /api/resume/proxy-pdf, not stored as a permanent URL.
  const { path } = await uploadRes.json() as { path: string };
  return path;
}

export async function saveResumeWithFiles(
  resume: Omit<Resume, 'imagePath' | 'resumePath'>,
  pdfFile: File,
  /** An upload already started with uploadResumePdf, to reuse instead of uploading again. */
  uploading?: Promise<string>,
): Promise<string> {
  try {
    const { id } = resume;

    console.log('📤 Uploading PDF to Storage:', id);
    const resumePath = await (uploading ?? uploadResumePdf(pdfFile, id));
    console.log('✅ PDF uploaded');

    const saveRes = await fetch('/api/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...resume,
        resumePath,
        filePath: resumePath,
      }),
    });
    if (!saveRes.ok) {
      const e = await saveRes.json().catch(() => ({ error: 'Save failed' }));
      throw new Error(e.error || 'Failed to save resume record');
    }
    console.log('✅ Resume saved to Postgres:', id);

    return id;
  } catch (error) {
    console.error('❌ Error saving resume:', error);
    throw new Error(`Failed to save resume: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getResume(id: string): Promise<Resume | null> {
  try {
    const res = await fetch(`/api/resume/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get resume (${res.status})`);
    const { data } = await res.json();
    return { ...data, createdAt: normalizeCreatedAt(data.createdAt) } as Resume;
  } catch (error) {
    console.error('❌ Error getting resume:', error);
    throw new Error('Failed to get resume');
  }
}

// The sidebar's "recent resume" and the page mount at the same moment and
// both asked /api/resume for the same list (two 300-500ms requests). A
// request already in flight is shared; nothing is cached after it settles,
// so a save or delete is always reflected on the next call.
let inflightResumes: Promise<Resume[]> | null = null;

export function getUserResumes(userId: string): Promise<Resume[]> {
  if (!inflightResumes) {
    inflightResumes = fetchUserResumes(userId).finally(() => { inflightResumes = null; });
  }
  // A copy each, so one caller re-sorting or filtering cannot affect another.
  return inflightResumes.then(list => [...list]);
}

async function fetchUserResumes(userId: string): Promise<Resume[]> {
  try {
    // The API route scopes to the caller's own authenticated session -
    // `userId` is accepted for signature compatibility with existing
    // callers but is otherwise unused (it always matches the caller anyway).
    void userId;

    const res = await fetch('/api/resume');
    if (!res.ok) throw new Error(`Failed to get user resumes (${res.status})`);
    const { data } = await res.json();

    const resumes: Resume[] = (data as Resume[]).map((r) => ({
      ...r,
      createdAt: normalizeCreatedAt(r.createdAt),
    }));

    resumes.sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as string).getTime();
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as string).getTime();
      return tb - ta;
    });

    return resumes;
  } catch (error) {
    console.error('❌ Error getting user resumes:', error);
    throw new Error('Failed to get user resumes');
  }
}

// ─── Class export (backward compatibility) ───────────────────────────────────

export class ResumeService {
  static saveResumeWithFiles = saveResumeWithFiles;
  static getResume           = getResume;
  static getUserResumes      = getUserResumes;
  static uploadResumePdf     = uploadResumePdf;
}

export default ResumeService;
