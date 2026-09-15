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

    // ── Update ticket meta ────────────────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin.from('support_tickets').update({
      status: 'in-progress',
      updated_at: nowIso,
      last_reply_by: 'support',
      last_reply_at: nowIso,
      reply_count: (ticketData.reply_count ?? 0) + 1,
    }).eq('id', ticketId);
    if (updateError) throw updateError;

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
  userName:     string,
  shortId:      string,
  subject:      string,
  replyMessage: string,
  fullTicketId: string,
): string {
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://preciprocal.com';
  const ticketUrl = `${appUrl}/help?section=tickets`;

  const safeMessage = replyMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Support Reply · Ticket #${shortId}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f5f7;">
    Our support team replied to your ticket #${shortId} &zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <tr>
          <td style="padding:0 0 0;background:#0f0f1a;border-bottom:1px solid #1e1e2e;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:28px 36px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="middle">
                        <p style="margin:0 0 2px;font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">Preciprocal</p>
                        <p style="margin:0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.4px;">Support Team</p>
                      </td>
                      <td align="right" valign="middle">
                        <span style="display:inline-block;background:#1e1e2e;color:#818cf8;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:1px solid #2e2e4e;letter-spacing:0.2px;">
                          #${shortId}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 28px;">

            <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;">You have a reply</p>
            <p style="margin:0 0 26px;font-size:14px;color:#6b7280;line-height:1.5;">
              Hi ${userName}, our support team has responded to your ticket.
            </p>

            <!-- Subject chip -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr>
                <td style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;">
                  <p style="margin:0 0 2px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Subject</p>
                  <p style="margin:0;font-size:14px;color:#374151;font-weight:500;">${subject}</p>
                </td>
              </tr>
            </table>

            <!-- Reply block -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#fafafa;border:1px solid #e5e7eb;border-left:3px solid #4f46e5;border-radius:8px;padding:22px 24px;">
                  <!-- Agent label -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                    <tr>
                      <td valign="middle">
                        <span style="display:inline-block;width:28px;height:28px;background:#4f46e5;border-radius:50%;text-align:center;line-height:28px;font-size:12px;font-weight:700;color:#ffffff;vertical-align:middle;">P</span>
                        <span style="font-size:13px;font-weight:600;color:#374151;vertical-align:middle;margin-left:8px;">Preciprocal Support</span>
                      </td>
                      <td align="right" valign="middle">
                        <span style="font-size:12px;color:#9ca3af;">Support reply</span>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:0;font-size:14px;line-height:1.75;color:#1f2937;white-space:pre-wrap;word-break:break-word;">${safeMessage}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${ticketUrl}"
                     style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
                    View Full Conversation
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info note -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 16px;">
                  <p style="margin:0;font-size:13px;color:#0369a1;line-height:1.5;">
                    You can also reply directly to this email to continue the conversation, or visit your dashboard to see the full ticket history.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="height:1px;background:#f3f4f6;font-size:0;">&nbsp;</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;background:#f9fafb;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#374151;">Preciprocal</p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    <a href="https://preciprocal.com" style="color:#6b7280;text-decoration:none;">preciprocal.com</a>
                    &nbsp;·&nbsp;
                    <a href="${appUrl}/help" style="color:#6b7280;text-decoration:none;">Help Center</a>
                    &nbsp;·&nbsp;
                    <a href="https://preciprocal.com/privacy" style="color:#6b7280;text-decoration:none;">Privacy</a>
                  </p>
                </td>
                <td align="right" valign="top">
                  <p style="margin:0;font-size:11px;color:#d1d5db;font-family:monospace;">#${fullTicketId}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        This was sent because you submitted a support ticket at preciprocal.com
      </p>

    </td></tr>
  </table>
</body>
</html>`;
}
