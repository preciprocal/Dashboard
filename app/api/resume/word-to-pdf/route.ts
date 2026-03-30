// app/api/resume/word-to-pdf/route.ts
// Accepts a Word file (.docx / .doc), converts it to a PDF buffer via
// mammoth (Word → HTML) + Puppeteer (HTML → PDF), and returns the PDF bytes.
// Called from the upload page before saveResumeWithFiles so the rest of the
// app always receives a real PDF regardless of what the user uploaded.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/firebase/admin';
import puppeteer from 'puppeteer';

export const runtime     = 'nodejs';
export const maxDuration = 60;

async function verifyToken(request: NextRequest): Promise<string | null> {
  try {
    const h = request.headers.get('authorization');
    if (!h?.startsWith('Bearer ')) return null;
    const decoded = await auth.verifyIdToken(h.split('Bearer ')[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const userId = await verifyToken(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file     = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith('.docx') && !name.endsWith('.doc')) {
      return NextResponse.json({ error: 'File must be a Word document (.docx or .doc)' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    // ── Step 1: Word → HTML via mammoth ──────────────────────────────────────
    const mammoth = await import('mammoth');
    const { value: bodyHtml } = await mammoth.convertToHtml({ buffer });

    if (!bodyHtml.trim()) {
      return NextResponse.json(
        { error: 'Could not extract content from Word document. Try saving as PDF directly.' },
        { status: 422 },
      );
    }

    // ── Step 2: HTML → PDF via Puppeteer ─────────────────────────────────────
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: Letter; margin: 0.75in 0.85in; }
    * { box-sizing: border-box; }
    html, body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1 { font-size: 18pt; margin: 0 0 4pt; }
    h2 { font-size: 13pt; margin: 12pt 0 3pt; border-bottom: 1pt solid #000; padding-bottom: 1pt; }
    h3 { font-size: 11pt; margin: 8pt 0 2pt; }
    p  { margin: 0 0 4pt; }
    ul, ol { margin: 2pt 0 4pt; padding-left: 18pt; }
    li { margin-bottom: 2pt; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 6pt; }
    td, th { padding: 3pt 6pt; border: 0.5pt solid #ccc; }
    a  { color: #0563c1; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format:             'Letter',
        printBackground:    true,
        preferCSSPageSize:  true,
      });

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `inline; filename="converted.pdf"`,
        },
      });
    } finally {
      await browser.close();
    }

  } catch (err) {
    console.error('❌ word-to-pdf error:', err);
    return NextResponse.json(
      { error: 'Failed to convert Word document to PDF. Please try saving as PDF and re-uploading.' },
      { status: 500 },
    );
  }
}