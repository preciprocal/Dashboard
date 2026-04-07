// lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk';

// ─── Client & Model ──────────────────────────────────────────────────────────

const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
export const CLAUDE_MODEL = 'claude-sonnet-4-6';

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

  // 3. Try parsing as-is first (fast path — no repair overhead)
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
      // Return the repaired version anyway — caller will get a clearer error
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
        // Fully closed at top level — this is the ideal cut point
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

  // Warn when response was truncated — likely the source of JSON parse errors
  if (response.stop_reason === 'max_tokens') {
    console.warn(
      `⚠️  [${label}] Response truncated by max_tokens — output may be incomplete. Consider raising max_tokens.`,
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
    .replace(/[^\x20-\x7E\n\u00C0-\u024F]/g, '') // strip non-printable chars (keep accented)
    .trim();
}