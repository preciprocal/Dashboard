// app/api/contacts/interactions/route.ts
// A contact's timeline. Logging an interaction is also how the contact moves
// on: it stamps last_contacted_at, advances the status (never backwards, see
// statusAfterInteraction) and can set the next follow-up in the same request,
// so "I emailed them, remind me in a week" is one action.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { applyRateLimit } from '@/lib/ai/rate-limit';
import { supabaseAdmin } from '@/supabase/admin';
import {
  isOutreach, isUuid, parseInteractionInput, repliedAtFor, safeTzOffset, statusAfterInteraction,
  type ContactStatus,
} from '@/lib/contacts/model';
import { isMissingTable, notSetUpResponse, toContact, toInteraction, type ContactRow, type InteractionRow } from '@/lib/contacts/server';

// ─── GET - ?contactId= ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;
  const uid = user.supabaseUserId;

  const contactId = new URL(request.url).searchParams.get('contactId');
  if (!isUuid(contactId)) return NextResponse.json({ error: 'contactId is required' }, { status: 400 });

  try {
    // user_id is on the interaction row itself, so this one filter is the
    // owner check: another user's contact id simply returns nothing.
    const { data, error } = await supabaseAdmin
      .from('contact_interactions')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', uid)
      .order('occurred_at', { ascending: false })
      .limit(200);
    if (isMissingTable(error)) return NextResponse.json({ success: true, setupRequired: true, interactions: [] });
    if (error) throw error;
    return NextResponse.json({ success: true, interactions: (data as InteractionRow[]).map(toInteraction) });
  } catch (error) {
    console.error('❌ contact interactions GET:', error);
    return NextResponse.json({ error: 'Failed to load the timeline' }, { status: 500 });
  }
}

// ─── POST - log one ──────────────────────────────────────────────────────────
// { contactId, type, occurredAt?, summary?, followUpDays? | nextFollowUpAt?, tz? }

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await applyRateLimit(request, user.userId, 'light');
  if (limited) return limited;
  const uid = user.supabaseUserId;

  let body: Record<string, unknown>;
  try {
    const b = await request.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('not an object');
    body = b as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!isUuid(body.contactId)) return NextResponse.json({ error: 'contactId is required' }, { status: 400 });

  const now = new Date();
  const parsed = parseInteractionInput(body, now, safeTzOffset(body.tz));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  const input = parsed.value;

  try {
    const { data: contact, error: readErr } = await supabaseAdmin
      .from('contacts')
      .select('id, status, last_contacted_at, replied_at')
      .eq('id', body.contactId)
      .eq('user_id', uid)
      .maybeSingle();
    if (isMissingTable(readErr)) return notSetUpResponse();
    if (readErr) throw readErr;
    if (!contact) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: created, error: insErr } = await supabaseAdmin
      .from('contact_interactions')
      .insert({
        contact_id: contact.id,
        user_id: uid,
        type: input.type,
        occurred_at: input.occurredAt,
        summary: input.summary,
      })
      .select('*')
      .single();
    if (isMissingTable(insErr)) return notSetUpResponse();
    if (insErr) throw insErr;

    const nowIso = now.toISOString();
    const nextStatus = statusAfterInteraction(contact.status as ContactStatus, input.type);
    const prevLast = contact.last_contacted_at as string | null;
    // Logging an older conversation after a newer one must not move "last
    // contacted" back in time.
    const lastContacted = isOutreach(input.type) && (!prevLast || Date.parse(input.occurredAt) > Date.parse(prevLast))
      ? input.occurredAt
      : prevLast;

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('contacts')
      .update({
        status: nextStatus,
        last_contacted_at: lastContacted,
        replied_at: repliedAtFor((contact.replied_at as string | null) ?? null, nextStatus, nowIso),
        ...(input.nextFollowUpAt !== undefined ? { next_follow_up_at: input.nextFollowUpAt } : {}),
        updated_at: nowIso,
      })
      .eq('id', contact.id)
      .eq('user_id', uid)
      .select('*')
      .single();
    if (updErr) throw updErr;

    return NextResponse.json({
      success: true,
      interaction: toInteraction(created as InteractionRow),
      contact: toContact(updated as ContactRow),
    }, { status: 201 });
  } catch (error) {
    console.error('❌ contact interactions POST:', error);
    return NextResponse.json({ error: 'Failed to log the interaction' }, { status: 500 });
  }
}
