// lib/ai/writing-check.ts
// Does this letter sound like a person, and does it only claim true things?
//
// Recruiters reject applications that read like every other AI-written one,
// and reviewers of other tools report AI output that invents qualifications.
// This checks a generated letter for both, deterministically, so it costs
// nothing per letter and scripts/verify-writing-check.ts can pin every rule.
//
// Two checks:
//   1. AI tells: stock phrases and patterns that mark text as machine-written.
//   2. Grounding: numbers, tools and employers in the letter that appear in
//      none of the user's own material (resume, profile, transcript). Not
//      proof of invention, but exactly what someone should check before
//      sending, because a recruiter will ask about it.

export interface AiTell { phrase: string; suggestion: string }
export interface Unsupported { text: string; kind: 'number' | 'tool' }

export interface WritingCheck {
  aiTells: AiTell[];
  unsupported: Unsupported[];
  /** Times the company is named. Zero means the letter could go to anyone. */
  companyMentions: number;
  /** One line for the UI. */
  verdict: 'ready' | 'review' | 'rework';
}

// ─── AI tells ────────────────────────────────────────────────────────────────

/**
 * Phrases that recruiters now read as "a model wrote this". Matched as whole
 * phrases, case-insensitively. Each has a plain alternative, because a flag
 * with no fix just makes people anxious.
 */
const TELLS: { re: RegExp; phrase: string; suggestion: string }[] = [
  { re: /\bi am writing to (express|convey) my (strong |keen |sincere )?interest\b/i, phrase: 'I am writing to express my interest', suggestion: 'Open with why this role, in your own words.' },
  { re: /\bdelv(e|ing) into\b/i, phrase: 'delve into', suggestion: 'Say "work on" or "dig into".' },
  { re: /\btapestry\b/i, phrase: 'tapestry', suggestion: 'Cut it.' },
  { re: /\btestament to\b/i, phrase: 'testament to', suggestion: 'Say "shows".' },
  { re: /\bfast[- ]paced (environment|setting|world)\b/i, phrase: 'fast-paced environment', suggestion: 'Name what is actually fast about the job.' },
  { re: /\b(dynamic|vibrant) team\b/i, phrase: 'dynamic team', suggestion: 'Name the team or what it does.' },
  { re: /\bresults[- ]driven\b/i, phrase: 'results-driven', suggestion: 'Show a result instead.' },
  { re: /\bpassionate about leveraging\b/i, phrase: 'passionate about leveraging', suggestion: 'Say what you like doing and why.' },
  { re: /\bleverag(e|ing) my (skills|expertise|experience)\b/i, phrase: 'leverage my skills', suggestion: 'Say "use what I learned building X".' },
  { re: /\bseamless(ly)?\b/i, phrase: 'seamlessly', suggestion: 'Cut it or say what made it smooth.' },
  { re: /\bin today'?s (fast-paced |ever-changing |rapidly evolving |digital )?(world|landscape)\b/i, phrase: "in today's world", suggestion: 'Cut the scene-setting and start with your point.' },
  { re: /\bever[- ](evolving|changing) landscape\b/i, phrase: 'ever-evolving landscape', suggestion: 'Cut it.' },
  { re: /\bunwavering\b/i, phrase: 'unwavering', suggestion: 'Cut it.' },
  { re: /\bsynerg(y|ies|istic)\b/i, phrase: 'synergy', suggestion: 'Say what working together produced.' },
  { re: /\bgame[- ]changer\b/i, phrase: 'game-changer', suggestion: 'Say what changed.' },
  { re: /\bcutting[- ]edge\b/i, phrase: 'cutting-edge', suggestion: 'Name the technology.' },
  { re: /\bi am confident that my\b/i, phrase: 'I am confident that my', suggestion: 'Let the examples make the case.' },
  { re: /\bwould be a valuable (asset|addition)\b/i, phrase: 'would be a valuable asset', suggestion: 'Say what you would do in the first months.' },
  { re: /\bthank you for (your time and )?consideration\b[\s\S]*\blook forward\b/i, phrase: 'thank you for your consideration... I look forward', suggestion: 'One short, specific closing line is enough.' },
  { re: /\bembark(ing)? on\b/i, phrase: 'embark on', suggestion: 'Say "start".' },
  { re: /\bharness(ing)? the power\b/i, phrase: 'harness the power', suggestion: 'Say "use".' },
  { re: /\bnavigat(e|ing) the complexities\b/i, phrase: 'navigate the complexities', suggestion: 'Name the hard part.' },
  { re: /\bmeticulous(ly)?\b/i, phrase: 'meticulous', suggestion: 'Show the care with an example.' },
  { re: /\bspearhead(ed|ing)?\b/i, phrase: 'spearheaded', suggestion: 'Say "led" or "started".' },
  { re: /—|–/, phrase: 'em or en dash', suggestion: 'Use a comma, a full stop or a hyphen.' },
];

/** The flagged phrases, for prompts that should avoid them (lib/ai/email-writing.ts). */
export const AI_TELL_PHRASES: string[] = TELLS.map((t) => t.phrase).filter((p) => !p.includes('...') && p !== 'em or en dash');

export function findAiTells(text: string): AiTell[] {
  const out: AiTell[] = [];
  for (const t of TELLS) if (t.re.test(text)) out.push({ phrase: t.phrase, suggestion: t.suggestion });

  // Most sentences starting with "I" reads like a list, not a letter.
  const sentences = body(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 4);
  if (sentences.length >= 6) {
    const iStarts = sentences.filter(s => /^I\b/.test(s)).length;
    if (iStarts / sentences.length >= 0.5) {
      out.push({ phrase: `${iStarts} of ${sentences.length} sentences start with "I"`, suggestion: 'Start some with the company, the problem or the result.' });
    }
  }
  return out;
}

/** The letter without its address block and sign-off, which skew counts. */
function body(text: string): string {
  const start = text.search(/^dear\b/im);
  const end = text.search(/^(best regards|sincerely|kind regards|regards|thank you),?\s*$/im);
  return text.slice(start >= 0 ? start : 0, end > start ? end : undefined);
}

// ─── Grounding ───────────────────────────────────────────────────────────────

/**
 * Tools and technologies worth checking. A curated list rather than "any
 * capitalised word", which would flag every company, city and month. When a
 * letter names one the user's own material never mentions, that is the claim
 * a recruiter will ask about in the interview.
 */
const TOOLS = [
  // Never everyday words: "go", "rest", "excel" and "r" would flag ordinary
  // sentences ("I excel at", "the rest of the team").
  'python', 'java', 'javascript', 'typescript', 'golang', 'rust', 'c\\+\\+', 'c#', 'ruby', 'php', 'kotlin', 'swift', 'scala',
  'react', 'next\\.js', 'vue', 'angular', 'svelte', 'node\\.js', 'express', 'django', 'flask', 'fastapi', 'spring', 'rails', '\\.net',
  'aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins', 'github actions', 'circleci',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'kafka', 'rabbitmq', 'elasticsearch', 'snowflake', 'bigquery', 'redshift', 'dynamodb', 'cassandra',
  'spark', 'hadoop', 'airflow', 'dbt', 'tableau', 'power bi', 'looker',
  'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'keras', 'hugging face', 'langchain', 'llm', 'computer vision', 'nlp',
  'graphql', 'grpc', 'rest api', 'microservices', 'figma', 'sketch', 'jira', 'salesforce', 'sap', 'hubspot', 'sql', 'nosql', 'linux',
];
const TOOL_RE = new RegExp(`(?<![a-z0-9])(${TOOLS.join('|')})(?![a-z0-9])`, 'gi');

/**
 * Metric-looking claims: 40%, $2M, 3x, 10,000 users, 5 years. Plain small
 * numbers ("two projects") are not flagged; they rarely carry a claim.
 */
const NUMBER_RE = /(\$\s?\d[\d,.]*\s?(k|m|b|million|billion)?|\d[\d,.]*\s?(%|percent)|\d+(\.\d+)?x\b|\d{1,3}(,\d{3})+\+?|\d+\+?\s+(years?|users|customers|clients|engineers|people|requests|transactions|downloads|students|members))/gi;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');

/** The digits of a number claim, so "40 percent" matches "40%" in the resume. */
const digitsOf = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).join(' ');

