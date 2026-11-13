// lib/contacts/model.ts
// The networking tracker's rules, kept free of React, Next and Supabase so
// the API routes, the Contacts page and scripts/verify-contacts.ts all run
// the same code: what a status means, when a follow-up is due, how the reply
// rate is counted, and what a valid contact looks like.

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const CONTACT_STATUSES = ['to_contact', 'contacted', 'replied', 'meeting_set', 'referred', 'closed'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const RELATIONSHIPS = ['recruiter', 'hiring_manager', 'referral', 'alumni', 'peer', 'other'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const INTERACTION_TYPES = ['email', 'linkedin', 'call', 'meeting', 'note'] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const CONTACT_SOURCES = ['manual', 'find_contacts', 'outreach'] as const;
export type ContactSource = (typeof CONTACT_SOURCES)[number];

export const STATUS_LABELS: Record<ContactStatus, string> = {
  to_contact: 'To contact',
  contacted: 'Contacted',
  replied: 'Replied',
  meeting_set: 'Meeting set',
  referred: 'Referred',
  closed: 'Closed',
};

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  referral: 'Referral',
  alumni: 'Alumni',
  peer: 'Peer',
  other: 'Other',
};

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  call: 'Call',
  meeting: 'Meeting',
  note: 'Note',
};

/** The "Set follow-up" quick picks, in days. */
export const FOLLOW_UP_PRESETS = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
] as const;

/** A per-user ceiling, so one account cannot fill the table. Far above any real search. */
export const MAX_CONTACTS_PER_USER = 2000;

