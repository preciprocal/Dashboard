// app/api/resume/rewrite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resumeId, userId, section, originalText, tone, context } = body;

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

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001'
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

${context.missingKeywords?.length > 0 ? `
🔑 CRITICAL MISSING KEYWORDS (Must incorporate naturally):
${context.missingKeywords.slice(0, 12).join(', ')}
` : ''}

${context.missingSkills?.length > 0 ? `
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
- Tone: ${tone} (${toneDescriptions[tone as keyof typeof toneDescriptions]})
- Length: 2-4 powerful sentences
- Mode: ${optimizationMode.toUpperCase()}

Generate exactly 3 distinct, high-quality variations. Each must:
1. Use commanding action verbs (Led, Spearheaded, Architected, Transformed, Delivered, Achieved, Pioneered)
2. Include specific quantifiable achievements with numbers and percentages
3. ${optimizationMode === 'job-description' ? 'Naturally weave in missing keywords from job description' : 
     optimizationMode === 'ai-knowledge' ? `Incorporate skills/technologies typical for ${context.jobTitle} at ${context.companyName || 'this type of company'}` :
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
          : `"Added typical ${context.jobTitle} requirements"`},
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

CRITICAL INSTRUCTIONS - READ CAREFULLY:

${optimizationMode === 'job-description' ? `
🎯 JOB DESCRIPTION MODE - PRECISION TARGETING:
You have the COMPLETE job description. This is the highest accuracy mode.

MUST DO:
- Read job description carefully and extract key requirements
- Identify which missing keywords naturally fit this ${section} section
- Don't force keywords - only add what makes sense contextually
- Use exact phrases from job posting where appropriate
- Prioritize critical missing skills over nice-to-have ones
- Make every word count toward job alignment
- Ensure natural flow - no keyword stuffing

EXAMPLE:
If missing keyword is "Kubernetes" and section is "experience":
✓ GOOD: "Led deployment of microservices on Kubernetes, reducing..."
✗ BAD: "Used Kubernetes" (too forced, no context)
` : ''}

${optimizationMode === 'ai-knowledge' ? `
🔬 AI KNOWLEDGE MODE - INTELLIGENT INFERENCE:
You don't have job description, but you know about "${context.jobTitle}"${context.companyName ? ` at ${context.companyName}` : ''}.

USE YOUR KNOWLEDGE TO:
1. Identify typical requirements for ${context.jobTitle} positions
2. Understand common tech stacks used in this role
3. ${context.companyName ? `Know ${context.companyName}'s technologies, culture, and values` : 'Apply industry standards'}
4. Recognize trending skills in this field (2024-2025)
5. Understand seniority expectations from job title
6. Incorporate universally important skills for this role

COMPANY KNOWLEDGE TO APPLY:
${context.companyName === 'Google' ? '- Google tech: Go, Python, Kubernetes, GCP, BigQuery, TensorFlow\n- Google values: Scale (billions), innovation, technical depth\n- Keywords: distributed systems, large-scale, ML/AI, infrastructure' : ''}
${context.companyName === 'Amazon' ? '- Amazon tech: AWS, Java, Python, DynamoDB, microservices\n- Amazon values: Customer obsession, ownership, high standards\n- Keywords: customer impact, scalability, ownership, operational excellence' : ''}
${context.companyName === 'Meta' || context.companyName === 'Facebook' ? '- Meta tech: React, Python, GraphQL, PyTorch, Hack\n- Meta values: Move fast, be bold, build social value\n- Keywords: social impact, billions of users, real-time systems' : ''}
${context.companyName === 'Microsoft' ? '- Microsoft tech: Azure, C#, .NET, TypeScript, AI services\n- Microsoft values: Growth mindset, innovation, inclusivity\n- Keywords: cloud transformation, enterprise, AI/ML integration' : ''}
${context.companyName === 'Netflix' ? '- Netflix tech: Java, Python, Node.js, AWS, Kafka\n- Netflix values: Freedom & responsibility, context not control\n- Keywords: streaming, personalization, A/B testing, microservices' : ''}
${!context.companyName ? '- Use general industry standards for ' + context.jobTitle : ''}

INTELLIGENT ASSUMPTIONS:
- For "Senior" roles: Add leadership, mentoring, architecture
- For "Principal/Staff": Add strategy, influence, system design
- For "Backend": Add scalability, APIs, databases, performance
- For "Frontend": Add UX, React/Vue, performance, accessibility
- For "Full Stack": Balance both with end-to-end ownership
- For "DevOps/SRE": Add CI/CD, monitoring, infrastructure, reliability
- For "Data": Add ML/AI, big data, analytics, visualization

MAKE IT AUTHENTIC:
Don't just list keywords - demonstrate experience with them through achievements.
` : ''}

${optimizationMode === 'general' ? `
📝 GENERAL MODE - PROFESSIONAL POLISH:
No job-specific information available. Focus on maximum impact.

ENHANCE WITH:
- Strongest possible action verbs
- Impressive quantifiable metrics
- Professional polish and clarity
- Industry-standard best practices
- General ATS optimization

TIP FOR USER: Provide job title and company for role-specific optimization!
` : ''}

RETURN FORMAT - PURE JSON ONLY:
No markdown code blocks, no explanations, just the JSON object.`;

    console.log('   🎯 Optimization Mode:', optimizationMode.toUpperCase());
    console.log('   📝 Mode Description:', modeDescription);
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

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('   ❌ JSON parse error:', e);
      console.error('   JSON preview:', jsonMatch[0].substring(0, 200));
      throw new Error('Invalid JSON format in AI response');
    }

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      console.error('   ❌ Invalid suggestions structure');
      throw new Error('AI response missing suggestions array');
    }

    const validSuggestions = parsed.suggestions.filter((s: any) => 
      s.id && s.rewritten && s.improvements && typeof s.score === 'number'
    );

    if (validSuggestions.length === 0) {
      console.error('   ❌ No valid suggestions after filtering');
      throw new Error('No valid suggestions generated - please try again');
    }

    console.log('   ✅ Rewrite complete!');
    console.log('   Valid suggestions:', validSuggestions.length);
    console.log('   Average score:', Math.round(validSuggestions.reduce((sum: number, s: any) => sum + s.score, 0) / validSuggestions.length));
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

  } catch (error: any) {
    console.error('❌ Rewrite error:', error);
    console.error('   Type:', error.constructor.name);
    console.error('   Message:', error.message);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate suggestions',
        errorType: error.constructor.name,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        } : undefined
      },
      { status: 500 }
    );
  }
}