// app/api/support/ticket-created/route.ts
// Called by the Help page right after it inserts a support ticket. Emails the
// team about the new ticket and sends the user their "we received it" copy.
//
// Moved from app/api/firebase/emails, a leftover of the Firestore era, which
// trusted the request body for everything: who to email, and what to say. Any
// caller could send the confirmation template, with their own subject and
// message in it, from our support address to any inbox. Now the caller must
// be signed in, the ticket is read from the database, it must be theirs, and
// it must be new, so the route can only ever confirm a ticket the caller has
// just opened.
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { emailAppUrl } from '@/lib/email/app-url';
import { renderEmail, renderText, firstName } from '@/lib/email/layout';
import { recordEmailSend } from '@/lib/email/track';

const resend = new Resend(process.env.RESEND_API_KEY);

/** Older than this and the ticket is not "just opened": refuse, so the route cannot be replayed. */
const FRESH_TICKET_MS = 10 * 60 * 1000;

interface SupportTicket {
  userName:  string;
  userEmail: string;
  subject:   string;
  message:   string;
  category:  string;
  priority:  'high' | 'medium' | 'low';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const bodySchema = z.object({ ticketId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser(request);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const { ticketId } = parsed.data;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const { data: row } = await supabaseAdmin
      .from('support_tickets')
      .select('user_id, user_email, user_name, subject, message, category, priority, created_at')
      .eq('id', ticketId)
      .eq('user_id', authedUser.supabaseUserId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (Date.now() - new Date(row.created_at as string).getTime() > FRESH_TICKET_MS) {
      return NextResponse.json({ error: 'Ticket is not new' }, { status: 409 });
    }

    const priority = ['high', 'medium', 'low'].includes(row.priority as string)
      ? (row.priority as SupportTicket['priority'])
      : 'medium';
    const ticket: SupportTicket = {
      // The account's own address, never one supplied by the caller.
      userEmail: authedUser.email ?? (row.user_email as string),
      userName:  (row.user_name as string) || 'there',
      subject:   (row.subject as string) || '(no subject)',
      message:   (row.message as string) || '',
      category:  (row.category as string) || 'general',
      priority,
    };
    if (!ticket.userEmail) return NextResponse.json({ error: 'No email on account' }, { status: 400 });

    const { data: sub } = await supabaseAdmin
      .from('subscriptions').select('plan, status').eq('user_id', authedUser.supabaseUserId).maybeSingle();
    const hasSla = String(sub?.plan ?? '').toLowerCase() === 'premium'
      && ['active', 'trialing'].includes(String(sub?.status ?? 'active'));

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@preciprocal.com';
    const shortId    = ticketId.slice(0, 8).toUpperCase();

    // ── 1. Admin notification ─────────────────────────────────────────────────
    // IMPORTANT: replyTo is support@preciprocal.com (NOT userEmail).
    // When the admin replies, the email routes through the inbound webhook
    // which saves the reply to the ticket and notifies the user automatically.
    // Ensure Resend Inbound is configured to route support@preciprocal.com
    // to: https://your-domain.com/api/support/inbound-email
    const { data: adminData, error: adminError } = await resend.emails.send({
      from:    'Preciprocal Support <support@preciprocal.com>',
      to:      adminEmail,
      replyTo: 'support@preciprocal.com',
      subject: `[Ticket #${ticketId}] ${ticket.subject}`,
      html:    generateAdminEmail(ticketId, shortId, ticket),
    });

    if (adminError) console.error('❌ Admin email error:', adminError);
    else            console.log('✅ Admin notification sent:', adminData?.id);

    // ── 2. User confirmation ──────────────────────────────────────────────────
    const { data: userData, error: userError } = await resend.emails.send({
      from:    'Preciprocal Support <support@preciprocal.com>',
      to:      ticket.userEmail,
      replyTo: 'support@preciprocal.com',
      subject: `[Ticket #${shortId}] We received your request`,
      html:    generateUserConfirmationEmail(ticket.userName, shortId, ticketId, ticket.subject, ticket.message, hasSla),
      text:    generateUserConfirmationText(ticket.userName, shortId, ticketId, ticket.subject, ticket.message, hasSla),
    });

    if (userError) console.error('❌ User confirmation error:', userError);
    else {
      console.log('✅ User confirmation sent:', userData?.id);
      await recordEmailSend({
        resendId: userData?.id,
        userId: authedUser.supabaseUserId,
        emailType: 'ticket_received',
        subject: `[Ticket #${shortId}] We received your request`,
      });
    }

    return NextResponse.json({ success: true, adminEmailId: adminData?.id, userEmailId: userData?.id });
  } catch (error) {
    console.error('❌ Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN EMAIL - Professional dark-themed internal notification
// ─────────────────────────────────────────────────────────────────────────────
function generateAdminEmail(ticketId: string, shortId: string, ticket: SupportTicket): string {
  const priorityMeta: Record<string, { color: string; bg: string; stripe: string; label: string }> = {
    high:   { color: '#f85149', bg: 'rgba(248,81,73,0.12)',  stripe: '#f85149', label: 'High Priority'   },
    medium: { color: '#e3b341', bg: 'rgba(227,179,65,0.12)', stripe: '#e3b341', label: 'Medium Priority' },
    low:    { color: '#3fb950', bg: 'rgba(63,185,80,0.12)',  stripe: '#3fb950', label: 'Low Priority'    },
  };
  const categoryMeta: Record<string, { color: string; bg: string }> = {
    general:   { color: '#58a6ff', bg: 'rgba(88,166,255,0.12)' },
    technical: { color: '#bc8cff', bg: 'rgba(188,140,255,0.12)' },
    billing:   { color: '#ffa657', bg: 'rgba(255,166,87,0.12)'  },
    feature:   { color: '#39d353', bg: 'rgba(57,211,83,0.12)'   },
    bug:       { color: '#f85149', bg: 'rgba(248,81,73,0.12)'   },
  };

  const p   = priorityMeta[ticket.priority] ?? priorityMeta.medium;
  const cat = categoryMeta[ticket.category] ?? categoryMeta.general;

  const submittedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });

  const initial = escapeHtml(ticket.userName.charAt(0).toUpperCase());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Support Ticket #${shortId}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0d1117;">
    [${ticket.priority.toUpperCase()}] ${escapeHtml(ticket.subject)} · from ${escapeHtml(ticket.userName)} &zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1117;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">

      <!-- Card -->
      <table width="640" cellpadding="0" cellspacing="0" border="0"
             style="width:640px;max-width:100%;background:#161b22;border-radius:12px;border:1px solid #30363d;overflow:hidden;">

        <!-- Priority stripe -->
        <tr><td style="height:3px;background:${p.stripe};font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #21262d;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <span style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Preciprocal</span>
                  <span style="font-size:13px;color:#6e7681;margin-left:6px;font-weight:400;">Support</span>
                </td>
                <td align="right" valign="middle">
                  <span style="display:inline-block;font-size:12px;font-weight:600;color:#58a6ff;background:#1f3a5f;padding:4px 12px;border-radius:20px;border:1px solid #1f6feb;letter-spacing:0.3px;">
                    #${shortId}
                  </span>
                  &nbsp;
                  <span style="display:inline-block;font-size:11px;font-weight:700;color:#484f58;background:#21262d;padding:3px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">
                    Internal
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px 0;">

            <!-- Label + Subject -->
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6e7681;text-transform:uppercase;letter-spacing:0.8px;">New Support Ticket</p>
            <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
              ${escapeHtml(ticket.subject)}
            </h1>

            <!-- Submitter card -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#0d1117;border:1px solid #21262d;border-radius:8px;margin-bottom:20px;">
              <tr>
                <td style="padding:16px 20px;">
                  <table cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td width="40" valign="middle">
                        <div style="width:38px;height:38px;background:linear-gradient(135deg,#6366f1,#a855f7);border-radius:50%;text-align:center;line-height:38px;font-size:16px;font-weight:700;color:#ffffff;display:inline-block;">
                          ${initial}
                        </div>
                      </td>
                      <td style="padding-left:14px;" valign="middle">
                        <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#ffffff;">${escapeHtml(ticket.userName)}</p>
                        <p style="margin:0;font-size:13px;color:#58a6ff;">${escapeHtml(ticket.userEmail)}</p>
                      </td>
                      <td align="right" valign="middle">
                        <p style="margin:0;font-size:12px;color:#6e7681;">${submittedAt}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Badges -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding-right:8px;">
                  <span style="display:inline-block;font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;background:${cat.bg};color:${cat.color};">
                    ${escapeHtml(ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1))}
                  </span>
                </td>
                <td>
                  <span style="display:inline-block;font-size:12px;font-weight:600;padding:5px 14px;border-radius:20px;background:${p.bg};color:${p.color};">
                    ${p.label}
                  </span>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
              <tr><td style="height:1px;background:#21262d;font-size:0;line-height:0;">&nbsp;</td></tr>
            </table>

            <!-- Message -->
            <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#6e7681;text-transform:uppercase;letter-spacing:0.6px;">Message from Customer</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#0d1117;border:1px solid #21262d;border-left:3px solid #6366f1;border-radius:6px;padding:20px 22px;">
                  <p style="margin:0;font-size:14px;color:#c9d1d9;line-height:1.75;white-space:pre-wrap;word-break:break-word;">${escapeHtml(ticket.message)}</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Reply CTA box -->
        <tr>
          <td style="padding:0 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#1a2740;border:1px solid #1f6feb;border-radius:8px;">
              <tr>
                <td style="padding:18px 22px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td valign="top" style="padding-right:12px;">
                        <div style="width:32px;height:32px;background:#1f6feb;border-radius:6px;text-align:center;line-height:32px;font-size:15px;">↩</div>
                      </td>
                      <td valign="middle">
                        <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:#58a6ff;">Reply to this email to respond</p>
                        <p style="margin:0;font-size:12px;color:#8b949e;line-height:1.55;">
                          Your reply is automatically saved to the ticket and the customer is notified. Do not forward - just reply.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="height:1px;background:#21262d;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:12px;color:#484f58;">
                    Preciprocal · Internal Admin Notification · Ticket ID: <span style="font-family:monospace;color:#6e7681;">${ticketId}</span>
                  </p>
                </td>
                <td align="right">
                  <a href="https://preciprocal.com" style="font-size:12px;color:#484f58;text-decoration:none;">preciprocal.com</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER CONFIRMATION EMAIL
// ─────────────────────────────────────────────────────────────────────────────
// Built on the shared shell (lib/email/layout.ts) and laid out like the staff
// reply in app/api/support/inbound-email, so the two ends of one ticket thread
// look like the same product. It used to be a separate light-theme template.
/**
 * Only Premium is sold a response time ("Priority support (24hr SLA)" on the
 * pricing page). Promising 24 hours to everyone would be a commitment nobody
 * agreed to, so everyone else is told the truth: as soon as we can.
 */
function responseLine(hasSla: boolean): string {
  return hasSla
    ? 'Your Premium plan includes a reply within 24 hours'
    : 'Someone from the team will reply as soon as they can';
}

function generateUserConfirmationEmail(
  userName: string, shortId: string, ticketId: string, subject: string, message: string, hasSla: boolean,
): string {
  // The message is the user's own plain text, so it is escaped and then its
  // newlines are turned back into <br />, matching the reply email.
  const body = escapeHtml(message).replace(/\n/g, '<br />');

  return renderEmail({
    campaign: 'ticket_received',
    preheader: `We received ticket #${shortId}. ${responseLine(hasSla)}.`,
    eyebrow: `Ticket #${shortId}`,
    heading: 'We received your request',
    paragraphs: [
      `Hi ${escapeHtml(firstName(userName))},`,
      `Thanks for reaching out. ${responseLine(hasSla)}, and you can follow the whole conversation from Help &amp; Support in the app.`,
    ],
    panel: {
      title: escapeHtml(subject) || 'Your ticket',
      rows: [{ label: 'Your message', value: body }],
    },
    cta: { label: 'View your ticket', url: `${emailAppUrl()}/help?ticket=${ticketId}` },
    signoff: 'Just reply to this email to add anything.<br />Preciprocal Support',
    footerNote: 'You are receiving this because you opened a support ticket with Preciprocal.',
  });
}

function generateUserConfirmationText(
  userName: string, shortId: string, ticketId: string, subject: string, message: string, hasSla: boolean,
): string {
  return renderText({
    campaign: 'ticket_received',
    heading: 'We received your request',
    paragraphs: [
      `Hi ${firstName(userName)},`,
      `Thanks for reaching out. ${responseLine(hasSla)}.`,
      subject ? `Subject: ${subject}` : '',
      '',
      message,
    ].filter(Boolean),
    cta: { label: 'View your ticket', url: `${emailAppUrl()}/help?ticket=${ticketId}` },
    signoff: 'Just reply to this email to add anything.\nPreciprocal Support',
    footerNote: 'You opened a support ticket with Preciprocal.',
  });
}
