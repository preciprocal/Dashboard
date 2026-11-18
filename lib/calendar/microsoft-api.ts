// lib/calendar/microsoft-api.ts
// The Microsoft Graph calls for Outlook calendar. Plain fetch, no SDK.
// Events go on the user's default calendar (/me/events), like Google's primary.

import type { GoogleEventLite, OutlookEventPayload } from './events';
import { outlookToLite } from './events';
import type { FetchLike } from './oauth';

const BASE = 'https://graph.microsoft.com/v1.0';

export class GraphApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GraphApiError';
  }
}

async function call<T>(fetchImpl: FetchLike, token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="UTC"',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new GraphApiError(res.status, json.error?.message ?? `Outlook calendar returned ${res.status}`);
  return json as T;
}

type GraphEvent = { id: string; isCancelled?: boolean; start?: { dateTime?: string }; end?: { dateTime?: string } };

export async function insertOutlookEvent(token: string, ev: OutlookEventPayload, f: FetchLike = fetch): Promise<GoogleEventLite> {
  return outlookToLite(await call<GraphEvent>(f, token, 'POST', '/me/events', ev));
}

/** PATCH keeps attendees or categories the user added in Outlook. */
export async function patchOutlookEvent(token: string, eventId: string, ev: OutlookEventPayload, f: FetchLike = fetch): Promise<GoogleEventLite> {
  return outlookToLite(await call<GraphEvent>(f, token, 'PATCH', `/me/events/${encodeURIComponent(eventId)}`, ev));
}

/** Already gone (404) counts as deleted. */
export async function deleteOutlookEvent(token: string, eventId: string, f: FetchLike = fetch): Promise<void> {
  try {
    await call<void>(f, token, 'DELETE', `/me/events/${encodeURIComponent(eventId)}`);
  } catch (err) {
    if (err instanceof GraphApiError && (err.status === 404 || err.status === 410)) return;
    throw err;
  }
}

/**
 * Read back only our own events, by id, to follow ones the user moved or
 * deleted in Outlook. A deleted event comes back as undefined.
 */
export async function getOutlookEvents(token: string, ids: string[], f: FetchLike = fetch): Promise<Map<string, GoogleEventLite | undefined>> {
  const out = new Map<string, GoogleEventLite | undefined>();
  for (const id of ids) {
    try {
      const ev = await call<GraphEvent>(f, token, 'GET', `/me/events/${encodeURIComponent(id)}?$select=id,start,end,isCancelled`);
      out.set(id, outlookToLite(ev));
    } catch (err) {
      if (err instanceof GraphApiError && (err.status === 404 || err.status === 410)) out.set(id, undefined);
      else throw err;
    }
  }
  return out;
}
