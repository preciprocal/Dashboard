// app/api/support/inbound-email/route.ts
//
// Receives inbound emails from Resend Inbound and saves admin replies to Firestore.
//
// SETUP (one-time):
//   1. In Resend dashboard → Inbound → add domain "preciprocal.com"
//   2. Create a catch-all route for "support@preciprocal.com"
//   3. Set webhook URL to: https://your-domain.com/api/support/inbound-email
//   4. Set INBOUND_WEBHOOK_SECRET in .env.local to the Resend signing secret
//      (the `whsec_...` value from the webhook's settings). REQUIRED - this
//      route rejects every request until it is set, because it writes into
//      customer support threads.
//   5. Ensure NEXT_PUBLIC_APP_URL is set to your production domain
//
// FLOW: Admin replies to ticket email → email hits support@preciprocal.com →
//       Resend fires this webhook → reply saved to Firestore → user notified.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { Resend } from 'resend';
import { SITE } from '@/lib/seo';
import { renderEmail, renderText, escapeHtml, firstName } from '@/lib/email/layout';

const resend = new Resend(process.env.RESEND_API_KEY);

const WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET;

/**
 * Verify the Svix signature Resend sends on inbound webhooks.
 *
 * Resend uses Svix, so the signed payload is `${id}.${timestamp}.${body}` and
 * the `svix-signature` header carries one or more space-separated
 * `v1,<base64>` values (more than one during a secret rotation). The secret
 * itself is `whsec_<base64>`; the bytes after that prefix are the HMAC key.
 */
