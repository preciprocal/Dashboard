// app/api/webhooks/inbound-email/route.ts
// Recruiter emails forwarded to a user's private address update their tracker.
// See lib/inbound/process.ts for what happens to each email.
//
// SETUP (one-time):
//   1. DNS: add the MX record Resend shows for receiving on a subdomain, e.g.
//      in.preciprocal.com (a subdomain keeps the main domain's mail untouched).
//   2. Resend -> Domains: verify in.preciprocal.com for receiving.
//   3. Resend -> Webhooks -> Add endpoint:
//        https://app.preciprocal.com/api/webhooks/inbound-email
//      Event: email.received
//   4. Env: INBOUND_EMAIL_DOMAIN=in.preciprocal.com
//           RESEND_INBOUND_WEBHOOK_SECRET=<that webhook's whsec_ secret>
//
// Rejects everything until the secret is set: this endpoint changes users'
// application statuses, so an unsigned one would let anyone rewrite them.
//
// Resend sends every received email to every email.received webhook on the
// account, including mail for support@ (app/api/support/inbound-email). Mail
// not addressed to one of our tokens is acknowledged and ignored.
import { NextRequest, NextResponse } from 'next/server';
import { verifySvix } from '@/lib/webhooks/svix';
import { processInboundEmail } from '@/lib/inbound/process';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ReceivedEvent {
  type?: string;
  data?: { email_id?: string; to?: string[]; received_for?: string[]; cc?: string[] };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySvix(raw, req.headers, process.env.RESEND_INBOUND_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: ReceivedEvent;
  try { event = JSON.parse(raw) as ReceivedEvent; } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (event.type !== 'email.received' || !event.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // received_for holds the original address when mail reaches us forwarded.
  const recipients = [...(event.data.received_for ?? []), ...(event.data.to ?? []), ...(event.data.cc ?? [])];

  try {
    const result = await processInboundEmail(event.data.email_id, recipients);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('❌ inbound email failed:', err);
    // 500 so Svix retries; processing is idempotent on the Resend email id.
    return NextResponse.json({ error: 'Not processed' }, { status: 500 });
  }
}