export interface Contact {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  linkedinUrl: string | null;
  relationship: Relationship;
  status: ContactStatus;
  notes: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  repliedAt: string | null;
  applicationId: string | null;
  source: ContactSource;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInteraction {
  id: string;
  contactId: string;
  type: InteractionType;
  occurredAt: string;
  summary: string | null;
  createdAt: string;
}

export const isStatus = (v: unknown): v is ContactStatus =>
  typeof v === 'string' && (CONTACT_STATUSES as readonly string[]).includes(v);
export const isRelationship = (v: unknown): v is Relationship =>
  typeof v === 'string' && (RELATIONSHIPS as readonly string[]).includes(v);
export const isInteractionType = (v: unknown): v is InteractionType =>
  typeof v === 'string' && (INTERACTION_TYPES as readonly string[]).includes(v);
export const isSource = (v: unknown): v is ContactSource =>
  typeof v === 'string' && (CONTACT_SOURCES as readonly string[]).includes(v);

// ─── Status transitions ──────────────────────────────────────────────────────
// The pipeline is ordered; 'closed' sits outside it because a conversation
// can end at any stage. People can set any status by hand. What is decided
// here is only the automatic move when an interaction is logged, and that
// move is never backwards: logging an email to someone who already referred
// you must not demote them to "contacted".

const PIPELINE_RANK: Record<Exclude<ContactStatus, 'closed'>, number> = {
  to_contact: 0, contacted: 1, replied: 2, meeting_set: 3, referred: 4,
};

/** Statuses that mean the person wrote back. */
export function hasReplied(status: ContactStatus): boolean {
  return status === 'replied' || status === 'meeting_set' || status === 'referred';
}

/**
 * The status after logging an interaction of `type`. Outreach on any channel
 * means the person has at least been contacted; a meeting means one is at
 * least set. A note changes nothing, and a closed contact stays closed until
 * the user reopens it on purpose.
 */
export function statusAfterInteraction(current: ContactStatus, type: InteractionType): ContactStatus {
  if (current === 'closed' || type === 'note') return current;
  const floor: ContactStatus = type === 'meeting' ? 'meeting_set' : 'contacted';
  return PIPELINE_RANK[floor] > PIPELINE_RANK[current] ? floor : current;
}

/** Interactions that count as reaching out, and so move last_contacted_at. */
export function isOutreach(type: InteractionType): boolean {
  return type !== 'note';
}

/** replied_at is write-once: set the first time the status means a reply. */
export function repliedAtFor(previous: string | null, nextStatus: ContactStatus, nowIso: string): string | null {
  if (previous) return previous;
  return hasReplied(nextStatus) ? nowIso : null;
}

// ─── Dates and "due" ─────────────────────────────────────────────────────────
// "Due today" is a calendar question, and the calendar is the user's, not the
// server's: a follow-up for Tuesday is due all of Tuesday in New York even
// once it is Wednesday in UTC. Callers pass the browser's
// Date.getTimezoneOffset() (minutes, positive west of UTC), and every
// boundary is computed in that local day.

const DAY_MS = 86_400_000;

/** Clamp a client-supplied offset to the real range of time zones. */
export function safeTzOffset(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(-14 * 60, Math.min(12 * 60, Math.round(n)));
}

/** UTC millis of local midnight at the start of the local day containing `now`. */
export function startOfLocalDay(now: Date, tzOffsetMin: number): number {
  const local = new Date(now.getTime() - tzOffsetMin * 60_000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + tzOffsetMin * 60_000;
}

/** UTC millis of the end of the local day (exclusive): local midnight tomorrow. */
export function endOfLocalDay(now: Date, tzOffsetMin: number): number {
  return startOfLocalDay(now, tzOffsetMin) + DAY_MS;
}

/**
 * The follow-up date `days` from today, at local noon. Noon rather than
 * midnight so the stored instant never slides into the neighbouring day when
 * it is shown in a slightly different offset (daylight saving, travel).
 */
export function followUpDate(days: number, now: Date, tzOffsetMin: number): string {
  const start = startOfLocalDay(now, tzOffsetMin);
  return new Date(start + days * DAY_MS + 12 * 3_600_000).toISOString();
}

/** A local calendar date (YYYY-MM-DD, as an <input type="date"> gives it) to local noon. */
export function localDateToIso(date: string, tzOffsetMin: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) + tzOffsetMin * 60_000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** The reverse: an instant to its local YYYY-MM-DD, for prefilling a date input. */
export function isoToLocalDate(iso: string | null, tzOffsetMin: number): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t - tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

/** Whole local days from today to `iso`: 0 today, 1 tomorrow, -2 two days ago. */
export function daysFromToday(iso: string, now: Date, tzOffsetMin: number): number {
  const t = Date.parse(iso);
  const start = startOfLocalDay(now, tzOffsetMin);
  return Math.floor((t - start) / DAY_MS);
}

type DueFields = Pick<Contact, 'status' | 'nextFollowUpAt'>;

/** Due: open, with a follow-up date of today or earlier. */
export function isDue(c: DueFields, now: Date, tzOffsetMin: number): boolean {
  if (c.status === 'closed' || !c.nextFollowUpAt) return false;
  const t = Date.parse(c.nextFollowUpAt);
  return Number.isFinite(t) && t < endOfLocalDay(now, tzOffsetMin);
}

/** Overdue: due, and the date was before today. */
export function isOverdue(c: DueFields, now: Date, tzOffsetMin: number): boolean {
  if (!isDue(c, now, tzOffsetMin)) return false;
  return Date.parse(c.nextFollowUpAt as string) < startOfLocalDay(now, tzOffsetMin);
}

/** "Today", "Tomorrow", "In 5 days", "3 days overdue", for the follow-up column. */
export function followUpLabel(iso: string | null, now: Date, tzOffsetMin: number): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'Not set';
  const d = daysFromToday(iso, now, tzOffsetMin);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return '1 day overdue';
  if (d < -1) return `${-d} days overdue`;
  if (d < 7) return `In ${d} days`;
  if (d < 14) return 'In 1 week';
  return `In ${Math.floor(d / 7)} weeks`;
}

/** "Today", "Yesterday", "4 days ago", "3 weeks ago", for the last contact column. */
export function lastContactLabel(iso: string | null, now: Date, tzOffsetMin: number): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'Never';
  const d = -daysFromToday(iso, now, tzOffsetMin);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 14) return '1 week ago';
  if (d < 60) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

type RateFields = Pick<Contact, 'status' | 'lastContactedAt' | 'repliedAt'>;

/**
 * Share of people reached who wrote back, as a whole percentage, or null when
 * nobody has been reached yet (0% would read as "nobody replies"). People
 * still on "to contact" were never asked, so they are not in the denominator;
 * anyone who replied counts, even if since closed.
 */
export function replyRate(contacts: RateFields[]): number | null {
  let reached = 0;
  let replied = 0;
  for (const c of contacts) {
    const didReply = !!c.repliedAt || hasReplied(c.status);
    const wasReached = didReply || !!c.lastContactedAt || c.status !== 'to_contact';
    if (wasReached) reached++;
    if (didReply) replied++;
  }
  return reached === 0 ? null : Math.round((replied / reached) * 100);
}

