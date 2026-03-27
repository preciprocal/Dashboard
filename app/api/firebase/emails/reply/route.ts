// app/api/firebase/emails/reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { to, userName, ticketId, subject, replyMessage } = await request.json();

    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Resend API key not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const cleanMessage = sanitizeReply(replyMessage);

    if (!cleanMessage.trim()) {
      console.error('❌ Sanitized reply message is empty');
      return NextResponse.json(
        { error: 'Reply message is empty after sanitization' },
        { status: 400 }
      );
    }

    const cleanSubject = subject
      .replace(/\[Internal\]\s*/gi, '')
      .trim();

    const { data, error } = await resend.emails.send({
      from: 'Preciprocal Support <admin@preciprocal.com>',
      to,
      replyTo: 'admin@preciprocal.com',
      subject: `Re: [Ticket #${ticketId}] ${cleanSubject}`,
      html: generateReplyEmail(userName, ticketId, cleanSubject, cleanMessage),
    });

    if (error) {
      console.error('❌ Reply email error:', error);
      return NextResponse.json(
        { error: 'Failed to send reply', details: error },
        { status: 500 }
      );
    }

    console.log('✅ Reply email sent, ID:', data?.id);
    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (error) {
    console.error('❌ Reply email error:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

/**
 * Sanitizes a reply message by stripping quoted email threads and leaked
 * ticket metadata. Handles plain text, Gmail HTML, Yahoo HTML, and Outlook HTML.
 */
function sanitizeReply(message: string): string {
  if (!message) return '';

  let text = message;

  // ── Step 1: Strip HTML if present ──────────────────────────────────────────
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = text
      .replace(/<div id="divRplyFwdMsg"[\s\S]*$/gi, '')
      .replace(/<p[^>]*>\s*<b>From:<\/b>[\s\S]*$/gi, '')
      .replace(/<div[^>]*>\s*<b>From:<\/b>[\s\S]*$/gi, '')
      .replace(/<hr\s[^>]*style="[^"]*display:inline-block[^"]*"[\s\S]*$/gi, '')
      .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
      .replace(/<div id="appendonsend"[\s\S]*$/gi, '')
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<div class="gmail_quote"[\s\S]*$/gi, '')
      .replace(/<div class="gmail_attr"[\s\S]*?<\/div>/gi, '')
      .replace(/<div class="yahoo_quoted"[\s\S]*$/gi, '')
      .replace(/<hr[\s\S]*?>/gi, '\n---\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'");
  }

  // ── Step 2: Line-by-line analysis ──────────────────────────────────────────
  const lines = text.split('\n');
  const clean: string[] = [];

  const quotedThreadStarters = [
    /^From:\s*.+/i,
    /^Sent:\s*.+/i,
    /^On .+wrote:$/i,
    /^On .+\d{4}.+wrote:/i,
    /^-{3,}/,
    /^_{3,}/,
    /^\s*>{1,}/,
    /^\[cid:/i,
  ];

  const metadataPatterns = [
    /^New Support Ticket$/i,
    /^Support request submitted$/i,
    /^#[A-Z0-9]{6,}$/,
    /^Customer$/i,
    /^Category$/i,
    /^Priority$/i,
    /^Submitted$/i,
    /^Message$/i,
    /^(high|medium|low|urgent)$/i,
    /^(general|technical|billing|feature|bug)$/i,
    /^\S+@\S+\.\S+$/,
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i,
    /^Subject:.*\[Ticket/i,
    /^To:.*<.*>$/i,
    /^Preciprocal Support\s*[—-]/i,
    /^Internal\s*[—-]\s*Admin Only$/i,
    /^Admin Only$/i,
    /^Reply to this email/i,
    /^Preciprocal Support$/i,
    /^\[Ticket #/i,
    /^Internal Notification$/i,
    /^\[Internal\]/i,
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' && clean.length === 0) continue;
    if (quotedThreadStarters.some(p => p.test(trimmed))) break;
    if (metadataPatterns.some(p => p.test(trimmed))) break;
    clean.push(line);
  }

  while (clean.length > 0 && clean[clean.length - 1].trim() === '') {
    clean.pop();
  }

  return clean.join('\n').trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Email template
// ─────────────────────────────────────────────────────────────────────────────

function generateReplyEmail(
  userName: string,
  ticketId: string,
  subject: string,
  replyMessage: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://preciprocal.com';
  const ticketUrl = `${appUrl}/help?section=tickets`;

  // Escape the reply message for safe HTML rendering
  const safeMessage = replyMessage
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <title>Support Reply — Ticket #${ticketId}</title>
  <style>
    /* Reset */
    * { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #f4f5f7; }

    /* Typography */
    body, td, p { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }

    /* Links */
    a { color: #4f46e5; }
    a:hover { color: #4338ca; }

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; padding: 0 !important; }
      .email-body { padding: 28px 20px !important; }
      .email-header { padding: 28px 20px !important; }
      .email-footer { padding: 20px !important; }
      .reply-block { padding: 20px !important; }
      .cta-button { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f5f7;">
    Our support team has responded to your ticket #${ticketId} — ${subject}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <!-- Email card -->
        <table class="email-wrapper" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- ── Header ── -->
          <tr>
            <td class="email-header" style="padding:36px 40px;background-color:#0f0f1a;border-bottom:1px solid #1e1e2e;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Wordmark -->
                    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                      Preciprocal
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;color:#6b7280;letter-spacing:0.3px;text-transform:uppercase;">
                      Support Team
                    </p>
                  </td>
                  <td align="right" valign="middle">
                    <!-- Ticket badge -->
                    <span style="display:inline-block;background-color:#1e1e2e;color:#818cf8;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px;border:1px solid #2e2e4e;letter-spacing:0.2px;">
                      #${ticketId}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td class="email-body" style="padding:40px 40px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
                You have a reply
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.5;">
                Hi ${userName}, our support team has responded to your ticket.
              </p>

              <!-- Subject line -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:20px;">
                <tr>
                  <td style="padding:12px 16px;background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:3px;">
                      Subject
                    </p>
                    <p style="margin:0;font-size:14px;color:#374151;font-weight:500;">
                      ${subject}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
                <tr>
                  <td style="height:1px;background-color:#f3f4f6;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Reply block -->
              <table class="reply-block" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 24px;background-color:#fafafa;border-radius:10px;border:1px solid #e5e7eb;border-left:3px solid #4f46e5;">

                    <!-- Agent label row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                      <tr>
                        <td valign="middle">
                          <!-- Avatar circle -->
                          <span style="display:inline-block;width:28px;height:28px;border-radius:50%;background-color:#4f46e5;text-align:center;line-height:28px;font-size:12px;font-weight:700;color:#ffffff;vertical-align:middle;">
                            P
                          </span>
                          <span style="font-size:13px;font-weight:600;color:#374151;vertical-align:middle;margin-left:8px;">
                            Preciprocal Support
                          </span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="font-size:12px;color:#9ca3af;">
                            Support reply
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Message body -->
                    <p style="margin:0;font-size:15px;line-height:1.75;color:#1f2937;white-space:pre-wrap;word-break:break-word;">
                      ${safeMessage}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${ticketUrl}"
                       class="cta-button"
                       style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;letter-spacing:0.1px;">
                      View Full Conversation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:14px 16px;background-color:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;">
                    <p style="margin:0;font-size:13px;color:#0369a1;line-height:1.5;">
                      You can reply directly to this email or visit your dashboard to continue the conversation. We typically respond within 24 hours.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="height:1px;background-color:#f3f4f6;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td class="email-footer" style="padding:24px 40px;background-color:#f9fafb;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">
                      Preciprocal
                    </p>
                    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                      AI-powered career preparation platform.<br />
                      <a href="https://preciprocal.com" style="color:#6b7280;text-decoration:none;">preciprocal.com</a>
                      &nbsp;·&nbsp;
                      <a href="${appUrl}/help" style="color:#6b7280;text-decoration:none;">Help Center</a>
                      &nbsp;·&nbsp;
                      <a href="${appUrl}/privacy" style="color:#6b7280;text-decoration:none;">Privacy Policy</a>
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <p style="margin:0;font-size:11px;color:#d1d5db;font-weight:500;">
                      Ticket #${ticketId}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

        <!-- Below-card note -->
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
          This email was sent to you because you submitted a support ticket.<br />
          If this was not you, please ignore this email.
        </p>

      </td>
    </tr>
  </table>

</body>
</html>`;
}