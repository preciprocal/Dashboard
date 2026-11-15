// lib/applications/truthful-tailor.ts
//
// Checks that hold a tailored resume to the facts in the original. A tailor
// may reword, reorder and use the job's keywords, but only for things the
// resume already says. The model is told this; these checks enforce it, so a
// change that slips through the prompt never reaches the user:
//
//   - the text it replaces must exist in the resume (so it can be applied and
//     shown side by side),
//   - it may not introduce a number the original line does not have,
//   - every job keyword and every name-like term it uses (tools, products,
//     acronyms) must already appear somewhere in the resume.
//
// Keyword coverage is counted here too, so before and after scores are a
// count of the job's keywords found in the text, not a model's guess.

export interface ProposedChange {
  section: string;
  original: string;
  rewrite: string;
  reason: string;
}

export interface CheckedChange extends ProposedChange {
  id: string;
  /** Job keywords the rewrite adds that the original line did not have. */
  keywordsAdded: string[];
}

export interface RejectedChange extends ProposedChange {
  why: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•●▪‣⁃]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when `term` appears in `text` as a whole term (not inside a longer
 * word), singular or plural: "dashboard" matches "dashboards".
 */
export function hasTerm(text: string, term: string): boolean {
  const t = norm(term);
  if (!t) return false;
  const stem = /[a-z]{3}s$/.test(t) && !/ss$/.test(t) ? t.slice(0, -1) : t;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(stem)}(s|es)?($|[^a-z0-9])`).test(norm(text));
}

/** Numbers as written ("1,000+" and "1000" are the same number). */
function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map(n => n.replace(/,/g, '').replace(/\.0+$/, ''));
}

/**
 * Tools, products and acronyms: any capitalised word that does not start a
 * sentence (Kubernetes, PostgreSQL), acronyms (AWS, S3) and names with + # or
 * a dot inside (C++, C#, Node.js). Plain capitalised English words are caught
 * too; rejecting a change for that is the safe direction.
 */
function nameLikeTerms(s: string): string[] {
  // Hyphens split too: "LLM-based" is the term "LLM".
  const tokens = s.split(/[\s,;:()/-]+/);
  const out: string[] = [];
  tokens.forEach((raw, i) => {
    // Possessives count as the name ("Stripe's" is "Stripe"); "I'm", "I've" are not names.
    const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9+#]+$/g, '').replace(/['’]s$/, '');
    if (w.length < 2 || !/[A-Za-z]/.test(w) || /^I['’][a-z]+$/.test(w)) return;
    const startsSentence = i === 0 || /[.!?]$/.test(tokens[i - 1] ?? '');
    if (/[A-Za-z][+#]|[a-z]\.[a-z]/i.test(w)) out.push(w);               // C++, C#, Node.js
    else if (/^[A-Z0-9]{2,}$/.test(w) && /[A-Z]/.test(w)) out.push(w);    // AWS, SQL, S3
    else if (!startsSentence && /^[A-Z]/.test(w)) out.push(w);           // Kubernetes, PostgreSQL
  });
  return out;
}

/** A regex that finds `original` in the resume however its whitespace was extracted. */
function looseRe(original: string): RegExp {
  const parts = original.trim().split(/\s+/).map(escapeRe);
  return new RegExp(parts.join('[\\s\\u2022\\u25cf\\u25aa]+'));
}

/** True when `fragment` appears in `text`, allowing for extracted whitespace and bullets. */
export function containsLoose(text: string, fragment: string): boolean {
  return !!fragment.trim() && looseRe(fragment).test(text);
}

/**
 * Why `text` is not grounded, or null when it is: every number it uses must
 * appear in `sources`, and every tool-like term in `termSources` (the same
 * text unless given, e.g. the resume plus the job description for a pitch,
 * which may name the company and its products).
 */
export function groundingIssue(text: string, sources: string, termSources: string = sources): string | null {
  const known = new Set(numbersIn(sources));
  const number = numbersIn(text).find(n => !known.has(n));
  if (number) return `uses the number ${number}, which your resume does not contain`;
  const term = nameLikeTerms(text).find(t => !hasTerm(termSources, t));
  if (term) return `mentions "${term}", which your resume does not`;
  return null;
}

/**
 * Removes first-person sentences ("I use", "my", "I've") that claim a skill
 * the resume does not show: one of the job's skills the resume lacks, or a
 * name found in neither the resume nor `context` (the posting and company).
 * Text like a pitch may describe the job's stack and name the company, but
 * not claim the stack as the candidate's own.
 */
export function dropUnbackedClaims(
  text: string,
  resumeText: string,
  jobSkills: string[],
  context: string,
): { text: string; removed: string[] } {
  // Tool-like skills only (Snowflake, A/B, C++): "I want to work in payments"
  // is a wish, not a claim, even when "payments" is one of the job's keywords.
  const absentSkills = jobSkills.filter(k => nameLikeTerms(` x ${k}`).length > 0 && !hasTerm(resumeText, k));
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) ?? [text];
  const removed: string[] = [];
  const kept = sentences.filter(s => {
    if (!/\b(I|I'm|I've|I'd|my|me|mine)\b/i.test(s)) return true;
    const claims =
      absentSkills.some(k => hasTerm(s, k)) ||
      nameLikeTerms(s).some(t => t !== 'I' && !hasTerm(resumeText, t) && !hasTerm(context, t));
    if (claims) removed.push(s.trim());
    return !claims;
  });
  return { text: kept.join('').trim(), removed };
}

export function check(
  proposed: ProposedChange[],
  resumeText: string,
  jobKeywords: string[],
): { accepted: CheckedChange[]; rejected: RejectedChange[] } {
  const accepted: CheckedChange[] = [];
  const rejected: RejectedChange[] = [];
  const seen = new Set<string>();
  const resumeNumbers = new Set(numbersIn(resumeText));

  for (const c of proposed) {
    const original = (c.original ?? '').trim();
    const rewrite = (c.rewrite ?? '').trim();
    const reject = (why: string) => rejected.push({ ...c, why });

    if (!original || !rewrite || norm(original) === norm(rewrite)) { reject('no change'); continue; }
    if (seen.has(norm(original))) { reject('duplicate'); continue; }
    if (!looseRe(original).test(resumeText)) { reject('original text not found in resume'); continue; }

    const origNumbers = new Set(numbersIn(original));
    const added = numbersIn(rewrite).filter(n => !origNumbers.has(n));
    if (added.length) { reject(`adds a number not in the original line: ${added.join(', ')}`); continue; }
    if (numbersIn(rewrite).some(n => !resumeNumbers.has(n))) { reject('adds a number not in the resume'); continue; }

    const unsupportedKeyword = jobKeywords.find(k => hasTerm(rewrite, k) && !hasTerm(resumeText, k));
    if (unsupportedKeyword) { reject(`claims "${unsupportedKeyword}", which the resume does not mention`); continue; }

    const unsupportedTerm = nameLikeTerms(rewrite).find(t => !hasTerm(resumeText, t));
    if (unsupportedTerm) { reject(`introduces "${unsupportedTerm}", which the resume does not mention`); continue; }

    seen.add(norm(original));
    accepted.push({
      ...c,
      original,
      rewrite,
      id: `chg-${accepted.length + 1}`,
      keywordsAdded: jobKeywords.filter(k => hasTerm(rewrite, k) && !hasTerm(original, k)),
    });
  }
  return { accepted, rejected };
}

/** The resume with the approved changes applied, in order. */
export function applyChanges(resumeText: string, changes: Pick<CheckedChange, 'original' | 'rewrite'>[]): string {
  let out = resumeText;
  for (const c of changes) out = out.replace(looseRe(c.original), () => c.rewrite);
  return out;
}

export interface Coverage {
  matched: string[];
  missing: string[];
  /** Share of the job's keywords found, 0-100. */
  percent: number;
}

export function coverage(text: string, jobKeywords: string[]): Coverage {
  const matched = jobKeywords.filter(k => hasTerm(text, k));
  const missing = jobKeywords.filter(k => !hasTerm(text, k));
  return { matched, missing, percent: jobKeywords.length ? Math.round((matched.length / jobKeywords.length) * 100) : 0 };
}

/** Distinct, trimmed keywords, at most `max`. */
export function cleanKeywords(raw: unknown, max = 25): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of raw) {
    if (typeof k !== 'string') continue;
    const t = k.trim().replace(/\s+/g, ' ');
    if (t.length < 2 || t.length > 40 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
