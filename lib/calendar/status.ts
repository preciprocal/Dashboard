// lib/calendar/status.ts
// The connection state the UI renders from. Shared by the status route, the
// schedule route and the client components.

export type CalendarProvider = 'google' | 'microsoft';

export const PROVIDER_NAME: Record<CalendarProvider, string> = { google: 'Google Calendar', microsoft: 'Outlook' };

export interface CalendarStatus {
  /** Some provider can be connected. When false the calendar parts of the UI are hidden. */
  configured: boolean;
  /** Which providers can be connected (env vars and tables in place). */
  available: Record<CalendarProvider, boolean>;
  /** The provider of the current connection (connected or broken), or null. */
  provider: CalendarProvider | null;
  /** Migration 0063 applied. */
  schemaReady: boolean;
  connected: boolean;
  /** The provider refused the refresh token; the user has to reconnect. */
  broken: boolean;
  email: string | null;
  connectedAt: string | null;
}

export const NOT_CONFIGURED: CalendarStatus = {
  configured: false, available: { google: false, microsoft: false }, provider: null, schemaReady: false, connected: false, broken: false, email: null, connectedAt: null,
};

export const CONNECT_PATH = '/api/integrations/google-calendar/connect';
export const MS_CONNECT_PATH = '/api/integrations/microsoft-calendar/connect';

/** Where "Connect" sends the browser, coming back to `returnTo` afterwards. */
export function connectHref(returnTo: string, provider: CalendarProvider = 'google'): string {
  return `${provider === 'microsoft' ? MS_CONNECT_PATH : CONNECT_PATH}?return=${encodeURIComponent(returnTo)}`;
}

/** The ?calendar= value the callback leaves on the return URL, as a message. */
export function callbackMessage(v: string | null): { ok: boolean; text: string } | null {
  switch (v) {
    case 'connected': return { ok: true, text: 'Google Calendar connected' };
    case 'denied': return { ok: false, text: 'Google Calendar was not connected. You can try again any time.' };
    case 'missing-scope': return { ok: false, text: 'Calendar access was not granted. Tick the calendar permission on the Google screen to connect.' };
    case 'unavailable': return { ok: false, text: 'Google Calendar is not available right now.' };
    case 'expired': return { ok: false, text: 'That sign-in took too long or came from another tab. Please connect again.' };
    case 'error': return { ok: false, text: 'Could not connect Google Calendar. Please try again.' };
    case 'outlook-connected': return { ok: true, text: 'Outlook calendar connected' };
    case 'outlook-denied': return { ok: false, text: 'Outlook was not connected. You can try again any time.' };
    case 'outlook-missing-scope': return { ok: false, text: 'Calendar access was not granted. Accept the calendar permission on the Microsoft screen to connect.' };
    case 'outlook-unavailable': return { ok: false, text: 'Outlook calendar is not available right now.' };
    case 'outlook-expired': return { ok: false, text: 'That sign-in took too long or came from another tab. Please connect again.' };
    case 'outlook-error': return { ok: false, text: 'Could not connect Outlook. Please try again.' };
    default: return null;
  }
}

/** One scheduled interview as the tracker sees it. */
export interface InterviewSchedule {
  applicationId: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  stage: string;
  meetingUrl: string | null;
  notes: string | null;
  /** True when a Google Calendar event backs it. */
  onGoogle: boolean;
  /** The calendar an event for it lives on, if any. */
  onCalendar: CalendarProvider | null;
}

/** What the schedule API reports about the calendar for one save or delete. */
export type GoogleSyncResult = 'created' | 'updated' | 'deleted' | 'skipped' | 'reconnect' | 'failed';

/** Interviews not yet over that start within `days`, soonest first. */
export function upcomingWithin(schedules: InterviewSchedule[], days: number, now = Date.now()): InterviewSchedule[] {
  const until = now + days * 86_400_000;
  return schedules
    .filter((s) => new Date(s.endsAt).getTime() >= now && new Date(s.startsAt).getTime() <= until)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
