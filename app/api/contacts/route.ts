// app/api/contacts/route.ts
// The networking tracker: list, create, update and delete the people a job
// seeker is talking to. Service-role access, so every query is scoped to the
// caller's own rows here, not left to RLS.
//
// Before migration 0062 is applied, GET answers { setupRequired: true } with
// an empty list (the page shows a "not set up yet" note) and writes answer
// 503 CONTACTS_NOT_SET_UP, instead of a 500 from a missing table.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { supabaseAdmin } from '@/supabase/admin';
import {
  MAX_CONTACTS_PER_USER, computeStats, endOfLocalDay, isRelationship, isStatus, isUuid,
  parseContactInput, repliedAtFor, safeTzOffset, sortForList, type ContactStatus,
} from '@/lib/contacts/model';
import { isMissingTable, notSetUpResponse, toColumns, toContact, type ContactRow } from '@/lib/contacts/server';

const STATS_COLUMNS = 'status, next_follow_up_at, last_contacted_at, replied_at, company';

/** Escape LIKE wildcards so a company filter matches literally. */
const likeLiteral = (s: string) => s.replace(/[\\%_]/g, m => `\\${m}`);

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json();
    return b && typeof b === 'object' && !Array.isArray(b) ? b as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** An application id is only linked if it is the caller's own. */
async function ownsApplication(uid: string, applicationId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('job_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', uid)
    .maybeSingle();
  return !!data;
}

// ─── GET - list, with filters and stats ──────────────────────────────────────
// ?status=&relationship=&company=&q=&due=1&tz=<getTimezoneOffset()>

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;
  const uid = user.supabaseUserId;

  const sp = new URL(request.url).searchParams;
  const tz = safeTzOffset(sp.get('tz'));
  const now = new Date();
  const status = sp.get('status');
  const relationship = sp.get('relationship');
  const company = sp.get('company')?.trim().slice(0, 160) || '';
  const q = sp.get('q')?.trim().toLowerCase().slice(0, 100) || '';
  const dueOnly = sp.get('due') === '1';

  try {
    let query = supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
      .limit(MAX_CONTACTS_PER_USER);
    if (isStatus(status)) query = query.eq('status', status);
    if (isRelationship(relationship)) query = query.eq('relationship', relationship);
    if (company) query = query.ilike('company', likeLiteral(company));
    if (dueOnly) {
      query = query
        .neq('status', 'closed')
        .not('next_follow_up_at', 'is', null)
        .lt('next_follow_up_at', new Date(endOfLocalDay(now, tz)).toISOString());
    }

    // Stats and the company list describe everything the user has, not the
    // filtered view, so they come from their own (narrow) query.
    const [listRes, allRes] = await Promise.all([
      query,
      supabaseAdmin.from('contacts').select(STATS_COLUMNS).eq('user_id', uid).limit(MAX_CONTACTS_PER_USER),
    ]);

    if (isMissingTable(listRes.error) || isMissingTable(allRes.error)) {
      return NextResponse.json({ success: true, setupRequired: true, contacts: [], stats: computeStats([], now, tz), companies: [] });
    }
    if (listRes.error) throw listRes.error;
    if (allRes.error) throw allRes.error;

    let contacts = (listRes.data as ContactRow[]).map(toContact);
    // Free-text search runs here rather than in PostgREST's or() filter,
    // whose syntax would need commas and brackets in the query escaped. A
    // user's list is capped, so this is cheap.
    if (q) {
      contacts = contacts.filter(c =>
        [c.name, c.company, c.role, c.email].some(v => v?.toLowerCase().includes(q)));
    }

    const all = (allRes.data as Pick<ContactRow, 'status' | 'next_follow_up_at' | 'last_contacted_at' | 'replied_at' | 'company'>[]);
    const stats = computeStats(all.map(r => ({
      status: r.status as ContactStatus,
      nextFollowUpAt: r.next_follow_up_at,
      lastContactedAt: r.last_contacted_at,
      repliedAt: r.replied_at,
    })), now, tz);
    const companies = [...new Map(all.filter(r => r.company).map(r => [r.company!.toLowerCase(), r.company!])).values()]
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ success: true, contacts: sortForList(contacts, now, tz), stats, companies });
  } catch (error) {
    console.error('❌ contacts GET:', error);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

// ─── POST - create ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;
  const uid = user.supabaseUserId;

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = parseContactInput(body, 'create');
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  const input = parsed.value;

  try {
    if (input.applicationId && !(await ownsApplication(uid, input.applicationId))) {
      return NextResponse.json({ error: 'Application not found', field: 'applicationId' }, { status: 400 });
    }

    const { count, error: countErr } = await supabaseAdmin
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid);
    if (isMissingTable(countErr)) return notSetUpResponse();
    if (countErr) throw countErr;
    if ((count ?? 0) >= MAX_CONTACTS_PER_USER) {
      return NextResponse.json({ error: `You can keep up to ${MAX_CONTACTS_PER_USER} contacts. Delete some to add more.` }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const status = input.status ?? 'to_contact';
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        ...toColumns(input),
        user_id: uid,
        status,
        replied_at: repliedAtFor(null, status, nowIso),
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('*')
      .single();

    if (error?.code === '23505' && input.email) {
      // Same email already saved: hand back that row so "Save to contacts"
      // can say "already saved" and open it, instead of failing.
      const { data: existing } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', uid)
        // parseContactInput lowercases emails, so stored ones are lowercase.
        .eq('email', input.email)
        .maybeSingle();
      return NextResponse.json(
        { error: 'A contact with this email already exists', code: 'DUPLICATE', duplicate: true, contact: existing ? toContact(existing as ContactRow) : null },
        { status: 409 },
      );
    }
    if (isMissingTable(error)) return notSetUpResponse();
    if (error) throw error;

    return NextResponse.json({ success: true, contact: toContact(data as ContactRow) }, { status: 201 });
  } catch (error) {
    console.error('❌ contacts POST:', error);
    return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 });
  }
}

