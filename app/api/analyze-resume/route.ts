// app/api/analyze-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  hashResumeContent,
  getCachedResumeAnalysis,
  cacheResumeAnalysis,
  getCachedResumeText,
  cacheResumeText,
  getCachedResumeFixes,
  cacheResumeFixes,
  type ResumeFeedback,
  type ResumeFix
} from "@/lib/redis/resume-cache";
import { checkAndIncrementUsage, type UserTier } from "@/lib/redis/usage-tracker";

// Define the feedback schema matching AI response format
const resumeFeedbackSchema = z.object({
  overallScore: z.number().min(0).max(100),
  ATS: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string().optional()
    }))
  }),
  toneAndStyle: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string().optional()
    }))
  }),
  content: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string().optional()
    }))
  }),
  structure: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string().optional()
    }))
  }),
  skills: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string().optional()
    }))
  })
});

// Define schema for resume fixes
const resumeFixSchema = z.object({
  fixes: z.array(z.object({
    id: z.string(),
    category: z.string(),
    issue: z.string(),
    originalText: z.string(),
    improvedText: z.string(),
    explanation: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    impact: z.string(),
    location: z.string().optional()
  }))
});

// Type for usage info
interface UsageInfo {
  allowed: boolean;
  remaining: number;
  limit: number;
  current: number;
}

// Define request interfaces
interface GenerateFixesRequest {
  action: 'generateFixes';
  resumeContent: string;
  jobDescription?: string;
  feedback?: z.infer<typeof resumeFeedbackSchema>;
  userId?: string;
  userTier?: UserTier;
}

interface RegenerateFixRequest {
  action: 'regenerateFix';
  originalFix: {
    id: string;
    category: string;
    issue: string;
    originalText: string;
    improvedText: string;
    explanation: string;
    priority: string;
    impact: string;
  };
  resumeContent: string;
  userId?: string;
  userTier?: UserTier;
}

// NEW: Extension job-based analysis request
interface ExtensionJobAnalysisRequest {
  action: 'analyzeForJob';
  jobData: {
    title: string;
    company: string;
    description: string;
    location?: string;
    salary?: string;
    jobType?: string;
    url?: string;
    platform?: string;
  };
  userId?: string;
  userTier?: UserTier;
}

type RequestData = GenerateFixesRequest | RegenerateFixRequest | ExtensionJobAnalysisRequest;

export async function GET() {
  const envTest = {
    hasGoogleAI: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    hasRedis: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    keyLength: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length || 0,
    keyPreview: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 
      process.env.GOOGLE_GENERATIVE_AI_API_KEY.substring(0, 20) + '...' : 'NOT_FOUND',
    nodeEnv: process.env.NODE_ENV
  };

  return NextResponse.json({ 
    message: 'AI Resume Analysis API with Gemini Resume Fixer + Redis Caching + Extension Support',
    timestamp: new Date().toISOString(),
    status: 'ok',
    model: 'gemini-2.5-flash',
    framework: 'ai-sdk',
    features: ['analysis', 'text-extraction', 'fixes', 'regeneration', 'redis-caching', 'usage-tracking', 'extension-job-analysis'],
    caching: envTest.hasRedis ? 'enabled' : 'disabled',
    environment: envTest
  });
}

