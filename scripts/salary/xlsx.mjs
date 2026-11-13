/**
 * scripts/salary/xlsx.mjs
 *
 * Just enough zip and xlsx reading for the BLS OEWS downloads, with no
 * dependencies. BLS ships each table as a .zip holding .xlsx workbooks (which
 * are zips of XML themselves). Pulling in a spreadsheet library for one yearly
 * job would add a large dependency to keep patched; the format we need is
 * small: stored or deflated entries, a shared string table, and one sheet of
 * plain cells.
 */

import { inflateRawSync } from "node:zlib";

// ─── Zip ─────────────────────────────────────────────────────────────────────

/** name -> () => Buffer, read lazily so a 30 MB workbook is inflated only when asked for. */
export function readZip(buf) {
  // The end-of-central-directory record sits in the last 64 KB (it may be
  // followed by a comment), so scan backwards for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file (no end of central directory)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt zip central directory");
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    entries.set(name, () => {
      // Sizes come from the central directory: the local header may defer
      // them to a data descriptor (bit 3), which Excel writers often do.
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const raw = buf.subarray(start, start + size);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`unsupported zip compression method ${method} for ${name}`);
    });
  }
  return entries;
}

// ─── Xlsx ────────────────────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const decodeXml = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });

function sharedStrings(files) {
  const get = files.get("xl/sharedStrings.xml");
  if (!get) return [];
  const xml = get().toString("utf8");
  const out = [];
  // A string item may be split into rich-text runs; join every <t> in it.
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = "";
    for (const t of si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += t[1];
    out.push(decodeXml(text));
  }
  return out;
}

/** Sheet names in workbook order, with the zip path of each sheet's XML. */
export function sheetList(files) {
  const wb = files.get("xl/workbook.xml")?.().toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.().toString("utf8");
  if (!wb || !rels) throw new Error("not an xlsx workbook");
  const targets = new Map();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1];
    const target = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  return [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: decodeXml(m[0].match(/\bname="([^"]*)"/)?.[1] ?? ""),
    path: targets.get(m[0].match(/\br:id="([^"]+)"/)?.[1]),
  }));
}

const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
};

/**
 * Calls onRow(cells: string[]) for every row of a sheet, as display text.
 * The sheet XML of the metro file is a few hundred MB once inflated, so it is
 * decoded in slices cut at row boundaries rather than as one string.
 */
export function eachRow(files, sheetPath, onRow) {
  const strings = sharedStrings(files);
  const get = files.get(sheetPath);
  if (!get) throw new Error(`sheet ${sheetPath} not found`);
  const xml = get();
  const END = Buffer.from("</row>");
  const SLICE = 8 * 1024 * 1024;
  let pos = 0;
  while (pos < xml.length) {
    let end = Math.min(xml.length, pos + SLICE);
    if (end < xml.length) {
      const cut = xml.lastIndexOf(END, end);
      end = cut > pos ? cut + END.length : xml.indexOf(END, end) + END.length;
      if (end < END.length) end = xml.length;
    }
    const text = xml.toString("utf8", pos, end);
    pos = end;
    for (const row of text.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      for (const c of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
        const type = attrs.match(/\bt="([^"]+)"/)?.[1];
        const body = c[2] ?? "";
        let value = "";
        if (type === "s") value = strings[Number(body.match(/<v>([^<]*)<\/v>/)?.[1])] ?? "";
        else if (type === "inlineStr") value = decodeXml([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
        else value = decodeXml(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? "");
        cells[ref ? colIndex(ref) : cells.length] = value;
      }
      for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
      onRow(cells);
    }
  }
}

/** All text in a sheet, for reading notes such as the top-code amount. */
export function sheetText(files, sheetPath) {
  const parts = [];
  eachRow(files, sheetPath, (cells) => parts.push(cells.join(" ")));
  return parts.join("\n");
}
