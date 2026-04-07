// app/api/resume/rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/firebase/admin';
import { cookies } from 'next/headers';
import { anthropic, CLAUDE_MODEL, extractText, extractJsonString, cachedSystem, logUsage } from '@/lib/ai/claude';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import { applyRateLimit } from '@/lib/ai/rate-limit';

// Output: 3 suggestions × (rewritten text + improvements + keywords + atsOptimizations)
// Typical output: ~1800-2800 tokens depending on section length.
// File-based rewrite (full resume) can be larger.
const MAX_TOKENS_TEXT = 2500;
const MAX_TOKENS_FILE = 3500;

const REWRITE_SYSTEM = `You are an elite resume writer with 15+ years crafting resumes for Fortune 500 candidates. Create multiple distinct rewrite suggestions, progressively more optimised. Return ONLY valid JSON. No markdown. Start with { end with }.`;

interface RewriteContext { jobTitle?: string; companyName?: string; jobDescription?: string; missingKeywords?: string[]; missingSkills?: string[]; }
interface Suggestion { id: string; original?: string; rewritten: string; improvements: string[]; tone: string; score: number; keywordsAdded?: string[]; atsOptimizations?: string[]; confidenceScore: number; optimizationMode: string; }
interface RewriteResponse { suggestions: Suggestion[]; }

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    let userId: string | null = null;
    const session = (await cookies()).get('session');
    if (session) try { userId = (await auth.verifySessionCookie(session.value, true)).uid; } catch {}
    if (!userId) {
      const h = request.headers.get('authorization');
      if (h?.startsWith('Bearer ')) try { userId = (await auth.verifyIdToken(h.slice(7))).uid; } catch {}
    }

    // ── Rate limit ────────────────────────────────────────────────
    const rateLimited = await applyRateLimit(request, userId ?? null, 'medium');
    if (rateLimited) return rateLimited;

    // ── Usage gate ────────────────────────────────────────────────
    if (userId) {
      const usageCheck = await checkUsage(userId, 'resumes');
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { error: usageCheck.message, code: 'USAGE_LIMIT', used: usageCheck.used, limit: usageCheck.limit },
          { status: 403 },
        );
      }
    }

    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('multipart/form-data')) return await handleFileRewrite(request, userId);
    return await handleTextRewrite(request, userId);
  } catch (error) { console.error('❌ Rewrite error:', error); return NextResponse.json({ error: (error as Error).message || 'Failed' }, { status: 500 }); }
}

async function handleFileRewrite(request: NextRequest, userId: string | null) {
  const fd = await request.formData();
  const file = fd.get('file') as File | null;
  const section = (fd.get('section') as string) ?? 'full resume';
  const tone = (fd.get('tone') as string) ?? 'professional';
  const context = fd.get('context') as string | null;
  const jobTitle = (fd.get('jobTitle') as string) ?? '';
  const company = (fd.get('companyName') as string) ?? '';
  const jobDesc = (fd.get('jobDescription') as string) ?? '';
  const keywords = (fd.get('missingKeywords') as string) ?? '';
  const skills = (fd.get('missingSkills') as string) ?? '';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImg = file.type.startsWith('image/');
  if (!isPdf && !isImg) return NextResponse.json({ error: 'File must be PDF or image' }, { status: 400 });

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const fileBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: (file.type || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } };

  const rewriteCtx: RewriteContext = { jobTitle: jobTitle || undefined, companyName: company || undefined, jobDescription: jobDesc || undefined, missingKeywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined, missingSkills: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : undefined };

  return await generateSuggestions({ section, originalText: '(See attached resume)', tone: tone as 'professional' | 'creative' | 'technical' | 'executive', context: context || rewriteCtx, fileBlock, userId, maxTokens: MAX_TOKENS_FILE });
}

async function handleTextRewrite(request: NextRequest, userId: string | null) {
  const { section, originalText, tone, context } = await request.json() as { section: string; originalText: string; tone: 'professional' | 'creative' | 'technical' | 'executive'; context?: string | RewriteContext };
  if (!originalText || !section) return NextResponse.json({ error: 'Missing originalText and section' }, { status: 400 });
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  return await generateSuggestions({ section, originalText, tone, context, userId, maxTokens: MAX_TOKENS_TEXT });
}

async function generateSuggestions({ section, originalText, tone, context, fileBlock, userId, maxTokens }: {
  section: string; originalText: string; tone: string; context?: string | RewriteContext; fileBlock?: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam; userId: string | null; maxTokens: number;
}): Promise<NextResponse> {
  const isCustom = typeof context === 'string' && context.trim().length > 0;
  const jobCtx = !isCustom && typeof context === 'object' ? context as RewriteContext : null;

  let mode = 'general', ctxInstr = '';
  if (isCustom) { mode = 'custom-prompt'; ctxInstr = `USER INSTRUCTIONS:\n"${context}"\nFollow exactly.`; }
  else if (jobCtx?.jobDescription) { mode = 'job-description'; ctxInstr = `TARGET: ${jobCtx.jobTitle || 'Not specified'}${jobCtx.companyName ? ` at ${jobCtx.companyName}` : ''}\nJD:\n${jobCtx.jobDescription}\n${jobCtx.missingKeywords?.length ? `MISSING KEYWORDS: ${jobCtx.missingKeywords.slice(0, 12).join(', ')}` : ''}\n${jobCtx.missingSkills?.length ? `MISSING SKILLS: ${jobCtx.missingSkills.slice(0, 8).join(', ')}` : ''}`; }
  else if (jobCtx?.jobTitle) { mode = 'ai-knowledge'; ctxInstr = `TARGET: ${jobCtx.jobTitle}${jobCtx.companyName ? ` at ${jobCtx.companyName}` : ''}`; }

  const prompt = `Rewrite "${section}". Tone: ${tone} | Mode: ${mode}\n${ctxInstr}\n${originalText !== '(See attached resume)' ? `ORIGINAL:\n${originalText}` : ''}\n\n3 suggestions, progressively optimised.\nJSON: { "suggestions": [{ "id": "1", "original": "...", "rewritten": "...", "improvements": ["..."], "tone": "${tone}", "score": <75-95>, "keywordsAdded": ["..."], "atsOptimizations": ["..."], "confidenceScore": <0.7-0.99>, "optimizationMode": "${mode}" }] }`;

  try {
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = fileBlock ? [fileBlock, { type: 'text', text: prompt }] : prompt;
    const response = await anthropic!.messages.create({ model: CLAUDE_MODEL, max_tokens: maxTokens, system: cachedSystem(REWRITE_SYSTEM), messages: [{ role: 'user', content: content }] });
    logUsage('resume-rewrite', response);
    const data = JSON.parse(extractJsonString(extractText(response))) as RewriteResponse;

    // ── Increment usage ───────────────────────────────────────────
    if (userId) await checkAndIncrementUsage(userId, 'resumes');

    return NextResponse.json({ ...data, optimizationMode: mode, meta: { model: CLAUDE_MODEL, mode } });
  } catch (err) {
    return NextResponse.json({ suggestions: [{ id: '1', original: originalText.substring(0, 100), rewritten: `[Unavailable — ${(err as Error).message}]`, improvements: ['Service temporarily unavailable'], tone, score: 70, keywordsAdded: [], atsOptimizations: [], confidenceScore: 0.5, optimizationMode: mode }], optimizationMode: mode, meta: { model: 'fallback' } });
  }
}