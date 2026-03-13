// app/api/resume/rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.CLAUDE_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

interface RewriteContext {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  missingKeywords?: string[];
  missingSkills?: string[];
}

interface RewriteRequest {
  resumeId?: string;
  userId?: string;
  section: string;
  originalText: string;
  tone: 'professional' | 'creative' | 'technical' | 'executive';
  context?: string | RewriteContext;
}

interface Suggestion {
  id: string;
  original?: string;
  rewritten: string;
  improvements: string[];
  tone: string;
  score: number;
  keywordsAdded?: string[];
  atsOptimizations?: string[];
  confidenceScore: number;
  optimizationMode: string;
}

interface RewriteResponse {
  suggestions: Suggestion[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RewriteRequest;
    const { section, originalText, tone, context } = body;

    console.log('🧠 Intelligent Resume Rewrite Started');
    console.log('   Section:', section);
    console.log('   Tone:', tone);
    console.log('   Context Type:', typeof context);

    if (!originalText || !section) {
      return NextResponse.json(
        { error: 'Missing required fields: originalText and section' },
        { status: 400 }
      );
    }

    if (!anthropic || !apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured. Please add CLAUDE_API_KEY.' },
        { status: 500 }
      );
    }

    const isCustomPrompt = typeof context === 'string' && context.trim().length > 0;
    const jobContext = !isCustomPrompt && typeof context === 'object' ? context as RewriteContext : null;

    let optimizationMode = 'general';
    let modeDescription = 'General resume enhancement';
    let contextInstructions = '';

