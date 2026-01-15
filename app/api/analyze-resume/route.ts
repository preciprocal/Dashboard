// app/api/analyze-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

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

// Define request interfaces
interface GenerateFixesRequest {
  action: 'generateFixes';
  resumeContent: string;
  jobDescription?: string;
  feedback?: z.infer<typeof resumeFeedbackSchema>;
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
}

type RequestData = GenerateFixesRequest | RegenerateFixRequest;

export async function GET() {
  const envTest = {
    hasGoogleAI: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    keyLength: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.length || 0,
    keyPreview: process.env.GOOGLE_GENERATIVE_AI_API_KEY ? 
      process.env.GOOGLE_GENERATIVE_AI_API_KEY.substring(0, 20) + '...' : 'NOT_FOUND',
    nodeEnv: process.env.NODE_ENV
  };

  return NextResponse.json({ 
    message: 'AI Resume Analysis API with Gemini Resume Fixer',
    timestamp: new Date().toISOString(),
    status: 'ok',
    model: 'gemini-2.5-flash',
    framework: 'ai-sdk',
    features: ['analysis', 'text-extraction', 'fixes', 'regeneration'],
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
      // Resume fixes generation or regeneration request
      const requestData = await request.json() as RequestData;
      
      if (requestData.action === 'generateFixes') {
        return await handleGenerateResumeFixes(requestData);
      } else if (requestData.action === 'regenerateFix') {
        return await handleRegenerateSpecificFix(requestData);
      } else {
        return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
      }
    }

  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: (error as Error).message
    }, { status: 500 });
  }
}

async function handleResumeAnalysis(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobTitle = (formData.get('jobTitle') as string) || '';
    const jobDescription = (formData.get('jobDescription') as string) || '';

    console.log('📋 Analysis request received:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size ? `${(file.size / 1024).toFixed(1)}KB` : 'unknown',
      jobTitle: jobTitle || 'Not specified',
      jobDescLength: jobDescription?.length || 0
    });

    if (!file) {
      return NextResponse.json({ error: 'No resume file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: 'File must be an image format (PNG, JPEG, WebP)' 
      }, { status: 400 });
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    return await performResumeAnalysisWithTextExtraction(dataUrl, jobTitle, jobDescription);

  } catch (error) {
    console.error('❌ Resume analysis error:', error);
    return NextResponse.json({
      error: 'Failed to process resume',
      message: (error as Error).message
    }, { status: 500 });
  }
}

async function performResumeAnalysisWithTextExtraction(dataUrl: string, jobTitle: string, jobDescription: string) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.log('⚠️ No API key found - using enhanced mock analysis with text');
    
    const mockFeedback = createDetailedMockAnalysis(jobTitle, jobDescription);
    const mockText = generateMockExtractedText();
    
    return NextResponse.json({ 
      feedback: mockFeedback,
      extractedText: mockText,
      resumeText: mockText, // Add this for compatibility
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

    // ENHANCED: Extract complete text with better structure preservation
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

COMPLETENESS CHECK:
- Did you get the person's name?
- Did you get contact info (email, phone)?
- Did you get ALL job experiences with dates?
- Did you get ALL education entries?
- Did you get ALL technical skills?
- Did you get ALL projects?

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
      maxTokens: 4096, // Increase token limit for longer resumes
      temperature: 0.1 // Lower temperature for more accurate extraction
    });

    const extractedText = textResponse.text.trim();
    console.log('📝 Text extracted successfully. Length:', extractedText.length);
    console.log('📝 Preview:', extractedText.substring(0, 200) + '...');

    // Validate extraction quality
    if (extractedText.length < 100) {
      console.warn('⚠️ Extracted text seems too short, may be incomplete');
    }

    // Step 2: Analyze the resume using both image and extracted text
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
Check:
- Section headers (clear and standard?)
- Bullet formatting (consistent?)
- Date formatting (uniform?)
- Contact information (complete and correct?)
- Keyword placement (strategic and relevant?)
- File parsability (clean structure?)

2. CONTENT QUALITY (0-100):
Evaluate achievements, metrics, relevance, and impact.
Analyze:
- Action verbs (strong and varied?)
- Quantifiable results (specific numbers and percentages?)
- Technical depth (detailed and current?)
- Career progression (clear advancement?)
- Role alignment (matches target job?)
- Achievement statements (compelling?)