export interface ContactStats {
  total: number;
  due: number;
  overdue: number;
  dueToday: number;
  replyRate: number | null;
  byStatus: Record<ContactStatus, number>;
}

export function computeStats(contacts: (RateFields & DueFields)[], now: Date, tzOffsetMin: number): ContactStats {
  const byStatus = Object.fromEntries(CONTACT_STATUSES.map(s => [s, 0])) as Record<ContactStatus, number>;
  let due = 0;
  let overdue = 0;
  for (const c of contacts) {
    byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    if (isDue(c, now, tzOffsetMin)) {
      due++;
      if (isOverdue(c, now, tzOffsetMin)) overdue++;
    }
  }
  return { total: contacts.length, due, overdue, dueToday: due - overdue, replyRate: replyRate(contacts), byStatus };
}

/** Due first (most overdue at the top), then by soonest follow-up, then most recent activity. */
export function sortForList<T extends DueFields & Pick<Contact, 'updatedAt'>>(contacts: T[], now: Date, tzOffsetMin: number): T[] {
  return [...contacts].sort((a, b) => {
    const ad = isDue(a, now, tzOffsetMin), bd = isDue(b, now, tzOffsetMin);
    if (ad !== bd) return ad ? -1 : 1;
    const af = a.status !== 'closed' && a.nextFollowUpAt ? Date.parse(a.nextFollowUpAt) : Infinity;
    const bf = b.status !== 'closed' && b.nextFollowUpAt ? Date.parse(b.nextFollowUpAt) : Infinity;
    if (af !== bf) return af - bf;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}

// ─── Input validation ────────────────────────────────────────────────────────
// Shared by the API (the authority) and the form (so it can say what is wrong
// before a round trip). Every field is optional on update; on create only the
// name is required.

export interface ContactInput {
  name?: string;
  role?: string | null;
  company?: string | null;
  email?: string | null;
  linkedinUrl?: string | null;
  relationship?: Relationship;
  status?: ContactStatus;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  applicationId?: string | null;
  source?: ContactSource;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string; field?: string };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

export function isValidEmail(v: string): boolean {
  return v.length <= 254 && EMAIL_RE.test(v);
}

/**
 * A LinkedIn profile URL, normalised to https. Pasted links arrive as
 * "linkedin.com/in/x", "www.linkedin.com/in/x/" or with tracking params; any
 * of those is fine. Anything not on linkedin.com is refused, because the link
 * is rendered as a clickable "LinkedIn" button and must go where it says.
 */
export function normaliseLinkedIn(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { return null; }
  const host = url.hostname.toLowerCase();
  if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return null;
  if (url.pathname.length <= 1) return null;
  const out = `https://${host}${url.pathname.replace(/\/+$/, '')}`;
  return out.length <= 300 ? out : null;
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/\s+/g, ' ');
  return t ? t.slice(0, max) : null;
}

function longText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** An ISO instant within a sane window, or null to clear. */
function instant(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === '') return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false };
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return { ok: false };
  const year = new Date(t).getUTCFullYear();
  if (year < 2000 || year > 2100) return { ok: false };
  return { ok: true, value: new Date(t).toISOString() };
}

export function parseContactInput(body: Record<string, unknown>, mode: 'create' | 'update'): Parsed<ContactInput> {
  const out: ContactInput = {};

  if ('name' in body || mode === 'create') {
    const name = text(body.name, 120);
    if (!name) return { ok: false, error: 'Name is required', field: 'name' };
    out.name = name;
  }
  if ('role' in body) out.role = text(body.role, 160);
  if ('company' in body) out.company = text(body.company, 160);
  if ('notes' in body) out.notes = longText(body.notes, 4000);

  if ('email' in body) {
    const email = text(body.email, 254);
    if (email && !isValidEmail(email)) return { ok: false, error: 'Enter a valid email address', field: 'email' };
    out.email = email ? email.toLowerCase() : null;
  }

  if ('linkedinUrl' in body) {
    const raw = typeof body.linkedinUrl === 'string' ? body.linkedinUrl.trim() : '';
    if (raw) {
      const url = normaliseLinkedIn(raw);
      if (!url) return { ok: false, error: 'Use a linkedin.com profile link', field: 'linkedinUrl' };
      out.linkedinUrl = url;
    } else {
      out.linkedinUrl = null;
    }
  }

  if ('relationship' in body) {
    if (!isRelationship(body.relationship)) return { ok: false, error: 'Unknown relationship', field: 'relationship' };
    out.relationship = body.relationship;
  }
  if ('status' in body) {
    if (!isStatus(body.status)) return { ok: false, error: 'Unknown status', field: 'status' };
    out.status = body.status;
  }

  if ('nextFollowUpAt' in body) {
    const at = instant(body.nextFollowUpAt);
    if (!at.ok) return { ok: false, error: 'Follow-up date is not valid', field: 'nextFollowUpAt' };
    out.nextFollowUpAt = at.value;
  }

  if ('applicationId' in body) {
    const id = body.applicationId;
    if (id === null || id === '') out.applicationId = null;
    else if (isUuid(id)) out.applicationId = id;
    else return { ok: false, error: 'applicationId is not valid', field: 'applicationId' };
  }

  // The source says where a contact came from, so it is fixed at creation.
  if (mode === 'create') {
    if ('source' in body && !isSource(body.source)) return { ok: false, error: 'Unknown source', field: 'source' };
    out.source = isSource(body.source) ? body.source : 'manual';
  }

  if (mode === 'update' && Object.keys(out).length === 0) return { ok: false, error: 'No valid fields to update' };
  return { ok: true, value: out };
}

