// lib/applications/pdf-edit.ts
//
// Edits the student's own resume PDF in place: each approved change replaces
// its line in the file they uploaded, so the design, fonts and file name stay
// theirs. The old words are removed from the page's content stream rather
// than covered up, so an applicant tracking system reading the file sees only
// the new text.
//
// How one change is applied:
//   1. pdf.js finds the original words on the page and where they sit.
//   2. Each glyph that drew them is taken out of the content stream and
//      replaced by a blank move of the same width, so nothing after it on the
//      line moves. A label in another font ("Skills:") and text set apart on
//      the line (a right-aligned date) stay when the rewrite keeps them.
//   3. The rewrite is set in the same lines, right after the old text in the
//      stream so the page still reads in order, in the resume's own embedded font
//      when it has every glyph needed (it usually does: a rewrite reuses the
//      resume's words), otherwise in the closest standard PDF font.
//   4. pdf.js reads the result back. A change is kept only when its rewrite is
//      on the page and no other text was lost or left behind.
// A change that cannot be placed this way (it would need more lines than the
// original, moves a date, sits under a link, or the text is drawn somewhere
// this cannot edit) is reported, not forced into the file.

import {
  PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef,
  StandardFonts, decodePDFRawStream, rgb, type PDFFont, type PDFObject, type PDFPage,
} from 'pdf-lib';

export interface PdfChange { id: string; original: string; rewrite: string }
export interface Box { page: number; x: number; y: number; w: number; h: number }
export interface Placement {
  id: string;
  ok: boolean;
  /** Why it could not be placed, in words for the student. */
  why?: string;
  /**
   * Why, for a retry: too-long (the rewrite needs more room than its lines
   * have), apart (it moves text set apart on the line, like a date), link
   * (the line has a link), other.
   */
  reason?: FailReason;
  /** too-long: the share of the rewrite's width that fits, 0 to 1. */
  room?: number;
  /** apart: the text set apart that the rewrite must keep, as it is. */
  keep?: string;
  /** Where the old text was (page coordinates), for the red marks. */
  before: Box[];
  /** Where the new text is, for the green marks. */
  after: Box[];
}

// ─── Text normalisation (shared by matching and verification) ────────────────

const BULLETS = /[•●▪‣⁃◦■□►▸➢✓✔·]/;
function normChar(c: string): string {
  const n = c.normalize('NFKC');
  return n
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s/g, '')
    .replace(new RegExp(BULLETS.source, 'g'), '');
}
const normText = (s: string) => [...s].map(normChar).join('');

// ─── Reading text and positions with pdf.js ──────────────────────────────────

interface Item { str: string; x: number; y: number; w: number; size: number; font: string }
interface PageText { items: Item[]; join: string; map: { item: number; idx: number }[] }

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfJs> | null = null;
const pdfjs = () => (pdfjsPromise ??= (async () => {
  // Loading the worker module runs pdf.js on this thread. It also lets the
  // build trace the file, which pdf.js would otherwise load by a path at
  // runtime that is not in the deployment.
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  return import('pdfjs-dist/legacy/build/pdf.mjs');
})());

async function readPages(bytes: Uint8Array): Promise<PageText[]> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    const pages: PageText[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of tc.items) {
        if (!('str' in raw) || !raw.str) continue;
        const [, , c, d, e, f] = raw.transform as number[];
        items.push({ str: raw.str, x: e, y: f, w: raw.width, size: Math.hypot(c, d) || raw.height || 10, font: raw.fontName });
      }
      let join = '';
      const map: PageText['map'] = [];
      items.forEach((it, i) => {
        [...it.str].forEach((ch, idx) => {
          for (const n of normChar(ch)) { join += n; map.push({ item: i, idx: charIndex(it.str, idx) }); }
        });
      });
      pages.push({ items, join, map });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/** UTF-16 index of the idx-th code point, so str.slice works on it. */
function charIndex(s: string, cp: number): number {
  let i = 0;
  for (let k = 0; k < cp; k++) i += (s.codePointAt(i)! > 0xffff ? 2 : 1);
  return i;
}

// ─── Fonts: widths and the Unicode a font can draw ───────────────────────────

interface FontInfo {
  base: string;
  twoByte: boolean;
  widths: Map<number, number>;
  dw: number;
  /** Code to Unicode, from the font's ToUnicode map. */
  toUni: Map<number, string>;
  /** Codes the file draws with this font: their glyphs are in the subset. */
  used: Set<number>;
  /** Unicode to a code the file already draws (filled in after reading the pages). */
  fromUni: Map<string, number>;
  /** False when the widths are unknown, so positions after it are guesses. */
  metrics: boolean;
}

function lookup(doc: PDFDocument, o: PDFObject | undefined): PDFObject | undefined {
  return o instanceof PDFRef ? doc.context.lookup(o) : o;
}
const num = (doc: PDFDocument, o: PDFObject | undefined) => {
  const v = lookup(doc, o);
  return v instanceof PDFNumber ? v.asNumber() : undefined;
};

function streamBytes(doc: PDFDocument, o: PDFObject | undefined): Uint8Array | null {
  const s = lookup(doc, o);
  if (s instanceof PDFRawStream) return decodePDFRawStream(s).decode();
  if (s && typeof (s as unknown as { getContents?: () => Uint8Array }).getContents === 'function') {
    return (s as unknown as { getContents: () => Uint8Array }).getContents();
  }
  return null;
}

const latin1 = (b: Uint8Array) => Buffer.from(b).toString('latin1');
const hexToNum = (h: string) => parseInt(h, 16);
function utf16Hex(h: string): string {
  let s = '';
  for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(hexToNum(h.slice(i, i + 4)));
  if (h.length === 2) s = String.fromCharCode(hexToNum(h));
  return s;
}

function parseToUnicode(text: string, into: Map<number, string>) {
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) {
      const u = utf16Hex(m[2]);
      if (u) into.set(hexToNum(m[1]), u);
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = hexToNum(m[1]), hi = hexToNum(m[2]);
      if (hi - lo > 2000) continue;
      if (m[3].startsWith('[')) {
        [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].forEach((d, i) => {
          const u = utf16Hex(d[1]);
          if (u) into.set(lo + i, u);
        });
      } else {
        const dst = m[3].slice(1, -1);
        const head = dst.slice(0, -4), last = hexToNum(dst.slice(-4) || '0');
        for (let c = lo; c <= hi; c++) {
          const u = utf16Hex(head + (last + c - lo).toString(16).padStart(4, '0'));
          if (u) into.set(c, u);
        }
      }
    }
  }
}