export async function POST(request: NextRequest) {
  console.log('🚀 Starting AI resume processing...');

  try {
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('multipart/form-data')) {
      // Resume analysis request with file upload
      return await handleResumeAnalysis(request);
    } else {
      // Resume fixes generation, regeneration, or extension job analysis request
      const requestData = await request.json() as RequestData;
      
      if (requestData.action === 'generateFixes') {
        return await handleGenerateResumeFixes(requestData);
      } else if (requestData.action === 'regenerateFix') {
        return await handleRegenerateSpecificFix(requestData);
      } else if (requestData.action === 'analyzeForJob') {
        return await handleExtensionJobAnalysis(requestData);
      } else {
        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
      }
    }

  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// NEW: Handle extension job-based analysis
async function handleExtensionJobAnalysis(requestData: ExtensionJobAnalysisRequest) {
  const { jobData, userId = 'anonymous', userTier = 'free' } = requestData;

  console.log('🎯 Extension job analysis request:', {
    jobTitle: jobData.title,
    company: jobData.company,
    userId,
    userTier
  });

  if (!jobData || !jobData.title || !jobData.description) {
    return NextResponse.json({ error: 'Invalid job data provided' }, { status: 400 });
  }

  // Check usage limits
  const usageCheck = await checkAndIncrementUsage(userId, 'resume-analysis', userTier);
  
  if (!usageCheck.allowed) {
    return NextResponse.json({
      error: 'Usage limit reached',
      message: `You've used all ${usageCheck.limit} analyses for this month. Upgrade to Pro for unlimited analyses.`,
      usage: {
        current: usageCheck.current,
        limit: usageCheck.limit,
        remaining: usageCheck.remaining
      }
    }, { status: 429 });
  }

  // TODO: Fetch user's resume from Firebase/Firestore
  // For now, we'll return a placeholder response
  // You need to implement: const userResume = await getUserResume(userId);

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const mockAnalysis = createJobSpecificMockAnalysis(jobData);
    return NextResponse.json({
      atsScore: mockAnalysis.atsScore,
      suggestions: mockAnalysis.suggestions,
      keywordMatch: mockAnalysis.keywordMatch,
      missingSkills: mockAnalysis.missingSkills,
      usage: usageCheck,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'mock-job-analysis',
        type: 'extension-analysis',
        note: 'Add GOOGLE_GENERATIVE_AI_API_KEY for real AI analysis'
      }
    });
  }

  try {
    console.log('🤖 Analyzing resume against job posting with Gemini...');

    // TODO: Replace with actual user resume content
    const userResumeContent = "User resume content would go here"; // await getUserResume(userId);

    const analysisPrompt = `
You are an expert ATS (Applicant Tracking System) analyzer and resume optimizer.

JOB POSTING INFORMATION:
Title: ${jobData.title}
Company: ${jobData.company}
Location: ${jobData.location || 'Not specified'}
Job Type: ${jobData.jobType || 'Not specified'}
Salary: ${jobData.salary || 'Not specified'}

JOB DESCRIPTION:
${jobData.description}

USER'S RESUME:
${userResumeContent}

Please analyze the resume against this specific job posting and provide:
1. An ATS compatibility score (0-100) for THIS specific job
2. Keyword match percentage
3. Specific suggestions for improvement to match the job requirements
4. Missing skills or keywords that should be added
5. Sections that need strengthening

Respond in JSON format:
{
  "atsScore": number (0-100),
  "keywordMatch": number (0-100),
  "suggestions": [
    "specific actionable suggestion 1",
    "specific actionable suggestion 2",
    ...
  ],
  "missingSkills": ["skill1", "skill2", ...],
  "strengthenSections": ["section1", "section2", ...]
}`;

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.2
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const analysisData = JSON.parse(jsonMatch[0]);

    console.log('✅ Job-specific analysis completed');

    return NextResponse.json({
      atsScore: analysisData.atsScore,
      keywordMatch: analysisData.keywordMatch,
      suggestions: analysisData.suggestions,
      missingSkills: analysisData.missingSkills || [],
      strengthenSections: analysisData.strengthenSections || [],
      usage: usageCheck,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        type: 'extension-job-analysis',
        jobTitle: jobData.title,
        company: jobData.company
      }
    });

  } catch (error) {
    console.error('❌ Extension job analysis failed:', error);
    
    const fallbackAnalysis = createJobSpecificMockAnalysis(jobData);
    return NextResponse.json({
      atsScore: fallbackAnalysis.atsScore,
      suggestions: fallbackAnalysis.suggestions,
      keywordMatch: fallbackAnalysis.keywordMatch,
      missingSkills: fallbackAnalysis.missingSkills,
      usage: usageCheck,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'fallback-job-analysis',
        type: 'ai-error-recovery',
        note: 'AI service issue - fallback analysis provided'
      }
    });
  }
}

