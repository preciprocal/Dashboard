// app/api/cover-letter/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, AlignmentType, ExternalHyperlink } from 'docx';

interface DownloadRequest {
  letterId?: string;
  content: string;
  jobRole: string;
  companyName?: string;
  format: 'pdf' | 'docx';
}

// Helper function to parse markdown links and split text
interface TextSegment {
  text: string;
  isLink: boolean;
  url?: string;
}

function parseContentWithLinks(content: string): Array<{ paragraph: string; segments: TextSegment[] }> {
  const lines = content.split('\n');
  const result: Array<{ paragraph: string; segments: TextSegment[] }> = [];

  lines.forEach(line => {
    const segments: TextSegment[] = [];
    let lastIndex = 0;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    // Find all links in this line
    const matches: Array<{ text: string; url: string; start: number; end: number }> = [];
    while ((match = linkRegex.exec(line)) !== null) {
      matches.push({
        text: match[1],
        url: match[2],
        start: match.index,
        end: match.index + match[0].length
      });
    }

    // Build segments
    matches.forEach(linkMatch => {
      // Add text before link
      if (linkMatch.start > lastIndex) {
        segments.push({
          text: line.substring(lastIndex, linkMatch.start),
          isLink: false
        });
      }

      // Add link
      segments.push({
        text: linkMatch.text,
        isLink: true,
        url: linkMatch.url
      });

      lastIndex = linkMatch.end;
    });

    // Add remaining text
    if (lastIndex < line.length) {
      segments.push({
        text: line.substring(lastIndex),
        isLink: false
      });
    }

    // If no segments, add the whole line
    if (segments.length === 0 && line.length > 0) {
      segments.push({
        text: line,
        isLink: false
      });
    }

    result.push({ paragraph: line, segments });
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Cover Letter Download Request');

    // ==================== AUTHENTICATION ====================
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      await auth.verifySessionCookie(session.value, true);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      );
    }

    // ==================== PARSE REQUEST ====================
    const body = await request.json() as DownloadRequest;
    const { content, jobRole, companyName, format } = body;

    if (!content || !format) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📄 Generating ${format.toUpperCase()} for: ${jobRole}`);

    // Generate filename - clean format without numbers or timestamps
    const sanitize = (str: string) => str.replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim();
    const roleSlug = sanitize(jobRole);
    const companySlug = companyName ? sanitize(companyName) : 'Company';
    const filename = `${companySlug} ${roleSlug} Cover Letter`;

    // Parse content with links
    const parsedContent = parseContentWithLinks(content);

    // ==================== GENERATE PDF ====================
    if (format === 'pdf') {
      try {
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        doc.setFont('helvetica');
        doc.setFontSize(10);
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margins = 12;
        const maxLineWidth = pageWidth - (margins * 2);
        const maxHeight = pageHeight - (margins * 2);
        
        let yPosition = margins;
        const lineHeight = 4.5;
        const paragraphSpacing = 1.5;
        
        parsedContent.forEach(({ paragraph, segments }) => {
          if (paragraph.trim() === '') {
            yPosition += paragraphSpacing;
            return;
          }

          // Check if we need a new page
          if (yPosition >= maxHeight) {
            doc.addPage();
            yPosition = margins;
          }

          // Check if this line has links
          const hasLinks = segments.some(seg => seg.isLink);

          if (hasLinks && segments.length > 0) {
            // Handle line with links
            let xPosition = margins;
            
            segments.forEach(segment => {
              // Check if we need a new page
              if (yPosition >= maxHeight) {
                doc.addPage();
                yPosition = margins;
                xPosition = margins;
              }

              if (segment.isLink && segment.url) {
                // Add clickable link
                const textWidth = doc.getTextWidth(segment.text);
                doc.setTextColor(0, 86, 193); // Blue color
                doc.textWithLink(segment.text, xPosition, yPosition, { url: segment.url });
                doc.setTextColor(0, 0, 0); // Reset to black
                xPosition += textWidth;
              } else {
                // Add regular text
                const textWidth = doc.getTextWidth(segment.text);
                doc.text(segment.text, xPosition, yPosition);
                xPosition += textWidth;
              }
            });

            yPosition += lineHeight + paragraphSpacing;
          } else {
            // Regular paragraph without links
            const lines = doc.splitTextToSize(paragraph, maxLineWidth);
            
            lines.forEach((line: string) => {
              // Check if we need a new page
              if (yPosition >= maxHeight) {
                doc.addPage();
                yPosition = margins;
              }
              
              doc.text(line, margins, yPosition);
              yPosition += lineHeight;
            });
            
            yPosition += paragraphSpacing;
          }
        });

        const pdfBytes = doc.output('arraybuffer');
        const pdfBuffer = new Uint8Array(pdfBytes);
        
        console.log('✅ PDF generated successfully with clickable links');
        
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}.pdf"`
          }
        });

      } catch (pdfError) {
        console.error('❌ PDF generation error:', pdfError);
        return NextResponse.json(
          { success: false, error: 'Failed to generate PDF' },
          { status: 500 }
        );
      }
    }

    // ==================== GENERATE DOCX ====================
    if (format === 'docx') {
      try {
        const docParagraphs = parsedContent
          .filter(({ paragraph }) => paragraph.trim().length > 0)
          .map(({ paragraph, segments }) => {
            const isHeader = paragraph.length < 50 && !paragraph.includes(',') && !paragraph.startsWith('Dear');
            
            // Check if this paragraph has links
            const hasLinks = segments.some(seg => seg.isLink);

            if (hasLinks) {
              // Build paragraph with mixed text and hyperlinks
              const children: Array<TextRun | ExternalHyperlink> = [];
              
              segments.forEach(segment => {
                if (segment.isLink && segment.url) {
                  // Add hyperlink
                  children.push(
                    new ExternalHyperlink({
                      children: [
                        new TextRun({
                          text: segment.text,
                          size: 20,
                          font: 'Calibri',
                          color: '0563C1',
                          underline: {}
                        })
                      ],
                      link: segment.url
                    })
                  );
                } else {
                  // Add regular text
                  children.push(
                    new TextRun({
                      text: segment.text,
                      size: 20,
                      font: 'Calibri'
                    })
                  );
                }
              });

              return new Paragraph({
                children: children,
                spacing: {
                  after: isHeader ? 0 : 100,
                  before: 0,
                  line: 260
                },
                alignment: AlignmentType.LEFT
              });
            } else {
              // Regular paragraph without links
              return new Paragraph({
                children: [
                  new TextRun({
                    text: paragraph,
                    size: 20,
                    font: 'Calibri'
                  })
                ],
                spacing: {
                  after: isHeader ? 0 : 100,
                  before: 0,
                  line: 260
                },
                alignment: AlignmentType.LEFT
              });
            }
          });

        const doc = new Document({
          sections: [{
            properties: {
              page: {
                margin: {
                  top: 720,
                  right: 720,
                  bottom: 720,
                  left: 720
                }
              }
            },
            children: docParagraphs
          }]
        });

        const docxBuffer = await Packer.toBuffer(doc);
        const docxBytes = new Uint8Array(docxBuffer);
        
        console.log('✅ Word document generated successfully with hyperlinks');
        
        return new NextResponse(docxBytes, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}.docx"`
          }
        });

      } catch (docxError) {
        console.error('❌ DOCX generation error:', docxError);
        return NextResponse.json(
          { success: false, error: 'Failed to generate Word document' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid format specified' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}