function fontInfo(doc: PDFDocument, dict: PDFDict): FontInfo {
  const base = (lookup(doc, dict.get(PDFName.of('BaseFont'))) as PDFName | undefined)?.decodeText?.() ?? '';
  const subtype = (lookup(doc, dict.get(PDFName.of('Subtype'))) as PDFName | undefined)?.decodeText?.() ?? '';
  const twoByte = subtype === 'Type0';
  const widths = new Map<number, number>();
  let dw = twoByte ? 1000 : 0;
  let metrics = false;

  if (twoByte) {
    const desc = lookup(doc, (lookup(doc, dict.get(PDFName.of('DescendantFonts'))) as PDFArray | undefined)?.get(0)) as PDFDict | undefined;
    if (desc) {
      dw = num(doc, desc.get(PDFName.of('DW'))) ?? 1000;
      metrics = true;
      const w = lookup(doc, desc.get(PDFName.of('W'))) as PDFArray | undefined;
      if (w) {
        for (let i = 0; i < w.size();) {
          const first = num(doc, w.get(i));
          const next = lookup(doc, w.get(i + 1));
          if (first === undefined) break;
          if (next instanceof PDFArray) {
            for (let j = 0; j < next.size(); j++) widths.set(first + j, num(doc, next.get(j)) ?? dw);
            i += 2;
          } else {
            const last = num(doc, next) ?? first;
            const width = num(doc, w.get(i + 2)) ?? dw;
            for (let c = first; c <= last && c - first < 5000; c++) widths.set(c, width);
            i += 3;
          }
        }
      }
    }
  } else {
    const first = num(doc, dict.get(PDFName.of('FirstChar')));
    const w = lookup(doc, dict.get(PDFName.of('Widths'))) as PDFArray | undefined;
    if (first !== undefined && w) {
      metrics = true;
      for (let j = 0; j < w.size(); j++) widths.set(first + j, num(doc, w.get(j)) ?? 0);
    }
    const fd = lookup(doc, dict.get(PDFName.of('FontDescriptor'))) as PDFDict | undefined;
    dw = (fd && num(doc, fd.get(PDFName.of('MissingWidth')))) ?? (metrics ? 0 : 500);
  }

  const toUni = new Map<number, string>();
  const tu = streamBytes(doc, dict.get(PDFName.of('ToUnicode')));
  if (tu) parseToUnicode(latin1(tu), toUni);
  else if (!twoByte) {
    // A simple font with no ToUnicode map: printable ASCII is its own code.
    for (let c = 32; c < 127; c++) toUni.set(c, String.fromCharCode(c));
  }
  return { base, twoByte, widths, dw, toUni, used: new Set(), fromUni: new Map(), metrics };
}

/**
 * Which code draws each character, using only codes the file already draws.
 * A subset font may map codes in its ToUnicode table that have no glyph.
 */
function fillFromUni(f: FontInfo) {
  f.fromUni.clear();
  for (const code of f.used) {
    const u = f.toUni.get(code);
    if (u && [...u].length === 1 && !f.fromUni.has(u)) f.fromUni.set(u, code);
  }
}

// ─── Content stream tokens and a small text-state interpreter ───────────────

type Tok =
  | { k: 'num'; v: number; s: number; e: number }
  | { k: 'name'; v: string; s: number; e: number }
  | { k: 'str'; v: number[]; s: number; e: number }
  | { k: 'op'; v: string; s: number; e: number }
  | { k: 'arr'; v: Tok[]; s: number; e: number }
  | { k: 'other'; s: number; e: number };

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set('()<>[]{}/%'.split('').map(c => c.charCodeAt(0)));

class Lexer {
  i = 0;
  private b: Uint8Array;
  constructor(b: Uint8Array) { this.b = b; }
  private skip() {
    const b = this.b;
    while (this.i < b.length) {
      if (WS.has(b[this.i])) this.i++;
      else if (b[this.i] === 37) { while (this.i < b.length && b[this.i] !== 10 && b[this.i] !== 13) this.i++; }
      else break;
    }
  }
  next(): Tok | null {
    this.skip();
    const b = this.b, s = this.i;
    if (s >= b.length) return null;
    const c = b[s];
    if (c === 40) return this.literal();
    if (c === 60 && b[s + 1] === 60) { this.i += 2; return { k: 'other', s, e: this.i }; }
    if (c === 62 && b[s + 1] === 62) { this.i += 2; return { k: 'other', s, e: this.i }; }
    if (c === 60) return this.hex();
    if (c === 91) {
      this.i++;
      const v: Tok[] = [];
      for (;;) {
        this.skip();
        if (this.i >= b.length) break;
        if (b[this.i] === 93) { this.i++; break; }
        const t = this.next();
        if (!t) break;
        v.push(t);
      }
      return { k: 'arr', v, s, e: this.i };
    }
    if (c === 93 || c === 123 || c === 125 || c === 41 || c === 62) { this.i++; return { k: 'other', s, e: this.i }; }
    if (c === 47) {
      this.i++;
      while (this.i < b.length && !WS.has(b[this.i]) && !DELIM.has(b[this.i])) this.i++;
      return { k: 'name', v: latin1(b.subarray(s + 1, this.i)), s, e: this.i };
    }
    while (this.i < b.length && !WS.has(b[this.i]) && !DELIM.has(b[this.i])) this.i++;
    if (this.i === s) { this.i++; return { k: 'other', s, e: this.i }; }
    const word = latin1(b.subarray(s, this.i));
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) return { k: 'num', v: parseFloat(word), s, e: this.i };
    return { k: 'op', v: word, s, e: this.i };
  }
  private literal(): Tok {
    const b = this.b, s = this.i;
    const v: number[] = [];
    let depth = 0;
    this.i++;
    while (this.i < b.length) {
      const c = b[this.i++];
      if (c === 92) {
        const n = b[this.i++];
        if (n === 110) v.push(10); else if (n === 114) v.push(13); else if (n === 116) v.push(9);
        else if (n === 98) v.push(8); else if (n === 102) v.push(12);
        else if (n === 13) { if (b[this.i] === 10) this.i++; }
        else if (n === 10) { /* line continuation */ }
        else if (n >= 48 && n <= 55) {
          let o = n - 48;
          for (let k = 0; k < 2 && b[this.i] >= 48 && b[this.i] <= 55; k++) o = o * 8 + (b[this.i++] - 48);
          v.push(o & 255);
        } else v.push(n);
      } else if (c === 40) { depth++; v.push(c); }
      else if (c === 41) { if (depth === 0) break; depth--; v.push(c); }
      else v.push(c);
    }
    return { k: 'str', v, s, e: this.i };
  }
  private hex(): Tok {
    const b = this.b, s = this.i;
    this.i++;
    let h = '';
    while (this.i < b.length && b[this.i] !== 62) {
      const ch = String.fromCharCode(b[this.i++]);
      if (/[0-9a-fA-F]/.test(ch)) h += ch;
    }
    this.i++;
    if (h.length % 2) h += '0';
    const v: number[] = [];
    for (let k = 0; k < h.length; k += 2) v.push(hexToNum(h.slice(k, k + 2)));
    return { k: 'str', v, s, e: this.i };
  }
  /** After an ID operator: skip the inline image's binary data up to EI. */
  skipInlineImage() {
    const b = this.b;
    this.i++;
    for (; this.i < b.length - 1; this.i++) {
      if (b[this.i] === 69 && b[this.i + 1] === 73 && WS.has(b[this.i - 1]) && (this.i + 2 >= b.length || WS.has(b[this.i + 2]))) { this.i += 2; return; }
    }
    this.i = b.length;
  }
}

