// app/api/inbound/route.ts
// The user's forwarding address and what recent forwarded emails did.
//
//   GET                       address + the last 20 emails
//   POST {action:'rotate'}    a new address; the old one stops working
//   POST {action:'undo', id}  put the application back to its previous status
//   POST {action:'apply', id, applicationId?}
//                             apply a suggested change (needs_review), or
//                             attach an unmatched email to an application
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { getOrCreateAddress, rotateAddress, INBOUND_DOMAIN } from '@/lib/inbound/address';
import { applyStatus } from '@/lib/applications/apply-status';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!INBOUND_DOMAIN) return NextResponse.json({ success: true, enabled: false });

  try {
    const address = await getOrCreateAddress(user.supabaseUserId);
    const { data: emails } = await supabaseAdmin
      .from('inbound_emails')
      .select('id, subject, received_at, kind, company, job_title, evidence, confirmation, application_id, previous_status, new_status, outcome')
      .eq('user_id', user.supabaseUserId)
      .order('received_at', { ascending: false })
      .limit(20);
    return NextResponse.json({ success: true, enabled: true, address, emails: emails ?? [] });
  } catch (err) {
    // Most likely migration 0057 is not applied yet.
    console.error('❌ inbound GET:', err);
    return NextResponse.json({ success: true, enabled: false });
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const uid = user.supabaseUserId;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (body.action === 'rotate') {
      return NextResponse.json({ success: true, address: await rotateAddress(uid) });
    }

    const id = typeof body.id === 'string' ? body.id : '';
    const { data: row } = await supabaseAdmin
      .from('inbound_emails')
      .select('id, user_id, application_id, previous_status, new_status, outcome')
      .eq('id', id)
      .maybeSingle();
    if (!row || row.user_id !== uid) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.action === 'undo') {
      if (row.outcome !== 'applied' || !row.application_id || !row.previous_status) {
        return NextResponse.json({ error: 'Nothing to undo' }, { status: 400 });
      }
      // Only if nobody has moved the card since; otherwise undo would
      // silently throw away the user's own later change.
      const { data: app } = await supabaseAdmin.from('job_applications').select('status').eq('id', row.application_id).maybeSingle();
      if (app?.status !== row.new_status) {
        return NextResponse.json({ error: 'This application has changed since. Update it on the board instead.' }, { status: 409 });
      }
      await applyStatus(uid, row.application_id as string, row.previous_status as string);
      await supabaseAdmin.from('inbound_emails').update({ outcome: 'undone' }).eq('id', id);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'apply') {
      if (!['needs_review', 'unmatched'].includes(row.outcome as string) || !row.new_status) {
        return NextResponse.json({ error: 'Nothing to apply' }, { status: 400 });
      }
      const applicationId = typeof body.applicationId === 'string' && body.applicationId ? body.applicationId : (row.application_id as string | null);
      if (!applicationId) return NextResponse.json({ error: 'Choose an application' }, { status: 400 });
      const done = await applyStatus(uid, applicationId, row.new_status as string);
      if (!done) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      await supabaseAdmin.from('inbound_emails')
        .update({ outcome: 'applied', application_id: applicationId, previous_status: done.previous })
        .eq('id', id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('❌ inbound POST:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
