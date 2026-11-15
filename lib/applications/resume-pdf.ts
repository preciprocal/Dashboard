// lib/applications/resume-pdf.ts
//
// The tailored resume as a plain, single-column PDF the student can upload to
// an application form. Applicant tracking systems read this layout reliably.
// It does not reproduce the student's own design; the Apply flow says so and
// offers the text for pasting into their own file.
//
// Shared by the browser (the PDF download in step 3) and the server
// (app/api/extension/auto-apply, which hands the extension the same file to
// attach to the employer's form).

import { jsPDF } from 'jspdf';

const MARGIN = 48;
const WIDTH = 612 - MARGIN * 2; // US Letter, points

/** A line that reads as a section heading: short, and all caps. */
const isHeading = (l: string) => l.length > 2 && l.length < 48 && l === l.toUpperCase() && /[A-Z]/.test(l);

const BULLET = /^[•●▪\-*]\s*/;
const CARRIES_ON = /(,|&|\(|\/|\+|\b(and|or|of|to|the|a|an|in|on|by|for|with|from|across|into|at|as))$/i;

/** A "Skills: ..." style row. */
const LABEL = /^[A-Z][\w &/+.-]{1,40}:\s/;
/** A line that opens a new entry: a date range ("Jan 2025 - Present") or a "Label:" row. */
const NEW_ENTRY = new RegExp(String.raw`\b(19|20)\d{2}\b.*(-|–|to)\s*(present|current|(19|20)\d{2}|[a-z]{3,9}\.?\s+(19|20)\d{2})`, 'i');
const opensEntry = (l: string) => NEW_ENTRY.test(l) || LABEL.test(l);

/**
 * Text extracted from a PDF keeps the original's line wraps, so a bullet can
 * arrive as "...into a 6" + "category taxonomy...". Rejoin a line onto the one
 * before when it plainly continues it: it starts lowercase or with a number,
 * the previous line ends mid-phrase, or the previous line is a bullet or a
 * "Label:" row that ran the full width. A line that opens a new entry is
 * never joined.
 */
export function reflow(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    const prev = out[out.length - 1];
    const continues = !!line && !!prev && !BULLET.test(line) && !isHeading(line) && !isHeading(prev) && !opensEntry(line) &&
      (/^[a-z0-9$(%]/.test(line) || CARRIES_ON.test(prev) || ((BULLET.test(prev) || LABEL.test(prev)) && prev.length >= 85));
    if (continues) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

export function buildResumePdf(text: string): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = MARGIN;
  const ensure = (h: number) => {
    if (y + h > 792 - MARGIN) { doc.addPage(); y = MARGIN; }
  };

  const lines = reflow(text);
  lines.forEach((raw, i) => {
    if (!raw) { y += 6; return; }
    const first = i === 0;
    const heading = !first && isHeading(raw);
    const bullet = BULLET.test(raw);
    const body = bullet ? raw.replace(BULLET, '') : raw;

    const size = first ? 16 : heading ? 11 : 10;
    doc.setFont('helvetica', first || heading ? 'bold' : 'normal');
    doc.setFontSize(size);
    const indent = bullet ? 12 : 0;
    const wrapped = doc.splitTextToSize(body, WIDTH - indent) as string[];
    const lineH = size * 1.32;

    if (heading) { y += 6; ensure(lineH + 6); }
    wrapped.forEach((w, j) => {
      ensure(lineH);
      if (bullet && j === 0) doc.text('•', MARGIN, y);
      doc.text(w, MARGIN + indent, y);
      y += lineH;
    });
    if (heading) {
      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y - lineH + 3, MARGIN + WIDTH, y - lineH + 3);
      y += 2;
    }
  });

  return doc;
}

/** The file name a student would expect: "<Name> - <Company>.pdf". */
export const resumePdfName = (base: string) => (base.endsWith('.pdf') ? base : `${base}.pdf`);

/** Browser only: download the PDF. */
export function tailoredResumePdf(text: string, fileName: string): void {
  buildResumePdf(text).save(resumePdfName(fileName));
}

/** Server: the PDF as bytes, to store and hand to the extension. */
export function resumePdfBytes(text: string): Uint8Array {
  return new Uint8Array(buildResumePdf(text).output('arraybuffer'));
}

/** Server: the cover letter as a plain PDF, for forms that want it as a file. */
export function letterPdfBytes(text: string): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const lineH = 11 * 1.45;
  let y = MARGIN + 12;
  for (const para of text.replace(/\r/g, '').split(/\n{2,}/)) {
    for (const line of para.split('\n')) {
      for (const w of doc.splitTextToSize(line.trim(), WIDTH) as string[]) {
        if (y + lineH > 792 - MARGIN) { doc.addPage(); y = MARGIN + 12; }
        doc.text(w, MARGIN, y);
        y += lineH;
      }
    }
    y += lineH * 0.6;
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
