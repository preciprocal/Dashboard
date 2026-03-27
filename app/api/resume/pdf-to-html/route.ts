// app/api/resume/pdf-to-html/route.ts
// Fetches PDF from Firebase Storage, uploads to OpenAI Files API,
// then asks GPT-4o to reconstruct it as pixel-perfect editable HTML.

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as pdfjsLib from 'pdfjs-dist';

// ── Disable the web worker in Node.js (server-side) ──────────────────────────
// pdfjs-dist v4+ ships ESM; the legacy worker path no longer exists.
// Setting workerSrc to an empty string makes it run synchronously instead.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an expert at converting resume PDFs into clean editable HTML that looks IDENTICAL to the original.

STRICT RULES:
- Reproduce EVERY word, date, bullet point, skill, and link exactly — no paraphrasing, no omissions
- Use ONLY inline styles — no <style> tags, no class names
- Name: <h1 style="text-align:center;font-size:18pt;font-weight:700;margin:0 0 2px 0;font-family:Calibri,Arial,sans-serif;color:#000;">NAME</h1>
- Contact line: <p style="text-align:center;font-size:9pt;margin:0 0 10px 0;font-family:Calibri,Arial,sans-serif;color:#000;">email | phone | location | LinkedIn</p>
- Section headings: <h2 style="font-size:11pt;font-weight:700;text-transform:uppercase;border-bottom:1.5px solid #000;padding-bottom:2px;margin:12px 0 4px 0;font-family:Calibri,Arial,sans-serif;color:#000;">SECTION NAME</h2>
- Job header line: <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;"><span style="font-weight:700;font-size:10pt;font-family:Calibri,Arial,sans-serif;">Job Title, Company Name</span><span style="font-size:10pt;font-family:Calibri,Arial,sans-serif;">Location | Date Range</span></div>
- Bullet points: <ul style="margin:2px 0 8px 0;padding-left:18px;"><li style="margin:2px 0;font-size:10pt;font-family:Calibri,Arial,sans-serif;color:#000;line-height:1.4;">bullet text</li></ul>
- Skills / plain text lines: <p style="margin:2px 0;font-size:10pt;font-family:Calibri,Arial,sans-serif;color:#000;line-height:1.4;">text</p>
- LINKS: Any clickable link, URL, LinkedIn profile, GitHub, Portfolio, or email visible in the PDF MUST be wrapped in an <a> tag. Examples:
    • LinkedIn → <a href="https://linkedin.com/in/username" target="_blank" style="color:#0066cc;text-decoration:underline;">LinkedIn</a>
    • GitHub → <a href="https://github.com/username" target="_blank" style="color:#0066cc;text-decoration:underline;">Github</a>
    • Portfolio → <a href="https://portfolio-url.com" target="_blank" style="color:#0066cc;text-decoration:underline;">Portfolio</a>
    • Email → <a href="mailto:email@example.com" style="color:#0066cc;text-decoration:underline;">email@example.com</a>
    • Any raw URL → wrap it in <a href="..."> with the same URL as both href and display text
    • If the PDF shows a word like "LinkedIn", "GitHub", "Portfolio" without showing the full URL, still create the <a> tag using whatever URL information is visible or inferable from the document
- Do NOT wrap in <html>, <head>, or <body>
- Return ONLY the raw HTML fragment — no markdown fences, no explanation, no preamble`;

export async function POST(request: NextRequest) {
  try {
    const { pdfUrl } = await request.json() as { pdfUrl: string; resumeId?: string };

    if (!pdfUrl) {
      return NextResponse.json({ error: 'pdfUrl is required' }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
    }

    // ── 1. Fetch PDF bytes from Firebase Storage ──────────────────────────────
    console.log('[pdf-to-html] Fetching PDF from Firebase...');
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      return NextResponse.json({ error: `Failed to fetch PDF: ${pdfRes.status}` }, { status: 502 });
    }
    const pdfBuffer = await pdfRes.arrayBuffer();
    console.log('[pdf-to-html] PDF fetched, bytes:', pdfBuffer.byteLength);

    // ── 2. Upload PDF to OpenAI Files API ─────────────────────────────────────
    console.log('[pdf-to-html] Uploading to OpenAI Files API...');
    const blob     = new Blob([pdfBuffer], { type: 'application/pdf' });
    const file     = new File([blob], 'resume.pdf', { type: 'application/pdf' });
    const uploaded = await openai.files.create({ file, purpose: 'assistants' });
    console.log('[pdf-to-html] Uploaded file id:', uploaded.id);

    // ── 3. Extract real hyperlink URLs from PDF annotations ───────────────────
    const pdfLinks: { url: string; text: string }[] = [];
    try {
      const pdfDoc = await pdfjsLib.getDocument({
        data:             new Uint8Array(pdfBuffer),
        useWorkerFetch:   false,
        isEvalSupported:  false,
        useSystemFonts:   true,
      }).promise;

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page        = await pdfDoc.getPage(i);
        const annotations = await page.getAnnotations();
        const textContent = await page.getTextContent();

        for (const ann of annotations) {
          // ann is typed as AnnotationData — access url/unsafeUrl defensively
          const annAny = ann as Record<string, unknown>;
          if (annAny['subtype'] === 'Link' && (annAny['url'] || annAny['unsafeUrl'])) {
            const url  = (annAny['url'] || annAny['unsafeUrl'] || '') as string;
            const rect = annAny['rect'] as number[];
            const [ax1, ay1, ax2, ay2] = rect;

            const overlapping = (textContent.items as Array<{ str: string; transform: number[] }>)
              .filter(item => {
                const ix = item.transform[4];
                const iy = item.transform[5];
                return ix >= ax1 - 5 && ix <= ax2 + 5 && iy >= ay1 - 5 && iy <= ay2 + 5;
              })
              .map(item => item.str)
              .join('');

            pdfLinks.push({ url, text: overlapping || url });
          }
        }
      }
      console.log('[pdf-to-html] Extracted PDF links:', pdfLinks);
    } catch (linkErr) {
      console.warn('[pdf-to-html] Link extraction failed (non-fatal):', linkErr);
    }

    // ── 4. Ask GPT-4o to convert to HTML ─────────────────────────────────────
    const linksContext = pdfLinks.length > 0
      ? `\n\nEXTRACTED HYPERLINKS FROM PDF (use these exact URLs in <a> tags):\n${pdfLinks.map(l => `- Text: "${l.text}" → URL: ${l.url}`).join('\n')}`
      : '';

    console.log('[pdf-to-html] Calling GPT-4o...');
    const response = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Convert this resume PDF into clean editable HTML that exactly matches the original layout, structure, and content. Every section, bullet point, date, word, and hyperlink must be present.${linksContext}`,
            },
            { type: 'file', file: { file_id: uploaded.id } },
          ],
        },
      ],
    });

    // ── 5. Clean up uploaded file ─────────────────────────────────────────────
    await openai.files.delete(uploaded.id).catch((e) =>
      console.warn('[pdf-to-html] File cleanup failed (non-fatal):', e),
    );

    // ── 6. Parse and return HTML ──────────────────────────────────────────────
    let html = response.choices[0]?.message?.content?.trim() ?? '';
    html = html
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    console.log('[pdf-to-html] HTML length:', html.length);

    if (!html || html.length < 100) {
      return NextResponse.json({ error: 'GPT-4o returned empty HTML' }, { status: 500 });
    }

    return NextResponse.json({ html });

  } catch (err) {
    console.error('[pdf-to-html] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}