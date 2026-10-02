// app/api/webhooks/resend/route.ts
// Delivery events for the emails we send: delivered, opened, clicked,
// bounced, complained. Stored in email_events (migration 0046) and joined to
// email_sends by Resend's message id, which is how the admin analytics page
// shows open and click rates per email type and per user.
//
// SETUP (one-time, in the Resend dashboard):
//   1. Webhooks -> Add endpoint: https://app.preciprocal.com/api/webhooks/resend
//      Events: email.delivered, email.opened, email.clicked, email.bounced,
//      email.complained, email.delivery_delayed
//   2. Copy its signing secret (whsec_...) into RESEND_WEBHOOK_SECRET.
//   3. Domains -> preciprocal.com -> turn on open tracking and click tracking.
//      Without these Resend never sends opened/clicked events.
//
// Rejects everything until RESEND_WEBHOOK_SECRET is set: an unsigned endpoint
// would let anyone write fake engagement into the numbers decisions are made on.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/supabase/admin';
import { verifySvix } from '@/lib/webhooks/svix';

export const runtime = 'nodejs';

const TRACKED = new Set(['delivered', 'opened', 'clicked', 'bounced', 'complained', 'delivery_delayed']);

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    click?: { link?: string };
  };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySvix(raw, req.headers, process.env.RESEND_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: ResendEvent;
  try { payload = JSON.parse(raw) as ResendEvent; } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = (payload.type ?? '').replace(/^email\./, '');
  const resendId = payload.data?.email_id;
  // Acknowledge what we do not track, so Resend does not keep retrying it.
  if (!TRACKED.has(event) || !resendId) return NextResponse.json({ ok: true, ignored: true });

  const { error } = await supabaseAdmin.from('email_events').upsert({
    resend_id: resendId,
    event,
    link: payload.data?.click?.link?.slice(0, 500) ?? null,
    // Svix retries until it gets a 2xx; the unique message id makes a retry a no-op.
    webhook_id: req.headers.get('svix-id'),
    created_at: payload.created_at ?? new Date().toISOString(),
  }, { onConflict: 'webhook_id', ignoreDuplicates: true });

  if (error) {
    console.error('❌ Resend webhook insert failed:', error.message);
    // 500 so Svix retries later rather than the event being lost.
    return NextResponse.json({ error: 'Not stored' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