type M6 = [number, number, number, number, number, number];
const ID: M6 = [1, 0, 0, 1, 0, 0];
const invert = (m: M6): M6 | null => {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};
const mul = (m: M6, n: M6): M6 => [
  m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5],
];

interface Gs { ctm: M6; tc: number; tw: number; th: number; tl: number; ts: number; font: string; fs: number; fill: [number, number, number] }

interface ShowOp {
  /** Byte range of the operands and operator. */
  s: number; e: number;
  op: string;
  /** Operands that set state before the show (for ' and "). */
  pre: string;
  x0: number; y0: number; x1: number;
  size: number;
  font: string;
  /** What it draws, glyph by glyph, so single glyphs can be taken out. */
  parts: Part[];
  fs: number; th: number; tc: number;
  fill: [number, number, number];
  upright: boolean;
  /** Where its text object ends (after ET), and the CTM there, to draw new text in reading order. */
  etEnd?: number;
  etCtm?: M6;
}

/** A kerning number, or one glyph: its code bytes, where it sits and its advance in text space. */
type Part = { n: number } | { code: number[]; x0: number; x1: number; adv: number };

const cmyk = (c: number, m: number, y: number, k: number): [number, number, number] => [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];

function interpret(content: Uint8Array, fonts: (name: string) => FontInfo | null): ShowOp[] {
  const lx = new Lexer(content);
  const shows: ShowOp[] = [];
  let gs: Gs = { ctm: [...ID], tc: 0, tw: 0, th: 1, tl: 0, ts: 0, font: '', fs: 0, fill: [0, 0, 0] };
  const stack: Gs[] = [];
  let tm: M6 = [...ID], tlm: M6 = [...ID];
  let ops: Tok[] = [];
  let opStart = -1;
  let textStart = 0;

  const point = (m: M6) => {
    const full = mul(mul([1, 0, 0, 1, 0, gs.ts], m), gs.ctm);
    return { x: full[4], y: full[5], full };
  };
  const advance = (codes: number[], f: FontInfo | null) => {
    let tx = 0;
    for (const code of codes) {
      const w = (f?.widths.get(code) ?? f?.dw ?? 500) / 1000;
      tx += (w * gs.fs + gs.tc + (!f?.twoByte && code === 32 ? gs.tw : 0)) * gs.th;
    }
    return tx;
  };
  const codesOf = (bytes: number[], f: FontInfo | null) => {
    if (!f?.twoByte) return bytes;
    const out: number[] = [];
    for (let i = 0; i + 1 < bytes.length; i += 2) out.push(bytes[i] * 256 + bytes[i + 1]);
    return out;
  };
  const show = (parts: Tok[], s: number, e: number, op: string, pre: string) => {
    const f = fonts(gs.font);
    const start = point(tm);
    const out: Part[] = [];
    for (const p of parts) {
      if (p.k === 'num') {
        out.push({ n: p.v });
        tm = mul([1, 0, 0, 1, -p.v / 1000 * gs.fs * gs.th, 0], tm);
      } else if (p.k === 'str') {
        const step = f?.twoByte ? 2 : 1;
        codesOf(p.v, f).forEach((code, i) => {
          f?.used.add(code);
          const tx = advance([code], f);
          const x0 = point(tm).x;
          tm = mul([1, 0, 0, 1, tx, 0], tm);
          out.push({ code: p.v.slice(i * step, i * step + step), x0, x1: point(tm).x, adv: tx });
        });
      }
    }
    const end = point(tm);
    const m = start.full;
    shows.push({
      s, e, op, pre, x0: start.x, y0: start.y, x1: end.x, size: gs.fs * Math.hypot(m[2], m[3]),
      font: gs.font, parts: out, fs: gs.fs, th: gs.th, tc: gs.tc, fill: gs.fill,
      upright: m[0] > 0 && m[3] > 0 && Math.abs(m[1]) < 1e-6 && Math.abs(m[2]) < 1e-6,
    });
  };

  for (let t = lx.next(); t; t = lx.next()) {
    if (t.k !== 'op') { if (opStart < 0) opStart = t.s; ops.push(t); continue; }
    const s = opStart < 0 ? t.s : opStart, e = t.e;
    const n = ops.map(o => (o.k === 'num' ? o.v : NaN));
    switch (t.v) {
      case 'q': stack.push({ ...gs, ctm: [...gs.ctm] as M6, fill: [...gs.fill] as Gs['fill'] }); break;
      case 'Q': gs = stack.pop() ?? gs; break;
      case 'cm': if (n.length === 6) gs.ctm = mul(n as M6, gs.ctm); break;
      case 'BT': tm = [...ID]; tlm = [...ID]; textStart = shows.length; break;
      case 'ET':
        for (let k = textStart; k < shows.length; k++) { shows[k].etEnd = e; shows[k].etCtm = [...gs.ctm] as M6; }
        textStart = shows.length;
        break;
      case 'Tf': if (ops[0]?.k === 'name') gs.font = ops[0].v; if (!isNaN(n[1])) gs.fs = n[1]; break;
      case 'Tc': gs.tc = n[0] || 0; break;
      case 'Tw': gs.tw = n[0] || 0; break;
      case 'Tz': gs.th = (n[0] ?? 100) / 100; break;
      case 'TL': gs.tl = n[0] || 0; break;
      case 'Ts': gs.ts = n[0] || 0; break;
      case 'Td': tlm = mul([1, 0, 0, 1, n[0] || 0, n[1] || 0], tlm); tm = [...tlm]; break;
      case 'TD': gs.tl = -(n[1] || 0); tlm = mul([1, 0, 0, 1, n[0] || 0, n[1] || 0], tlm); tm = [...tlm]; break;
      case 'Tm': if (n.length === 6) { tlm = n as M6; tm = [...tlm]; } break;
      case 'T*': tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = [...tlm]; break;
      case 'Tj': if (ops[0]) show([ops[0]], s, e, 'Tj', ''); break;
      case 'TJ': if (ops[0]?.k === 'arr') show(ops[0].v, s, e, 'TJ', ''); break;
      case "'":
        tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = [...tlm];
        if (ops[0]) show([ops[0]], s, e, "'", 'T*');
        break;
      case '"':
        gs.tw = n[0] || 0; gs.tc = n[1] || 0;
        tlm = mul([1, 0, 0, 1, 0, -gs.tl], tlm); tm = [...tlm];
        if (ops[2]) show([ops[2]], s, e, '"', `${n[0] || 0} Tw ${n[1] || 0} Tc T*`);
        break;
      case 'g': gs.fill = [n[0], n[0], n[0]]; break;
      case 'rg': gs.fill = [n[0], n[1], n[2]]; break;
      case 'k': gs.fill = cmyk(n[0], n[1], n[2], n[3]); break;
      case 'sc': case 'scn': {
        const v = n.filter(x => !isNaN(x));
        if (v.length === 1) gs.fill = [v[0], v[0], v[0]];
        else if (v.length === 3) gs.fill = [v[0], v[1], v[2]];
        else if (v.length === 4) gs.fill = cmyk(v[0], v[1], v[2], v[3]);
        break;
      }
      case 'ID': lx.skipInlineImage(); break;
    }
    ops = [];
    opStart = -1;
  }
  return shows;
}

