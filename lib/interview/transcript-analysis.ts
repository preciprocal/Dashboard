// lib/interview/transcript-analysis.ts
// Pure helpers for the annotated transcript on the interview results page.
//
// Filler words and hedges are found here, deterministically, rather than by
// the model: the highlight has to land on exactly the word that was said, the
// count has to be the same every time the page loads, and neither should cost
// a model call. The model only judges what needs judgement (vague, wrong,
// rambling, off the question) - see lib/interview/transcript-review.ts.
//
// No imports, no I/O: the same functions run on the server (to build the
// prompt and validate the reply) and in the browser (to draw the highlights).

// ─── Turns ───────────────────────────────────────────────────────────────────

export interface TranscriptMessage { role: string; content: string }

export type Speaker = "interviewer" | "candidate";

export interface Turn {
  /** Position in the merged turn list; the model refers to answers by this. */
  index: number;
  speaker: Speaker;
  text: string;
}

/**
 * Turn the raw call transcript into speaker turns.
 *
 * Vapi emits a "final" transcript per utterance segment, so one spoken answer
 * usually arrives as several consecutive user messages. Merging them gives one
 * answer per turn, which is the unit everything else (highlights, the model's
 * critique, the better answer) is built on. System messages are instructions
 * to the interviewer, not something either person said, so they are dropped.
 */
export function buildTurns(messages: unknown): Turn[] {
  if (!Array.isArray(messages)) return [];
  const turns: Turn[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const { role, content } = m as Partial<TranscriptMessage>;
    if (typeof content !== "string") continue;
    const speaker: Speaker | null = role === "assistant" ? "interviewer" : role === "user" ? "candidate" : null;
    if (!speaker) continue;
    const text = content.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.speaker === speaker) {
      last.text = `${last.text} ${text}`;
    } else {
      turns.push({ index: turns.length, speaker, text });
    }
  }
  return turns;
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}

// ─── Fillers and hedges ──────────────────────────────────────────────────────

export type MarkerKind = "filler" | "hedge";

export interface Marker {
  start: number;
  end: number;
  kind: MarkerKind;
  /** Canonical lower-case form ("um", "you know", "i'm not sure"), for counts. */
  label: string;
}

const APOS = "['’]";

/**
 * Hedge phrases. Always a hedge wherever they appear, so plain regexes.
 * Plain "I think" is deliberately absent: it is how most people open an
 * opinion question, and flagging it would teach people to ignore the check.
 */
const HEDGES: Array<{ re: RegExp; label: string }> = [
  { re: /\bi\s+think\s+maybe\b/giu, label: "i think maybe" },
  { re: new RegExp(`\\bi(?:${APOS}m|\\s+am)\\s+not\\s+(?:really\\s+|totally\\s+|entirely\\s+|completely\\s+|100%\\s+)?sure\\b`, "giu"), label: "i'm not sure" },
  { re: /\bnot\s+100%\s+sure\b/giu, label: "i'm not sure" },
  { re: new RegExp(`\\bi\\s+don${APOS}?t\\s+(?:really\\s+)?know\\b`, "giu"), label: "i don't know" },
  { re: /\bi\s+guess\b/giu, label: "i guess" },
  { re: /\bi\s+suppose\b/giu, label: "i suppose" },
  { re: /\bi\s+could\s+be\s+wrong\b/giu, label: "i could be wrong" },
  { re: new RegExp(`\\bi(?:${APOS}m|\\s+am)\\s+not\\s+(?:an?\\s+)?expert\\b`, "giu"), label: "i'm not an expert" },
  { re: /\bif\s+that\s+makes\s+sense\b/giu, label: "if that makes sense" },
  { re: /\bor\s+something(?:\s+like\s+that)?\b/giu, label: "or something" },
  { re: /\bor\s+whatever\b/giu, label: "or whatever" },
  { re: /\bhopefully\b/giu, label: "hopefully" },
  { re: /\bmaybe\b/giu, label: "maybe" },
];

