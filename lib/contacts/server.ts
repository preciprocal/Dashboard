// lib/contacts/server.ts
// Server-only pieces of the networking tracker shared by the /api/contacts
// routes: row mapping, the "migration not applied yet" check, and the
// responses for it.
import { NextResponse } from 'next/server';
import type { Contact, ContactInput, ContactInteraction, ContactSource, ContactStatus, InteractionType, Relationship } from './model';

export interface ContactRow {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship: string;
  status: string;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  replied_at: string | null;
  application_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface InteractionRow {
  id: string;
  contact_id: string;
  user_id: string;
  type: string;
  occurred_at: string;
  summary: string | null;
  created_at: string;
}

// The table's check constraints guarantee these values, so the casts only
// restate what the database already enforces.
export function toContact(r: ContactRow): Contact {
  return {
    id: r.id,
    name: r.name,
    role: r.role,
    company: r.company,
    email: r.email,
    linkedinUrl: r.linkedin_url,
    relationship: r.relationship as Relationship,
    status: r.status as ContactStatus,
    notes: r.notes,
    lastContactedAt: r.last_contacted_at,
    nextFollowUpAt: r.next_follow_up_at,
    repliedAt: r.replied_at,
    applicationId: r.application_id,
    source: r.source as ContactSource,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function toInteraction(r: InteractionRow): ContactInteraction {
  return {
    id: r.id,
    contactId: r.contact_id,
    type: r.type as InteractionType,
    occurredAt: r.occurred_at,
    summary: r.summary,
    createdAt: r.created_at,
  };
}

const COLUMN: Record<keyof ContactInput, keyof ContactRow> = {
  name: 'name',
  role: 'role',
  company: 'company',
  email: 'email',
  linkedinUrl: 'linkedin_url',
  relationship: 'relationship',
  status: 'status',
  notes: 'notes',
  nextFollowUpAt: 'next_follow_up_at',
  applicationId: 'application_id',
  source: 'source',
};

export function toColumns(input: ContactInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[COLUMN[k as keyof ContactInput]] = v;
  }
  return out;
}

/**
 * True when the error means migration 0062 has not been applied: Postgres
 * says 42P01 (relation does not exist), PostgREST says PGRST205 (table not in
 * its schema cache). The owner applies migrations by hand, so the feature has
 * to ship before its tables exist without breaking the page.
 */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205'
    || /relation .*contact.* does not exist|Could not find the table .*contact/i.test(err.message ?? '');
}

export const NOT_SET_UP_CODE = 'CONTACTS_NOT_SET_UP';

/** For writes: there is nowhere to put the data yet. */
export function notSetUpResponse() {
  return NextResponse.json(
    { error: 'Contacts are not set up yet. Please try again later.', code: NOT_SET_UP_CODE, setupRequired: true },
    { status: 503 },
  );
}