// ─── Planning one change ─────────────────────────────────────────────────────

interface Line { x0: number; x1: number; y: number; size: number; /** Kept text to the right that new words must stop before. */ stop?: number }
interface Plan {
  id: string;
  page: number;
  /** pdf.js items whose text is replaced. */
  items: number[];
  /** Glyphs to take out, by operator: indexes into its parts. */
  cuts: Map<ShowOp, Set<number>>;
  text: string;
  /** Non-space characters taken out, for the read-back check. */
  removedChars: number;
  lines: Line[];
  startX: number;
  /** Right edge each line may run to. */
  limits: number[];
  /** The original lines, but the last, ran to the right edge. */
  justified: boolean;
  font: string;
  fill: [number, number, number];
  tc: number;
  th: number;
}

export type FailReason = 'too-long' | 'apart' | 'link' | 'other';
class PlanError extends Error {
  reason: FailReason;
  room?: number;
  keep?: string;
  constructor(message: string, extra: { reason?: FailReason; room?: number; keep?: string } = {}) {
    super(message);
    this.reason = extra.reason ?? 'other';
    this.room = extra.room;
    this.keep = extra.keep;
  }
}

/** Where a change's original text is, and the full text that replaces it. */
function locate(c: PdfChange, pages: PageText[]): { page: number; items: number[]; text: string; removedChars: number } {
  const needle = normText(c.original);
  if (needle.length < 3) throw new PlanError('The line is too short to find in your file.');
  const p = pages.findIndex(pg => pg.join.includes(needle));
  if (p < 0) throw new PlanError('This line could not be found in your PDF as written.');
  const pg = pages[p];
  const at = pg.join.indexOf(needle);
  const first = pg.map[at], last = pg.map[at + needle.length - 1];

  const items: number[] = [];
  for (let i = first.item; i <= last.item; i++) items.push(i);
  // Text in the first and last items that is outside the match is drawn again.
  const prefix = pg.items[first.item].str.slice(0, first.idx);
  const lastStr = pg.items[last.item].str;
  const suffix = lastStr.slice(last.idx + (lastStr.codePointAt(last.idx)! > 0xffff ? 2 : 1));
  // A bullet the model quoted stays the file's own: it is drawn apart from
  // the text, often in a symbol font.
  const rewrite = c.rewrite.trim().replace(new RegExp(`^(${BULLETS.source}\\s*)+`), '');

  return {
    page: p, items,
    text: `${prefix}${rewrite}${suffix}`.replace(/\s+/g, ' ').trim(),
    removedChars: normText(items.map(i => pg.items[i].str).join('')).length,
  };
}