export function findUnsupported(letter: string, sources: string[], exclude: string[] = []): Unsupported[] {
  const src = norm(sources.join('\n'));
  const srcDigits = new Set((src.match(/\d+(\.\d+)?/g) ?? []).map(d => d.replace(/,/g, '')));
  // Text the letter is allowed to repeat without it being a claim about the
  // candidate, such as the company name or a line in the date.
  const skip = exclude.map(norm).filter(Boolean);
  const text = body(letter);
  const out: Unsupported[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[0].trim();
    const digits = digitsOf(raw.replace(/,/g, ''));
    if (!digits || seen.has(raw.toLowerCase())) continue;
    seen.add(raw.toLowerCase());
    const found = digits.split(' ').every(d => srcDigits.has(d));
    if (!found) out.push({ text: raw, kind: 'number' });
  }

  for (const m of text.matchAll(TOOL_RE)) {
    const tool = m[1];
    const key = tool.toLowerCase();
    if (seen.has(key) || skip.some(s => s.includes(key))) continue;
    seen.add(key);
    const re = new RegExp(`(?<![a-z0-9])${key.replace(/[.+#]/g, c => `\\${c}`)}(?![a-z0-9])`, 'i');
    if (!re.test(src)) out.push({ text: tool, kind: 'tool' });
  }
  return out;
}

// ─── Whole check ─────────────────────────────────────────────────────────────

export function checkWriting(
  letter: string,
  opts: { sources: string[]; companyName?: string | null },
): WritingCheck {
  const aiTells = findAiTells(letter);
  // The job description is deliberately NOT a source. A tool named only in
  // the posting is exactly the one a letter tends to claim without basis, so
  // it is flagged for the user to double-check rather than waved through.
  const unsupported = findUnsupported(letter, opts.sources, [opts.companyName ?? '']);
  const company = (opts.companyName ?? '').trim();
  const companyMentions = company
    ? (body(letter).match(new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) ?? []).length
    : 0;

  const verdict: WritingCheck['verdict'] =
    unsupported.some(u => u.kind === 'number') || aiTells.length >= 4 ? 'rework'
      : unsupported.length > 0 || aiTells.length > 0 || (company && companyMentions === 0) ? 'review'
      : 'ready';

  return { aiTells, unsupported, companyMentions, verdict };
}
