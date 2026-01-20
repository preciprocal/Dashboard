// app/api/firebase/emails/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketId, ticket } = body;

    // Validate required fields
    if (!ticket || !ticketId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send email to support team
    const supportEmail = await resend.emails.send({
      from: 'Preciprocal Support <notifications@preciprocal.com>',
      to: 'support@preciprocal.com',
      subject: `New Support Ticket: ${ticket.subject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f1f5f9;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
              }
              .header { 
                background: linear-gradient(135deg, #9333ea 0%, #4f46e5 100%); 
                color: white; 
                padding: 30px; 
                border-radius: 12px 12px 0 0; 
              }
              .content { 
                background: #ffffff; 
                padding: 30px; 
                border-radius: 0 0 12px 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .ticket-info { 
                background: #f8fafc; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
                border-left: 4px solid #9333ea; 
              }
              .label { 
                font-weight: 600; 
                color: #64748b; 
                font-size: 12px; 
                text-transform: uppercase; 
                margin-bottom: 5px; 
              }
              .value { 
                color: #1e293b; 
                font-size: 14px; 
                margin-bottom: 15px; 
              }
              .message-box { 
                background: #f8fafc; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
              }
              .priority { 
                display: inline-block; 
                padding: 4px 12px; 
                border-radius: 4px; 
                font-size: 12px; 
                font-weight: 600; 
              }
              .priority-high { background: #fee2e2; color: #dc2626; }
              .priority-medium { background: #fed7aa; color: #ea580c; }
              .priority-low { background: #e2e8f0; color: #64748b; }
              .button { 
                background: linear-gradient(135deg, #9333ea 0%, #4f46e5 100%); 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 8px; 
                display: inline-block; 
                font-weight: 600;
                margin-top: 10px;
              }
              .footer { 
                text-align: center; 
                color: #94a3b8; 
                font-size: 12px; 
                margin-top: 20px; 
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">🎫 New Support Ticket</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">A new support request has been submitted</p>
              </div>
              <div class="content">
                <div class="ticket-info">
                  <div class="label">Ticket ID</div>
                  <div class="value" style="font-family: monospace; background: white; padding: 8px; border-radius: 4px;">${ticketId}</div>
                  
                  <div class="label">Subject</div>
                  <div class="value"><strong>${ticket.subject}</strong></div>
                  
                  <div class="label">Category</div>
                  <div class="value" style="text-transform: capitalize;">${ticket.category}</div>
                  
                  <div class="label">Priority</div>
                  <div class="value">
                    <span class="priority priority-${ticket.priority}">${ticket.priority.toUpperCase()}</span>
                  </div>
                  
                  <div class="label">User Information</div>
                  <div class="value">
                    <strong>${ticket.userName || 'Unknown User'}</strong><br>
                    <a href="mailto:${ticket.userEmail}" style="color: #4f46e5;">${ticket.userEmail}</a>
                  </div>
                  
                  <div class="label">Submitted</div>
                  <div class="value">${new Date().toLocaleString('en-US', { 
                    dateStyle: 'full', 
                    timeStyle: 'short' 
                  })}</div>
                </div>
                
                <div class="message-box">
                  <div class="label">Message</div>
                  <div class="value" style="white-space: pre-wrap; line-height: 1.6; margin-bottom: 0;">${ticket.message}</div>
                </div>
                
                <p style="text-align: center; margin: 30px 0 10px 0;">
                  <a href="https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/data/supportTickets/${ticketId}" 
                     class="button">
                    View in Firebase Console
                  </a>
                </p>
                
                <div class="footer">
                  <p style="margin: 0;">This is an automated notification from Preciprocal Support System</p>
                  <p style="margin: 5px 0 0 0; color: #cbd5e1;">Please respond to ${ticket.userEmail}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    });

    // Send confirmation email to user
    const userEmail = await resend.emails.send({
      from: 'Preciprocal Support <support@preciprocal.com>',
      to: ticket.userEmail,
      subject: `Ticket Received: ${ticket.subject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f1f5f9;
              }
              .container { 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
              }
              .header { 
                background: linear-gradient(135deg, #9333ea 0%, #4f46e5 100%); 
                color: white; 
                padding: 30px; 
                border-radius: 12px 12px 0 0; 
                text-align: center; 
              }
              .content { 
                background: #ffffff; 
                padding: 30px; 
                border-radius: 0 0 12px 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .info-box { 
                background: #f8fafc; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0;
                border-left: 4px solid #9333ea;
              }
              .label {
                color: #64748b;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                margin-bottom: 5px;
              }
              .value {
                color: #1e293b;
                font-size: 14px;
                margin-bottom: 15px;
              }
              .footer { 
                text-align: center; 
                color: #94a3b8; 
                font-size: 12px; 
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">✅ Thank You for Contacting Us</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">We've received your support ticket</p>
              </div>
              <div class="content">
                <p style="color: #1e293b; font-size: 16px; line-height: 1.6;">
                  Hi ${ticket.userName || 'there'},
                </p>
                <p style="color: #1e293b; font-size: 16px; line-height: 1.6;">
                  We've received your support ticket and our team will get back to you within <strong>24 hours</strong>.
                </p>
                
                <div class="info-box">
                  <div class="label">Ticket ID</div>
                  <div class="value" style="font-family: monospace; background: white; padding: 8px; border-radius: 4px; margin-bottom: 15px;">${ticketId}</div>
                  
                  <div class="label">Subject</div>
                  <div class="value" style="margin-bottom: 15px;"><strong>${ticket.subject}</strong></div>
                  
                  <div class="label">Category</div>
                  <div class="value" style="text-transform: capitalize; margin-bottom: 0;">${ticket.category}</div>
                </div>
                
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 20px;">
                  You can view your ticket status anytime in the <strong>Help & Support</strong> section of your dashboard under the <strong>Tickets</strong> tab.
                </p>
                
                <div class="footer">
                  <p style="margin: 0; color: #1e293b; font-size: 14px;">
                    Best regards,<br>
                    <strong>Preciprocal Support Team</strong>
                  </p>
                  <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px;">
                    If you have any questions, reply to this email or visit our help center
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    });

    return NextResponse.json({
      success: true,
      supportEmailId: supportEmail.data?.id,
      userEmailId: userEmail.data?.id
    });

  } catch (error) {
    console.error('Error sending emails:', error);
    return NextResponse.json(
      { 
        error: 'Failed to send emails',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}