function planChange(c: PdfChange, pages: PageText[], shows: ShowOp[][], fontsFor: (pi: number) => (name: string) => FontInfo | null): Plan {
  const located = locate(c, pages);
  const { page: p, items } = located;
  let { text, removedChars } = located;
  const pg = pages[p];
  const its = items.map(i => pg.items[i]);

  const lines: Line[] = [];
  for (const it of its) {
    if (!it.str.trim()) continue;
    const line = lines.find(l => Math.abs(l.y - it.y) < Math.max(1, it.size * 0.3));
    if (line) { line.x0 = Math.min(line.x0, it.x); line.x1 = Math.max(line.x1, it.x + it.w); line.size = Math.max(line.size, it.size); }
    else lines.push({ x0: it.x, x1: it.x + it.w, y: it.y, size: it.size });
  }
  lines.sort((a, b) => b.y - a.y);
  if (!lines.length) throw new PlanError('This line could not be found in your PDF as written.');
  let startX = its.find(it => it.str.trim() && Math.abs(it.y - lines[0].y) < Math.max(1, it.size * 0.3))?.x ?? lines[0].x0;

  // Every glyph drawn inside these lines' spans is taken out, whichever
  // operator drew it.
  const cuts = new Map<ShowOp, Set<number>>();
  for (const op of shows[p]) {
    const line = lines.find(l => Math.abs(op.y0 - l.y) < Math.max(1, l.size * 0.3));
    if (!line) continue;
    op.parts.forEach((part, i) => {
      if (!('code' in part)) return;
      const mid = (part.x0 + part.x1) / 2;
      const lineStart = line === lines[0] ? startX : line.x0;
      if (mid < lineStart - 0.5 || mid > line.x1 + 0.5) return;
      if (!op.upright) throw new PlanError('This line is rotated or mirrored in your PDF.');
      const set = cuts.get(op) ?? new Set<number>();
      set.add(i);
      cuts.set(op, set);
    });
  }
  if (!cuts.size) throw new PlanError('This line is drawn in a way that cannot be edited.');

  // The new text is set in the font most of the old text used, not in a bold
  // label's font that happens to come first.
  const perFont = new Map<string, number>();
  for (const [op, idx] of cuts) perFont.set(op.font, (perFont.get(op.font) ?? 0) + idx.size);
  const main = [...perFont].sort((a, b) => b[1] - a[1])[0][0];
  const font: ShowOp = [...cuts].filter(([op]) => op.font === main).sort((a, b) => b[1].size - a[1].size)[0][0];

  const charOf = (op: ShowOp, i: number) => {
    const f = fontsFor(p)(op.font);
    const part = op.parts[i] as Extract<Part, { code: number[] }>;
    return f?.toUni.get(f.twoByte ? part.code[0] * 256 + (part.code[1] ?? 0) : part.code[0]) ?? '';
  };

  // A label in another font at the start of the line ("Skills:" in bold)
  // stays as it is when the rewrite starts with it.
  {
    const first = [...cuts].flatMap(([op, idx]) => [...idx].map(i => ({ op, i, x0: (op.parts[i] as Extract<Part, { code: number[] }>).x0 })))
      .filter(g => Math.abs(g.op.y0 - lines[0].y) < Math.max(1, lines[0].size * 0.3))
      .sort((a, b) => a.x0 - b.x0);
    const lead = first.slice(0, Math.max(0, first.findIndex(g => g.op.font === main && charOf(g.op, g.i).trim())));
    const label = lead.map(g => charOf(g.op, g.i)).join('');
    const labelNorm = normText(label);
    if (labelNorm && normText(text).startsWith(labelNorm) && labelNorm.length < normText(text).length) {
      let seen = 0, cut = 0;
      while (cut < text.length && seen < labelNorm.length) { seen += normChar(text[cut]).length; cut++; }
      text = text.slice(cut).trimStart();
      removedChars -= labelNorm.length;
      for (const g of lead) cuts.get(g.op)!.delete(g.i);
      startX = first[lead.length].x0;
    }
  }

  // A line can draw text set apart, like a right-aligned date, in the same
  // run as the words before it. Find such gaps from the glyphs themselves:
  // keep a part in place when the rewrite keeps it, otherwise this change
  // would move it.
  for (const line of lines) {
    const glyphs: { op: ShowOp; i: number; x0: number; x1: number; ch: string }[] = [];
    for (const [op, idx] of cuts) {
      if (Math.abs(op.y0 - line.y) >= Math.max(1, line.size * 0.3)) continue;
      for (const i of idx) {
        const part = op.parts[i] as Extract<Part, { code: number[] }>;
        glyphs.push({ op, i, x0: part.x0, x1: part.x1, ch: charOf(op, i) });
      }
    }
    glyphs.sort((a, b) => a.x0 - b.x0);
    // Each stretch of white between words: blank moves plus space glyphs.
    // Justified text widens every one of them about equally; a date set
    // apart is one stretch far wider than the line's usual word spacing.
    const visible = glyphs.filter(g => g.ch.trim());
    const gaps = visible.slice(1).map((g, i) => g.x0 - visible[i].x1);
    const words = gaps.filter(w => w > line.size * 0.15).sort((a, b) => a - b);
    const usual = words[Math.floor(words.length / 2)] ?? 0;
    const apart = (w: number) => w > line.size * 2.5 && (words.length < 2 ? w > line.size * 6 : w > usual * 4);
    const clusters: (typeof glyphs)[] = [];
    let lastVisible: (typeof glyphs)[number] | null = null;
    for (const g of glyphs) {
      const last = clusters[clusters.length - 1];
      const startsApart = !!g.ch.trim() && !!lastVisible && apart(g.x0 - lastVisible.x1);
      if (last && !startsApart) last.push(g);
      else clusters.push([g]);
      if (g.ch.trim()) lastVisible = g;
    }
    if (clusters.length < 2) continue;
    if (lines.length > 1) throw new PlanError('This line has text set apart on it, like a date, that the new wording moves.', { reason: 'apart', keep: clusters.slice(1).map(cl => cl.map(g => g.ch).join('').trim()).join(' ') });
    const keep = (cluster: typeof glyphs, end: 'head' | 'tail') => {
      const part = normText(cluster.map(g => g.ch).join(''));
      const r = normText(text);
      if (!part || r === part || !(end === 'tail' ? r.endsWith(part) : r.startsWith(part))) return false;
      let seen = 0;
      if (end === 'tail') {
        let cut = text.length;
        while (cut > 0 && seen < part.length) { cut--; seen += normChar(text[cut]).length; }
        text = text.slice(0, cut).trimEnd();
      } else {
        let cut = 0;
        while (cut < text.length && seen < part.length) { seen += normChar(text[cut]).length; cut++; }
        text = text.slice(cut).trimStart();
      }
      removedChars -= part.length;
      for (const g of cluster) cuts.get(g.op)!.delete(g.i);
      return true;
    };
    while (clusters.length > 1 && keep(clusters[clusters.length - 1], 'tail')) {
      line.stop = clusters[clusters.length - 1][0].x0 - line.size;
      clusters.pop();
      line.x1 = clusters[clusters.length - 1][clusters[clusters.length - 1].length - 1].x1;
    }
    while (clusters.length > 1 && keep(clusters[0], 'head')) {
      clusters.shift();
      line.x0 = clusters[0][0].x0;
      if (line === lines[0]) startX = line.x0;
    }
    if (clusters.length > 1) throw new PlanError('This line has text set apart on it, like a date, that the new wording moves.', { reason: 'apart', keep: clusters.slice(1).map(cl => cl.map(g => g.ch).join('').trim()).join(' ') });
  }
  for (const [op, idx] of cuts) if (!idx.size) cuts.delete(op);

  // How far right each line may run: the column's edge, and never into text
  // beside it.
  const minX = Math.min(...lines.map(l => l.x0)), maxX = Math.max(...lines.map(l => l.x1));
  const others = pg.items.filter((it, i) => !items.includes(i) && it.str.trim());
  const near = others.filter(it => Math.abs(it.y - lines[0].y) < 160 && it.x < maxX && it.x + it.w > minX && it.x >= minX - 40);
  const column = Math.max(maxX, ...near.map(it => it.x + it.w));
  const limits = lines.map(l => {
    const beside = others.filter(it => Math.abs(it.y - l.y) < l.size * 0.8 && it.x >= l.x1 - 0.5).map(it => it.x - 4);
    return Math.min(column, ...beside, l.stop ?? Infinity);
  });
  const justified = lines.length > 1 && lines.slice(0, -1).every((l, i) => l.x1 >= limits[i] - 1.5);

  return {
    id: c.id, page: p, items, cuts, text, removedChars, lines, startX, limits, justified,
    font: font.font, fill: font.fill, tc: font.tc * (font.size / (font.fs || font.size)), th: font.th,
  };
}