/** Sounds that are never words. */
const VOCAL_FILLERS: Array<{ re: RegExp; label: string }> = [
  { re: /\bu+m+\b/giu, label: "um" },
  { re: /\bu+h+m*\b/giu, label: "uh" },
  { re: /\ba+h+\b/giu, label: "ah" },
  { re: /\be+r+m*\b/giu, label: "er" },
  { re: /\bh+m+\b/giu, label: "hmm" },
  { re: /\bbasically\b/giu, label: "basically" },
];

// Words that make "kind of" / "sort of" literal: "what kind of database",
// "a sort of queue", "kind of a", "sort of thing".
const KIND_OF_LITERAL_BEFORE = new Set([
  "what", "which", "this", "that", "the", "a", "an", "any", "some", "every", "same", "different",
  "one", "those", "these", "all", "no", "my", "your", "our", "their", "its", "his", "her", "what's", "what’s", "new", "right", "wrong",
]);
const KIND_OF_LITERAL_AFTER = new Set(["thing", "things", "person", "people", "problem", "problems", "role", "work"]);

// "you know how/what/that..." is a real question or clause, not a filler.
const YOU_KNOW_LITERAL_AFTER = new Set([
  "what", "how", "that", "if", "why", "when", "where", "who", "whether", "about", "the", "it", "him", "her", "them", "me", "this",
]);

// After a sentence break or a vocal filler, "like" followed by one of these
// is a filler: "Like, I...", "um like we...". "I like the" is not matched
// because "I" is not in the lead-in set.
const LIKE_FOLLOWERS = new Set(["i", "we", "you", "um", "uh", "so", "the", "it", "this", "that", "they", "he", "she"]);
const LIKE_LEADS = new Set(["um", "uh", "so", "ah"]);

// "So that's", "so far" etc. are fine at a sentence start; "So, I..." and
// "So I built..." as an answer opener are the habit being counted.
const SO_LITERAL_AFTER = new Set(["much", "many", "far", "long", "yes", "no", "good", "big", "hard", "easy"]);

