// app/api/resume/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import puppeteer from 'puppeteer';
import * as htmlDocx from 'html-docx-js';

interface EditorPadding {
  top: string; right: string; bottom: string; left: string;
}

interface DownloadRequest {
  resumeId?:     string;
  htmlContent:   string;
  format:        'pdf' | 'docx';
  editorPadding?: EditorPadding;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Resume Download Request');

    // ── Auth ─────────────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try { await auth.verifySessionCookie(session.value, true); }
    catch { return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }); }

    // ── Parse body ───────────────────────────────────────────────────────────
    const body = await request.json() as DownloadRequest;
    const { htmlContent, resumeId, format, editorPadding } = body;
    if (!htmlContent || !format)
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

    console.log(`📄 Generating ${format.toUpperCase()}`);
    const timestamp = Date.now();
    const filename  = resumeId ? `resume_${resumeId}_${timestamp}` : `resume_${timestamp}`;

    // Use whatever padding the editor actually had; fall back to its default (72px all round)
    const pad = editorPadding ?? { top: '72px', right: '72px', bottom: '72px', left: '72px' };

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (format === 'pdf') {
      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
                 '--disable-accelerated-2d-canvas','--disable-gpu'],
        });

        const pg = await browser.newPage();
        await pg.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });

        // Wrap the raw innerHTML exactly as the editor displayed it:
        // - same padding the editor had (read from computed styles on the client)
        // - NO font / size / color / margin overrides — everything comes from
        //   the inline styles already baked into the HTML
        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 8.5in auto; margin: 0; }

    html { margin: 0; padding: 0; background: #fff; }

    body {
      margin: 0;
      /* Mirror the exact padding the contentEditable div had in the editor */
      padding: ${pad.top} ${pad.right} ${pad.bottom} ${pad.left};
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      /* No font / size / color: honour whatever is inside htmlContent */
    }

    /* Strip editor-only chrome */
    .highlighted-line, [data-ai-highlight] {
      background: transparent !important;
      border-left: none !important;
      outline: none !important;
    }
    [id^="line-"] { background: transparent !important; border: none !important; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`;

        await pg.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
        await pg.evaluateHandle('document.fonts.ready');

        // Measure real content height so we never add a blank second page
        const contentH: number = await pg.evaluate(() => document.documentElement.scrollHeight);
        const minH    = 1056; // one Letter page @ 96dpi
        const pageH   = `${(Math.max(contentH, minH) / 96).toFixed(4)}in`;

        const pdfBuffer = await pg.pdf({
          width:  '8.5in',
          height: pageH,          // content-driven — not fixed Letter
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' }, // padding already in body
          displayHeaderFooter: false,
        });

        await browser.close();
        console.log(`✅ PDF: contentH=${contentH}px → pageH=${pageH}`);

        return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          },
        });
      } catch (e) {
        console.error('❌ PDF error:', e);
        return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
      }
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────
    if (format === 'docx') {
      try {
        // Convert the editor padding (px) to inches for Word's @page rule
        const pxToIn = (px: string) => `${(parseFloat(px) / 96).toFixed(4)}in`;
        const mTop   = pxToIn(pad.top);
        const mRight = pxToIn(pad.right);
        const mBot   = pxToIn(pad.bottom);
        const mLeft  = pxToIn(pad.left);

        const fullHtml = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="UTF-8">
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <style>
    @page Section1 {
      size: 8.5in 11in;
      margin: ${mTop} ${mRight} ${mBot} ${mLeft};
      mso-header-margin: 0; mso-footer-margin: 0; mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    /* No body overrides — preserve every inline style from the editor */
    .highlighted-line, [data-ai-highlight] {
      background: transparent; border-left: none; outline: none;
    }
  </style>
</head>
<body><div class="Section1">${htmlContent}</div></body>
</html>`;

        const blob   = htmlDocx.asBlob(fullHtml);
        const buffer = await blob.arrayBuffer();
        console.log('✅ DOCX generated');

        return new NextResponse(Buffer.from(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}.docx"`,
          },
        });
      } catch (e) {
        console.error('❌ DOCX error:', e);
        return NextResponse.json({ success: false, error: 'Failed to generate Word document' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid format' }, { status: 400 });

  } catch (e) {
    console.error('❌ Unexpected error:', e);
    return NextResponse.json({ success: false, error: 'An unexpected error occurred' }, { status: 500 });
  }
}