// ─── Writing the new text ────────────────────────────────────────────────────

interface Writer {
  /** Width of `s` at `size` points, or null when this font cannot draw it. */
  width(s: string, size: number): number | null;
  /** Content stream operators that draw `s` at (x, y), with `extra` points added at each space (to justify). */
  draw(s: string, x: number, y: number, size: number, extra?: number): string;
}

const SPACE_EM = 0.26;

function reuseWriter(res: string, f: FontInfo, tc: number, th: number): Writer {
  const hasSpace = f.fromUni.has(' ');
  const w = (code: number) => (f.widths.get(code) ?? f.dw) / 1000;
  const ok = (s: string) => f.metrics && [...s].every(ch => ch === ' ' || (f.fromUni.has(ch) && w(f.fromUni.get(ch)!) > 0));
  const hex = (code: number) => code.toString(16).padStart(f.twoByte ? 4 : 2, '0');
  return {
    width(s, size) {
      if (!ok(s)) return null;
      let total = 0;
      for (const ch of s) total += ((ch === ' ' && !hasSpace) ? SPACE_EM : w(f.fromUni.get(ch)!)) * size + tc;
      return total * th;
    },
    draw(s, x, y, size, extra = 0) {
      const parts: string[] = [];
      let run = '';
      const stretch = extra * 1000 / (size * th);
      for (const ch of s) {
        if (ch === ' ' && !hasSpace) {
          if (run) { parts.push(`<${run}>`); run = ''; }
          parts.push(fmt(-(SPACE_EM * 1000 + tc * 1000 / size) - stretch));
        } else if (ch === ' ' && stretch) {
          run += hex(f.fromUni.get(ch)!);
          parts.push(`<${run}>`, fmt(-stretch));
          run = '';
        } else run += hex(f.fromUni.get(ch)!);
      }
      if (run) parts.push(`<${run}>`);
      return `BT /${res} ${fmt(size)} Tf ${fmt(tc)} Tc ${fmt(th * 100)} Tz 1 0 0 1 ${fmt(x)} ${fmt(y)} Tm [${parts.join(' ')}] TJ ET\n`;
    },
  };
}

function standardWriter(res: string, font: PDFFont, th: number): Writer {
  return {
    width(s, size) {
      try { font.encodeText(s); return font.widthOfTextAtSize(s, size) * th; } catch { return null; }
    },
    draw(s, x, y, size, extra = 0) {
      const words = s.split(' ');
      const stretch = fmt(-extra * 1000 / (size * th));
      const parts = words.map((w, i) => font.encodeText(i < words.length - 1 ? `${w} ` : w).toString());
      return `BT /${res} ${fmt(size)} Tf 0 Tc ${fmt(th * 100)} Tz 1 0 0 1 ${fmt(x)} ${fmt(y)} Tm [${parts.join(` ${stretch} `)}] TJ ET\n`;
    },
  };
}

const fmt = (n: number) => (Math.round(n * 1000) / 1000).toString();

function standardFor(base: string): StandardFonts {
  const b = /bold|black|heavy|semibold|demi/i.test(base), i = /italic|oblique/i.test(base);
  if (/courier|mono|consol/i.test(base)) return b && i ? StandardFonts.CourierBoldOblique : b ? StandardFonts.CourierBold : i ? StandardFonts.CourierOblique : StandardFonts.Courier;
  if (/times|georgia|garamond|cambria|serif|minion|palatino|book|baskerville|merriweather|roman|cmr|lmr|charter/i.test(base) && !/sans/i.test(base)) {
    return b && i ? StandardFonts.TimesRomanBoldItalic : b ? StandardFonts.TimesRomanBold : i ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  }
  return b && i ? StandardFonts.HelveticaBoldOblique : b ? StandardFonts.HelveticaBold : i ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
}

/** Greedy word wrap into at most `limits.length` lines. */
function wrap(text: string, writer: Writer, size: number, starts: number[], limits: number[]): string[] | null {
  const words = text.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const word of words) {
    const tryLine = cur ? `${cur} ${word}` : word;
    const li = out.length;
    if (li >= limits.length) return null;
    const w = writer.width(tryLine, size);
    if (w === null) return null;
    if (starts[li] + w <= limits[li] + 0.5) { cur = tryLine; continue; }
    if (!cur) return null;
    out.push(cur);
    cur = word;
    if (out.length >= limits.length) return null;
    const w2 = writer.width(cur, size);
    if (w2 === null || starts[out.length] + w2 > limits[out.length] + 0.5) return null;
  }
  if (cur) out.push(cur);
  return out.length <= limits.length ? out : null;
}

// ─── Applying a set of changes ───────────────────────────────────────────────

interface Built { bytes: Uint8Array; placements: Placement[] }
type Fact = { page: number; text: string; removedChars: number };

