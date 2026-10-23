// lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk';

// ─── Client & Model ──────────────────────────────────────────────────────────

const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
/** Fallback model, and the one older call sites still name. */
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

// ─── Fast generation ─────────────────────────────────────────────────────────

/**
 * Model for candidate-facing generation (analysis, fixes, rewrites, tailoring,
 * cover letters, plans...). Measured on the same resume: ~156 output tokens/s
 * with thinking off, against ~45 for Sonnet 4.6, at a lower price; quality was
 * judged equal or better on resume analysis (Opus 5.5 as judge, 3 resumes).
 */
export const FAST_MODEL = 'claude-sonnet-5-5';

type CreateParams = Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'> & { model?: string };

/**
 * messages.create on FAST_MODEL with thinking off. Callers keep passing their
 * old `model`; it is ignored here so one import change moves a route over.
 * If FAST_MODEL declines (stop_reason "refusal"), the same request is sent
 * once to CLAUDE_MODEL, which has no such classifier on these prompts.
 */
export async function createMessage(params: CreateParams): Promise<Anthropic.Message> {
  if (!anthropic) throw new Error('AI not configured');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { model: _callerModel, ...rest } = params;
  // `between_tools` (Sonnet 5.5's thinking-off mode) is newer than the
  // installed SDK's types, hence the cast; the API accepts it.
  const fast = {
    ...rest,
    // Caps were sized for CLAUDE_MODEL. FAST_MODEL writes ~35% more for the
    // same task (measured on fix generation: 5,054 vs 3,775 tokens), so the
    // old cap cut its JSON off mid-object. A cap only bounds length; it
    // costs nothing unless the model uses it.
    max_tokens: Math.ceil(rest.max_tokens * 1.5),
    model: FAST_MODEL,
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;
  const response = await anthropic.messages.create(fast);
  if ((response.stop_reason as string) !== 'refusal') return response;
  console.warn(`⚠️ ${FAST_MODEL} declined, retrying on ${CLAUDE_MODEL}`);
  return anthropic.messages.create({ ...rest, model: CLAUDE_MODEL });
}

// ─── Extract helpers ─────────────────────────────────────────────────────────

/** Pull plain text from a Claude response */
export function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n');
}

/**
 * Strip markdown fences, find the outermost JSON object/array,
 * and auto-repair truncated JSON from max_tokens cutoff.
 *
 * Returns a string that is safe to pass to JSON.parse().
 * If the raw response was truncated, the repair closes all open
 * structures so parsing succeeds (some trailing data may be lost).
 */
export function extractJsonString(raw: string): string {
  // 1. Strip markdown code fences
  let s = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // 2. Find the outermost JSON structure
  const startBrace = s.indexOf('{');
  const startBracket = s.indexOf('[');

  let start = -1;
  if (startBrace === -1 && startBracket === -1) return s;
  if (startBrace === -1) start = startBracket;
  else if (startBracket === -1) start = startBrace;
  else start = Math.min(startBrace, startBracket);

  s = s.slice(start);

  // 3. Try parsing as-is first (fast path - no repair overhead)
  try {
    JSON.parse(s);
    return s;
  } catch {
    // Fall through to repair
  }

  // 4. Repair truncated JSON and verify
  const repaired = repairTruncatedJson(s);

  try {
    JSON.parse(repaired);
    console.warn('[extractJsonString] Repaired truncated JSON successfully');
    return repaired;
  } catch (e) {
    // Last resort: find the last valid closing brace/bracket and truncate there
    const lastResort = truncateToLastValid(s);
    try {
      JSON.parse(lastResort);
      console.warn('[extractJsonString] Last-resort truncation succeeded');
      return lastResort;
    } catch {
      // Return the repaired version anyway - caller will get a clearer error
      console.error('[extractJsonString] All repair attempts failed:', (e as Error).message);
      return repaired;
    }
  }
}

// ─── JSON Repair (private) ───────────────────────────────────────────────────

/**
 * Repairs JSON that was truncated mid-output (e.g. by max_tokens).
 * Closes unclosed strings, strips dangling commas/colons/keys, and
 * balances all brackets/braces so JSON.parse() can succeed.
 */
function repairTruncatedJson(raw: string): string {
  let s = raw;

  // ── Pass 1: Scan to find state at end of string ──
  let inString = false;
  let escaped = false;
  let openBraces = 0;
  let openBrackets = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }

  // ── If stuck inside a string, close it ──
  if (inString) {
    // Escape any trailing backslash that would escape our closing quote
    if (s.endsWith('\\')) s += '\\';
    s += '"';
  }

  // ── Strip trailing garbage outside strings ──
  // Remove patterns that leave invalid JSON at the tail:
  //   - trailing comma:                    ..., }
  //   - dangling key with no value:        ..."key"
  //   - dangling key with colon:           ..."key":
  //   - dangling key with colon + quote:   ..."key": "
  // We loop because stripping one layer can reveal another
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/,\s*$/, '');                      // trailing comma
    s = s.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, ''); // ,"key": "truncatedVal
    s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '');        // ,"key":
    s = s.replace(/,\s*"[^"]*"\s*$/, '');             // ,"key"
    s = s.replace(/:\s*$/, ': null');                  // dangling colon → null
  }

  // ── Pass 2: Recount after modifications ──
  openBraces = 0;
  openBrackets = 0;
  inString = false;
  escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }

  // One more trailing comma strip before closing
  s = s.replace(/,\s*$/, '');

  // ── Close all open structures ──
  while (openBrackets > 0) { s += ']'; openBrackets--; }
  while (openBraces > 0) { s += '}'; openBraces--; }

  return s;
}