3. STRUCTURE (0-100):
Assess layout, consistency, visual hierarchy, and readability.
Review:
- Information flow (logical order?)
- Formatting consistency (uniform throughout?)
- White space (optimal balance?)
- Professional appearance (polished and clean?)
- Section organization (intuitive?)
- Length (appropriate for experience level?)

4. SKILLS (0-100):
Review keyword optimization, organization, and relevance.
Evaluate:
- Job matching (aligns with target role?)
- Skill categorization (well organized?)
- Technology currency (up-to-date tools?)
- Industry standards (includes expected skills?)
- Depth indicators (proficiency levels?)
- Completeness (comprehensive coverage?)

5. TONE & STYLE (0-100):
Analyze language, grammar, and professional communication.
Check:
- Consistency (uniform throughout?)
- Clarity (easy to understand?)
- Professional terminology (appropriate language?)
- Confidence (strong without arrogance?)
- Grammar (error-free?)
- Conciseness (no fluff?)

SCORING STANDARDS:
- 90-100: Exceptional, FAANG-ready, minimal improvements needed
- 80-89: Excellent, strong candidate, minor polish required
- 70-79: Good foundation, several improvements will enhance results
- 60-69: Average, significant work needed for competitive advantage
- 50-59: Below average, major overhaul required
- <50: Needs complete restructuring

FEEDBACK REQUIREMENTS:
- Provide exactly 4-5 actionable tips per category
- Be specific with concrete examples where possible
- Be honest and realistic with scoring
- Focus on high-impact improvements
- Consider the target role context
- Prioritize changes that matter most

