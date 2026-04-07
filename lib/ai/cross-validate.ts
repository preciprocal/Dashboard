// lib/ai/cross-validate.ts
// Adversarial AI peer-review. Non-blocking — failures never block the main response.

import { anthropic, CLAUDE_MODEL, extractText, logUsage } from '@/lib/ai/claude';

// 1200 tokens — the JSON with 2-3 issues + assessment needs ~800-1000.
// Previous 600 was truncating every single time.
const V_TOKENS = 1200;

export interface CrossValidationResult {
  issuesFound: number;
  issues: Array<{
    field: string;
    severity: 'critical' | 'warning' | 'info';
    issue: string;
    suggestion: string;
  }>;
  overallAssessment: string;
  trustScore: number;
}

// ─── Safe JSON extraction — handles truncation gracefully ─────────────────────

function extractAndParseJSON(raw: string): CrossValidationResult | null {
  if (!raw || raw.trim().length === 0) return null;

  let text = raw.trim();

  // Strip markdown fences if present
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Find the first { in the text
  const startIdx = text.indexOf('{');
  if (startIdx === -1) return null;

  text = text.slice(startIdx);

  // Try parsing as-is first
  try {
    const parsed = JSON.parse(text) as CrossValidationResult;
    parsed.issuesFound = parsed.issues?.length ?? 0;
    return parsed;
  } catch {
    // JSON is truncated — attempt repair
  }

  // Repair strategy: close open strings, arrays, objects
  let fixed = text;

  // If odd number of unescaped quotes, close the string
  const unescapedQuotes = (fixed.match(/(?<!\\)"/g) || []).length;
  if (unescapedQuotes % 2 !== 0) {
    fixed += '"';
  }

  // Remove any trailing comma before we close brackets
  fixed = fixed.replace(/,\s*$/, '');

  // Count open vs close brackets and close them
  const stack: string[] = [];
  let inString = false;
  let escape = false;

  for (let i = 0; i < fixed.length; i++) {
    const ch = fixed[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Close remaining open brackets in reverse order
  while (stack.length > 0) {
    fixed += stack.pop();
  }

  try {
    const parsed = JSON.parse(fixed) as CrossValidationResult;
    parsed.issuesFound = parsed.issues?.length ?? 0;
    return parsed;
  } catch {
    // Still can't parse — return a safe default
    console.warn('⚠️ Cross-validation JSON repair failed, returning default');
    return {
      issuesFound: 0,
      issues: [],
      overallAssessment: 'Validation check completed — response was partially truncated.',
      trustScore: 65,
    };
  }
}

// ─── Benchmark cross-validation ───────────────────────────────────────────────

export async function crossValidateBenchmark(
  benchmarkJson: Record<string, unknown>,
  resumeScore: number,
): Promise<CrossValidationResult | null> {
  if (!anthropic) return null;

  try {
    const dims = (benchmarkJson.dimensions as Array<Record<string, unknown>> | undefined)
      ?.map(d => `${d.name}: user=${d.userScore} peer=${d.peerMedian} hired=${d.hiredMedian}`)
      .join('; ') ?? 'none';

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: V_TOKENS,
      messages: [{
        role: 'user',
        content: `Audit this benchmark data. Resume score: ${resumeScore}/100.

percentile: ${benchmarkJson.overallPercentile}, chance: ${benchmarkJson.hiringChance}
dimensions: ${dims}

Respond with ONLY a JSON object. Keep ALL strings under 50 characters. No markdown.

{"issues":[{"field":"name","severity":"warning","issue":"short desc","suggestion":"short fix"}],"overallAssessment":"one sentence max 50 chars","trustScore":80}

Rules:
- If percentile doesn't match resume score quality, flag it
- If any hired median < peer median, flag it (impossible)
- If hiring chance contradicts the scores, flag it
- If everything is consistent, return empty issues array and trustScore 80-95
- Maximum 3 issues`,
      }],
    });
    logUsage('cross-validate-benchmark', response);

    return extractAndParseJSON(extractText(response));
  } catch (e) {
    console.warn('⚠️ Benchmark cross-validation failed:', e);
    return null;
  }
}

// ─── Interview intel cross-validation ─────────────────────────────────────────

export async function crossValidateIntel(
  intelJson: Record<string, unknown>,
  company: string,
  role: string,
): Promise<CrossValidationResult | null> {
  if (!anthropic) return null;

  try {
    const co = intelJson.companyOverview as Record<string, unknown> | undefined;
    const si = intelJson.salaryIntel as Record<string, unknown> | undefined;
    const ip = intelJson.interviewProcess as Record<string, unknown> | undefined;
    const qCount = (intelJson.topQuestions as unknown[] | null)?.length ?? 0;

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: V_TOKENS,
      messages: [{
        role: 'user',
        content: `Fact-check this interview intel for ${company} (${role}).

difficulty: ${co?.interviewDifficulty ?? 'null'}, glassdoor: ${co?.glassdoorRating ?? 'null'}
salary base: ${si?.baseSalary ? JSON.stringify(si.baseSalary) : 'null'}
rounds: ${ip?.totalRounds ?? 'null'}, questions: ${qCount}
hiring status: ${co?.hiringStatus ?? 'null'}

Respond with ONLY a JSON object. Keep ALL strings under 50 characters. No markdown.

{"issues":[{"field":"name","severity":"warning","issue":"short desc","suggestion":"short fix"}],"overallAssessment":"one sentence max 50 chars","trustScore":75}

Rules:
- Check salary plausibility for this role
- Check round count vs company norms
- Glassdoor must be 1-5
- Flag contradictions (hiring freeze + actively hiring)
- If data looks reasonable, return empty issues and trustScore 75-90
- Maximum 3 issues`,
      }],
    });
    logUsage('cross-validate-intel', response);

    return extractAndParseJSON(extractText(response));
  } catch (e) {
    console.warn('⚠️ Intel cross-validation failed:', e);
    return null;
  }
}

// ─── Recruiter simulation cross-validation ────────────────────────────────────

export async function crossValidateRecruiterSim(
  simJson: Record<string, unknown>,
): Promise<CrossValidationResult | null> {
  if (!anthropic) return null;

  try {
    const fi = simJson.firstImpression as Record<string, unknown> | undefined;
    const heatmap = simJson.eyeTrackingHeatmap as Array<Record<string, unknown>> | undefined;
    const heatmapStr = heatmap?.map(h => `${h.section}:${h.timeSpent}s`).join(', ') ?? 'none';

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: V_TOKENS,
      messages: [{
        role: 'user',
        content: `Audit this recruiter simulation against known research.

Known facts: avg scan 6-8s, most scores 40-65, pass rate 15-25%.

score: ${fi?.score ?? '?'}, reviewTime: ${simJson.timeToReview ?? '?'}s, pass: ${simJson.passScreening ?? '?'}
heatmap: ${heatmapStr}

Respond with ONLY a JSON object. Keep ALL strings under 50 characters. No markdown.

{"issues":[{"field":"name","severity":"warning","issue":"short desc","suggestion":"short fix"}],"overallAssessment":"one sentence max 50 chars","trustScore":75}

Rules:
- Review time should be 5-12s
- Score above 80 is very rare
- Education should NOT get more time than experience
- passScreening=true should be uncommon
- If everything is realistic, return empty issues and trustScore 75-90
- Maximum 3 issues`,
      }],
    });
    logUsage('cross-validate-recruiter', response);

    return extractAndParseJSON(extractText(response));
  } catch (e) {
    console.warn('⚠️ Recruiter cross-validation failed:', e);
    return null;
  }
}