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

        // Set viewport to match Letter size at 96 DPI
        await page.setViewport({
          width: 816,  // 8.5 inches * 96 DPI
          height: 1056, // 11 inches * 96 DPI
          deviceScaleFactor: 2
        });

        // CRITICAL: Minimal CSS - preserve exact HTML structure and inline styles
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
    
    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 10pt;
      color: #000000;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* Only override editor-specific classes */
    .highlighted-line {
      background: transparent !important;
      border-left: none !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
      animation: none !important;
    }
    
    [id^="line-"] {
      background: transparent !important;
      border: none !important;
    }
    
    /* Ensure links are clickable and blue */
    a {
      color: #0066cc !important;
      text-decoration: underline !important;
    }
    
    a[href^="mailto:"],
    a[href^="tel:"],
    a[href^="http"] {
      color: #0066cc !important;
      text-decoration: underline !important;
    }
    
    /* Ensure text is black */
    body, p, div, span, li, h1, h2, h3, h4, h5, h6, strong, b, em, i, u {
      color: #000000 !important;
    }
    
    a {
      color: #0066cc !important;
    }
    
    @media print {
      body {
        background: white;
      }
      
      a {
        color: #0066cc !important;
        text-decoration: underline !important;
      }
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

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');

        // Generate PDF with exact Letter size
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
          displayHeaderFooter: false,
          scale: 1,
          omitBackground: false
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
        // Minimal HTML for Word - preserve structure
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
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <style>
    @page Section1 {
      size: 8.5in 11in;
      margin: 0.5in 0.6in 0.5in 0.6in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
      mso-paper-source: 0;
    }
    
    div.Section1 {
      page: Section1;
    }
    
    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 10pt;
      color: #000000;
      margin: 0;
      padding: 0;
    }
    
    /* Remove editor highlighting */
    .highlighted-line {
      background: transparent;
      border-left: none;
      padding-left: 0;
      margin-left: 0;
    }
    
    [id^="line-"] {
      background: transparent;
      border: none;
    }
    
    /* Ensure links are blue and clickable */
    a {
      color: #0066cc;
      text-decoration: underline;
    }
    
    a:link, a:visited {
      color: #0066cc;
      text-decoration: underline;
    }
    
    /* Ensure text is black except links */
    body, p, div, span, li, h1, h2, h3, h4, h5, h6, strong, b, em, i, u {
      color: #000000;
    }
  </style>
</head>
<body>
<div class="Section1">
  ${htmlContent}
</div>
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