Generate comprehensive, professional feedback that helps improve interview chances.
    `;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: resumeFeedbackSchema,
      system: "You are Sarah Chen, a senior resume analyst with 15+ years of recruiting experience at top tech companies like Google, Amazon, Microsoft, and Meta. You've reviewed over 50,000 resumes and know exactly what gets interviews. Provide detailed, actionable feedback with honest scoring based on real industry standards. Be thorough, professional, and genuinely helpful.",
      messages: [
        {
          role: "user", 
          content: [
            { type: "text", text: analysisPrompt },
            { type: "image", image: dataUrl }
          ]
        }
      ],
      temperature: 0.3 // Balanced for quality analysis
    });

    const processedObject = processAnalysisObject(object);
    
    // Store the extracted text in the feedback object for later use
    const feedbackWithText = {
      ...processedObject,
      resumeText: extractedText // Store for job recommendations
    };
    
    console.log('✅ Analysis completed successfully with comprehensive text extraction');
    
    return NextResponse.json({ 
      feedback: feedbackWithText,
      extractedText: extractedText,
      resumeText: extractedText, // Duplicate for compatibility
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        version: '6.0-enhanced-extraction',
        type: 'expert-ai-analysis-comprehensive',
        textExtracted: true,
        textLength: extractedText.length,
        hasJobContext: !!(jobTitle || jobDescription),
        extractionQuality: extractedText.length >= 500 ? 'excellent' : 
                          extractedText.length >= 200 ? 'good' : 'needs_review'
      }
    });

  } catch (error) {
    console.error('❌ AI analysis failed:', error);
    
    // Enhanced fallback with realistic extracted text
    const fallbackAnalysis = createDetailedMockAnalysis(jobTitle, jobDescription);
    const mockText = generateMockExtractedText();
    
    const fallbackWithText = {
      ...fallbackAnalysis,
      resumeText: mockText
    };
    
    return NextResponse.json({ 
      feedback: fallbackWithText,
      extractedText: mockText,
      resumeText: mockText,
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
  const { resumeContent, jobDescription, feedback } = requestData;

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

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    // Return mock fixes when no API key
    return NextResponse.json({
      fixes: generateMockFixes(resumeContent),
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

ANALYSIS INSTRUCTIONS:
1. Read the actual resume content carefully
2. Identify REAL issues that exist in this specific resume
3. Extract EXACT text snippets that need improvement
4. Provide specific, actionable replacement text
5. Focus on high-impact changes only
6. Prioritize based on current score deficiencies
7. Limit to 10-15 most critical fixes

IMPROVEMENT CATEGORIES:
- ATS Optimization: Keywords, formatting, parsing issues
- Content Enhancement: Weak verbs, missing metrics, generic descriptions
- Skills Optimization: Missing skills, outdated technologies, organization
- Format & Structure: Inconsistent formatting, layout issues
- Tone & Style: Grammar, professional language, clarity
- Contact Information: Email professionalism, missing profiles
- Employment History: Gaps, unclear timelines, weak descriptions

RESPONSE FORMAT:
Return a JSON object with a "fixes" array. Each fix must include:
- id: unique identifier (e.g., "ats-keywords-1")  
- category: one of the categories above
- issue: specific problem description
- originalText: exact text from the resume that needs fixing
- improvedText: your suggested replacement text
- explanation: why this improvement works
- priority: "high" (critical issues), "medium" (important), or "low" (nice to have)
- impact: expected outcome of implementing this fix
- location: where in resume this appears (optional)

CRITICAL REQUIREMENTS:
- Only suggest fixes for problems that actually exist in the provided resume
- Use exact text snippets from the resume as "originalText"
- Make "improvedText" specific and actionable
- Focus on changes that will meaningfully improve the resume
- Be honest about priority levels

Example fix:
{
  "id": "content-weak-verb-1",
  "category": "Content Enhancement", 
  "issue": "Weak action verb reduces impact",
  "originalText": "Was responsible for managing software projects",
  "improvedText": "Led cross-functional software development teams, delivering 8 projects ahead of schedule with 95% stakeholder satisfaction",
  "explanation": "Strong action verb 'Led' with quantifiable results demonstrates leadership and measurable impact",
  "priority": "high",
  "impact": "Increases perceived leadership capability and project management expertise",
  "location": "Professional Experience section"
}

Analyze the resume content and provide 10-15 of the most impactful fixes.
    `;

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: resumeFixSchema,
      messages: [{ role: "user", content: fixPrompt }]
    });

    // Validate and enhance the generated fixes
    const validatedFixes = object.fixes
      .filter(fix => fix.id && fix.category && fix.issue && fix.originalText && fix.improvedText)
      .map((fix, index) => ({
        ...fix,
        id: fix.id || `ai-fix-${index + 1}`,
        priority: fix.priority || 'medium',
        impact: fix.impact || 'Improves resume quality and appeal',
        explanation: fix.explanation || 'AI-recommended improvement for better results'
      }));

    console.log(`✅ Generated ${validatedFixes.length} validated fixes`);

    return NextResponse.json({
      fixes: validatedFixes,
      meta: {
        timestamp: new Date().toISOString(),
        model: 'gemini-2.5-flash',
        type: 'dynamic-ai-fixes',
        count: validatedFixes.length,
        contentAnalyzed: resumeContent.length
      }
    });

  } catch (error) {
    console.error('❌ Fix generation failed:', error);
    
    // Fallback to mock fixes with content
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
  const { originalFix, resumeContent } = requestData;

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

REQUIREMENTS:
- Address the same core problem
- Use different phrasing/approach than current suggestion
- Maintain the same level of improvement impact
- Be specific and actionable
- Consider alternative angles or emphasis

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

    // Extract JSON from response
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
      message: (error as Error).message,
      type: 'regeneration-error'
    }, { status: 500 });
  }
}

function processAnalysisObject(object: z.infer<typeof resumeFeedbackSchema>) {
  // Ensure all tips have explanations where expected
  const processedObject = {
    ...object,
    toneAndStyle: {
      ...object.toneAndStyle,
      tips: object.toneAndStyle.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Professional analysis recommendation.`
      }))
    },
    content: {
      ...object.content,
      tips: object.content.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Content improvement suggestion.`
      }))
    },
    structure: {
      ...object.structure,
      tips: object.structure.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Structure enhancement recommendation.`
      }))
    },
    skills: {
      ...object.skills,
      tips: object.skills.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - Skills optimization advice.`
      }))
    },
    ATS: {
      ...object.ATS,
      tips: object.ATS.tips.map((tip) => ({
        ...tip,
        explanation: tip.explanation || `${tip.tip} - ATS compatibility improvement.`
      }))
    }
  };

  // Calculate overall score as weighted average
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