// ─── PATCH - update ──────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;
  const uid = user.supabaseUserId;

  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  if (!isUuid(body.id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const id = body.id;
  const { id: _omit, ...fields } = body;
  void _omit;
  const parsed = parseContactInput(fields, 'update');
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  const input = parsed.value;

  try {
    // Scoped to the caller: someone else's id reads as not found, so the
    // endpoint does not confirm which ids exist.
    const { data: existing, error: readErr } = await supabaseAdmin
      .from('contacts')
      .select('id, status, replied_at')
      .eq('id', id)
      .eq('user_id', uid)
      .maybeSingle();
    if (isMissingTable(readErr)) return notSetUpResponse();
    if (readErr) throw readErr;
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (input.applicationId && !(await ownsApplication(uid, input.applicationId))) {
      return NextResponse.json({ error: 'Application not found', field: 'applicationId' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const nextStatus = input.status ?? (existing.status as ContactStatus);
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({
        ...toColumns(input),
        replied_at: repliedAtFor((existing.replied_at as string | null) ?? null, nextStatus, nowIso),
        updated_at: nowIso,
      })
      .eq('id', id)
      .eq('user_id', uid)
      .select('*')
      .single();
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Another contact already uses this email', field: 'email', code: 'DUPLICATE' }, { status: 409 });
    }
    if (error) throw error;

    return NextResponse.json({ success: true, contact: toContact(data as ContactRow) });
  } catch (error) {
    console.error('❌ contacts PATCH:', error);
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

// ─── DELETE - ?id= ───────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;
  const uid = user.supabaseUserId;

  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  try {
    // Interactions go with it (on delete cascade).
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', uid)
      .select('id');
    if (isMissingTable(error)) return notSetUpResponse();
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ contacts DELETE:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