async function handleResumeAnalysis(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobTitle = (formData.get('jobTitle') as string) || '';
    const jobDescription = (formData.get('jobDescription') as string) || '';
    const userId = (formData.get('userId') as string) || 'anonymous';
    const userTier = (formData.get('userTier') as string || 'free') as UserTier;

    console.log('📋 Analysis request received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size ? `${(file.size / 1024).toFixed(1)}KB` : 'unknown',
      jobTitle: jobTitle || 'Not specified',
      jobDescLength: jobDescription?.length || 0,
      userId,
      userTier
    });

    if (!file) {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'File must be an image format (PNG, JPEG, WebP)' 
      }, { status: 400 });
    }

    // Check usage limits (only for free tier)
    const usageCheck = await checkAndIncrementUsage(userId, 'resume-analysis', userTier);
    
    if (!usageCheck.allowed) {
      return NextResponse.json({
        error: 'Usage limit reached',
        message: `You've used all ${usageCheck.limit} resume analyses for this month. Upgrade to Pro for unlimited analyses.`,
        usage: {
          current: usageCheck.current,
          limit: usageCheck.limit,
          remaining: usageCheck.remaining
        }
      }, { status: 429 });
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Generate hash for caching (from base64 content)
    const contentHash = hashResumeContent(base64);
    console.log('🔑 Content hash:', contentHash);

    // Check cache first
    const cachedAnalysis = await getCachedResumeAnalysis(contentHash);
    const cachedText = await getCachedResumeText(contentHash);

    if (cachedAnalysis && cachedText) {
      console.log('⚡ Returning cached analysis (0ms vs ~3000ms)');
      return NextResponse.json({
        feedback: cachedAnalysis,
        extractedText: cachedText,
        resumeText: cachedText,
        usage: {
          current: usageCheck.current,
          limit: usageCheck.limit,
          remaining: usageCheck.remaining
        },
        meta: {
          timestamp: new Date().toISOString(),
          model: 'gemini-2.5-flash',
          version: '6.0-redis-cached',
          type: 'cached-analysis',
          cached: true,
          cacheHit: true,
          textLength: cachedText.length
        }
      });
    }

    // Perform fresh analysis with caching
    return await performResumeAnalysisWithTextExtraction(
      dataUrl,
      jobTitle,
      jobDescription,
      contentHash,
      usageCheck
    );

  } catch (error) {
    console.error('❌ Resume analysis error:', error);
    return NextResponse.json({
      error: 'Failed to process resume',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function performResumeAnalysisWithTextExtraction(
  dataUrl: string,
  jobTitle: string,
  jobDescription: string,
  contentHash: string,
  usageInfo: UsageInfo
) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log('⚠️ No API key found - using enhanced mock analysis with text');
    
    const mockFeedback = createDetailedMockAnalysis(jobTitle, jobDescription);
    const mockText = generateMockExtractedText();
    
    return NextResponse.json({ 
      feedback: mockFeedback,
      extractedText: mockText,
      resumeText: mockText,
      usage: usageInfo,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'professional-comprehensive-mock-with-text',
        version: '5.0',
        type: 'detailed-professional-with-text',
        note: 'Add GOOGLE_GENERATIVE_AI_API_KEY to enable real AI analysis'
      }
    });
  }

  try {
    console.log('🤖 Extracting comprehensive resume data with Gemini...');

    const textExtractionPrompt = `
Extract ALL text from this resume image with MAXIMUM accuracy and detail.

CRITICAL INSTRUCTIONS:
1. Capture EVERY word, number, date, email, phone number, URL exactly as shown
2. Preserve ALL section headers (Education, Experience, Skills, Projects, etc.)
3. Include ALL job titles, company names, dates, locations
4. Extract ALL bullet points and descriptions completely
5. Capture ALL technical skills, tools, frameworks, languages
6. Include ALL education details (degrees, universities, GPAs, dates)
7. Extract ALL project names, descriptions, and technologies used
8. Maintain original structure and hierarchy
9. Include contact information (name, email, phone, LinkedIn, GitHub, etc.)
10. Preserve all formatting cues (bullets, dates, locations)

OUTPUT FORMAT:
Return the text maintaining clear structure with:
- Section headers on their own lines
- Job/education entries with company/school, title/degree, location, dates
- Bullet points clearly marked
- Skills grouped together
- All content verbatim from the image

Return ONLY the extracted text with complete accuracy.
    `;

    const textResponse = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: textExtractionPrompt },
            { type: "image", image: dataUrl }
          ]
        }
      ],
      maxTokens: 4096,
      temperature: 0.1
    });

    const extractedText = textResponse.text.trim();
    console.log('📝 Text extracted successfully. Length:', extractedText.length);

    // Cache extracted text immediately
    await cacheResumeText(contentHash, extractedText);

    if (extractedText.length < 100) {
      console.warn('⚠️ Extracted text seems too short, may be incomplete');
    }

    const analysisPrompt = `
Analyze this resume comprehensively as an expert recruiter and career coach.

COMPLETE RESUME TEXT:
${extractedText}

TARGET POSITION CONTEXT:
${jobTitle ? `Target Role: ${jobTitle}` : 'General professional position'}
${jobDescription ? `Job Requirements:\n${jobDescription}` : 'Standard professional requirements'}

COMPREHENSIVE EVALUATION FRAMEWORK:

1. ATS COMPATIBILITY (0-100):
Examine formatting, keywords, structure for ATS parsing success.

2. CONTENT QUALITY (0-100):
Evaluate achievements, metrics, relevance, and impact.

3. STRUCTURE (0-100):
Assess layout, consistency, visual hierarchy, and readability.

4. SKILLS (0-100):
Review keyword optimization, organization, and relevance.

5. TONE & STYLE (0-100):
Analyze language, grammar, and professional communication.

FEEDBACK REQUIREMENTS:
- Provide exactly 4-5 actionable tips per category
- Be specific with concrete examples where possible
- Be honest and realistic with scoring
- Focus on high-impact improvements

Generate comprehensive, professional feedback that helps improve interview chances.
    `;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: resumeFeedbackSchema,
      system: "You are Sarah Chen, a senior resume analyst with 15+ years of recruiting experience at top tech companies. Provide detailed, actionable feedback with honest scoring based on real industry standards.",
      messages: [
        {
          role: "user", 
          content: [
            { type: "text", text: analysisPrompt },
            { type: "image", image: dataUrl }
          ]
        }
      ],
      temperature: 0.3
    });

    const processedObject = processAnalysisObject(object);
    
    const feedbackWithText: ResumeFeedback = {
      ...processedObject,
      resumeText: extractedText
    };

    // Cache the analysis result
    await cacheResumeAnalysis(contentHash, feedbackWithText);
    
    console.log('✅ Analysis completed successfully with Redis caching');
    
    return NextResponse.json({ 
      feedback: feedbackWithText,
      extractedText: extractedText,
      resumeText: extractedText,
      usage: usageInfo,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        version: '7.0-redis-optimized',
        type: 'expert-ai-analysis-cached',
        textExtracted: true,
        textLength: extractedText.length,
        hasJobContext: !!(jobTitle || jobDescription),
        extractionQuality: extractedText.length >= 500 ? 'excellent' : 
                          extractedText.length >= 200 ? 'good' : 'needs_review',
        cached: false,
        cacheHit: false
      }
    });

  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    
    const fallbackAnalysis = createDetailedMockAnalysis(jobTitle, jobDescription);
    const mockText = generateMockExtractedText();
    
    const fallbackWithText: ResumeFeedback = {
      ...fallbackAnalysis,
      resumeText: mockText
    };
    
    return NextResponse.json({ 
      feedback: fallbackWithText,
      extractedText: mockText,
      resumeText: mockText,
      usage: usageInfo,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'professional-fallback-enhanced',
        type: 'ai-error-recovery',
        note: 'AI service issue - professional analysis with text provided',
        textExtracted: true,
        textLength: mockText.length,
        fallback: true
      }
    });
  }
}