async function build(bytes: Uint8Array, changes: PdfChange[], pages: PageText[]): Promise<Built & { facts: Map<string, Fact> }> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const pdfPages = doc.getPages();
  const contents: Uint8Array[] = [];
  // One entry per font object, so the codes used on every page count.
  const byDict = new Map<PDFDict, FontInfo>();
  const fontsFor = (pi: number) => (name: string) => {
    const res = pdfPages[pi].node.Resources();
    const fd = res && (lookup(doc, res.get(PDFName.of('Font'))) as PDFDict | undefined);
    const dict = fd && lookup(doc, fd.get(PDFName.of(name)));
    if (!(dict instanceof PDFDict)) return null;
    if (!byDict.has(dict)) byDict.set(dict, fontInfo(doc, dict));
    return byDict.get(dict)!;
  };
  const shows = pdfPages.map((pg, i) => {
    const c = pg.node.Contents();
    const parts: Uint8Array[] = [];
    if (c instanceof PDFArray) for (let j = 0; j < c.size(); j++) { const b = streamBytes(doc, c.get(j)); if (b) parts.push(b); }
    else { const b = streamBytes(doc, c); if (b) parts.push(b); }
    const joined = Buffer.concat(parts.flatMap(b => [Buffer.from(b), Buffer.from('\n')]));
    contents[i] = joined;
    return interpret(joined, fontsFor(i));
  });
  byDict.forEach(fillFromUni);

  const placements: Placement[] = [];
  const facts = new Map<string, Fact>();
  const edits = new Map<number, { cuts: Map<ShowOp, Set<number>>; inserts: { at: number; draw: string }[] }>();
  const usedItems = new Map<number, Set<number>>();
  const stdFonts = new Map<string, { font: PDFFont; res: string }>();

  for (const c of changes) {
    try {
      const plan = planChange(c, pages, shows, fontsFor);
      // A link's clickable area is fixed on the page; moved words would
      // leave it over the wrong text.
      const links = linkRects(doc, pdfPages[plan.page]);
      const onLink = plan.lines.some((l, i) => {
        const x0 = i === 0 ? plan.startX : l.x0, y0 = l.y - l.size * 0.3, y1 = l.y + l.size * 0.9;
        return links.some(([a, b, c2, d]) => a < l.x1 && c2 > x0 && b < y1 && d > y0);
      });
      if (onLink) throw new PlanError('This line has a link in it, which would no longer sit on the right words.', { reason: 'link' });
      const used = usedItems.get(plan.page) ?? new Set<number>();
      if (plan.items.some(i => used.has(i))) throw new PlanError('This line overlaps another change.');

      const info = fontsFor(plan.page)(plan.font);
      let writer: Writer | null = info ? reuseWriter(plan.font, info, plan.tc, plan.th) : null;
      if (!writer || writer.width(plan.text, 10) === null) {
        const std = standardFor(info?.base ?? '');
        let entry = stdFonts.get(`${plan.page}:${std}`);
        if (!entry) {
          const font = await doc.embedFont(std);
          const res = pdfPages[plan.page].node.newFontDictionary('PrcF', font.ref).decodeText();
          entry = { font, res };
          stdFonts.set(`${plan.page}:${std}`, entry);
        }
        writer = standardWriter(entry.res, entry.font, plan.th);
      }

      const starts = plan.lines.map((l, i) => (i === 0 ? plan.startX : l.x0));
      let laid: string[] | null = null, size = plan.lines[0].size;
      for (const scale of [1, 0.97, 0.94]) {
        size = plan.lines[0].size * scale;
        laid = wrap(plan.text, writer, size, starts, plan.limits);
        if (laid) break;
      }
      if (!laid) {
        const need = writer.width(plan.text, plan.lines[0].size);
        const have = plan.limits.reduce((sum, lim, i) => sum + Math.max(0, lim - starts[i]), 0);
        throw new PlanError('The new wording is longer than the space this line has in your resume.', { reason: 'too-long', room: need ? Math.min(1, have / need) : undefined });
      }

      const [r, g, b] = plan.fill.map(v => Math.min(1, Math.max(0, isNaN(v) ? 0 : v)));
      // Text state the page may have left set, which would change how the
      // new text draws.
      let draw = `${fmt(r)} ${fmt(g)} ${fmt(b)} rg 0 Tw 0 Ts 0 Tr\n`;
      const after: Box[] = [];
      laid.forEach((text, i) => {
        const width = writer!.width(text, size) ?? 0;
        const spaces = text.split(' ').length - 1;
        // Justified like the original: every line but the last fills the width.
        const extra = plan.justified && i < laid!.length - 1 && spaces ? Math.max(0, plan.limits[i] - starts[i] - width) / spaces : 0;
        draw += writer!.draw(text, starts[i], plan.lines[i].y, size, extra);
        after.push({ page: plan.page, x: starts[i], y: plan.lines[i].y - size * 0.28, w: width + extra * spaces, h: size * 1.16 });
      });
      const e = edits.get(plan.page) ?? { cuts: new Map<ShowOp, Set<number>>(), inserts: [] };
      for (const [op, idx] of plan.cuts) e.cuts.set(op, new Set([...(e.cuts.get(op) ?? []), ...idx]));
      // Drawn right after the text object the old words were in, so the page
      // still reads in order for a parser that reads the stream in order. The
      // inverse of the CTM there puts the drawing back in page coordinates.
      const anchor = [...plan.cuts.keys()].sort((a, b) => a.s - b.s)[0];
      const inv = anchor.etEnd !== undefined && anchor.etCtm ? invert(anchor.etCtm) : null;
      e.inserts.push(inv
        ? { at: anchor.etEnd!, draw: `\nq ${inv.map(fmt).join(' ')} cm\n${draw}Q\n` }
        : { at: Infinity, draw: `\nq\n${draw}Q\n` });
      edits.set(plan.page, e);
      plan.items.forEach(i => used.add(i));
      usedItems.set(plan.page, used);
      facts.set(c.id, { page: plan.page, text: plan.text, removedChars: plan.removedChars });
      placements.push({
        id: c.id, ok: true,
        before: plan.lines.map((l, i) => ({ page: plan.page, x: i === 0 ? plan.startX : l.x0, y: l.y - l.size * 0.28, w: l.x1 - (i === 0 ? plan.startX : l.x0), h: l.size * 1.16 })),
        after,
      });
    } catch (e) {
      if (!(e instanceof PlanError)) throw e;
      placements.push({ id: c.id, ok: false, why: e.message, reason: e.reason, room: e.room, keep: e.keep, before: [], after: [] });
    }
  }

  for (const [pi, e] of edits) {
    const src = contents[pi];
    // Cut glyphs out of their operators and add the new text after its text
    // object, both in one pass over the stream.
    type Step = { at: number; end: number; out: string };
    const steps: Step[] = [
      ...[...e.cuts].map(([op, idx]) => ({ at: op.s, end: op.e, out: ` ${op.pre} ${rewriteShow(op, idx)} ` })),
      ...e.inserts.map(ins => ({ at: Math.min(ins.at, src.length), end: Math.min(ins.at, src.length), out: ins.draw })),
    ].sort((a, b) => a.at - b.at || (a.end - a.at) - (b.end - b.at));
    const chunks: Buffer[] = [Buffer.from('q\n')];
    let at = 0;
    for (const st of steps) {
      chunks.push(Buffer.from(src.subarray(at, st.at)), Buffer.from(st.out, 'latin1'));
      at = st.end;
    }
    chunks.push(Buffer.from(src.subarray(at)), Buffer.from('\nQ\n'));
    const stream = doc.context.flateStream(Buffer.concat(chunks));
    pdfPages[pi].node.set(PDFName.of('Contents'), doc.context.register(stream));
  }

  return { bytes: await doc.save({ useObjectStreams: false }), placements, facts };
}

