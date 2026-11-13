// lib/calendar/google-api.ts
// The four Calendar API v3 calls the feature makes. Plain fetch, no SDK: the
// googleapis package is tens of megabytes for four endpoints.

import { EVENT_MARKER_KEY, EVENT_MARKER_VALUE, type GoogleEventLite, type GoogleEventPayload } from './events';
import type { FetchLike } from './oauth';

const BASE = 'https://www.googleapis.com/calendar/v3';

export class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

async function call<T>(fetchImpl: FetchLike, token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new GoogleApiError(res.status, json.error?.message ?? `Google Calendar returned ${res.status}`);
  return json as T;
}

const cal = (id: string) => `/calendars/${encodeURIComponent(id)}/events`;

export function insertEvent(token: string, calendarId: string, ev: GoogleEventPayload, f: FetchLike = fetch) {
  return call<GoogleEventLite>(f, token, 'POST', cal(calendarId), ev);
}

/** PATCH, not PUT, so attendees or a colour the user added in Google survive a reschedule. */
export function patchEvent(token: string, calendarId: string, eventId: string, ev: GoogleEventPayload, f: FetchLike = fetch) {
  return call<GoogleEventLite>(f, token, 'PATCH', `${cal(calendarId)}/${encodeURIComponent(eventId)}`, ev);
}

/** Already gone (404 / 410) counts as deleted. */
export async function deleteEvent(token: string, calendarId: string, eventId: string, f: FetchLike = fetch): Promise<void> {
  try {
    await call<void>(f, token, 'DELETE', `${cal(calendarId)}/${encodeURIComponent(eventId)}`);
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}

/**
 * Only events Preciprocal created: Google filters on the private extended
 * property server side, so nothing else on the calendar is returned to us.
 * showDeleted so an event the user deleted in Google comes back as
 * "cancelled" and the card can drop its calendar link.
 */
export async function listOurEvents(token: string, calendarId: string, timeMin: Date, timeMax: Date, f: FetchLike = fetch): Promise<GoogleEventLite[]> {
  const q = new URLSearchParams({
    privateExtendedProperty: `${EVENT_MARKER_KEY}=${EVENT_MARKER_VALUE}`,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    showDeleted: 'true',
    maxResults: '100',
    fields: 'items(id,status,start,end)',
  });
  const res = await call<{ items?: GoogleEventLite[] }>(f, token, 'GET', `${cal(calendarId)}?${q.toString()}`);
  return res.items ?? [];
}