async function handleGenerateResumeFixes(requestData: GenerateFixesRequest) {
  const { resumeContent, jobDescription, feedback, userId = 'anonymous', userTier = 'free' } = requestData;

  console.log('🔧 Fix generation request from user:', userId, 'tier:', userTier);

  if (!resumeContent) {
    return NextResponse.json({
      error: 'Resume content is required for fix generation',
      details: {
        hasApiKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        hasResumeContent: false,
        solution: 'Re-upload resume to extract text content'
      }
    }, { status: 400 });
  }

  // Generate hash for caching
  const contentHash = hashResumeContent(resumeContent + (jobDescription || ''));
  console.log('🔑 Fixes hash:', contentHash);

  // Check cache first
  const cachedFixes = await getCachedResumeFixes(contentHash);
  if (cachedFixes) {
    console.log('⚡ Returning cached fixes');
    return NextResponse.json({
      fixes: cachedFixes,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        type: 'cached-fixes',
        cached: true,
        count: cachedFixes.length
      }
    });
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const mockFixes = generateMockFixes(resumeContent);
    return NextResponse.json({
      fixes: mockFixes,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'mock-fixes-with-content',
        type: 'mock-dynamic-fixes',
        note: 'Add GOOGLE_GENERATIVE_AI_API_KEY for real AI analysis'
      }
    });
  }

  try {
    console.log('🔧 Generating specific resume fixes with Gemini...');

    const fixPrompt = `
You are an expert resume improvement specialist. Analyze this ACTUAL resume content and provide specific, actionable fixes.

ACTUAL RESUME CONTENT:
${resumeContent}

${jobDescription ? `TARGET JOB DESCRIPTION:\n${jobDescription}\n` : ''}

${feedback ? `CURRENT ANALYSIS SCORES:
- Overall Score: ${feedback.overallScore}/100
- ATS Compatibility: ${feedback.ATS?.score}/100  
- Content Quality: ${feedback.content?.score}/100
- Skills Optimization: ${feedback.skills?.score}/100
- Structure & Format: ${feedback.structure?.score}/100
- Tone & Style: ${feedback.toneAndStyle?.score}/100
` : ''}

Provide 10-15 specific, actionable fixes with exact text from the resume.
    `;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: resumeFixSchema,
      messages: [{ role: "user", content: fixPrompt }]
    });

    const validatedFixes: ResumeFix[] = object.fixes
      .filter(fix => fix.id && fix.category && fix.issue && fix.originalText && fix.improvedText)
      .map((fix, index) => ({
        ...fix,
        id: fix.id || `ai-fix-${index + 1}`,
        priority: fix.priority || 'medium',
        impact: fix.impact || 'Improves resume quality and appeal',
        explanation: fix.explanation || 'AI-recommended improvement for better results'
      }));

    // Cache the fixes
    await cacheResumeFixes(contentHash, validatedFixes);

    console.log(`✅ Generated ${validatedFixes.length} validated fixes and cached`);

    return NextResponse.json({
      fixes: validatedFixes,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        type: 'dynamic-ai-fixes',
        count: validatedFixes.length,
        contentAnalyzed: resumeContent.length,
        cached: false
      }
    });

  } catch (error) {
    console.error('❌ Fix generation failed:', error);
    
    const mockFixes = generateMockFixes(resumeContent);
    return NextResponse.json({
      fixes: mockFixes,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'mock-fixes-fallback',
        type: 'ai-error-recovery',
        count: mockFixes.length,
        note: 'AI service issue - mock fixes generated from content'
      }
    });
  }
}

