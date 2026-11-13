// lib/contacts/client.ts
// Browser-side calls to /api/contacts. One place that knows the response
// shapes and turns a non-2xx into an Error carrying the server's message, so
// components only deal in contacts and messages.
import type { Contact, ContactInteraction, ContactStats } from './model';

/** The browser's offset, sent with every date-sensitive call (see model.ts). */
export const tzOffset = () => new Date().getTimezoneOffset();

export class ContactsApiError extends Error {
  status: number;
  code?: string;
  field?: string;
  payload?: Record<string, unknown>;
  constructor(message: string, status: number, code?: string, field?: string, payload?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
    this.payload = payload;
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
  });
  const data = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    throw new ContactsApiError(
      typeof data.error === 'string' ? data.error : `Request failed (${res.status})`,
      res.status,
      typeof data.code === 'string' ? data.code : undefined,
      typeof data.field === 'string' ? data.field : undefined,
      data,
    );
  }
  return data as T;
}

export interface ContactFilters {
  status?: string;
  relationship?: string;
  company?: string;
  due?: boolean;
}

export interface ContactsList {
  setupRequired?: boolean;
  contacts: Contact[];
  stats: ContactStats;
  companies: string[];
}

export function listContacts(f: ContactFilters = {}): Promise<ContactsList> {
  const p = new URLSearchParams({ tz: String(tzOffset()) });
  if (f.status) p.set('status', f.status);
  if (f.relationship) p.set('relationship', f.relationship);
  if (f.company) p.set('company', f.company);
  if (f.due) p.set('due', '1');
  return call<ContactsList>(`/api/contacts?${p.toString()}`);
}

export async function createContact(body: Record<string, unknown>): Promise<Contact> {
  return (await call<{ contact: Contact }>('/api/contacts', { method: 'POST', body: JSON.stringify(body) })).contact;
}

export async function updateContact(id: string, body: Record<string, unknown>): Promise<Contact> {
  return (await call<{ contact: Contact }>('/api/contacts', { method: 'PATCH', body: JSON.stringify({ ...body, id }) })).contact;
}

export async function deleteContact(id: string): Promise<void> {
  await call(`/api/contacts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listInteractions(contactId: string): Promise<ContactInteraction[]> {
  return (await call<{ interactions: ContactInteraction[] }>(`/api/contacts/interactions?contactId=${encodeURIComponent(contactId)}`)).interactions;
}

export function logInteraction(body: Record<string, unknown>): Promise<{ interaction: ContactInteraction; contact: Contact }> {
  return call('/api/contacts/interactions', { method: 'POST', body: JSON.stringify({ ...body, tz: tzOffset() }) });
}

export function dueCounts(): Promise<{ setupRequired?: boolean; due: number; overdue: number; dueToday: number }> {
  return call(`/api/contacts/due?tz=${tzOffset()}`);
}
