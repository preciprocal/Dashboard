// app/api/resume/rewrite/route.ts
// Claude Sonnet 4.6 handles both PDF reading and rewriting.
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
  : null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RewriteContext {
  jobTitle?:        string;
  companyName?:     string;
  jobDescription?:  string;
  missingKeywords?: string[];
  missingSkills?:   string[];
}

interface Suggestion {
  id:                string;
  original?:         string;
  rewritten:         string;
  improvements:      string[];
  tone:              string;
  score:             number;
  keywordsAdded?:    string[];
  atsOptimizations?: string[];
  confidenceScore:   number;
  optimizationMode:  string;
}

interface RewriteResponse {
  suggestions: Suggestion[];
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) return await handleFileRewrite(request);
    return await handleTextRewrite(request);
  } catch (error) {
    console.error('❌ Rewrite error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || 'Failed to generate suggestions', errorType: err.constructor.name },
      { status: 500 },
    );
  }
}

// ─── File-based rewrite ───────────────────────────────────────────────────────
// Claude reads the PDF/image directly via its native document/image support

async function handleFileRewrite(request: NextRequest) {
  const formData = await request.formData();
  const file     = formData.get('file')             as File   | null;
  const section  = (formData.get('section')         as string) ?? 'full resume';
  const tone     = (formData.get('tone')            as string) ?? 'professional';
  const context  = formData.get('context')          as string | null;
  const jobTitle = (formData.get('jobTitle')        as string) ?? '';
  const company  = (formData.get('companyName')     as string) ?? '';
  const jobDesc  = (formData.get('jobDescription')  as string) ?? '';
  const keywords = (formData.get('missingKeywords') as string) ?? '';
  const skills   = (formData.get('missingSkills')   as string) ?? '';

  console.log('✏️  File-based rewrite:', { section, tone, hasFile: !!file, hasJobDesc: !!jobDesc });

  if (!file)      return NextResponse.json({ error: 'No resume file provided' },                          { status: 400 });
  if (!anthropic) return NextResponse.json({ error: 'AI service not configured — add CLAUDE_API_KEY' },   { status: 503 });

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImg = file.type.startsWith('image/');
  if (!isPdf && !isImg) return NextResponse.json({ error: 'File must be a PDF or image' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const base64Data  = Buffer.from(arrayBuffer).toString('base64');

  const rewriteContext: RewriteContext = {
    jobTitle:        jobTitle  || undefined,
    companyName:     company   || undefined,
    jobDescription:  jobDesc   || undefined,
    missingKeywords: keywords  ? keywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
    missingSkills:   skills    ? skills.split(',').map(s => s.trim()).filter(Boolean)   : undefined,
  };

  // Build Claude content blocks for the file
  const fileBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam = isPdf
    ? {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: base64Data,
        },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: (file.type || 'image/png') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64Data,
        },
      };

  return await generateSuggestions({
    section,
    originalText: '(See attached resume — full content to be rewritten)',
    tone:         tone as 'professional' | 'creative' | 'technical' | 'executive',
    context:      context || rewriteContext,
    fileBlock,
  });
}

// ─── Legacy JSON-based rewrite ───────────────────────────────────────────────

async function handleTextRewrite(request: NextRequest) {
  const body = await request.json() as {
    resumeId?:    string;
    userId?:      string;
    section:      string;
    originalText: string;
    tone:         'professional' | 'creative' | 'technical' | 'executive';
    context?:     string | RewriteContext;
  };

  const { section, originalText, tone, context } = body;
  console.log('✏️  Text-based rewrite:', { section, tone });

  if (!originalText || !section) {
    return NextResponse.json({ error: 'Missing required fields: originalText and section' }, { status: 400 });
  }
  if (!anthropic) {
    return NextResponse.json({ error: 'AI service not configured — add CLAUDE_API_KEY' }, { status: 503 });
  }

  return await generateSuggestions({ section, originalText, tone, context });
}

// ─── Core rewrite logic ───────────────────────────────────────────────────────