/**
 * Last-resort: walk forward tracking depth, record the last position
 * where the top-level structure fully closed, and truncate there.
 * This loses more data but virtually guarantees valid JSON.
 */
function truncateToLastValid(raw: string): string {
  let inString = false;
  let escaped = false;
  let lastGoodEnd = -1;
  let depth = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') depth++;
    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        // Fully closed at top level - this is the ideal cut point
        lastGoodEnd = i;
      }
    }
  }

  // If we found a point where top-level structure closed, use that
  if (lastGoodEnd > 0) {
    return raw.slice(0, lastGoodEnd + 1);
  }

  // Otherwise fall back to the standard repair
  return repairTruncatedJson(raw);
}

// ─── Cached System Prompt ────────────────────────────────────────────────────

/** Wrap a system prompt with ephemeral cache control */
export function cachedSystem(
  text: string,
): Anthropic.MessageCreateParams['system'] {
  return [
    {
      type: 'text' as const,
      text,
      cache_control: { type: 'ephemeral' as const },
    },
  ];
}

// ─── Usage Logging ───────────────────────────────────────────────────────────

/** Log token usage from a Claude response */
export function logUsage(label: string, response: Anthropic.Message): void {
  const u = response.usage;
  if (!u) return;
  const cached = (u as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
  const created = (u as unknown as Record<string, number>).cache_creation_input_tokens ?? 0;
  console.log(
    `[${label}] in=${u.input_tokens} (cached=${cached}, created=${created}) out=${u.output_tokens} | stop=${response.stop_reason}`,
  );

  // Warn when response was truncated - likely the source of JSON parse errors
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      `⚠️  [${label}] Response truncated by max_tokens - output may be incomplete. Consider raising max_tokens.`,
    );
  }
}

// ─── Resume Text Cleaning ────────────────────────────────────────────────────

/** Strip PDF extraction noise before sending to Claude */
export function cleanResumeText(text: string): string {
  return text
    .replace(/\f/g, '\n')                        // form feeds → newlines
    .replace(/\r\n/g, '\n')                       // normalize line endings
    .replace(/[ \t]+/g, ' ')                      // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')                   // collapse triple+ newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars only - keeps every language's characters
    .trim();
}

// ─── Dash Cleanup ────────────────────────────────────────────────────────────

/**
 * Keys whose values are quoted verbatim from the candidate's resume so the UI
 * can find the line again (lineId, fix matching). Rewriting a dash inside
 * one of these would break that match, so they are left exactly as returned.
 */
const VERBATIM_KEYS: ReadonlySet<string> = new Set(['originalText', 'original', 'targetLine', 'lineId']);

/**
 * Replace em and en dashes in AI-written text with plain hyphens. The prompts
 * ask for this too (see LANGUAGE_MATCH_INSTRUCTION), but the model still
 * slips them in, so this is the guarantee.
 *   "2019–2021" -> "2019-2021"
 *   "fast — and cheap" / "fast—and cheap" -> "fast - and cheap"
 */
export function stripDashes(text: string): string {
  return text
    .replace(/(\d)[ \t]*[–—‒][ \t]*(\d)/g, '$1-$2')
    .replace(/[ \t]*[—―][ \t]*/g, ' - ')
    .replace(/[ \t]+[–‒][ \t]+/g, ' - ')
    .replace(/[–‒]/g, '-')
    .replace(/^ - /gm, '- ')
    .replace(/ - $/gm, '');
}

/**
 * stripDashes over every string in a parsed AI response, skipping
 * VERBATIM_KEYS. A string in "original → replacement" form (resume tailor)
 * only has its replacement side cleaned, because the left side has to match
 * the resume exactly.
 */
export function stripDashesDeep<T>(value: T, key?: string): T {
  if (typeof value === 'string') {
    if (key && VERBATIM_KEYS.has(key)) return value;
    const arrow = value.indexOf('→');
    if (arrow !== -1) return (value.slice(0, arrow + 1) + stripDashes(value.slice(arrow + 1))) as T;
    return stripDashes(value) as T;
  }
  if (Array.isArray(value)) return value.map(v => stripDashesDeep(v, key)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, stripDashesDeep(v, k)]),
    ) as T;
  }
  return value;
}

// ─── Multilingual Output ─────────────────────────────────────────────────────

/**
 * Appended to system prompts for every feature that reads a resume, job
 * description, or job title and produces candidate-facing text (feedback,
 * rewrites, tailored content). Ensures non-English candidates get the whole
 * response - including rewritten "edit" text - in their own language,
 * instead of English feedback on a non-English resume.
 */
export const LANGUAGE_MATCH_INSTRUCTION = `

LANGUAGE: Detect the language the candidate's resume, job description, and/or job title are written in. If it is not English, respond ENTIRELY in that language - every piece of narrative text: feedback, explanations, quotes, tips, verdicts, AND any rewritten/tailored/"improved" text you generate. The candidate must be able to use your output directly, so a rewritten bullet point must be written in their language, not translated-then-English. Keep JSON field names exactly as specified in the schema (always English) - only the string VALUES change language. If the resume and job description are in different languages, prefer the resume's language for anything the candidate will reuse (rewrites, edits), since that is the language of the document they will submit. If everything is in English, respond in English as normal.

PUNCTUATION: Never use em dashes (—) or en dashes (–) in text you write. Use a comma, colon, period, or a plain hyphen (-) instead, and write ranges as "2019-2021". The only exception is text you quote verbatim from the resume (such as originalText or targetLine), which must stay exactly as written.`;