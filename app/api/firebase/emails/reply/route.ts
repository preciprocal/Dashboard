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

    // Sanitize the reply message before sending
    const cleanMessage = sanitizeReply(replyMessage);

    // Safety check — if sanitized message is empty, reject
    if (!cleanMessage.trim()) {
      console.error('❌ Sanitized reply message is empty');
      return NextResponse.json(
        { error: 'Reply message is empty after sanitization' },
        { status: 400 }
      );
    }

    // Strip [Internal] from subject if it leaked through
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
      // ── Outlook-specific quoted thread wrappers ──
      // Outlook wraps the forwarded/replied block in a div with id="divRplyFwdMsg"
      .replace(/<div id="divRplyFwdMsg"[\s\S]*$/gi, '')
      // Outlook "From/Sent/To/Subject" block inside a <p> tag
      .replace(/<p[^>]*>\s*<b>From:<\/b>[\s\S]*$/gi, '')
      .replace(/<div[^>]*>\s*<b>From:<\/b>[\s\S]*$/gi, '')
      // Outlook separator HR
      .replace(/<hr\s[^>]*style="[^"]*display:inline-block[^"]*"[\s\S]*$/gi, '')
      // Outlook namespace tags
      .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
      // Outlook "appendonsend" wrapper
      .replace(/<div id="appendonsend"[\s\S]*$/gi, '')

      // ── Gmail-specific quoted thread wrappers ──
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<div class="gmail_quote"[\s\S]*$/gi, '')
      .replace(/<div class="gmail_attr"[\s\S]*?<\/div>/gi, '')

      // ── Yahoo-specific quoted thread wrappers ──
      .replace(/<div class="yahoo_quoted"[\s\S]*$/gi, '')

      // ── Generic HR divider (treat as thread separator) ──
      .replace(/<hr[\s\S]*?>/gi, '\n---\n')

      // ── Convert structural tags to newlines before stripping ──
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')

      // ── Strip all remaining HTML tags ──
      .replace(/<[^>]+>/g, '')

      // ── Decode HTML entities ──
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

  // Patterns that signal the start of a quoted email thread — cut everything from here
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

  // Patterns that are internal metadata noise — stop if we see them
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

    // Skip leading blank lines
    if (trimmed === '' && clean.length === 0) continue;

    // If we hit a quoted thread marker, cut everything from here
    if (quotedThreadStarters.some(p => p.test(trimmed))) break;

    // If we hit metadata noise, cut everything from here
    if (metadataPatterns.some(p => p.test(trimmed))) break;

    clean.push(line);
  }

  // Trim trailing blank lines
  while (clean.length > 0 && clean[clean.length - 1].trim() === '') {
    clean.pop();
  }

  return clean.join('\n').trim();
}

function generateReplyEmail(
  userName: string,
  ticketId: string,
  subject: string,
  replyMessage: string
) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f8f9fa; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 35px 40px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
        .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
        .content { padding: 40px; }
        .reply-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #10b981; padding: 24px; border-radius: 8px; margin: 20px 0; }
        .reply-label { font-size: 12px; color: #16a34a; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .reply-text { color: #1e293b; font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
        .cta { text-align: center; margin: 30px 0; }
        .cta a { display: inline-block; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
        .info-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px; margin: 25px 0; font-size: 14px; color: #1e40af; }
        .footer { padding: 25px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
        .footer p { color: #64748b; font-size: 13px; margin: 0; }
        .footer a { color: #667eea; text-decoration: none; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You have a new reply</h1>
          <p>Ticket #${ticketId} — ${subject}</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; color: #1f2937;">Hi ${userName},</p>
          <p style="font-size: 15px; color: #4b5563;">Our support team has responded to your ticket:</p>
          <div class="reply-box">
            <div class="reply-label">Support Reply</div>
            <div class="reply-text">${replyMessage}</div>
          </div>
          <div class="cta">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/help?section=tickets">View Full Conversation</a>
          </div>
          <div class="info-box">
            You can reply directly to this email or visit your dashboard to continue the conversation.
          </div>
        </div>
        <div class="footer">
          <p><strong>Preciprocal Support</strong></p>
          <p style="margin-top: 8px;"><a href="https://preciprocal.com">preciprocal.com</a></p>
          <p style="margin-top: 12px; font-size: 11px; color: #94a3b8;">Ticket #${ticketId}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}