/** The page's link areas, as [x0, y0, x1, y1]. */
function linkRects(doc: PDFDocument, page: PDFPage): [number, number, number, number][] {
  const annots = lookup(doc, page.node.get(PDFName.of('Annots')));
  if (!(annots instanceof PDFArray)) return [];
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < annots.size(); i++) {
    const a = lookup(doc, annots.get(i));
    if (!(a instanceof PDFDict) || (lookup(doc, a.get(PDFName.of('Subtype'))) as PDFName | undefined)?.decodeText?.() !== 'Link') continue;
    const r = lookup(doc, a.get(PDFName.of('Rect')));
    if (!(r instanceof PDFArray) || r.size() < 4) continue;
    const [x0, y0, x1, y1] = [0, 1, 2, 3].map(k => num(doc, r.get(k)) ?? 0);
    out.push([Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)]);
  }
  return out;
}

/**
 * The operator again as a TJ array without the cut glyphs. Each cut glyph
 * becomes a blank move of its own width, so everything after it stays put.
 */
function rewriteShow(op: ShowOp, cut: Set<number>): string {
  const out: string[] = [];
  let run = '', gap = 0;
  const flushRun = () => { if (run) { out.push(`<${run}>`); run = ''; } };
  const flushGap = () => { if (gap) { out.push(fmt(gap)); gap = 0; } };
  op.parts.forEach((part, i) => {
    if (!('code' in part)) { flushRun(); flushGap(); out.push(fmt(part.n)); return; }
    if (cut.has(i)) {
      flushRun();
      gap += op.fs && op.th ? -part.adv * 1000 / (op.fs * op.th) : 0;
      return;
    }
    flushGap();
    run += part.code.map(b => b.toString(16).padStart(2, '0')).join('');
  });
  flushRun(); flushGap();
  return `[${out.join(' ')}] TJ`;
}

/**
 * True when the edited file reads back as planned: each rewrite is on its
 * page, and every page has exactly the text it had, less what was replaced,
 * plus what was written. Text lost or left behind changes that count.
 */
function verified(before: PageText[], after: PageText[], placed: Fact[]): boolean {
  if (before.length !== after.length) return false;
  const delta = new Map<number, number>();
  for (const pl of placed) {
    delta.set(pl.page, (delta.get(pl.page) ?? 0) - pl.removedChars + normText(pl.text).length);
    if (!after[pl.page].join.includes(normText(pl.text))) return false;
  }
  return before.every((pg, i) => after[i].join.length === pg.join.length + (delta.get(i) ?? 0));
}

/**
 * Applies the changes to the PDF. Returns the edited file and, for each
 * change, whether it was placed and where. Only changes that read back
 * correctly are in the file.
 */
export async function editResumePdf(bytes: Uint8Array, changes: PdfChange[]): Promise<Built> {
  const pages = await readPages(bytes);
  if (!pages.some(p => p.join.length > 20)) {
    return { bytes, placements: changes.map(c => ({ id: c.id, ok: false, why: 'Your PDF has no readable text to edit.', before: [], after: [] })) };
  }

  const check = async (set: PdfChange[]) => {
    const built = await build(bytes, set, pages);
    if (!built.facts.size) return { built, good: true };
    const after = await readPages(built.bytes);
    return { built, good: verified(pages, after, [...built.facts.values()]) };
  };

  const all = await check(changes);
  if (all.good) return all.built;

  // Something did not read back as planned: find which changes are safe on
  // their own, then apply just those.
  const safe: PdfChange[] = [];
  const failed = new Map<string, Placement>();
  for (const c of changes) {
    const one = await check([c]);
    const pl = one.built.placements[0];
    if (pl.ok && one.good) safe.push(c);
    else failed.set(c.id, pl.ok ? { id: c.id, ok: false, why: 'Editing this line in your PDF would have changed other text, so it was left as is.', before: [], after: [] } : pl);
  }
  const final = safe.length ? await check(safe) : null;
  const built = final?.good ? final.built : { bytes, placements: [] as Placement[] };
  const byId = new Map(built.placements.map(p => [p.id, p]));
  return {
    bytes: built.bytes,
    placements: changes.map(c => byId.get(c.id) ?? failed.get(c.id) ?? { id: c.id, ok: false, why: 'Could not be placed.', before: [], after: [] }),
  };
}

/** The file with each box marked: red with a strike for old text, green for new. */
export async function markPdf(bytes: Uint8Array, boxes: Box[], tone: 'removed' | 'added'): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const pages = doc.getPages();
  const color = tone === 'removed' ? rgb(0.94, 0.27, 0.27) : rgb(0.13, 0.73, 0.4);
  for (const b of boxes) {
    const page: PDFPage | undefined = pages[b.page];
    if (!page || b.w <= 0) continue;
    page.drawRectangle({ x: b.x - 1, y: b.y, width: b.w + 2, height: b.h, color, opacity: 0.22 });
    if (tone === 'removed') page.drawLine({ start: { x: b.x - 1, y: b.y + b.h * 0.47 }, end: { x: b.x + b.w + 1, y: b.y + b.h * 0.47 }, thickness: 0.8, color, opacity: 0.9 });
  }
  return doc.save({ useObjectStreams: false });
}

