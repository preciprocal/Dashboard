// app/api/support/inbound-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

// This endpoint receives emails from your email service provider
// Works with SendGrid, Mailgun, Postmark, etc.

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (implement based on your provider)
    // const signature = request.headers.get('x-webhook-signature');
    // TODO: Verify signature matches your email provider's secret
    
    const body = await request.json();
    
    // Parse email data (format varies by provider)
    // This example uses SendGrid Inbound Parse format
    const {
      from, // User's email who replied
      subject, // Email subject
      text, // Plain text body
      html, // HTML body
      // to, // notifications@preciprocal.com
      // headers, // Email headers
    } = body;

    // Extract ticket ID from subject line or In-Reply-To header
    // Format: "Re: [Ticket #TICKET_ID] Subject"
    const ticketIdMatch = subject.match(/\[Ticket #([^\]]+)\]/);
    
    if (!ticketIdMatch) {
      console.error('No ticket ID found in subject:', subject);
      return NextResponse.json(
        { error: 'Invalid ticket reference' },
        { status: 400 }
      );
    }

    const ticketId = ticketIdMatch[1];
    
    // Get ticket from Firestore
    const ticketRef = db.collection('supportTickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();
    
    if (!ticketDoc.exists) {
      console.error('Ticket not found:', ticketId);
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    const ticketData = ticketDoc.data();
    
    if (!ticketData) {
      console.error('Ticket data is empty:', ticketId);
      return NextResponse.json(
        { error: 'Invalid ticket data' },
        { status: 404 }
      );
    }
    
    // Clean the reply text (remove quoted text, signatures, ticket metadata, etc.)
    const cleanedReply = cleanEmailReply(text || html);
    
    // Add reply to ticket
    const replyData = {
      ticketId,
      message: cleanedReply,
      from: 'support',
      fromEmail: from,
      createdAt: Timestamp.now(),
      isStaff: true
    };

    // Add reply to subcollection
    await ticketRef.collection('replies').add(replyData);
    
    // Update ticket status
    await ticketRef.update({
      status: 'in-progress',
      updatedAt: Timestamp.now(),
      lastReplyBy: 'support',
      lastReplyAt: Timestamp.now()
    });

    // Send a CLEAN reply email to the user (no ticket metadata exposed)
    await sendReplyNotificationToUser(
      ticketData.userEmail,
      ticketData.userName,
      ticketId,
      ticketData.subject,
      cleanedReply
    );

    return NextResponse.json({ 
      success: true,
      ticketId,
      replyAdded: true 
    });

  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to clean email reply text
function cleanEmailReply(text: string): string {
  if (!text) return '';
  
  // If it's HTML, strip tags first
  let cleanText = text;
  if (cleanText.includes('<') && cleanText.includes('>')) {
    cleanText = cleanText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  }

  const lines = cleanText.split('\n');
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Stop at common quote markers
    if (
      trimmed.startsWith('>') ||
      (trimmed.startsWith('On ') && trimmed.includes('wrote:')) ||
      trimmed.includes('---Original Message---') ||
      trimmed.includes('________________________________') ||
      trimmed.includes('---------- Forwarded message') ||
      trimmed.startsWith('From:') ||
      trimmed.startsWith('Sent:')
    ) {
      break;
    }

    // Stop at ticket metadata block (the unprofessional part users see)
    if (
      trimmed === 'New Support Ticket' ||
      trimmed.startsWith('Support request submitted') ||
      trimmed.match(/^#[A-Z0-9]{10,}$/) || // Ticket IDs like #5APBA53RSNXJ
      trimmed === 'Customer' ||
      trimmed === 'Subject' ||
      trimmed === 'Category' ||
      trimmed === 'Priority' ||
      trimmed === 'Submitted' ||
      trimmed === 'Message' ||
      trimmed.match(/^(high|medium|low|urgent)$/i) || // Priority values
      trimmed.match(/^(general|technical|billing|feature|bug)$/i) // Category values
    ) {
      break;
    }
    
    cleanedLines.push(line);
  }
  
  // Remove trailing empty lines and signatures
  let result = cleanedLines.join('\n').trim();
  
  // Remove common email signatures
  result = result
    .replace(/\n--\s*\n[\s\S]*$/, '') // "-- " signature separator
    .replace(/\nSent from my (iPhone|iPad|Android|Galaxy|Pixel)[\s\S]*$/i, '')
    .replace(/\nGet Outlook for [\s\S]*$/i, '')
    .trim();
  
  return result;
}

// Send a clean, professional reply email to the user
async function sendReplyNotificationToUser(
  userEmail: string,
  userName: string,
  ticketId: string,
  subject: string,
  replyMessage: string
) {
  try {
    // Double-check: strip any remaining ticket metadata that slipped through
    const sanitizedReply = sanitizeReplyForEmail(replyMessage);

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/firebase/emails/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: userEmail,
        userName,
        ticketId,
        subject,
        replyMessage: sanitizedReply
      })
    });
  } catch (error) {
    console.error('Error sending reply notification:', error);
  }
}

// Final sanitization before sending to the user
function sanitizeReplyForEmail(message: string): string {
  if (!message) return '';

  // Remove any lines containing internal ticket metadata keywords
  const metadataPatterns = [
    /^New Support Ticket$/i,
    /^Support request submitted$/i,
    /^#[A-Z0-9]{8,}$/,
    /^Customer$/i,
    /^Category$/i,
    /^Priority$/i,
    /^Submitted$/i,
    /^Message$/i,
    /^(high|medium|low|urgent)$/i,
    /^(general|technical|billing|feature|bug)$/i,
    /^\w+@\w+\.\w+$/, // Standalone email lines (internal metadata)
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}/i, // Timestamp lines
    /^From:.*<.*>$/i,
    /^Sent:.*\d{4}/i,
    /^To:.*<.*>$/i,
    /^Subject:.*\[Ticket/i,
  ];

  const lines = message.split('\n');
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isMetadata = metadataPatterns.some(pattern => pattern.test(trimmed));
    if (isMetadata) break; // Stop at the first metadata line
    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}