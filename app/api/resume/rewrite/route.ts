// app/api/resume/rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Define interfaces
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
  context?: RewriteContext;
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
    console.log('   Job Title:', context?.jobTitle || 'Not provided');
    console.log('   Company:', context?.companyName || 'Not provided');
    console.log('   Has Description:', !!context?.jobDescription);

    if (!originalText || !section) {
      return NextResponse.json(
        { error: 'Missing required fields: originalText and section' },
        { status: 400 }
      );
    }

    if (!genAI || !apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY.' },
        { status: 500 }
      );
    }

    // ✅ Using Gemini 2.5 Flash - Latest and most powerful model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'
    });

    // Determine optimization mode
    let optimizationMode = 'general';
    let modeDescription = 'General resume enhancement';
    let jobContext = '';

    if (context?.jobDescription) {
      // MODE 1: Full job description provided (BEST)
      optimizationMode = 'job-description';
      modeDescription = `Tailored for specific job posting`;
      
      jobContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 MODE 1: JOB DESCRIPTION OPTIMIZATION (HIGHEST ACCURACY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TARGET JOB INFORMATION:
Position: ${context.jobTitle || 'Not specified'}
${context.companyName ? `Company: ${context.companyName}` : ''}

COMPLETE JOB DESCRIPTION:
${context.jobDescription}

${context.missingKeywords && context.missingKeywords.length > 0 ? `
🔑 CRITICAL MISSING KEYWORDS (Must incorporate naturally):
${context.missingKeywords.slice(0, 12).join(', ')}
` : ''}

${context.missingSkills && context.missingSkills.length > 0 ? `
⚡ MISSING TECHNICAL SKILLS (Address if relevant):
${context.missingSkills.slice(0, 10).join(', ')}
` : ''}

OPTIMIZATION STRATEGY:
✓ Study the job description word-for-word
✓ Incorporate missing keywords naturally (don't force)
✓ Highlight experience addressing missing skills
✓ Use EXACT terminology from job posting
✓ Align achievements with stated job requirements
✓ Optimize for this company's specific ATS system
✓ Make candidate appear as PERFECT FIT for this exact role

CRITICAL: Prioritize keywords that genuinely fit this ${section} section.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    } else if (context?.jobTitle) {
      // MODE 2: Job title/company only - Use AI knowledge
      optimizationMode = 'ai-knowledge';
      modeDescription = `AI knowledge-based optimization for ${context.jobTitle}`;
      
      jobContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬 MODE 2: AI KNOWLEDGE-BASED OPTIMIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TARGET ROLE: ${context.jobTitle}
${context.companyName ? `TARGET COMPANY: ${context.companyName}` : ''}

AI RESEARCH INSTRUCTIONS:
You have extensive knowledge about job markets, industries, and company cultures.
Use your training data to understand what makes a strong "${context.jobTitle}" candidate.

ANALYZE AND INCORPORATE:
1. Typical technical requirements for ${context.jobTitle} roles
2. Common skills hiring managers seek for this position
3. Industry-standard technologies and frameworks
4. ${context.companyName ? `${context.companyName}'s known tech stack, values, and culture` : 'General industry best practices'}
5. Trending tools and methodologies in this field
6. Expected qualifications based on seniority level in title

${context.companyName === 'Google' ? `
GOOGLE-SPECIFIC OPTIMIZATION:
- Tech: Go, Python, Kubernetes, GCP, Bigtable, TensorFlow
- Values: Innovation at scale, technical excellence, data-driven
- Culture: "Moonshot thinking", collaborative, fast-paced
- Keywords: scale, billions of users, distributed systems, ML/AI
` : ''}

${context.companyName === 'Amazon' ? `
AMAZON-SPECIFIC OPTIMIZATION:
- Tech: AWS, Java, Python, DynamoDB, Lambda
- Values: Customer obsession, ownership, bias for action, frugality
- Culture: Leadership principles-driven, data-focused, high bar
- Keywords: customer impact, scalability, ownership, metrics
` : ''}

${context.companyName === 'Meta' || context.companyName === 'Facebook' ? `
META-SPECIFIC OPTIMIZATION:
- Tech: React, Python, PHP, GraphQL, Hack
- Values: Move fast, be bold, focus on impact, build social value
- Culture: Hacker mentality, iteration, user-focused
- Keywords: billions of users, real-time, social impact, innovation
` : ''}

${context.companyName === 'Microsoft' ? `
MICROSOFT-SPECIFIC OPTIMIZATION:
- Tech: Azure, C#, .NET, TypeScript, AI/ML
- Values: Innovation, diversity, growth mindset, customer success
- Culture: Collaborative, inclusive, cloud-first
- Keywords: enterprise scale, cloud transformation, AI integration
` : ''}

${context.companyName === 'Apple' ? `
APPLE-SPECIFIC OPTIMIZATION:
- Tech: Swift, Objective-C, iOS/macOS, Metal, Core ML
- Values: Excellence, simplicity, privacy, innovation
- Culture: Design-driven, user experience focus, perfectionism
- Keywords: user experience, privacy-first, elegant solutions
` : ''}

RESEARCH-BASED REWRITING:
✓ Use knowledge of typical ${context.jobTitle} requirements
✓ Incorporate technologies commonly used in this role
✓ Add skills that are universally valued for this position
✓ ${context.companyName ? `Apply ${context.companyName}'s cultural values and tech preferences` : 'Use industry standards'}
✓ Make educated assumptions about needed qualifications
✓ Include relevant trending technologies for this field

CONFIDENCE NOTE: These are knowledge-based suggestions (85-90% confidence).
For highest accuracy (95%), provide the full job description.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    } else {
      // MODE 3: No job context - General optimization
      optimizationMode = 'general';
      modeDescription = 'General resume enhancement';
      
      jobContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 MODE 3: GENERAL OPTIMIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Focus on creating strong, impactful content with:
✓ Powerful action verbs and active voice
✓ Quantifiable achievements with metrics
✓ Industry-standard professional keywords
✓ Clear, concise, achievement-focused language
✓ General ATS optimization best practices

TIP: For role-specific optimization, provide job title and company name!
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

${jobContext}

ORIGINAL TEXT TO REWRITE:
"""
${originalText}
"""

REWRITING REQUIREMENTS:
- Section: ${section}
- Tone: ${tone} (${toneDescriptions[tone]})
- Length: 2-4 powerful sentences
- Mode: ${optimizationMode.toUpperCase()}

Generate exactly 3 distinct, high-quality variations. Each must:
1. Use commanding action verbs (Led, Spearheaded, Architected, Transformed, Delivered, Achieved, Pioneered)
2. Include specific quantifiable achievements with numbers and percentages
3. ${optimizationMode === 'job-description' ? 'Naturally weave in missing keywords from job description' : 
     optimizationMode === 'ai-knowledge' ? `Incorporate skills/technologies typical for ${context?.jobTitle} at ${context?.companyName || 'this type of company'}` :
     'Use strong industry-standard keywords'}
4. Be concrete and specific (avoid generic statements)
5. Sound authentic and natural (not keyword-stuffed)
6. Maintain perfect ${tone} tone throughout
7. ${optimizationMode !== 'general' ? 'Maximize job relevance and ATS match score' : 'Maximize general impact'}

Return ONLY valid JSON (no markdown, no code blocks, no extra text):
{
  "suggestions": [
    {
      "id": "suggestion-1",
      "original": "${originalText.substring(0, 50)}...",
      "rewritten": "[Write comprehensive, impactful text here]",
      "improvements": [
        "Added quantifiable metrics (+40% specificity)",
        ${optimizationMode !== 'general' ? '"Incorporated [specific keyword] from requirements",' : '"Enhanced professional impact",'}
        "Used stronger action verbs",
        "Highlighted relevant technical expertise",
        "Optimized for ATS systems"
      ],
      "tone": "${tone}",
      "score": ${optimizationMode === 'job-description' ? 95 : optimizationMode === 'ai-knowledge' ? 91 : 87},
      ${optimizationMode !== 'general' ? `"keywordsAdded": ["keyword1", "keyword2", "keyword3"],` : ''}
      ${optimizationMode !== 'general' ? `"atsOptimizations": [
        ${optimizationMode === 'job-description' 
          ? '"Incorporated missing keyword from job posting"' 
          : `"Added typical ${context?.jobTitle} requirements"`},
        "Enhanced technical depth with role-specific terms",
        "Aligned language with industry expectations"
      ],` : ''}
      "confidenceScore": ${optimizationMode === 'job-description' ? 95 : optimizationMode === 'ai-knowledge' ? 88 : 85},
      "optimizationMode": "${optimizationMode}"
    },
    {
      "id": "suggestion-2",
      "rewritten": "[Second variation - different angle, equal quality]",
      "improvements": ["Variation 2 improvements"],
      "tone": "${tone}",
      "score": ${optimizationMode === 'job-description' ? 93 : optimizationMode === 'ai-knowledge' ? 89 : 85},
      ${optimizationMode !== 'general' ? `"keywordsAdded": ["keyword4", "keyword5"],` : ''}
      ${optimizationMode !== 'general' ? `"atsOptimizations": ["Different approach"],` : ''}
      "confidenceScore": ${optimizationMode === 'job-description' ? 93 : optimizationMode === 'ai-knowledge' ? 86 : 83},
      "optimizationMode": "${optimizationMode}"
    },
    {
      "id": "suggestion-3",
      "rewritten": "[Third variation - unique perspective]",
      "improvements": ["Variation 3 improvements"],
      "tone": "${tone}",
      "score": ${optimizationMode === 'job-description' ? 91 : optimizationMode === 'ai-knowledge' ? 87 : 83},
      ${optimizationMode !== 'general' ? `"keywordsAdded": ["keyword6"],` : ''}
      ${optimizationMode !== 'general' ? `"atsOptimizations": ["Third approach"],` : ''}
      "confidenceScore": ${optimizationMode === 'job-description' ? 91 : optimizationMode === 'ai-knowledge' ? 84 : 81},
      "optimizationMode": "${optimizationMode}"
    }
  ]
}

Return the JSON object now.`;

    console.log('   🎯 Optimization Mode:', optimizationMode.toUpperCase());
    console.log('   📝 Mode Description:', modeDescription);
    console.log('   🤖 Using Gemini 2.5 Flash');
    console.log('   Calling Gemini AI...');
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean response - remove any markdown
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    }
    
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('   ❌ No JSON found in response');
      console.error('   Response preview:', responseText.substring(0, 300));
      throw new Error('Failed to extract JSON from AI response');
    }

    let parsed: RewriteResponse;
    try {
      parsed = JSON.parse(jsonMatch[0]) as RewriteResponse;
    } catch (e) {
      console.error('   ❌ JSON parse error:', e);
      console.error('   JSON preview:', jsonMatch[0].substring(0, 200));
      throw new Error('Invalid JSON format in AI response');
    }

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      console.error('   ❌ Invalid suggestions structure');
      throw new Error('AI response missing suggestions array');
    }

    const validSuggestions = parsed.suggestions.filter((s: Suggestion) => 
      s.id && s.rewritten && s.improvements && typeof s.score === 'number'
    );

    if (validSuggestions.length === 0) {
      console.error('   ❌ No valid suggestions after filtering');
      throw new Error('No valid suggestions generated - please try again');
    }

    console.log('   ✅ Rewrite complete!');
    console.log('   Valid suggestions:', validSuggestions.length);
    console.log('   Average score:', Math.round(validSuggestions.reduce((sum: number, s: Suggestion) => sum + s.score, 0) / validSuggestions.length));
    console.log('   Keywords added:', validSuggestions[0].keywordsAdded?.length || 0);

    return NextResponse.json({
      success: true,
      suggestions: validSuggestions,
      optimizationMode,
      modeDescription,
      aiKnowledgeUsed: optimizationMode === 'ai-knowledge',
      jobDescriptionUsed: optimizationMode === 'job-description',
      confidenceLevel: optimizationMode === 'job-description' ? 'highest' : 
                       optimizationMode === 'ai-knowledge' ? 'high' : 'medium',
    });

  } catch (error) {
    console.error('❌ Rewrite error:', error);
    const err = error as Error;
    console.error('   Type:', err.constructor.name);
    console.error('   Message:', err.message);
    
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