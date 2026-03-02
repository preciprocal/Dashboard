// app/api/firebase/emails/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Fix: typed interface instead of any
interface SupportTicket {
  userName: string;
  userEmail: string;
  subject: string;
  message: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Email API called (Resend)');
    
    const { ticketId, ticket } = await request.json() as { ticketId: string; ticket: SupportTicket };
    
    console.log('✅ Ticket ID:', ticketId);
    console.log('✅ User:', ticket.userName, '-', ticket.userEmail);

    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Resend API key not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const shortTicketId = ticketId.slice(0, 12).toUpperCase();

    // 1. Send INTERNAL notification to admin (with full details)
    const { data: adminData, error: adminError } = await resend.emails.send({
      from: 'Preciprocal Support <admin@preciprocal.com>',
      to: 'admin@preciprocal.com',
      replyTo: ticket.userEmail,
      subject: `[Ticket #${shortTicketId}] ${ticket.subject}`,
      html: generateAdminNotificationEmail(ticketId, ticket),
    });

    if (adminError) {
      console.error('❌ Admin email error:', adminError);
    } else {
      console.log('✅ Admin notification sent, ID:', adminData?.id);
    }

    // 2. Send CLEAN confirmation to the user (no internal metadata)
    const { data: userData, error: userError } = await resend.emails.send({
      from: 'Preciprocal Support <admin@preciprocal.com>',
      to: ticket.userEmail,
      replyTo: 'admin@preciprocal.com',
      subject: `[Ticket #${shortTicketId}] ${ticket.subject}`,
      html: generateUserConfirmationEmail(ticket.userName, shortTicketId, ticket.subject, ticket.message),
    });

    if (userError) {
      console.error('❌ User confirmation email error:', userError);
    } else {
      console.log('✅ User confirmation sent, ID:', userData?.id);
    }

    return NextResponse.json({ 
      success: true,
      adminEmailId: adminData?.id,
      userEmailId: userData?.id,
      message: 'Emails sent successfully'
    });
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ============================================================
// ADMIN EMAIL - Internal notification with full ticket details
// ============================================================
function generateAdminNotificationEmail(ticketId: string, ticket: SupportTicket) {
  const shortId = ticketId.slice(0, 12).toUpperCase();
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f8f9fa; }
        .container { max-width: 650px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
        .header { background: linear-gradient(135deg, #2563eb, #1e40af); color: #fff; padding: 40px; }
        .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 600; }
        .header-meta { margin: 12px 0 0; opacity: 0.9; font-size: 14px; }
        .ticket-id-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-top: 12px; letter-spacing: 0.5px; }
        .content { padding: 40px; }
        .user-section { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #3b82f6; padding: 24px; border-radius: 8px; margin-bottom: 30px; }
        .user-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; margin-bottom: 10px; }
        .user-name { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }
        .user-email { font-size: 15px; color: #3b82f6; font-weight: 500; }
        .detail-row { padding: 14px 0; border-bottom: 1px solid #f1f5f9; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px; }
        .detail-value { font-size: 15px; color: #0f172a; font-weight: 500; }
        .priority-badge { display: inline-block; padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .priority-high { background: #fee2e2; color: #dc2626; }
        .priority-medium { background: #fef3c7; color: #d97706; }
        .priority-low { background: #e0f2fe; color: #0369a1; }
        .category-badge { display: inline-block; padding: 5px 14px; background: #f1f5f9; color: #475569; border-radius: 6px; font-size: 13px; font-weight: 500; }
        .message-section { margin-top: 30px; padding-top: 30px; border-top: 2px solid #e2e8f0; }
        .section-title { font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
        .message-content { background: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; color: #1e293b; line-height: 1.7; font-size: 15px; }
        .footer { padding: 30px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; }
        .footer-text { color: #64748b; font-size: 13px; margin: 0; }
        .internal-badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Support Ticket</h1>
          <p class="header-meta">Support request submitted</p>
          <div class="ticket-id-badge">#${shortId}</div>
          <br/><span class="internal-badge">Internal — Admin Only</span>
        </div>
        <div class="content">
          <div class="user-section">
            <div class="user-label">Customer</div>
            <div class="user-name">${ticket.userName}</div>
            <div class="user-email">${ticket.userEmail}</div>
          </div>
          <div>
            <div class="detail-row">
              <div class="detail-label">Subject</div>
              <div class="detail-value">${ticket.subject}</div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Category</div>
              <div class="detail-value"><span class="category-badge">${ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}</span></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Priority</div>
              <div class="detail-value"><span class="priority-badge priority-${ticket.priority}">${ticket.priority}</span></div>
            </div>
            <div class="detail-row">
              <div class="detail-label">Submitted</div>
              <div class="detail-value">${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</div>
            </div>
          </div>
          <div class="message-section">
            <div class="section-title">Message</div>
            <div class="message-content">${ticket.message}</div>
          </div>
        </div>
        <div class="footer">
          <p class="footer-text"><strong>Preciprocal Support</strong> — Internal Notification</p>
          <p class="footer-text" style="margin-top: 8px; font-size: 12px; color: #94a3b8;">Reply to this email to respond directly to the customer</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================
// USER EMAIL - Clean confirmation the customer sees
// ============================================================
function generateUserConfirmationEmail(userName: string, ticketId: string, subject: string, message: string) {
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
        .message-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .message-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
        .message-text { color: #1e293b; font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
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
          <h1>We've received your request</h1>
          <p>Ticket #${ticketId} — ${subject}</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; color: #1f2937;">Hi ${userName},</p>
          <p style="font-size: 15px; color: #4b5563;">Thank you for reaching out. We've received your support request and our team will get back to you as soon as possible.</p>
          <div class="message-box">
            <div class="message-label">Your Message</div>
            <div class="message-text">${message}</div>
          </div>
          <div class="cta">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/help?section=tickets">View Your Tickets</a>
          </div>
          <div class="info-box">
            <strong>What happens next?</strong><br/>
            Our support team typically responds within 24 hours. You can reply to this email or check your ticket status from your dashboard.
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