async function handleRegenerateSpecificFix(requestData: RegenerateFixRequest) {
  const { originalFix, resumeContent, userId = 'anonymous', userTier = 'free' } = requestData;

  console.log('🔄 Regenerate fix request from user:', userId, 'tier:', userTier);

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({
      error: 'API key required for fix regeneration'
    }, { status: 400 });
  }

  try {
    console.log('🔄 Regenerating specific fix...');

    const regeneratePrompt = `
You are a resume expert. Create an alternative improvement for this specific issue:

ORIGINAL RESUME TEXT: "${originalFix.originalText}"
CURRENT SUGGESTION: "${originalFix.improvedText}"
ISSUE CATEGORY: ${originalFix.category}
PROBLEM: ${originalFix.issue}

RESUME CONTEXT (for reference):
${resumeContent.substring(0, 1000)}...

TASK: Provide a DIFFERENT but equally effective approach to fixing the same issue.

Return JSON format:
{
  "improvedText": "your alternative improvement text",
  "explanation": "why this alternative approach works effectively", 
  "impact": "expected outcome of this alternative approach"
}

Make it meaningfully different while solving the same underlying issue.
    `;

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      messages: [{ role: "user", content: regeneratePrompt }]
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in AI response');
    }

    const alternative = JSON.parse(jsonMatch[0]) as {
      improvedText: string;
      explanation: string;
      impact?: string;
    };
    
    console.log('✅ Fix regenerated with alternative approach');
    
    return NextResponse.json({
      alternative: {
        improvedText: alternative.improvedText,
        explanation: alternative.explanation,
        impact: alternative.impact || originalFix.impact
      },
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        type: 'fix-regeneration',
        originalCategory: originalFix.category
      }
    });

  } catch (error) {
    console.error('❌ Fix regeneration failed:', error);
    return NextResponse.json({
      error: 'Failed to regenerate fix',
      message: error instanceof Error ? error.message : 'Unknown error',
      type: 'regeneration-error'
    }, { status: 500 });
  }
}

