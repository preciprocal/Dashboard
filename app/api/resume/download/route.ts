// app/api/resume/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';
import * as htmlDocx from 'html-docx-js';

interface EditorPadding {
  top: string; right: string; bottom: string; left: string;
}

interface DownloadRequest {
  resumeId?:      string;
  htmlContent:    string;
  format:         'pdf' | 'docx';
  editorPadding?: EditorPadding;
  userName?:      string;
  jobTitle?:      string;
  companyName?:   string;
}

export const maxDuration = 60;
export const runtime     = 'nodejs';

/** Builds a clean filename: "John Doe - Software Engineer - Google Resume" */
function buildFilename(
  userName?: string,
  jobTitle?: string,
  companyName?: string,
): string {
  const sanitize = (s: string) =>
    s.trim().replace(/[^a-zA-Z0-9 \-]/g, '').replace(/\s+/g, ' ').trim();

  const parts: string[] = [];
  if (userName)    parts.push(sanitize(userName));
  if (jobTitle)    parts.push(sanitize(jobTitle));
  if (companyName) parts.push(sanitize(companyName));
  parts.push('Resume');

  return parts.join(' - ') || 'Resume';
}

async function launchBrowser() {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Local: use system Chrome — no download needed
    const fs = await import('fs');
    const localPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const executablePath = localPaths.find(p => fs.existsSync(p));
    if (!executablePath) throw new Error('No local Chrome found. Install Google Chrome.');

    return puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }

  // Production (Vercel): download serverless Chromium at runtime
  const executablePath = await chromium.executablePath(
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
  );

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Resume Download Request');

    // ── Auth ─────────────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const session = cookieStore.get('session');
    if (!session)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    try { await auth.verifySessionCookie(session.value, true); }
    catch { return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 }); }

    // ── Parse body ───────────────────────────────────────────────────────────
    const body = await request.json() as DownloadRequest;
    const { htmlContent, format, editorPadding, userName, jobTitle, companyName } = body;
    if (!htmlContent || !format)
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });

    console.log(`📄 Generating ${format.toUpperCase()}`);
    const filename = buildFilename(userName, jobTitle, companyName);
    const pad      = editorPadding ?? { top: '72px', right: '72px', bottom: '72px', left: '72px' };

    // ── PDF ──────────────────────────────────────────────────────────────────
    if (format === 'pdf') {
      let browser;
      try {
        browser = await launchBrowser();
        const pg = await browser.newPage();
        await pg.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: 8.5in auto; margin: 0; }
    html { margin: 0; padding: 0; background: #fff; }
    body {
      margin: 0;
      padding: ${pad.top} ${pad.right} ${pad.bottom} ${pad.left};
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
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

        const contentH: number = await pg.evaluate(
          () => document.documentElement.scrollHeight
        );
        const pageH = `${(Math.max(contentH, 1056) / 96).toFixed(4)}in`;

        const pdfBuffer = await pg.pdf({
          width:  '8.5in',
          height: pageH,
          printBackground: true,
          margin: { top: '0', right: '0', bottom: '0', left: '0' },
          displayHeaderFooter: false,
        });

        console.log(`✅ PDF: contentH=${contentH}px → pageH=${pageH} → "${filename}.pdf"`);

        return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}.pdf"`,
          },
        });
      } catch (e) {
        console.error('❌ PDF error:', e);
        return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
      } finally {
        if (browser) await browser.close().catch(() => {});
      }
    }

    // ── DOCX ─────────────────────────────────────────────────────────────────
    if (format === 'docx') {
      try {
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
    .highlighted-line, [data-ai-highlight] {
      background: transparent; border-left: none; outline: none;
    }
  </style>
</head>
<body><div class="Section1">${htmlContent}</div></body>
</html>`;

        const blob   = htmlDocx.asBlob(fullHtml);
        const buffer = await blob.arrayBuffer();
        console.log(`✅ DOCX generated → "${filename}.docx"`);

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