function createDetailedMockAnalysis(jobTitle: string, jobDescription: string) {
  const hasJobContext = !!(jobTitle || jobDescription);
  
  return {
    overallScore: 74,
    ATS: {
      score: 78,
      tips: [
        {
          type: "good" as const,
          tip: "Standard section headers used correctly",
          explanation: "Resume uses industry-standard headers like 'Experience', 'Education', 'Skills' that ATS systems easily recognize and parse."
        },
        {
          type: "improve" as const,
          tip: "Add more keywords from job description",
          explanation: "Increase keyword density by incorporating exact terms from job postings. This improves ATS matching scores significantly."
        },
        {
          type: "improve" as const, 
          tip: hasJobContext ? `Include ${jobTitle} specific terminology` : "Include more industry-specific terminology",
          explanation: hasJobContext ? 
            `Add technical terms and phrases specific to ${jobTitle} roles to improve relevance scoring in ATS systems.` :
            "Use industry-standard terminology and acronyms that hiring managers expect to see in your field."
        },
        {
          type: "good" as const,
          tip: "Professional contact information format",
          explanation: "Contact details are clearly formatted and include essential information for recruiter outreach."
        },
        {
          type: "improve" as const,
          tip: "Ensure consistent date formatting throughout",
          explanation: "Use uniform date format (e.g., 'Jan 2022 - Present' or 'January 2022 - Present') across all sections for better ATS parsing."
        }
      ]
    },
    toneAndStyle: {
      score: 72,
      tips: [
        {
          type: "good" as const,
          tip: "Professional communication maintained",
          explanation: "Document demonstrates appropriate business language with executive-level presentation standards suitable for corporate environments."
        },
        {
          type: "improve" as const,
          tip: "Strengthen action verbs throughout experience",
          explanation: "Replace weak verbs like 'responsible for', 'helped with', 'worked on' with powerful action words like 'architected', 'spearheaded', 'optimized', 'delivered'."
        },
        {
          type: "improve" as const,
          tip: "Eliminate filler words for maximum impact",
          explanation: "Remove unnecessary words like 'the', 'a', 'an', 'various', 'multiple' to create concise, powerful statements that maximize impact per word."
        },
        {
          type: "improve" as const,
          tip: "Ensure grammatical consistency",
          explanation: "Use past tense consistently for previous roles and present tense only for current position. Maintain parallel structure across all bullet points."
        }
      ]
    },
    content: {
      score: 69,
      tips: [
        {
          type: "good" as const,
          tip: "Career progression demonstrated",
          explanation: "Work history shows logical professional advancement with increasing responsibility levels and expanding technical expertise."
        },
        {
          type: "improve" as const,
          tip: "Add quantifiable metrics to all achievements",
          explanation: "Include specific numbers: 'Improved system performance by 45%', 'Managed $3.8M budget', 'Led team of 15 engineers', 'Reduced processing time by 60%'."
        },
        {
          type: "improve" as const,
          tip: "Expand recent role with detailed project examples",
          explanation: "Most recent position needs 5-6 comprehensive bullets showcasing major initiatives, technologies used, and measurable business outcomes."
        },
        {
          type: "improve" as const,
          tip: hasJobContext ? `Highlight ${jobTitle} specific experience` : "Emphasize relevant technical accomplishments",
          explanation: hasJobContext ? 
            `Focus on experience directly relevant to ${jobTitle} role requirements and technologies mentioned in the job description.` :
            "Emphasize technical projects, leadership experience, and achievements most relevant to your target industry."
        },
        {
          type: "improve" as const,
          tip: "Use STAR method for achievement descriptions",
          explanation: "Structure bullets using Situation-Task-Action-Result format to demonstrate problem-solving and quantifiable impact."
        }
      ]
    },
    structure: {
      score: 84,
      tips: [
        {
          type: "good" as const,
          tip: "Industry-standard section organization",
          explanation: "Resume follows optimal recruiter-friendly structure with logical information flow designed for both human scanning and ATS parsing."
        },
        {
          type: "good" as const,
          tip: "Consistent formatting patterns",
          explanation: "Dates, job titles, and company information maintain uniform formatting that creates professional appearance."
        },
        {
          type: "improve" as const,
          tip: "Optimize white space distribution",
          explanation: "Adjust margins to 0.75 inches, use 1.15 line spacing, and ensure consistent section spacing for optimal readability."
        },
        {
          type: "improve" as const,
          tip: "Enhance visual hierarchy",
          explanation: "Use strategic typography: 12pt bold for headers, 11pt bold for job titles, regular weight for descriptions."
        }
      ]
    },
    skills: {
      score: 76,
      tips: [
        {
          type: "good" as const,
          tip: "Comprehensive technical skills presented",
          explanation: "Skills section demonstrates broad technical knowledge with current, industry-relevant technologies."
        },
        {
          type: "improve" as const,
          tip: "Organize skills into strategic categories",
          explanation: "Group as: 'Languages: Python, JavaScript', 'Frameworks: React, Node.js', 'Cloud: AWS, Docker' for better scanning."
        },
        {
          type: "improve" as const,
          tip: hasJobContext ? "Align skills with job requirements" : "Prioritize most relevant skills",
          explanation: hasJobContext ?
            `Ensure all technologies mentioned in the ${jobTitle} job description appear prominently in your skills section.` :
            "Move most critical skills to the top of each category and remove outdated technologies."
        },
        {
          type: "improve" as const,
          tip: "Add proficiency context",
          explanation: "Include experience levels: 'Python (Expert, 5+ years)', 'React (Advanced, 3+ years)' for credibility."
        },
        {
          type: "improve" as const,
          tip: "Include certifications and training",
          explanation: "Add relevant certifications like AWS Certified, PMP, or industry-specific credentials to strengthen technical credibility."
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
Relevant Coursework: Data Structures, Algorithms, Database Systems, Software Engineering, Web Development
GPA: 3.7/4.0

Sardar Patel Institute of Technology, Mumbai, India
Bachelor of Engineering in Computer Engineering | July 2024

TECHNICAL SKILLS

Programming Languages: Java, Python, JavaScript, TypeScript, C++, SQL, HTML5, CSS3
Frameworks & Libraries: React, Node.js, Express, Spring Boot, Django, Flask, Next.js
Tools & Technologies: Git, Docker, Kubernetes, AWS, MongoDB, PostgreSQL, MySQL, Redis
Development Practices: RESTful APIs, Microservices Architecture, Agile Development, CI/CD, Test-Driven Development

PROFESSIONAL EXPERIENCE

Software Engineering Intern | ABC Tech Solutions, Boston, MA | June 2023 - Present
- Developed and maintained full-stack web applications using React, Node.js, and PostgreSQL serving 10,000+ users
- Collaborated with cross-functional teams of 8 members to deliver 5 major features ahead of schedule
- Implemented RESTful APIs for data processing and user management handling 50,000+ requests daily
- Optimized database queries resulting in 30% performance improvement and reduced server costs by $5,000/month
- Participated in code reviews and maintained 95% code quality standards across the development team
- Built automated testing suite achieving 85% code coverage and reducing bug reports by 40%

Logistics & Operations Assistant | XYZ Development Services, Boston, MA | Feb 2023 - June 2023
- Managed inventory tracking systems and coordinated supply chain operations for 15+ active construction projects
- Developed automated reporting tools using Python reducing manual data entry time by 60%
- Analyzed operational data trends and provided insights that improved process efficiency by 25%
- Supported project management activities ensuring on-time delivery of materials for projects worth $2M+
- Created Excel dashboards for real-time inventory monitoring used by 12 team members daily

PROJECTS

E-commerce Web Application | Personal Project | Mar 2023 - May 2023
- Built comprehensive full-stack e-commerce platform using MERN stack (MongoDB, Express, React, Node.js)
- Implemented user authentication with JWT, payment processing with Stripe, and real-time inventory management
- Deployed on AWS EC2 with CI/CD pipeline using GitHub Actions achieving 99.9% uptime
- Developed responsive design supporting mobile, tablet, and desktop with 500+ product listings
- Integrated email notifications and order tracking system for enhanced user experience

Task Management System | University Project | Jan 2023 - Mar 2023
- Designed and developed collaborative task management application for team coordination
- Used React frontend with Node.js backend and PostgreSQL database supporting 100+ concurrent users
- Implemented real-time updates using WebSocket technology for instant task synchronization
- Led team of 4 developers using Agile methodologies with 2-week sprint cycles
- Achieved 95% project completion rate and received A+ grade for technical implementation

Machine Learning Model Deployment | Academic Project | Sep 2022 - Dec 2022
- Built and deployed predictive machine learning model using Python, TensorFlow, and scikit-learn
- Processed dataset of 50,000+ records achieving 92% accuracy in classification tasks
- Created Flask REST API for model serving with Docker containerization
- Implemented data preprocessing pipeline reducing inference time by 40%

CERTIFICATIONS & ACHIEVEMENTS

- AWS Certified Cloud Practitioner (In Progress - Expected Feb 2024)
- Dean's List recognition for academic excellence (Fall 2022, Spring 2023)
- Hackathon Winner - "Best Technical Innovation" at TechFest 2023
- Active member of Northeastern Computer Science Student Association
- Volunteer tutor for introductory programming courses (CS1210, CS2500)

ADDITIONAL INFORMATION

Languages: English (Fluent), Hindi (Native), Marathi (Conversational)
Interests: Open source contribution, Technical blogging, Competitive programming
Portfolio: neerajkolaner.dev`;
}

interface MockFix {
  id: string;
  category: string;
  issue: string;
  originalText: string;
  improvedText: string;
  explanation: string;
  priority: string;
  impact: string;
  location?: string;
}

function generateMockFixes(resumeContent: string): MockFix[] {
  // Generate realistic mock fixes based on the content
  const fixes: MockFix[] = [];
  
  if (resumeContent.toLowerCase().includes('responsible for')) {
    fixes.push({
      id: 'weak-verb-1',
      category: 'Content Enhancement',
      issue: 'Weak action verb reduces impact of achievements',
      originalText: 'responsible for managing software projects',
      improvedText: 'Led cross-functional software development teams, delivering 8 projects ahead of schedule with 95% stakeholder satisfaction',
      explanation: 'Strong action verbs like "Led" demonstrate leadership and proactive ownership rather than passive responsibility',
      priority: 'high',
      impact: 'Increases perceived leadership capability by 60%',
      location: 'Professional Experience section'
    });
  }
  
  if (!resumeContent.includes('%') || resumeContent.split('%').length < 3) {
    fixes.push({
      id: 'missing-metrics-1',
      category: 'Content Enhancement',
      issue: 'Missing quantifiable results and business impact',
      originalText: 'Improved database performance',
      improvedText: 'Optimized database queries, reducing response times by 40% and improving user satisfaction by 25%',
      explanation: 'Specific metrics demonstrate concrete value and measurable impact on business outcomes',
      priority: 'high',
      impact: 'Makes achievements 3x more compelling to recruiters'
    });
  }

  if (resumeContent.includes('@hotmail') || resumeContent.includes('@yahoo')) {
    fixes.push({
      id: 'email-professional-1',
      category: 'Contact Information',
      issue: 'Unprofessional email address may hurt first impression',
      originalText: resumeContent.match(/\S+@(hotmail|yahoo)\S+/)?.[0] || 'unprofessional email',
      improvedText: 'firstname.lastname@gmail.com',
      explanation: 'Professional email addresses using your name create better first impressions with hiring managers',
      priority: 'medium',
      impact: 'Prevents automatic filtering by recruiters'
    });
  }

  if (resumeContent.toLowerCase().includes('worked on')) {
    fixes.push({
      id: 'weak-verb-2',
      category: 'Content Enhancement',
      issue: 'Passive language weakens achievement presentation',
      originalText: 'Worked on web development projects',
      improvedText: 'Architected and deployed 5 responsive web applications serving 10,000+ users with 99.9% uptime',
      explanation: 'Specific achievements with metrics replace vague descriptions, demonstrating clear value delivery',
      priority: 'high',
      impact: 'Transforms generic statement into compelling accomplishment'
    });
  }

  // Add default fixes if none were generated
  if (fixes.length === 0) {
    fixes.push({
      id: 'general-improvement-1',
      category: 'Content Enhancement',
      issue: 'Generic descriptions lack specific impact',
      originalText: 'Worked on various projects',
      improvedText: 'Led development of 5 high-priority projects, resulting in 30% efficiency improvement and $50K cost savings',
      explanation: 'Specific numbers and outcomes demonstrate tangible value and measurable contributions',
      priority: 'high',
      impact: 'Increases resume impact and memorability'
    });
    
    fixes.push({
      id: 'skill-organization-1',
      category: 'Skills Optimization',
      issue: 'Skills not optimally organized for ATS',
      originalText: 'Skills: Python, JavaScript, React, AWS, SQL',
      improvedText: 'Technical Skills: Languages: Python, JavaScript, SQL | Frameworks: React, Node.js | Cloud: AWS, Docker',
      explanation: 'Categorized skills improve ATS parsing and make it easier for recruiters to quickly identify relevant expertise',
      priority: 'medium',
      impact: 'Improves ATS compatibility score by 15-20%'
    });
  }

  return fixes.slice(0, 8); // Limit mock fixes
}