function processAnalysisObject(object: z.infer<typeof resumeFeedbackSchema>): ResumeFeedback {
  const processedObject: ResumeFeedback = {
    overallScore: object.overallScore,
    toneAndStyle: {
      score: object.toneAndStyle.score,
      tips: object.toneAndStyle.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Professional analysis recommendation.`
      }))
    },
    content: {
      score: object.content.score,
      tips: object.content.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Content improvement suggestion.`
      }))
    },
    structure: {
      score: object.structure.score,
      tips: object.structure.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Structure enhancement recommendation.`
      }))
    },
    skills: {
      score: object.skills.score,
      tips: object.skills.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Skills optimization advice.`
      }))
    },
    ATS: {
      score: object.ATS.score,
      tips: object.ATS.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - ATS compatibility improvement.`
      }))
    }
  };

  const weights = { ATS: 0.25, content: 0.30, structure: 0.15, skills: 0.20, toneAndStyle: 0.10 };
  const weightedScore = 
    (processedObject.ATS.score * weights.ATS) +
    (processedObject.content.score * weights.content) +
    (processedObject.structure.score * weights.structure) +
    (processedObject.skills.score * weights.skills) +
    (processedObject.toneAndStyle.score * weights.toneAndStyle);
  
  processedObject.overallScore = Math.round(weightedScore);

  return processedObject;
}

// NEW: Create job-specific mock analysis for extension
function createJobSpecificMockAnalysis(jobData: ExtensionJobAnalysisRequest['jobData']) {
  return {
    atsScore: 72,
    keywordMatch: 65,
    suggestions: [
      `Add "${jobData.title}" specific keywords from the job description to improve ATS matching`,
      `Highlight experience relevant to ${jobData.company}'s industry and requirements`,
      `Include metrics and quantifiable achievements that match the job requirements`,
      `Optimize skills section to include technologies mentioned in the job posting`,
      `Tailor your summary/objective to align with ${jobData.company}'s mission`
    ],
    missingSkills: [
      'Extract from job description',
      'Technical skills mentioned in posting',
      'Soft skills emphasized by employer'
    ]
  };
}

function createDetailedMockAnalysis(jobTitle: string, jobDescription: string): ResumeFeedback {
  const hasJobContext = !!(jobTitle || jobDescription);
  
  return {
    overallScore: 74,
    ATS: {
      score: 78,
      tips: [
        {
          type: "good",
          tip: "Standard section headers used correctly",
          explanation: "Resume uses industry-standard headers like 'Experience', 'Education', 'Skills' that ATS systems easily recognize and parse."
        },
        {
          type: "improve",
          tip: "Add more keywords from job description",
          explanation: "Increase keyword density by incorporating exact terms from job postings. This improves ATS matching scores significantly."
        },
        {
          type: "improve", 
          tip: hasJobContext ? `Include ${jobTitle} specific terminology` : "Include more industry-specific terminology",
          explanation: hasJobContext ? 
            `Add technical terms and phrases specific to ${jobTitle} roles to improve relevance scoring in ATS systems.` :
            "Use industry-standard terminology and acronyms that hiring managers expect to see in your field."
        },
        {
          type: "good",
          tip: "Professional contact information format",
          explanation: "Contact details are clearly formatted and include essential information for recruiter outreach."
        },
        {
          type: "improve",
          tip: "Ensure consistent date formatting throughout",
          explanation: "Use uniform date format (e.g., 'Jan 2022 - Present' or 'January 2022 - Present') across all sections for better ATS parsing."
        }
      ]
    },
    toneAndStyle: {
      score: 72,
      tips: [
        {
          type: "good",
          tip: "Professional communication maintained",
          explanation: "Document demonstrates appropriate business language with executive-level presentation standards."
        },
        {
          type: "improve",
          tip: "Strengthen action verbs throughout experience",
          explanation: "Replace weak verbs with powerful action words like 'architected', 'spearheaded', 'optimized', 'delivered'."
        },
        {
          type: "improve",
          tip: "Eliminate filler words for maximum impact",
          explanation: "Remove unnecessary words to create concise, powerful statements."
        },
        {
          type: "improve",
          tip: "Ensure grammatical consistency",
          explanation: "Use past tense consistently for previous roles and present tense only for current position."
        }
      ]
    },
    content: {
      score: 69,
      tips: [
        {
          type: "good",
          tip: "Career progression demonstrated",
          explanation: "Work history shows logical professional advancement."
        },
        {
          type: "improve",
          tip: "Add quantifiable metrics to all achievements",
          explanation: "Include specific numbers: 'Improved system performance by 45%', 'Managed $3.8M budget'."
        },
        {
          type: "improve",
          tip: "Expand recent role with detailed project examples",
          explanation: "Most recent position needs 5-6 comprehensive bullets."
        },
        {
          type: "improve",
          tip: hasJobContext ? `Highlight ${jobTitle} specific experience` : "Emphasize relevant technical accomplishments",
          explanation: "Focus on experience most relevant to target role."
        },
        {
          type: "improve",
          tip: "Use STAR method for achievement descriptions",
          explanation: "Structure bullets using Situation-Task-Action-Result format."
        }
      ]
    },
    structure: {
      score: 84,
      tips: [
        {
          type: "good",
          tip: "Industry-standard section organization",
          explanation: "Resume follows optimal recruiter-friendly structure."
        },
        {
          type: "good",
          tip: "Consistent formatting patterns",
          explanation: "Dates and job titles maintain uniform formatting."
        },
        {
          type: "improve",
          tip: "Optimize white space distribution",
          explanation: "Adjust margins and spacing for optimal readability."
        },
        {
          type: "improve",
          tip: "Enhance visual hierarchy",
          explanation: "Use strategic typography for better scanning."
        }
      ]
    },
    skills: {
      score: 76,
      tips: [
        {
          type: "good",
          tip: "Comprehensive technical skills presented",
          explanation: "Skills section demonstrates broad technical knowledge."
        },
        {
          type: "improve",
          tip: "Organize skills into strategic categories",
          explanation: "Group as: 'Languages', 'Frameworks', 'Cloud' for better scanning."
        },
        {
          type: "improve",
          tip: hasJobContext ? "Align skills with job requirements" : "Prioritize most relevant skills",
          explanation: "Ensure key technologies appear prominently."
        },
        {
          type: "improve",
          tip: "Add proficiency context",
          explanation: "Include experience levels for credibility."
        },
        {
          type: "improve",
          tip: "Include certifications and training",
          explanation: "Add relevant certifications to strengthen credibility."
        }
      ]
    }
  };
}

