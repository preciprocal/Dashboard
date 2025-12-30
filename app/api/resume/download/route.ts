// app/api/resume/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import puppeteer from 'puppeteer';
import * as htmlDocx from 'html-docx-js';

interface DownloadRequest {
  resumeId?: string;
  htmlContent: string;
  format: 'pdf' | 'docx';
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Resume Download Request');

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
    const { htmlContent, resumeId, format } = body;

    if (!htmlContent || !format) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📄 Generating ${format.toUpperCase()} resume`);

    // Generate filename
    const timestamp = Date.now();
    const filename = resumeId 
      ? `resume_${resumeId}_${timestamp}` 
      : `resume_${timestamp}`;

    // ==================== GENERATE PDF ====================
    if (format === 'pdf') {
      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
          ]
        });

        const page = await browser.newPage();

        // Create HTML with TIGHT spacing matching your original resume
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: Letter;
      margin: 0.5in 0.6in;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000000;
      background: white;
    }
    
    /* Remove ALL default margins */
    h1, h2, h3, h4, h5, h6, p, ul, ol, li, div {
      margin: 0;
      padding: 0;
    }
    
    /* Tight heading styles */
    h1 {
      font-size: 18pt;
      font-weight: 700;
      margin-bottom: 4pt;
      color: #000000;
    }
    
    h2 {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 8pt;
      margin-bottom: 4pt;
      padding-bottom: 2pt;
      color: #000000;
      border-bottom: 1.5pt solid #000000;
    }
    
    h3 {
      font-size: 9pt;
      font-weight: 600;
      margin-top: 4pt;
      margin-bottom: 2pt;
      color: #000000;
    }
    
    /* Minimal paragraph spacing */
    p {
      margin: 2pt 0;
      color: #000000;
      line-height: 1.3;
    }
    
    /* Tight list spacing */
    ul, ol {
      margin: 2pt 0;
      padding-left: 18pt;
      color: #000000;
    }
    
    li {
      margin: 1pt 0;
      padding-left: 2pt;
      color: #000000;
      line-height: 1.3;
    }
    
    /* Text formatting */
    strong, b {
      font-weight: 700;
      color: #000000;
    }
    
    em, i {
      font-style: italic;
      color: #000000;
    }
    
    u {
      text-decoration: underline;
      color: #000000;
    }
    
    /* Ensure all text is black with no extra spacing */
    div {
      color: #000000;
      margin: 0;
      padding: 0;
    }
    
    /* Remove spacing between consecutive elements */
    * + * {
      margin-top: 0;
    }
    
    /* First element has no top margin */
    *:first-child {
      margin-top: 0 !important;
    }
    
    /* Override any inline styles that add spacing */
    [style*="margin"] {
      margin: 0 !important;
    }
    
    [style*="padding"] {
      padding: 0 !important;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

        await page.setContent(fullHtml, { 
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        // Generate PDF with tight margins
        const pdfBuffer = await page.pdf({
          format: 'Letter',
          printBackground: true,
          margin: {
            top: '0.5in',
            right: '0.6in',
            bottom: '0.5in',
            left: '0.6in'
          },
          preferCSSPageSize: true,
          scale: 1
        });

        await browser.close();

        console.log('✅ PDF generated successfully');

        return new NextResponse(Buffer.from(pdfBuffer), {
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
        // Create HTML with tight spacing for Word
        const fullHtml = `
<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="UTF-8">
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <style>
    @page {
      size: 8.5in 11in;
      margin: 0.5in 0.6in;
    }
    
    body {
      font-family: 'Calibri', 'Arial', sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000000;
    }
    
    h1, h2, h3, h4, h5, h6, p, ul, ol, li, div {
      margin: 0;
      padding: 0;
    }
    
    h1 {
      font-size: 18pt;
      font-weight: 700;
      margin-bottom: 4pt;
      color: #000000;
    }
    
    h2 {
      font-size: 11pt;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 8pt;
      margin-bottom: 4pt;
      padding-bottom: 2pt;
      color: #000000;
      border-bottom: 1.5pt solid #000000;
    }
    
    h3 {
      font-size: 9pt;
      font-weight: 600;
      margin-top: 4pt;
      margin-bottom: 2pt;
      color: #000000;
    }
    
    p {
      margin: 2pt 0;
      color: #000000;
      line-height: 1.3;
    }
    
    ul, ol {
      margin: 2pt 0;
      padding-left: 18pt;
    }
    
    li {
      margin: 1pt 0;
      padding-left: 2pt;
      color: #000000;
      line-height: 1.3;
    }
    
    strong, b {
      font-weight: 700;
    }
    
    em, i {
      font-style: italic;
    }
    
    u {
      text-decoration: underline;
    }
    
    div {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

        const docxBlob = htmlDocx.asBlob(fullHtml);
        const buffer = await docxBlob.arrayBuffer();

        console.log('✅ Word document generated successfully');

        return new NextResponse(Buffer.from(buffer), {
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