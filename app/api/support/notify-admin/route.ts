// app/api/support/notify-admin/route.ts
// Fires when a user replies to their own ticket from the app dashboard.
// Sends an email notification to the admin with the user's reply.
// Admin can reply to this email — it routes through support@preciprocal.com
// and the inbound webhook saves it back to Firestore automatically.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const { ticketId, ticketSubject, userName, userEmail, message } =
      await request.json() as {
        ticketId:      string;
        ticketSubject: string;
        userName:      string;
        userEmail:     string;
        message:       string;
      };

    if (!ticketId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@preciprocal.com';
    const shortId    = ticketId.slice(0, 8).toUpperCase();

    const { error } = await resend.emails.send({
      from:    'Preciprocal Support <admin@preciprocal.com>',
      to:      adminEmail,
      // replyTo is support@preciprocal.com so admin replies are captured
      // by the inbound webhook and saved back to Firestore automatically.
      replyTo: 'support@preciprocal.com',
      subject: `[Ticket #${ticketId}] Re: ${ticketSubject}`,
      html:    generateUserReplyAdminEmail(ticketId, shortId, ticketSubject, userName, userEmail, message),
    });

    if (error) {
      console.error('❌ Admin user-reply notification error:', error);
      return NextResponse.json({ error: 'Failed to notify admin' }, { status: 500 });
    }

    console.log('✅ Admin notified of user reply on ticket:', shortId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('❌ notify-admin error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateUserReplyAdminEmail(
  ticketId:      string,
  shortId:       string,
  ticketSubject: string,
  userName:      string,
  userEmail:     string,
  message:       string,
): string {
  const submittedAt = new Date().toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
  const initial = escapeHtml(userName.charAt(0).toUpperCase());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Customer Reply · Ticket #${shortId}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0d1117;">
    ${escapeHtml(userName)} replied to Ticket #${shortId} · ${escapeHtml(ticketSubject)} &zwnj;&nbsp;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1117;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">

      <table width="640" cellpadding="0" cellspacing="0" border="0"
             style="width:640px;max-width:100%;background:#161b22;border-radius:12px;border:1px solid #30363d;overflow:hidden;">

        <!-- Top stripe — blue for user reply -->
        <tr><td style="height:3px;background:#58a6ff;font-size:0;line-height:0;">&nbsp;</td></tr>

        <!-- Header -->
        <tr>
          <td style="padding:24px 32px;border-bottom:1px solid #21262d;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <span style="font-size:17px;font-weight:700;color:#ffffff;">Preciprocal</span>
                  <span style="font-size:13px;color:#6e7681;margin-left:6px;">Support</span>
                </td>
                <td align="right" valign="middle">
                  <span style="display:inline-block;font-size:12px;font-weight:600;color:#58a6ff;background:#1f3a5f;padding:4px 12px;border-radius:20px;border:1px solid #1f6feb;">
                    #${shortId}
                  </span>
                  &nbsp;
                  <span style="display:inline-block;font-size:11px;font-weight:700;color:#3fb950;background:rgba(63,185,80,0.1);padding:3px 8px;border-radius:4px;">
                    Customer Reply
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px 0;">

            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6e7681;text-transform:uppercase;letter-spacing:0.8px;">Customer replied via app</p>
            <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#ffffff;line-height:1.3;letter-spacing:-0.3px;">
              Re: ${escapeHtml(ticketSubject)}
            </h1>

            <!-- Submitter card -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background:#0d1117;border:1px solid #21262d;border-radius:8px;margin-bottom:24px;">
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
                        <p style="margin:0 0 3px;font-size:15px;font-weight:600;color:#ffffff;">${escapeHtml(userName)}</p>
                        <p style="margin:0;font-size:13px;color:#58a6ff;">${escapeHtml(userEmail)}</p>
                      </td>
                      <td align="right" valign="middle">
                        <p style="margin:0;font-size:12px;color:#6e7681;">${submittedAt}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Message -->
            <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#6e7681;text-transform:uppercase;letter-spacing:0.6px;">Their Message</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#0d1117;border:1px solid #21262d;border-left:3px solid #58a6ff;border-radius:6px;padding:20px 22px;">
                  <p style="margin:0;font-size:14px;color:#c9d1d9;line-height:1.75;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Reply CTA -->
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
                          Your reply will be automatically saved to the ticket and the customer will be notified.
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
        <tr><td style="height:1px;background:#21262d;font-size:0;">&nbsp;</td></tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:12px;color:#484f58;">
                    Preciprocal · Internal Notification · Ticket ID: <span style="font-family:monospace;color:#6e7681;">${ticketId}</span>
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
    </td></tr>
  </table>
</body>
</html>`;
}