    if (isCustomPrompt) {
      optimizationMode = 'custom-prompt';
      modeDescription = 'Custom user instructions';
      contextInstructions = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🪄 MODE 4: CUSTOM USER PROMPT (USER-DIRECTED OPTIMIZATION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

USER'S CUSTOM INSTRUCTIONS:
"${context}"

CRITICAL RULES FOR CUSTOM PROMPTS:
✓ Follow the user's instructions EXACTLY as specified
✓ Prioritize their specific requests over general best practices
✓ If they ask for metrics, add specific numbers and percentages
✓ If they ask for keywords, incorporate those exact terms naturally
✓ If they ask to make it concise, reduce length while keeping impact
✓ If they ask for technical depth, add specific tools/technologies
✓ If they ask for leadership focus, emphasize team management
✓ Maintain the requested ${tone} tone throughout
✓ Still optimize for ATS and professional quality

USER SATISFACTION IS HIGHEST PRIORITY - Give them exactly what they asked for!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    } else if (jobContext?.jobDescription) {
      optimizationMode = 'job-description';
      modeDescription = `Tailored for specific job posting`;
      contextInstructions = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 MODE 1: JOB DESCRIPTION OPTIMIZATION (HIGHEST ACCURACY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TARGET JOB INFORMATION:
Position: ${jobContext.jobTitle || 'Not specified'}
${jobContext.companyName ? `Company: ${jobContext.companyName}` : ''}

COMPLETE JOB DESCRIPTION:
${jobContext.jobDescription}

${jobContext.missingKeywords && jobContext.missingKeywords.length > 0 ? `
🔑 CRITICAL MISSING KEYWORDS (Must incorporate naturally):
${jobContext.missingKeywords.slice(0, 12).join(', ')}
` : ''}

${jobContext.missingSkills && jobContext.missingSkills.length > 0 ? `
⚡ MISSING TECHNICAL SKILLS (Address if relevant):
${jobContext.missingSkills.slice(0, 10).join(', ')}
` : ''}

OPTIMIZATION STRATEGY:
✓ Study the job description word-for-word
✓ Incorporate missing keywords naturally (don't force)
✓ Use EXACT terminology from job posting
✓ Align achievements with stated job requirements
✓ Make candidate appear as PERFECT FIT for this exact role
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    } else if (jobContext?.jobTitle) {
      optimizationMode = 'ai-knowledge';
      modeDescription = `AI knowledge-based optimization for ${jobContext.jobTitle}`;
      contextInstructions = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 MODE 2: AI KNOWLEDGE-BASED OPTIMIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TARGET ROLE: ${jobContext.jobTitle}
${jobContext.companyName ? `TARGET COMPANY: ${jobContext.companyName}` : ''}

Use your knowledge to understand what makes a strong "${jobContext.jobTitle}" candidate:
✓ Typical technical requirements for this role
✓ Common skills hiring managers seek
✓ Industry-standard technologies and frameworks
✓ ${jobContext.companyName ? `${jobContext.companyName}'s known tech stack and culture` : 'General industry best practices'}
✓ Trending tools and methodologies in this field
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    } else {
      optimizationMode = 'general';
      modeDescription = 'General resume enhancement';
      contextInstructions = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 MODE 3: GENERAL OPTIMIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Focus on:
✓ Powerful action verbs and active voice
✓ Quantifiable achievements with metrics
✓ Industry-standard professional keywords
✓ Clear, concise, achievement-focused language
✓ General ATS optimization best practices
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    }

    const toneDescriptions = {
      professional: 'corporate, formal, achievement-focused, and authoritative',
      creative: 'innovative, unique, engaging, and distinctive',
      technical: 'precise, detailed, technically accurate, and data-driven',
      executive: 'leadership-focused, strategic, high-level, and visionary'
    };

    const prompt = `You are an expert resume writer, ATS specialist, and career coach with deep knowledge of job markets, company cultures, and industry requirements.

${contextInstructions}

ORIGINAL TEXT TO REWRITE:
"""
${originalText}
"""

REWRITING REQUIREMENTS:
- Section: ${section}
- Tone: ${tone} (${toneDescriptions[tone]})
- Length: ${isCustomPrompt ? 'As appropriate for user request' : '2-4 powerful sentences'}
- Mode: ${optimizationMode.toUpperCase()}

Generate exactly 3 distinct, high-quality variations. Each must:
${isCustomPrompt ? `
1. FOLLOW USER'S CUSTOM INSTRUCTIONS: "${context}"
2. Still use commanding action verbs (Led, Spearheaded, Architected, Transformed)
3. Include specific quantifiable achievements when relevant
4. Be concrete and specific (avoid generic statements)
5. Sound authentic and natural
6. Maintain perfect ${tone} tone throughout
7. Optimize for ATS while fulfilling user's request
` : `
1. Use commanding action verbs (Led, Spearheaded, Architected, Transformed, Delivered, Achieved, Pioneered)
2. Include specific quantifiable achievements with numbers and percentages
3. ${optimizationMode === 'job-description' ? 'Naturally weave in missing keywords from job description' :
     optimizationMode === 'ai-knowledge' ? `Incorporate skills/technologies typical for ${jobContext?.jobTitle} at ${jobContext?.companyName || 'this type of company'}` :
     'Use strong industry-standard keywords'}
4. Be concrete and specific (avoid generic statements)
5. Sound authentic and natural (not keyword-stuffed)
6. Maintain perfect ${tone} tone throughout
7. ${optimizationMode !== 'general' ? 'Maximize job relevance and ATS match score' : 'Maximize general impact'}
`}

Return ONLY valid JSON (no markdown, no code blocks, no extra text):
{
  "suggestions": [
    {
      "id": "suggestion-1",
      "original": "${originalText.substring(0, 50)}...",
      "rewritten": "[Write comprehensive, impactful text here]",
      "improvements": [
        ${isCustomPrompt ? '"Applied user\'s custom instructions",' : '"Added quantifiable metrics (+40% specificity)",'}
        ${optimizationMode !== 'general' && !isCustomPrompt ? '"Incorporated role-specific keywords",' : '"Enhanced professional impact",'}
        "Used stronger action verbs",
        "Highlighted relevant expertise",
        "Optimized for ATS systems"
      ],
      "tone": "${tone}",
      "score": ${isCustomPrompt ? 92 : optimizationMode === 'job-description' ? 95 : optimizationMode === 'ai-knowledge' ? 91 : 87},
      ${optimizationMode !== 'general' || isCustomPrompt ? `"keywordsAdded": ["keyword1", "keyword2", "keyword3"],` : ''}
      ${optimizationMode !== 'general' || isCustomPrompt ? `"atsOptimizations": ["Customized per context", "Enhanced technical depth", "Aligned with industry expectations"],` : ''}
      "confidenceScore": ${isCustomPrompt ? 90 : optimizationMode === 'job-description' ? 95 : optimizationMode === 'ai-knowledge' ? 88 : 85},
      "optimizationMode": "${optimizationMode}"
    },
    {
      "id": "suggestion-2",
      "rewritten": "[Second variation - different angle, equal quality]",
      "improvements": ["Variation 2 improvements"],
      "tone": "${tone}",
      "score": ${isCustomPrompt ? 90 : optimizationMode === 'job-description' ? 93 : optimizationMode === 'ai-knowledge' ? 89 : 85},
      ${optimizationMode !== 'general' || isCustomPrompt ? `"keywordsAdded": ["keyword4", "keyword5"],` : ''}
      ${optimizationMode !== 'general' || isCustomPrompt ? `"atsOptimizations": ["Different approach"],` : ''}
      "confidenceScore": ${isCustomPrompt ? 88 : optimizationMode === 'job-description' ? 93 : optimizationMode === 'ai-knowledge' ? 86 : 83},
      "optimizationMode": "${optimizationMode}"
    },
    {
      "id": "suggestion-3",
      "rewritten": "[Third variation - unique perspective]",
      "improvements": ["Variation 3 improvements"],
      "tone": "${tone}",
      "score": ${isCustomPrompt ? 88 : optimizationMode === 'job-description' ? 91 : optimizationMode === 'ai-knowledge' ? 87 : 83},
      ${optimizationMode !== 'general' || isCustomPrompt ? `"keywordsAdded": ["keyword6"],` : ''}
      ${optimizationMode !== 'general' || isCustomPrompt ? `"atsOptimizations": ["Third approach"],` : ''}
      "confidenceScore": ${isCustomPrompt ? 86 : optimizationMode === 'job-description' ? 91 : optimizationMode === 'ai-knowledge' ? 84 : 81},
      "optimizationMode": "${optimizationMode}"
    }
  ]
}`;

    console.log('   🎯 Optimization Mode:', optimizationMode.toUpperCase());
    console.log('   📝 Mode Description:', modeDescription);
    console.log('   🤖 Calling Claude...');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    }

    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
    }

    if (!cleaned) {
      console.error('   ❌ No JSON found in response');
      throw new Error('Failed to extract JSON from AI response');
    }

    let parsed: RewriteResponse;
    try {
      parsed = JSON.parse(cleaned) as RewriteResponse;
    } catch (e) {
      console.error('   ❌ JSON parse error:', e);
      throw new Error('Invalid JSON format in AI response');
    }

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('AI response missing suggestions array');
    }