function wordBefore(text: string, idx: number): { word: string; punct: boolean } {
  let i = idx - 1;
  while (i >= 0 && text[i] === " ") i--;
  if (i < 0) return { word: "", punct: true };
  if (/[.,!?;:…]/.test(text[i])) return { word: "", punct: true };
  let j = i;
  while (j >= 0 && /[\p{L}\p{N}'’]/u.test(text[j])) j--;
  return { word: text.slice(j + 1, i + 1).toLowerCase(), punct: false };
}

function wordAfter(text: string, idx: number): { word: string; punct: string } {
  let i = idx;
  while (i < text.length && text[i] === " ") i++;
  if (i >= text.length) return { word: "", punct: "end" };
  if (/[.,!?;:…]/.test(text[i])) return { word: "", punct: text[i] };
  let j = i;
  while (j < text.length && /[\p{L}\p{N}'’]/u.test(text[j])) j++;
  return { word: text.slice(i, j).toLowerCase(), punct: "" };
}

/** True at the start of the text or right after a sentence end. */
function atSentenceStart(text: string, idx: number): boolean {
  let i = idx - 1;
  while (i >= 0 && text[i] === " ") i--;
  return i < 0 || /[.!?…]/.test(text[i]);
}

function contextualFillers(text: string): Marker[] {
  const out: Marker[] = [];
  let m: RegExpExecArray | null;

  const kindOf = /\b(kind|sort)\s+of\b/giu;
  while ((m = kindOf.exec(text))) {
    const before = wordBefore(text, m.index);
    const after = wordAfter(text, m.index + m[0].length);
    if (KIND_OF_LITERAL_BEFORE.has(before.word) || KIND_OF_LITERAL_AFTER.has(after.word)) continue;
    if (after.word === "a" || after.word === "an" || after.word === "the") continue;
    out.push({ start: m.index, end: m.index + m[0].length, kind: "filler", label: `${m[1].toLowerCase()} of` });
  }

  const youKnow = /\byou\s+know\b/giu;
  while ((m = youKnow.exec(text))) {
    const before = wordBefore(text, m.index);
    const after = wordAfter(text, m.index + m[0].length);
    // "Do you know", "if you know", "you know how": a real question or clause.
    if (["do", "did", "if", "don't", "don’t", "you'd", "you’d", "would", "will", "as"].includes(before.word)) continue;
    const pausedAfter = after.punct !== "";
    const pausedBefore = before.punct && !YOU_KNOW_LITERAL_AFTER.has(after.word);
    if (pausedAfter || pausedBefore) {
      out.push({ start: m.index, end: m.index + m[0].length, kind: "filler", label: "you know" });
    }
  }

  const iMean = /\bi\s+mean\b(?=\s*,)/giu;
  while ((m = iMean.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, kind: "filler", label: "i mean" });
  }

  const like = /\blike\b/giu;
  while ((m = like.exec(text))) {
    const before = wordBefore(text, m.index);
    const after = wordAfter(text, m.index + m[0].length);
    const filler =
      after.punct === "," ||
      ((before.punct || LIKE_LEADS.has(before.word)) && LIKE_FOLLOWERS.has(after.word));
    if (filler) out.push({ start: m.index, end: m.index + m[0].length, kind: "filler", label: "like" });
  }

  const so = /\bso\b/giu;
  while ((m = so.exec(text))) {
    const before = wordBefore(text, m.index);
    const after = wordAfter(text, m.index + m[0].length);
    if (SO_LITERAL_AFTER.has(after.word)) continue;
    // "so that" is purpose ("so that we could ship"); "so that's" is an opener.
    if (after.word === "that") continue;
    const opener = atSentenceStart(text, m.index) && after.punct !== "." && after.punct !== "?" && after.punct !== "end";
    const aside = before.punct && text.slice(0, m.index).trimEnd().endsWith(",") && after.punct === ",";
    if (opener || aside) out.push({ start: m.index, end: m.index + m[0].length, kind: "filler", label: "so" });
  }

  return out;
}

function regexMarkers(text: string, list: Array<{ re: RegExp; label: string }>, kind: MarkerKind): Marker[] {
  const out: Marker[] = [];
  for (const { re, label } of list) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      out.push({ start: m.index, end: m.index + m[0].length, kind, label });
    }
  }
  return out;
}

/**
 * Keep the earliest, then longest, of any overlapping spans. "I think maybe"
 * beats the "maybe" inside it, so a phrase is counted once, as the phrase.
 */
export function dropOverlaps<T extends { start: number; end: number }>(spans: T[]): T[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out: T[] = [];
  let lastEnd = -1;
  for (const s of sorted) {
    if (s.start >= lastEnd) {
      out.push(s);
      lastEnd = s.end;
    }
  }
  return out;
}

/** Every filler and hedge in one answer, in order, never overlapping. */
export function findMarkers(text: string): Marker[] {
  return dropOverlaps([
    ...regexMarkers(text, HEDGES, "hedge"),
    ...regexMarkers(text, VOCAL_FILLERS, "filler"),
    ...contextualFillers(text),
  ]);
}

// ─── Whole-transcript stats ──────────────────────────────────────────────────

export interface TranscriptStats {
  candidateTurns: number;
  candidateWords: number;
  fillerCount: number;
  hedgeCount: number;
  /** Fillers per 100 words the candidate spoke, one decimal place. */
  fillersPer100Words: number;
  topFillers: Array<{ label: string; count: number }>;
  topHedges: Array<{ label: string; count: number }>;
  /** Plain-English band for the filler rate. */
  fillerLevel: "low" | "moderate" | "high";
}

function tally(markers: Marker[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const m of markers) counts.set(m.label, (counts.get(m.label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function transcriptStats(turns: Turn[]): TranscriptStats {
  const answers = turns.filter((t) => t.speaker === "candidate");
  const markers = answers.flatMap((t) => findMarkers(t.text));
  const fillers = markers.filter((m) => m.kind === "filler");
  const hedges = markers.filter((m) => m.kind === "hedge");
  const words = answers.reduce((n, t) => n + countWords(t.text), 0);
  const rate = words > 0 ? Math.round((fillers.length / words) * 1000) / 10 : 0;
  return {
    candidateTurns: answers.length,
    candidateWords: words,
    fillerCount: fillers.length,
    hedgeCount: hedges.length,
    fillersPer100Words: rate,
    topFillers: tally(fillers).slice(0, 5),
    topHedges: tally(hedges).slice(0, 5),
    // Around 1-2 per 100 words goes unnoticed in conversation; past ~5 the
    // listener starts hearing the fillers instead of the answer.
    fillerLevel: rate < 2 ? "low" : rate < 5 ? "moderate" : "high",
  };
}

/** Too little said by the candidate for a critique to be worth anything. */
export const MIN_CANDIDATE_WORDS = 25;

export function isTooShort(turns: Turn[]): boolean {
  const answers = turns.filter((t) => t.speaker === "candidate");
  return answers.length === 0 || answers.reduce((n, t) => n + countWords(t.text), 0) < MIN_CANDIDATE_WORDS;
}

// ─── Model review: shape, validation, quote matching ─────────────────────────

export type IssueType = "vague" | "no_structure" | "rambling" | "off_topic" | "not_answered" | "wrong";

export const ISSUE_TYPES: IssueType[] = ["vague", "no_structure", "rambling", "off_topic", "not_answered", "wrong"];

export interface ReviewIssue {
  quote: string;
  type: IssueType;
  why: string;
}

export interface AnswerReview {
  turnIndex: number;
  verdict: "strong" | "ok" | "weak";
  issues: ReviewIssue[];
  /** Null when the answer was already good enough not to need one. */
  betterAnswer: string | null;
  why: string;
  practiseTip: string;
}

export interface TranscriptReview {
  version: 1;
  transcriptHash: string;
  generatedAt: string;
  patterns: string[];
  answers: AnswerReview[];
}

// Smart quotes are the same width as their ASCII forms, so normalising them
// keeps every index valid in the original string.
function normaliseForMatch(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
}

/**
 * Where `quote` sits in `text`, or null. Exact first, then ignoring case and
 * curly-vs-straight quotes, since that is the only liberty the model tends to
 * take with a verbatim quote. Anything looser would let a paraphrase through
 * and highlight words the candidate never said.
 */
export function locateQuote(text: string, quote: string): { start: number; end: number } | null {
  const q = quote.trim().replace(/^["'“‘]+|["'”’]+$/g, "").trim();
  if (q.length < 2) return null;
  let at = text.indexOf(q);
  if (at === -1) at = normaliseForMatch(text).indexOf(normaliseForMatch(q));
  return at === -1 ? null : { start: at, end: at + q.length };
}

/** Em and en dashes out of generated copy (the product never uses them). */
export function stripDashes(s: string): string {
  return s.replace(/\s*[—–]\s*/g, " - ");
}

function cleanString(v: unknown, max: number): string {
  return typeof v === "string" ? stripDashes(v.trim()).slice(0, max) : "";
}

/**
 * Turn whatever the model returned into a review we can trust.
 *
 * Every issue's quote is checked against the answer it claims to come from,
 * and dropped when it is not really there: a highlight on words the
 * candidate did not say is worse than no highlight. Issues whose quotes
 * overlap keep the first. Answers pointing at a turn that is not a candidate
 * turn are dropped. Missing or malformed fields degrade to empty, never throw.
 */
export function validateReview(raw: unknown, turns: Turn[]): { patterns: string[]; answers: AnswerReview[] } {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const patterns = (Array.isArray(obj.patterns) ? obj.patterns : [])
    .map((p) => cleanString(p, 300))
    .filter(Boolean)
    .slice(0, 3);

  const byIndex = new Map(turns.map((t) => [t.index, t]));
  const seen = new Set<number>();
  const answers: AnswerReview[] = [];

  for (const a of Array.isArray(obj.answers) ? obj.answers : []) {
    if (!a || typeof a !== "object") continue;
    const r = a as Record<string, unknown>;
    const turnIndex = typeof r.turn === "number" ? r.turn : typeof r.turnIndex === "number" ? r.turnIndex : NaN;
    const turn = byIndex.get(turnIndex);
    if (!turn || turn.speaker !== "candidate" || seen.has(turnIndex)) continue;
    if (r.verdict === "skip") continue;
    seen.add(turnIndex);

    const located: Array<ReviewIssue & { start: number; end: number }> = [];
    for (const i of Array.isArray(r.issues) ? r.issues : []) {
      if (!i || typeof i !== "object") continue;
      const issue = i as Record<string, unknown>;
      const type = issue.type as IssueType;
      if (!ISSUE_TYPES.includes(type) || typeof issue.quote !== "string") continue;
      const at = locateQuote(turn.text, issue.quote);
      if (!at) continue;
      located.push({ quote: turn.text.slice(at.start, at.end), type, why: cleanString(issue.why, 400), ...at });
    }
    const issues = dropOverlaps(located).map(({ quote, type, why }) => ({ quote, type, why }));

    const verdict = r.verdict === "strong" || r.verdict === "ok" || r.verdict === "weak" ? r.verdict : issues.length ? "weak" : "ok";
    const betterAnswer = cleanString(r.betterAnswer, 2500) || null;
    answers.push({
      turnIndex,
      verdict,
      issues,
      betterAnswer: verdict === "strong" ? null : betterAnswer,
      why: cleanString(r.why, 500),
      practiseTip: cleanString(r.practiseTip, 300),
    });
  }

  answers.sort((x, y) => x.turnIndex - y.turnIndex);
  return { patterns, answers };
}

/**
 * Stable fingerprint of the turns a review was written for (FNV-1a, 32 bit).
 * A retake overwrites the feedback row, so a cached review is only reused
 * when it was made from this exact transcript.
 */
export function transcriptHash(turns: Turn[]): string {
  const s = turns.map((t) => `${t.speaker[0]}:${t.text}`).join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ─── Rendering helper ────────────────────────────────────────────────────────

export interface Segment {
  text: string;
  marker?: MarkerKind;
  issue?: IssueType;
  /** Index into the answer's issues list, for linking a span to its note. */
  issueIndex?: number;
}

/**
 * Split an answer into runs that share the same highlighting, so a filler
 * inside a vague sentence shows both: the filler's tint and the sentence's
 * underline.
 */
export function segmentAnswer(text: string, markers: Marker[], issues: ReviewIssue[]): Segment[] {
  const issueSpans = dropOverlaps(
    issues
      .map((issue, issueIndex) => {
        const at = locateQuote(text, issue.quote);
        return at ? { ...at, type: issue.type, issueIndex } : null;
      })
      .filter((s): s is { start: number; end: number; type: IssueType; issueIndex: number } => s !== null),
  );

  const cuts = new Set<number>([0, text.length]);
  for (const s of [...markers, ...issueSpans]) {
    cuts.add(s.start);
    cuts.add(s.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a === b) continue;
    const marker = markers.find((m) => m.start <= a && m.end >= b);
    const issue = issueSpans.find((s) => s.start <= a && s.end >= b);
    const seg: Segment = { text: text.slice(a, b) };
    if (marker) seg.marker = marker.kind;
    if (issue) {
      seg.issue = issue.type;
      seg.issueIndex = issue.issueIndex;
    }
    const prev = segments[segments.length - 1];
    if (prev && prev.marker === seg.marker && prev.issueIndex === seg.issueIndex && prev.issue === seg.issue) {
      prev.text += seg.text;
    } else {
      segments.push(seg);
    }
  }
  return segments;
}
