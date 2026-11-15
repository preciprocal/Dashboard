// lib/applications/model-json.ts
//
// Reading JSON out of a model reply for the Apply flow. Besides the usual
// repairs (extractJsonString), a reply sometimes splits the answer into two
// objects one after the other, e.g. {"keywords": [...]} {"changes": [...]},
// which JSON.parse rejects ("non-whitespace character after JSON"). Those are
// merged. When the reply still cannot be read, the call is made once more.

import type Anthropic from '@anthropic-ai/sdk';
import { extractJsonString, extractText } from '@/lib/ai/claude';

/** Every top-level {...} in `text`, in order (string contents respected). */
function topLevelObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}' && depth > 0) { depth--; if (depth === 0 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1; } }
  }
  return out;
}

export function parseModelJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(extractJsonString(raw)) as Record<string, unknown>;
  } catch (first) {
    const parts = topLevelObjects(raw.replace(/```json\s*|```/gi, ''));
    const parsed = parts.map(p => { try { return JSON.parse(p) as Record<string, unknown>; } catch { return null; } }).filter(Boolean) as Record<string, unknown>[];
    if (parsed.length) return Object.assign({}, ...parsed);
    throw first;
  }
}

/** Calls the model and reads its JSON, asking once more if the reply is unreadable. */
export async function askJson(call: () => Promise<Anthropic.Message>, label: string): Promise<Record<string, unknown>> {
  for (let attempt = 1; ; attempt++) {
    const response = await call();
    try {
      return parseModelJson(extractText(response));
    } catch (err) {
      if (attempt >= 2) throw err;
      console.warn(`${label}: unreadable JSON, asking again:`, (err as Error).message);
    }
  }
}
