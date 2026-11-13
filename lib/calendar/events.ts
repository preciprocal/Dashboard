// lib/calendar/events.ts
// What an interview looks like on a calendar, built once and used three ways:
// the Google Calendar event, the .ics download, and the card on the tracker.
//
// Pure and isomorphic. The API route builds the Google payload from it; the
// modal builds the .ics from it when Calendar is not connected, so both carry
// the same title, description and links.

import { zonedWallTimeToUtc, isValidTimeZone, type WallTime } from './time';

// ─── Stages ──────────────────────────────────────────────────────────────────
// The tracker statuses that mean "an interview is coming". Kept in step with
// INTERVIEW_STATUSES in lib/config/outcomes.ts; 'other' covers an informal
// chat or an assessment the board has no column for.

export type InterviewStage = 'phone-screen' | 'technical' | 'final' | 'other';

export const INTERVIEW_STAGES: { value: InterviewStage; label: string }[] = [
  { value: 'phone-screen', label: 'Phone screen' },
  { value: 'technical', label: 'Technical' },
  { value: 'final', label: 'Final round' },
  { value: 'other', label: 'Other' },
];

const TRACKER_INTERVIEW_STATUSES = ['phone-screen', 'technical', 'final'] as const;

/** Whether a tracker card should offer "Add to calendar". */
export function isInterviewStatus(status: string): boolean {
  return (TRACKER_INTERVIEW_STATUSES as readonly string[]).includes(status);
}

/** The stage to preselect for a card, from its tracker status. */
export function stageForStatus(status: string): InterviewStage {
  return isInterviewStatus(status) ? (status as InterviewStage) : 'other';
}

export function stageLabel(stage: string): string {
  return INTERVIEW_STAGES.find((s) => s.value === stage)?.label ?? 'Interview';
}

export function parseStage(v: unknown): InterviewStage {
  return INTERVIEW_STAGES.some((s) => s.value === v) ? (v as InterviewStage) : 'other';
}

// ─── Input ───────────────────────────────────────────────────────────────────

export const DURATIONS = [30, 45, 60, 90] as const;
export const MAX_DURATION = 8 * 60;

export interface ScheduleInput {
  applicationId: string;
  company: string;
  jobTitle: string;
  wall: WallTime;
  timeZone: string;
  durationMinutes: number;
  stage: InterviewStage;
  meetingUrl: string | null;
  notes: string | null;
}

export interface ResolvedSchedule extends ScheduleInput {
  start: Date;
  end: Date;
}

/** Only http(s) links. A javascript: URL in a calendar description is a link someone will click. */
export function cleanMeetingUrl(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

/** Validate and resolve to real instants. Returns an error message instead of throwing. */
export function resolveSchedule(input: ScheduleInput): ResolvedSchedule | { error: string } {
  if (!isValidTimeZone(input.timeZone)) return { error: 'Unknown timezone' };
  const d = Math.round(input.durationMinutes);
  if (!Number.isFinite(d) || d < 5 || d > MAX_DURATION) return { error: 'Duration must be between 5 minutes and 8 hours' };
  const start = zonedWallTimeToUtc(input.wall, input.timeZone);
  if (!start) return { error: 'Enter a valid date and time' };
  const end = new Date(start.getTime() + d * 60_000);
  return { ...input, durationMinutes: d, start, end };
}

// ─── Copy ────────────────────────────────────────────────────────────────────

export function eventTitle(jobTitle: string, company: string): string {
  const role = jobTitle.trim() || 'Interview';
  const co = company.trim();
  return co ? `Interview: ${role} at ${co}` : `Interview: ${role}`;
}

export function trackerUrl(appUrl: string, applicationId: string): string {
  return `${appUrl.replace(/\/$/, '')}/job-tracker?application=${encodeURIComponent(applicationId)}`;
}

export function practiceUrl(appUrl: string, applicationId: string): string {
  return `${appUrl.replace(/\/$/, '')}/interview/create?application=${encodeURIComponent(applicationId)}`;
}

/** Plain text: Google shows it as-is and .ics has no markup. */
export function eventDescription(s: ScheduleInput, appUrl: string): string {
  const lines = [`${stageLabel(s.stage)} for ${s.jobTitle.trim() || 'the role'}${s.company.trim() ? ` at ${s.company.trim()}` : ''}.`];
  if (s.meetingUrl) lines.push('', `Join: ${s.meetingUrl}`);
  if (s.notes?.trim()) lines.push('', s.notes.trim());
  lines.push(
    '',
    `Practise this interview: ${practiceUrl(appUrl, s.applicationId)}`,
    `Application: ${trackerUrl(appUrl, s.applicationId)}`,
    '',
    'Added by Preciprocal.',
  );
  return lines.join('\n');
}

// ─── Google Calendar ─────────────────────────────────────────────────────────

/** Private extended property Preciprocal stamps on its events, so it can list only its own. */
export const EVENT_MARKER_KEY = 'preciprocal';
export const EVENT_MARKER_VALUE = 'interview';

export interface GoogleEventPayload {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  source: { title: string; url: string };
  reminders: { useDefault: boolean; overrides?: { method: 'popup'; minutes: number }[] };
  extendedProperties: { private: Record<string, string> };
}

export function buildGoogleEvent(s: ResolvedSchedule, appUrl: string): GoogleEventPayload {
  return {
    summary: eventTitle(s.jobTitle, s.company),
    description: eventDescription(s, appUrl),
    ...(s.meetingUrl ? { location: s.meetingUrl } : {}),
    // UTC instants plus the zone: the instant is unambiguous and Google uses
    // the zone for display and for recurring-rule maths (none here).
    start: { dateTime: s.start.toISOString(), timeZone: s.timeZone },
    end: { dateTime: s.end.toISOString(), timeZone: s.timeZone },
    source: { title: 'Preciprocal job tracker', url: trackerUrl(appUrl, s.applicationId) },
    // A day before to prepare, half an hour before to join.
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }, { method: 'popup', minutes: 30 }] },
    extendedProperties: { private: { [EVENT_MARKER_KEY]: EVENT_MARKER_VALUE, applicationId: s.applicationId } },
  };
}

/** The Google event fields we read back when reconciling a moved or deleted event. */
export interface GoogleEventLite {
  id: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

/**
 * What changed on Google since we wrote the event: the user can drag it in
 * Google Calendar or delete it there, and the card should follow.
 */
export function reconcileEvent(
  stored: { startsAt: string; endsAt: string },
  ev: GoogleEventLite | undefined,
): { kind: 'same' } | { kind: 'moved'; startsAt: string; endsAt: string } | { kind: 'deleted' } {
  if (!ev || ev.status === 'cancelled') return { kind: 'deleted' };
  const s = ev.start?.dateTime;
  const e = ev.end?.dateTime;
  if (!s || !e) return { kind: 'same' }; // turned into an all-day event; leave our time alone
  const startsAt = new Date(s).toISOString();
  const endsAt = new Date(e).toISOString();
  if (startsAt === new Date(stored.startsAt).toISOString() && endsAt === new Date(stored.endsAt).toISOString()) return { kind: 'same' };
  return { kind: 'moved', startsAt, endsAt };
}