async function generateSuggestions({
  section,
  originalText,
  tone,
  context,
  fileBlock,
}: {
  section:       string;
  originalText:  string;
  tone:          'professional' | 'creative' | 'technical' | 'executive';
  context?:      string | RewriteContext;
  fileBlock?:    Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam;
}): Promise<NextResponse> {
  const isCustomPrompt = typeof context === 'string' && context.trim().length > 0;
  const jobContext     = !isCustomPrompt && typeof context === 'object' ? context as RewriteContext : null;

  let optimizationMode = 'general';
  let contextInstructions = '';

  if (isCustomPrompt) {
    optimizationMode    = 'custom-prompt';
    contextInstructions = `USER'S CUSTOM INSTRUCTIONS:\n"${context}"\n\nFollow these instructions exactly.`;
  } else if (jobContext?.jobDescription) {
    optimizationMode    = 'job-description';
    contextInstructions = `TARGET JOB:
Position: ${jobContext.jobTitle || 'Not specified'}
${jobContext.companyName ? `Company: ${jobContext.companyName}` : ''}

FULL JOB DESCRIPTION:
${jobContext.jobDescription}

${jobContext.missingKeywords?.length ? `CRITICAL MISSING KEYWORDS (incorporate naturally):\n${jobContext.missingKeywords.slice(0, 12).join(', ')}` : ''}
${jobContext.missingSkills?.length   ? `MISSING SKILLS (incorporate where authentic):\n${jobContext.missingSkills.slice(0, 8).join(', ')}` : ''}`;
  } else if (jobContext?.jobTitle) {
    optimizationMode    = 'ai-knowledge';
    contextInstructions = `TARGET ROLE: ${jobContext.jobTitle}${jobContext.companyName ? ` at ${jobContext.companyName}` : ''}\nOptimise using best-practice knowledge for this role.`;
  }

  const prompt = `You are an elite resume writer. Rewrite the "${section}" section of this resume.
Tone: ${tone} | Mode: ${optimizationMode}

${contextInstructions}

${originalText !== '(See attached resume — full content to be rewritten)' ? `ORIGINAL TEXT:\n${originalText}` : ''}

Generate 3 distinct rewrite suggestions, each progressively more optimised.

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "id": "1",
      "original": "original bullet or section text",
      "rewritten": "improved version",
      "improvements": ["improvement 1", "improvement 2", "improvement 3"],
      "tone": "${tone}",
      "score": <75-95>,
      "keywordsAdded": ["keyword1", "keyword2"],
      "atsOptimizations": ["optimization1"],
      "confidenceScore": <0.7-0.99>,
      "optimizationMode": "${optimizationMode}"
    }
  ]
}`;

  try {
    // Build message content — with or without file
    const contentBlocks: Anthropic.MessageCreateParams['messages'][0]['content'] = fileBlock
      ? [fileBlock, { type: 'text' as const, text: prompt }]
      : prompt;

    const response = await anthropic!.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 4000,
      messages:   [{ role: 'user', content: contentBlocks }],
    });

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    let jsonStr = cleaned;
    if (!jsonStr.startsWith('{')) {
      const match = jsonStr.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      jsonStr = match[0];
    }

    const data = JSON.parse(jsonStr) as RewriteResponse;

    return NextResponse.json({
      ...data,
      optimizationMode,
      meta: { model: CLAUDE_MODEL, mode: optimizationMode },
    });
  } catch (err) {
    console.error('❌ Rewrite failed:', err);
    // Fallback mock
    return NextResponse.json({
      suggestions: [{
        id: '1',
        original:         originalText.substring(0, 100),
        rewritten:        `[AI rewrite unavailable — ${err instanceof Error ? err.message : 'unknown error'}]`,
        improvements:     ['Service temporarily unavailable'],
        tone,
        score:            70,
        keywordsAdded:    [],
        atsOptimizations: [],
        confidenceScore:  0.5,
        optimizationMode,
      }],
      optimizationMode,
      meta: { model: 'fallback' },
    });
  }
}