function generateMockExtractedText(): string {
  return `NEERAJ KOLANER
Software Engineer | neeraj.k@gmail.com | (617) 555-0123
LinkedIn: linkedin.com/in/neerajkolaner | GitHub: github.com/neerajkolaner

EDUCATION
Northeastern University, Boston, MA
Bachelor of Science in Computer Science | Expected May 2024
GPA: 3.7/4.0

TECHNICAL SKILLS
Programming Languages: Java, Python, JavaScript, TypeScript, C++, SQL
Frameworks: React, Node.js, Express, Spring Boot, Django
Tools: Git, Docker, AWS, MongoDB, PostgreSQL, Redis

PROFESSIONAL EXPERIENCE
Software Engineering Intern | ABC Tech Solutions, Boston, MA | June 2023 - Present
- Developed full-stack web applications using React, Node.js, and PostgreSQL serving 10,000+ users
- Optimized database queries resulting in 30% performance improvement
- Built automated testing suite achieving 85% code coverage`;
}

function generateMockFixes(resumeContent: string): ResumeFix[] {
  const fixes: ResumeFix[] = [];
  
  if (resumeContent.toLowerCase().includes('responsible for')) {
    fixes.push({
      id: 'weak-verb-1',
      category: 'Content Enhancement',
      issue: 'Weak action verb reduces impact',
      originalText: 'responsible for managing software projects',
      improvedText: 'Led cross-functional teams, delivering 8 projects ahead of schedule',
      explanation: 'Strong action verbs demonstrate leadership',
      priority: 'high',
      impact: 'Increases perceived leadership capability'
    });
  }
  
  if (!resumeContent.includes('%')) {
    fixes.push({
      id: 'missing-metrics-1',
      category: 'Content Enhancement',
      issue: 'Missing quantifiable results',
      originalText: 'Improved database performance',
      improvedText: 'Optimized queries, reducing response times by 40%',
      explanation: 'Metrics demonstrate concrete value',
      priority: 'high',
      impact: 'Makes achievements more compelling'
    });
  }

  return fixes.length > 0 ? fixes : [{
    id: 'general-1',
    category: 'Content Enhancement',
    issue: 'Generic descriptions lack impact',
    originalText: 'Worked on various projects',
    improvedText: 'Led 5 projects resulting in 30% efficiency improvement',
    explanation: 'Specific outcomes demonstrate value',
    priority: 'high',
    impact: 'Increases resume impact'
  }];
}