    const validSuggestions = parsed.suggestions.filter((s: Suggestion) =>
      s.id && s.rewritten && s.improvements && typeof s.score === 'number'
    );

    if (validSuggestions.length === 0) {
      throw new Error('No valid suggestions generated - please try again');
    }

    console.log('   ✅ Rewrite complete!');
    console.log('   Valid suggestions:', validSuggestions.length);

    return NextResponse.json({
      success: true,
      suggestions: validSuggestions,
      optimizationMode,
      modeDescription,
      customPromptUsed: isCustomPrompt,
      aiKnowledgeUsed: optimizationMode === 'ai-knowledge',
      jobDescriptionUsed: optimizationMode === 'job-description',
      confidenceLevel: isCustomPrompt ? 'custom' :
                       optimizationMode === 'job-description' ? 'highest' :
                       optimizationMode === 'ai-knowledge' ? 'high' : 'medium',
    });

  } catch (error) {
    console.error('❌ Rewrite error:', error);
    const err = error as Error;
    return NextResponse.json(
      {
        error: err.message || 'Failed to generate suggestions',
        errorType: err.constructor.name,
        details: process.env.NODE_ENV === 'development' ? {
          message: err.message,
          stack: err.stack?.split('\n').slice(0, 3).join('\n')
        } : undefined
      },
      { status: 500 }
    );
  }
}