export interface InteractionInput {
  type: InteractionType;
  occurredAt: string;
  summary: string | null;
  /** undefined: leave the follow-up alone; null: clear it; string: set it. */
  nextFollowUpAt?: string | null;
}

/**
 * Validates a logged interaction. The follow-up can be given as days from
 * today (the quick picks) or an explicit instant; days win when both arrive,
 * since they are what the buttons send.
 */
export function parseInteractionInput(body: Record<string, unknown>, now: Date, tzOffsetMin: number): Parsed<InteractionInput> {
  if (!isInteractionType(body.type)) return { ok: false, error: 'Choose how you were in touch', field: 'type' };

  let occurredAt = now.toISOString();
  if (body.occurredAt !== undefined && body.occurredAt !== null && body.occurredAt !== '') {
    const at = instant(body.occurredAt);
    if (!at.ok || !at.value) return { ok: false, error: 'Date is not valid', field: 'occurredAt' };
    // A day of slack for time zones; anything later is a typo, and a future
    // "last contacted" would hide the contact from every overdue view.
    if (Date.parse(at.value) > now.getTime() + DAY_MS) return { ok: false, error: 'That date is in the future', field: 'occurredAt' };
    occurredAt = at.value;
  }

  const out: InteractionInput = { type: body.type, occurredAt, summary: longText(body.summary, 2000) };

  if (body.followUpDays !== undefined && body.followUpDays !== null) {
    const days = Number(body.followUpDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) return { ok: false, error: 'Follow-up must be within a year', field: 'followUpDays' };
    out.nextFollowUpAt = days === 0 ? null : followUpDate(days, now, tzOffsetMin);
  } else if ('nextFollowUpAt' in body) {
    const at = instant(body.nextFollowUpAt);
    if (!at.ok) return { ok: false, error: 'Follow-up date is not valid', field: 'nextFollowUpAt' };
    out.nextFollowUpAt = at.value;
  }

  return { ok: true, value: out };
}

/**
 * A first guess at the relationship from a job title, for contacts saved
 * from Find Contacts. Only a default: the user can change it in one click.
 */
export function guessRelationship(position: string | null | undefined): Relationship {
  const p = (position ?? '').toLowerCase();
  if (/recruit|talent|sourc|\bhr\b|human resources|people (ops|partner)/.test(p)) return 'recruiter';
  if (/manager|director|head of|\blead\b|vp\b|vice president|founder|\bc[a-z]o\b|chief/.test(p)) return 'hiring_manager';
  return 'other';
}

// ─── Links out ───────────────────────────────────────────────────────────────

/**
 * Cold Outreach in Career Tools, prefilled for this person. Career Tools only
 * reads these params (it already honours ?tool=outreach), so the link is
 * harmless if any are missing.
 */
export function outreachHref(c: Pick<Contact, 'name' | 'role' | 'company' | 'email' | 'linkedinUrl'>): string {
  const p = new URLSearchParams({ tool: 'outreach' });
  if (c.name) p.set('name', c.name);
  if (c.role) p.set('role', c.role);
  if (c.company) p.set('company', c.company);
  // Default the channel to the one we can actually reach them on.
  p.set('platform', !c.email && c.linkedinUrl ? 'linkedin' : 'email');
  return `/career-tools?${p.toString()}`;
}