function verifySignature(raw: string, headers: Headers): boolean {
  const id        = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature || !WEBHOOK_SECRET) return false;

  // Reject anything older than 5 minutes so a captured request cannot be
  // replayed indefinitely.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${raw}`)
    .digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Constant-time compare against every offered signature; a plain === would
  // leak position-of-first-difference via timing.
  return signature.split(' ').some(part => {
    const provided = part.startsWith('v1,') ? part.slice(3) : part;
    const buf = Buffer.from(provided);
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
}

// ─── Resend inbound payload ───────────────────────────────────────────────────
// Resend sends the from field as a plain string "Name <email>" or just "email"
interface ResendInboundPayload {
  from:    string;
  to:      string | string[];
  subject: string;
  text?:   string;
  html?:   string;
}

export async function POST(request: NextRequest) {
  try {
    // ── Authenticate the webhook ─────────────────────────────────────────────
    // This endpoint writes directly into support ticket threads, so without a
    // signature check anyone who found the URL could inject forged replies
    // that look like they came from the support team.
    //
    // Fails CLOSED when the secret is unset. An unauthenticated writer into
    // customer conversations is worse than a support inbox that stops
    // ingesting until INBOUND_WEBHOOK_SECRET is configured - and the loud 503
    // is what makes a missing secret noticeable at all.
    const raw = await request.text();

    if (!WEBHOOK_SECRET) {
      console.error('❌ INBOUND_WEBHOOK_SECRET is not set - rejecting inbound email webhook');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    if (!verifySignature(raw, request.headers)) {
      console.warn('⚠️ Rejected inbound email webhook: bad or missing signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(raw) as ResendInboundPayload;
    const { from, subject, text, html } = body;

    if (!subject) {
      return NextResponse.json({ error: 'Missing subject' }, { status: 400 });
    }

    // ── Extract ticket ID from subject ─────────────────────────────────────────
    // Subject format: "[Ticket #FULL_TICKET_ID] Subject text"
    const ticketIdMatch = subject.match(/\[Ticket #([^\]]+)\]/);
    if (!ticketIdMatch) {
      console.warn('⚠️ No ticket ID in subject:', subject);
      return NextResponse.json({ error: 'No ticket reference in subject' }, { status: 400 });
    }

    const ticketId = ticketIdMatch[1].trim();
    console.log('📧 Inbound reply for ticket:', ticketId);

    // ── Look up ticket in Postgres ─────────────────────────────────────────────
    const { data: ticketData, error: fetchError } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!ticketData) {
      console.error('❌ Ticket not found:', ticketId);
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // ── Parse sender email from "Name <email>" format ─────────────────────────
    const fromEmail = parseEmail(from);

    // ── Clean the reply body ─────────────────────────────────────────────────
    const rawBody    = text || html || '';
    const cleanReply = cleanEmailReply(rawBody);

    if (!cleanReply.trim()) {
      console.warn('⚠️ Reply body empty after cleaning — likely a quoted-only reply');
      return NextResponse.json({ success: true, message: 'Empty reply body ignored' });
    }

    // ── Save reply to Postgres ─────────────────────────────────────────────────
    const { error: replyError } = await supabaseAdmin.from('support_ticket_replies').insert({
      ticket_id: ticketId,
      body: cleanReply,
      from_email: fromEmail,
      is_staff: true,
    });
    if (replyError) throw replyError;

    // ── Ticket meta is maintained by a trigger ───────────────────────────────
    //
    // sync_ticket_on_reply (migration 0036) sets status, reply_count,
    // last_reply_by, last_reply_at and updated_at from the reply that was just
    // inserted. This route used to set them itself, and the help page set the
    // same columns differently on a user reply - two writers, one of them
    // counting from client state, disagreeing about the same four columns.
    //
    // reply_count here was `(ticketData.reply_count ?? 0) + 1`, read before
    // the insert, so two replies arriving together both read the same value
    // and both wrote the same result.

    console.log('✅ Reply saved for ticket:', ticketId);

    // ── Notify user via email ─────────────────────────────────────────────────
    await notifyUserOfReply(
      ticketData.user_email as string,
      ticketData.user_name  as string,
      ticketId,
      ticketData.subject    as string,
      cleanReply,
    );

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    console.error('❌ Inbound email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Parse email address from "Name <email>" or plain "email" ────────────────
function parseEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1].trim() : from.trim();
}

// ─── Send reply notification email to the user ───────────────────────────────
async function notifyUserOfReply(
  userEmail: string,
  userName:  string,
  ticketId:  string,
  subject:   string,
  reply:     string,
): Promise<void> {
  try {
    // Clean the subject — strip any "Re:" prefixes and the ticket reference
    const cleanSubject = subject
      .replace(/^(re:\s*)+/gi, '')
      .replace(/\[Ticket #[^\]]+\]\s*/g, '')
      .trim();

    const shortId = ticketId.slice(0, 8).toUpperCase();

    const { error } = await resend.emails.send({
      from:    'Preciprocal Support <admin@preciprocal.com>',
      to:      userEmail,
      replyTo: 'support@preciprocal.com',
      subject: `[Ticket #${shortId}] Re: ${cleanSubject}`,
      html:    generateReplyEmail(userName, shortId, cleanSubject, reply, ticketId),
      text:    generateReplyText(userName, shortId, cleanSubject, reply, ticketId),
    });

    if (error) console.error('❌ User reply notification error:', error);
    else        console.log('✅ User notified of reply for ticket:', ticketId);
  } catch (err) {
    console.error('❌ Failed to notify user:', err);
  }
}

// ─── Strip quoted text and email metadata from the reply body ────────────────
function cleanEmailReply(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // Strip HTML if present
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<div id="divRplyFwdMsg"[\s\S]*$/gi, '')
      .replace(/<div class="gmail_quote"[\s\S]*$/gi, '')
      .replace(/<div class="gmail_attr"[\s\S]*?<\/div>/gi, '')
      .replace(/<div class="yahoo_quoted"[\s\S]*$/gi, '')
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<p[^>]*>\s*<b>From:<\/b>[\s\S]*$/gi, '')
      .replace(/<div[^>]*>\s*<b>From:<\/b>[\s\S]*$/gi, '')
      .replace(/<hr[\s\S]*?>/gi, '\n---\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  const lines = text.split('\n');
  const clean: string[] = [];

  const stopPatterns = [
    /^From:\s/i,
    /^Sent:\s/i,
    /^On .+wrote:$/i,
    /^On .+\d{4}.+wrote:/i,
    /^-{3,}/,
    /^_{3,}/,
    /^\s*>/,
  ];

  // Metadata injected by our own admin email template — stop here to avoid
  // the admin accidentally forwarding internal ticket details to the user.
  const metaStopPatterns = [
    /^New Support Ticket$/i,
    /^Support request submitted$/i,
    /^#[A-Z0-9]{6,}$/,
    /^Customer$/i,
    /^Category$/i,
    /^Priority$/i,
    /^Submitted$/i,
    /^(high|medium|low)( priority)?$/i,
    /^(general|technical|billing|feature|bug)$/i,
    /^Internal Admin Notification$/i,
    /^Reply to this email to respond$/i,
    /^Preciprocal\s*·\s*Internal/i,
    /^\[Ticket #/i,
  ];

  for (const line of lines) {
    const t = line.trim();
    if (t === '' && clean.length === 0) continue;
    if (stopPatterns.some(p => p.test(t)))     break;
    if (metaStopPatterns.some(p => p.test(t))) break;
    clean.push(line);
  }

  // Remove trailing blank lines
  while (clean.length > 0 && clean[clean.length - 1].trim() === '') clean.pop();

  // Strip common email signatures
  const result = clean.join('\n')
    .replace(/\n--\s*\n[\s\S]*$/, '')
    .replace(/\nSent from my (iPhone|iPad|Android|Galaxy|Pixel)[\s\S]*$/i, '')
    .replace(/\nGet Outlook for [\s\S]*$/i, '')
    .trim();

  return result;
}

// ─── Reply email sent to the user ────────────────────────────────────────────
function generateReplyEmail(
  userName: string,
  shortId: string,
  subject: string,
  reply: string,
  ticketId: string,
): string {
  // The agent's reply is plain text from an inbox, so it is escaped and then
  // newlines are turned back into <br />. Escaping after that conversion would
  // render the tags as literal text.
  const body = escapeHtml(reply).replace(/\n/g, '<br />');

  return renderEmail({
    preheader: `Reply on ticket #${shortId}`,
    eyebrow: `Ticket #${shortId}`,
    heading: 'We have replied',
    paragraphs: [
      `Hi ${escapeHtml(firstName(userName))},`,
      'Someone from the team has replied to your support ticket.',
    ],
    panel: {
      title: escapeHtml(subject) || 'Your ticket',
      rows: [{ label: 'Reply', value: body }],
    },
    cta: { label: 'View the full thread', url: `${SITE.app}/help?ticket=${ticketId}` },
    signoff: 'Just reply to this email to continue the conversation.<br />Preciprocal Support',
    footerNote: 'You are receiving this because you opened a support ticket with Preciprocal.',
  });
}

function generateReplyText(
  userName: string,
  shortId: string,
  subject: string,
  reply: string,
  ticketId: string,
): string {
  return renderText({
    heading: `Reply on ticket #${shortId}`,
    paragraphs: [
      `Hi ${firstName(userName)},`,
      'Someone from the team has replied to your support ticket.',
      subject ? `Subject: ${subject}` : '',
      '',
      reply,
    ].filter(Boolean),
    cta: { label: 'View the full thread', url: `${SITE.app}/help?ticket=${ticketId}` },
    signoff: 'Just reply to this email to continue the conversation.\nPreciprocal Support',
    footerNote: 'You opened a support ticket with Preciprocal.',
  });
}
