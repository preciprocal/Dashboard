// app/api/firebase/emails/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function POST(request: NextRequest) {
  try {
    const { ticketId, ticket } = await request.json() as { ticketId: string; ticket: SupportTicket };

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@preciprocal.com';
    const shortId    = ticketId.slice(0, 8).toUpperCase();

    // ── 1. Admin notification ─────────────────────────────────────────────────
    // IMPORTANT: replyTo is support@preciprocal.com (NOT userEmail).
    // When the admin replies, the email routes through the inbound webhook
    // which saves the reply to Firestore and notifies the user automatically.
    // Ensure Resend Inbound is configured to route support@preciprocal.com
    // to: https://your-domain.com/api/support/inbound-email
    const { data: adminData, error: adminError } = await resend.emails.send({
      from:    'Preciprocal Support <admin@preciprocal.com>',
      to:      adminEmail,
      replyTo: 'support@preciprocal.com',
      subject: `[Ticket #${ticketId}] ${ticket.subject}`,
      html:    generateAdminEmail(ticketId, shortId, ticket),
    });

    if (adminError) console.error('❌ Admin email error:', adminError);
    else            console.log('✅ Admin notification sent:', adminData?.id);

    // ── 2. User confirmation ──────────────────────────────────────────────────
    const { data: userData, error: userError } = await resend.emails.send({
      from:    'Preciprocal Support <admin@preciprocal.com>',
      to:      ticket.userEmail,
      replyTo: 'support@preciprocal.com',
      subject: `[Ticket #${shortId}] We received your request`,
      html:    generateUserConfirmationEmail(ticket.userName, shortId, ticket.subject, ticket.message),
    });

    if (userError) console.error('❌ User confirmation error:', userError);
    else           console.log('✅ User confirmation sent:', userData?.id);

    return NextResponse.json({ success: true, adminEmailId: adminData?.id, userEmailId: userData?.id });
  } catch (error) {
    console.error('❌ Email error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN EMAIL — Professional dark-themed internal notification
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
                          Your reply is automatically saved to the ticket and the customer is notified. Do not forward — just reply.
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
function generateUserConfirmationEmail(
  userName: string, ticketId: string, subject: string, message: string,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://preciprocal.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>We received your request · Preciprocal Support</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f5f7;">
    Your support request has been received — Ticket #${ticketId} &zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5f7;">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="580" cellpadding="0" cellspacing="0" border="0"
             style="width:580px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 36px 28px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);">
            <p style="margin:0 0 4px;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">We received your request</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);">Ticket #${ticketId} · ${escapeHtml(subject)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:600;">Hi ${escapeHtml(userName)},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.65;">
              Thanks for reaching out. We've received your support request and our team will get back to you within <strong style="color:#111827;">24 hours</strong>.
            </p>

            <!-- Message recap -->
            <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.6px;">Your message</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid #6366f1;border-radius:6px;padding:16px 18px;">
                  <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td align="center">
                  <a href="${appUrl}/help?section=tickets"
                     style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:0.1px;">
                    View Your Ticket
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info note -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;">
                  <p style="margin:0;font-size:13px;color:#1d4ed8;line-height:1.55;">
                    <strong>What happens next?</strong><br/>
                    Our team typically responds within 24 hours. You can also check your ticket status and full conversation history from the Help &amp; Support section in your dashboard.
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
                    <a href="https://preciprocal.com/privacy" style="color:#6b7280;text-decoration:none;">Privacy Policy</a>
                  </p>
                </td>
                <td align="right" valign="top">
                  <p style="margin:0;font-size:11px;color:#d1d5db;font-family:monospace;">Ticket #${ticketId}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
        You received this because you submitted a support ticket at preciprocal.com
      </p>

    </td></tr>
  </table>
</body>
</html>`;
}
