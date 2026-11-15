// lib/applications/pack.ts
//
// Everything the "Apply to this job" flow produces for one tracked
// application: the proposed resume changes and the user's decisions, keyword
// coverage before and after, the cover letter, the per-round prep pack and the
// notes from each round.
//
// Stored as one JSON file per application in the private `user-files` bucket
// (applications/<supabase user id>/<application id>.json) rather than a new
// table: it is read and written whole, by its owner only, and needs no
// migration to ship.

import { supabaseAdmin } from '@/supabase/admin';
import type { CheckedChange, Coverage } from '@/lib/applications/truthful-tailor';
import type { AuthStage, SponsorshipAnswer } from '@/lib/applications/sponsorship';
import type { EverifyStatus } from '@/lib/jobs/everify';
import type { H1bHistory } from '@/lib/jobs/h1b';

const BUCKET = 'user-files';
export const PACK_VERSION = 1;

export type Decision = 'approved' | 'rejected';

export interface StarStory {
  id: string;
  question: string;
  /** The resume line the story is built from, verbatim. */
  sourceLine: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export interface PrepPack {
  generatedAt: string;
  recruiter: {
    pitch: string;
    whyCompany: string;
    salaryApproach: string[];
    sponsorship: SponsorshipAnswer | null;
  };
  /** Public records for the company, as of the dates given. */
  employerRecords: {
    everify: EverifyStatus | null;
    everifySyncedAt: string | null;
    h1b: H1bHistory | null;
    h1bDataThrough: string | null;
  };
  technical: {
    topics: { topic: string; fromJob: string; questions: string[] }[];
  };
  behavioral: { stories: StarStory[] };
  hiringManager: {
    impactStories: { title: string; sourceLine: string; talkingPoints: string[] }[];
    first90Days: string[];
    questionsToAsk: string[];
  };
  /** Set by a round debrief: what to focus on next. */
  nextRoundFocus?: { afterRound: string; points: string[] } | null;
}

export interface RoundLog {
  id: string;
  round: string;
  date: string;
  notes: string;
  debriefId: string | null;
  nextRoundFocus: string[];
  thankYou: { subject: string; body: string } | null;
  createdAt: string;
}

export interface ApplyPack {
  version: number;
  applicationId: string;
  company: string;
  role: string;
  jobDescription: string;
  resumeId: string | null;
  authStage: AuthStage | null;
  keywords: string[];
  tailor: {
    generatedAt: string;
    original: string;
    changes: CheckedChange[];
    /** How many proposed changes the fact checks removed. */
    removedByChecks: number;
    decisions: Record<string, Decision>;
    before: Coverage;
    after: Coverage;
    tailoredText: string;
    /**
     * The student's own PDF, edited in place (lib/applications/pdf-edit.ts).
     * A copy is kept with the application so the file sent is the one that
     * was tailored, under the name they gave it. Null when the resume has no
     * PDF whose text could be edited: then only the text is tailored.
     */
    source?: { fileName: string } | null;
    /** Changes that passed the fact checks but did not fit the file's layout. */
    layoutSkipped?: number;
  } | null;
  coverLetter: { content: string; generatedAt: string } | null;
  prep: PrepPack | null;
  rounds: RoundLog[];
  planId: string | null;
  savedToTrackerAt: string | null;
  /** When the employer's form was opened from step 3 (auto mode asks, on return, whether it was submitted). */
  portalOpenedAt?: string | null;
  /** When auto mode ran on this application (it runs once). */
  autoRunAt?: string | null;
  updatedAt: string;
}

export interface TrackedApplication {
  id: string;
  company: string;
  jobTitle: string;
  jobUrl: string | null;
  status: string;
  jobDescription: string | null;
  resumeId: string | null;
}

const pathFor = (userId: string, applicationId: string) => `applications/${userId}/${applicationId}.json`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The user's own tracked application, or null. */
export async function getApplication(userId: string, applicationId: string): Promise<TrackedApplication | null> {
  if (!UUID_RE.test(applicationId)) return null;
  const { data, error } = await supabaseAdmin
    .from('job_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    company: data.company ?? '',
    jobTitle: data.job_title ?? '',
    jobUrl: data.job_url ?? null,
    status: data.status ?? 'wishlist',
    jobDescription: (data as { job_description?: string | null }).job_description ?? null,
    resumeId: data.resume_id ?? null,
  };
}

export function newPack(app: TrackedApplication): ApplyPack {
  return {
    version: PACK_VERSION,
    applicationId: app.id,
    company: app.company,
    role: app.jobTitle,
    jobDescription: app.jobDescription ?? '',
    resumeId: app.resumeId,
    authStage: null,
    keywords: [],
    tailor: null,
    coverLetter: null,
    prep: null,
    rounds: [],
    planId: null,
    savedToTrackerAt: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadPack(userId: string, app: TrackedApplication): Promise<ApplyPack> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(pathFor(userId, app.id));
  if (error || !data) return newPack(app);
  try {
    const pack = JSON.parse(await data.text()) as ApplyPack;
    if (pack.version !== PACK_VERSION || pack.applicationId !== app.id) return newPack(app);
    return pack;
  } catch {
    return newPack(app);
  }
}

export async function savePack(userId: string, pack: ApplyPack): Promise<ApplyPack> {
  const next = { ...pack, updatedAt: new Date().toISOString() };
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(pathFor(userId, pack.applicationId), JSON.stringify(next), { contentType: 'application/json', upsert: true });
  if (error) throw error;
  return next;
}

export type PackFile = 'resume' | 'letter' | 'source';
const pdfPathFor = (userId: string, applicationId: string, kind: PackFile = 'resume') => `applications/${userId}/${applicationId}.${kind}.pdf`;

export async function deletePack(userId: string, applicationId: string): Promise<void> {
  await supabaseAdmin.storage.from(BUCKET).remove([
    pathFor(userId, applicationId), pdfPathFor(userId, applicationId, 'resume'), pdfPathFor(userId, applicationId, 'letter'),
    pdfPathFor(userId, applicationId, 'source'),
  ]);
}

/**
 * Stores this application's tailored resume (or cover letter) PDF and returns
 * a link to it that expires in 10 minutes: long enough for the extension to
 * fetch and attach it to the employer's form.
 */
export async function storeTailoredPdf(userId: string, applicationId: string, bytes: Uint8Array, kind: PackFile = 'resume'): Promise<string | null> {
  const path = pdfPathFor(userId, applicationId, kind);
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) return null;
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Keeps the original resume PDF that this application's tailoring edits. */
export async function storeSourcePdf(userId: string, applicationId: string, bytes: Uint8Array): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(BUCKET)
    .upload(pdfPathFor(userId, applicationId, 'source'), bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw error;
}

export async function loadSourcePdf(userId: string, applicationId: string): Promise<Uint8Array | null> {
  const { data } = await supabaseAdmin.storage.from(BUCKET).download(pdfPathFor(userId, applicationId, 'source'));
  return data ? new Uint8Array(await data.arrayBuffer()) : null;
}
