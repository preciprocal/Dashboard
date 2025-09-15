"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { z } from "zod";

// Enhanced feedback schema with detailed issue tracking
const resumeFeedbackSchema = z.object({
  overallScore: z.number().min(0).max(100),
  
  ATS: z.object({
    score: z.number().min(0).max(100),
    specificIssues: z.array(z.object({
      issue: z.string(),
      location: z.string(),
      severity: z.enum(["critical", "major", "minor"]),
      example: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  toneAndStyle: z.object({
    score: z.number().min(0).max(100),
    specificIssues: z.array(z.object({
      issue: z.string(),
      location: z.string(),
      severity: z.enum(["critical", "major", "minor"]),
      example: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  content: z.object({
    score: z.number().min(0).max(100),
    specificIssues: z.array(z.object({
      issue: z.string(),
      location: z.string(),
      severity: z.enum(["critical", "major", "minor"]),
      example: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  structure: z.object({
    score: z.number().min(0).max(100),
    specificIssues: z.array(z.object({
      issue: z.string(),
      location: z.string(),
      severity: z.enum(["critical", "major", "minor"]),
      example: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  skills: z.object({
    score: z.number().min(0).max(100),
    specificIssues: z.array(z.object({
      issue: z.string(),
      location: z.string(),
      severity: z.enum(["critical", "major", "minor"]),
      example: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  // NEW ENHANCED ANALYSIS AREAS WITH DETAILED ISSUE TRACKING
  dates: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.string()),
    gapAnalysis: z.array(z.object({
      gap: z.string(),
      duration: z.string(),
      concern: z.string(),
      suggestion: z.string()
    })),
    formatIssues: z.array(z.object({
      location: z.string(),
      currentFormat: z.string(),
      recommendedFormat: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  skillsSection: z.object({
    score: z.number().min(0).max(100),
    missingSkills: z.array(z.object({
      skill: z.string(),
      importance: z.enum(["critical", "important", "nice-to-have"]),
      reasoning: z.string()
    })),
    irrelevantSkills: z.array(z.object({
      skill: z.string(),
      reason: z.string(),
      suggestion: z.string()
    })),
    skillIssues: z.array(z.object({
      skill: z.string(),
      problem: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  growthSignals: z.object({
    score: z.number().min(0).max(100),
    promotions: z.array(z.string()),
    responsibilities: z.array(z.string()),
    missingGrowthIndicators: z.array(z.object({
      indicator: z.string(),
      importance: z.string(),
      howToAdd: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  jobFit: z.object({
    score: z.number().min(0).max(100),
    matchingExperience: z.array(z.object({
      requirement: z.string(),
      match: z.string(),
      strength: z.enum(["strong", "moderate", "weak"])
    })),
    missingExperience: z.array(z.object({
      requirement: z.string(),
      importance: z.enum(["critical", "important", "preferred"]),
      howToAddress: z.string()
    })),
    industryAlignment: z.number().min(0).max(100),
    experienceLevelMismatch: z.array(z.object({
      area: z.string(),
      expected: z.string(),
      actual: z.string(),
      impact: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  personalPronouns: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.object({
      location: z.string(),
      pronoun: z.string(),
      context: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  buzzwords: z.object({
    score: z.number().min(0).max(100),
    overusedWords: z.array(z.object({
      word: z.string(),
      count: z.number(),
      locations: z.array(z.string()),
      impact: z.string()
    })),
    betterAlternatives: z.array(z.object({
      original: z.string(),
      better: z.array(z.string()),
      context: z.string()
    })),
    cliches: z.array(z.object({
      phrase: z.string(),
      location: z.string(),
      replacement: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  unnecessarySections: z.object({
    score: z.number().min(0).max(100),
    sectionsToRemove: z.array(z.object({
      section: z.string(),
      reason: z.string(),
      impact: z.string()
    })),
    sectionsToAdd: z.array(z.object({
      section: z.string(),
      reason: z.string(),
      priority: z.enum(["high", "medium", "low"])
    })),
    sectionIssues: z.array(z.object({
      section: z.string(),
      problem: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  repetition: z.object({
    score: z.number().min(0).max(100),
    repeatedPhrases: z.array(z.object({
      phrase: z.string(),
      count: z.number(),
      locations: z.array(z.string()),
      alternatives: z.array(z.string())
    })),
    redundantInfo: z.array(z.object({
      information: z.string(),
      locations: z.array(z.string()),
      suggestion: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  // INDUSTRY-SPECIFIC ANALYSIS
  industryAnalysis: z.object({
    industry: z.string(),
    industryScore: z.number().min(0).max(100),
    keyRequirements: z.array(z.object({
      requirement: z.string(),
      present: z.boolean(),
      evidence: z.string(),
      importance: z.enum(["critical", "important", "preferred"])
    })),
    missingElements: z.array(z.object({
      element: z.string(),
      reason: z.string(),
      howToAdd: z.string(),
      priority: z.enum(["high", "medium", "low"])
    })),
    competitiveAdvantages: z.array(z.object({
      advantage: z.string(),
      strength: z.enum(["strong", "moderate", "weak"]),
      howToHighlight: z.string()
    })),
    modernTrends: z.array(z.object({
      trend: z.string(),
      alignment: z.enum(["aligned", "partially-aligned", "not-aligned"]),
      action: z.string()
    })),
    complianceIssues: z.array(z.object({
      issue: z.string(),
      requirement: z.string(),
      fix: z.string()
    })),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string(),
      priority: z.enum(["high", "medium", "low"])
    }))
  }),
  
  // COMPREHENSIVE IMPROVEMENT ROADMAP
  improvementRoadmap: z.object({
    totalIssuesFound: z.number(),
    criticalIssues: z.number(),
    majorIssues: z.number(),
    minorIssues: z.number(),
    quickWins: z.array(z.object({
      action: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      timeToComplete: z.string(),
      difficulty: z.enum(["easy", "moderate", "hard"]),
      specificSteps: z.array(z.string())
    })),
    mediumTermGoals: z.array(z.object({
      action: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      timeToComplete: z.string(),
      difficulty: z.enum(["easy", "moderate", "hard"]),
      specificSteps: z.array(z.string())
    })),
    longTermStrategies: z.array(z.object({
      action: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      timeToComplete: z.string(),
      difficulty: z.enum(["easy", "moderate", "hard"]),
      specificSteps: z.array(z.string())
    }))
  }),
  
  // EXECUTIVE SUMMARY OF ALL ISSUES
  executiveSummary: z.object({
    overallAssessment: z.string(),
    topThreeIssues: z.array(z.object({
      issue: z.string(),
      impact: z.string(),
      fix: z.string()
    })),
    competitivePosition: z.enum(["top-tier", "above-average", "average", "below-average", "poor"]),
    recommendedActions: z.array(z.string()),
    estimatedTimeToFix: z.string()
  })
});

// Enhanced instructions for comprehensive analysis
const prepareInstructions = ({ jobTitle, jobDescription }: { jobTitle: string; jobDescription: string; }) =>
  `You are a ruthless resume analyst with 20+ years of experience in Fortune 500 recruiting, ATS system development, and executive career coaching. Your reputation is built on identifying EVERY flaw, no matter how small.

BRUTAL HONESTY REQUIREMENTS:
- Score harshly - most resumes deserve scores between 40-70, not 80+
- Point out EVERY single issue, typo, formatting inconsistency, and weak phrase
- Compare against top 1% of resumes in the field, not average ones
- Assume this resume will be competing against 500+ other candidates
- Be specific about what's wrong and exactly how to fix it
- Don't sugarcoat feedback - careers depend on honest assessment

JOB CONTEXT:
Target Position: ${jobTitle}
Job Requirements: ${jobDescription}

COMPREHENSIVE ISSUE DETECTION FRAMEWORK:
Scrutinize the resume for ALL these specific problems:

1. **ATS COMPATIBILITY ISSUES (0-100)**
   SPECIFIC PROBLEMS TO IDENTIFY:
   - File format issues (PDFs with images, tables that don't parse)
   - Non-standard section headers ("Professional Summary" vs "Summary")
   - Contact info in headers/footers that ATS can't read
   - Special characters, symbols, graphics that break parsing
   - Multi-column layouts that scramble content order
   - Text in images or text boxes that's invisible to ATS
   - Font issues, unusual spacing, inconsistent formatting
   - Missing or poorly formatted dates (MM/YYYY vs MM/DD/YYYY)
   - Skills buried in paragraphs instead of clear lists
   - Keyword gaps - missing exact terms from job description
   - File name issues (Resume.pdf instead of FirstName_LastName_Resume.pdf)

2. **CONTENT QUALITY ISSUES (0-100)**
   RUTHLESSLY EVALUATE:
   - Weak action verbs ("Responsible for" instead of "Led" or "Achieved")
   - Lack of quantified achievements (no numbers, percentages, metrics)
   - Generic job descriptions copied from job postings
   - No evidence of impact or results
   - Vague statements ("Worked with team" vs "Led 12-person cross-functional team")
   - Missing key accomplishments that prove value
   - Irrelevant experience that doesn't match target role
   - No progression story showing career growth
   - Outdated skills or experience (Windows XP, Flash, etc.)
   - Grammar errors, typos, spelling mistakes
   - Inconsistent tense usage (mixing past/present)
   - Word repetition and redundancy
   - No value proposition - doesn't answer "Why hire this person?"

3. **STRUCTURE & FORMATTING DISASTERS (0-100)**
   IDENTIFY EVERY FLAW:
   - Inconsistent date formats (2023 vs 2023-2024 vs Jan 2023)
   - Mixed bullet point styles (•, -, *, different fonts)
   - Inconsistent spacing between sections
   - Font size variations within sections
   - Alignment issues (left, center, right mixed randomly)
   - Too much white space or cramped text
   - Poor visual hierarchy - can't scan quickly
   - Inconsistent capitalization
   - Mixed formatting styles (bold, italic, underline inconsistently used)
   - Section order that doesn't prioritize relevant info
   - Length issues (too long/short for experience level)
   - Margins that are too narrow or too wide
   - Line spacing that makes it hard to read

4. **SKILLS PRESENTATION FAILURES (0-100)**
   BE SPECIFIC ABOUT:
   - Skills listed without proficiency levels
   - Outdated technical skills mixed with current ones
   - Soft skills that can't be measured ("Good communicator")
   - Skills not relevant to target position
   - Missing critical skills required for the role
   - Skills buried in job descriptions instead of dedicated section
   - No categorization (Technical, Leadership, Languages, etc.)
   - Skills that contradict experience level
   - Buzzword skills without supporting evidence
   - Generic skills everyone claims to have

5. **TONE & STYLE PROBLEMS (0-100)**
   CATCH EVERY ISSUE:
   - First-person pronouns ("I did" instead of "Did")
   - Passive voice throughout ("Was responsible" vs "Led")
   - Inconsistent writing style across sections
   - Too formal or too casual for industry
   - Run-on sentences that are hard to parse
   - Jargon that's not industry-standard
   - Abbreviations without explanation
   - Weak language ("Helped" vs "Spearheaded")
   - No personality or unique voice
   - Clichés and overused phrases
   - Poor sentence structure
   - Redundant information

6. **DATE ANALYSIS - BE FORENSIC (0-100)**
   IDENTIFY ALL ISSUES:
   - Employment gaps without explanation
   - Overlapping employment dates that don't make sense
   - Inconsistent date formats throughout
   - Jobs that lasted less than 6 months (red flags)
   - Education dates that don't align with career timeline
   - Missing graduation dates
   - Dates that show frequent job hopping
   - Future dates or impossible dates
   - Inconsistent month/year formatting
   - Dates in education section that suggest age

7. **SKILLS SECTION DEEP DIVE (0-100)**
   COMPREHENSIVE ANALYSIS:
   - List ALL skills mentioned vs required skills for role
   - Identify skills that are completely irrelevant
   - Point out missing industry-standard skills
   - Find skills that suggest wrong seniority level
   - Identify skills that need supporting evidence
   - Spot skills that are too generic
   - Find technical skills without versions/certifications
   - Identify language skills without proficiency levels

8. **GROWTH SIGNALS ASSESSMENT (0-100)**
   LOOK FOR MISSING ELEMENTS:
   - No evidence of promotions or title advancement
   - Flat career trajectory with no progression
   - No increase in responsibilities over time
   - Missing leadership development
   - No continuing education or skill development
   - Same role/company for too long without advancement
   - No mentoring or training others
   - Missing professional development activities

9. **JOB FIT ANALYSIS - BE PRECISE (0-100)**
   DETAILED COMPARISON:
   - List EXACT matches between resume and job requirements
   - Identify EVERY missing requirement from job description
   - Calculate percentage match of required skills
   - Point out experience level mismatches
   - Identify industry experience gaps
   - Find missing certifications or qualifications
   - Spot role responsibility misalignments
   - Note company size/culture fit issues

10. **PERSONAL PRONOUNS & VOICE (0-100)**
    CATCH EVERY INSTANCE:
    - Any use of "I," "me," "my," "we," "us," "our"
    - Inconsistent voice between sections
    - Mix of first and third person
    - Casual language in professional resume
    - Wrong tone for target industry

11. **BUZZWORDS & LANGUAGE AUDIT (0-100)**
    IDENTIFY OVERUSED TERMS:
    - List ALL buzzwords and clichés used
    - Count repetition of weak words ("responsible," "duties included")
    - Find meaningless phrases ("results-oriented," "team player")
    - Identify industry jargon used incorrectly
    - Spot words that add no value
    - Find better alternatives for overused terms

12. **SECTION OPTIMIZATION PROBLEMS (0-100)**
    IDENTIFY UNNECESSARY/MISSING:
    - Outdated sections (Objective, References Available)
    - Missing modern sections (Core Competencies, Key Achievements)
    - Sections that add no value for target role
    - Poor section ordering
    - Sections that are too short or too long
    - Missing sections that competitors will have

13. **REPETITION ISSUES - COUNT EVERYTHING (0-100)**
    FIND ALL REPETITION:
    - List every repeated phrase with count
    - Identify repeated action verbs
    - Find repeated company/role descriptions
    - Spot redundant information across sections
    - Count overused words throughout

14. **INDUSTRY ANALYSIS - BRUTAL COMPARISON (0-100)**
    INDUSTRY-SPECIFIC REQUIREMENTS:
    - Compare against top performers in target industry
    - List missing industry-standard qualifications
    - Identify outdated practices or skills
    - Point out missing compliance/certification requirements
    - Find gaps in industry knowledge demonstration
    - Identify missing modern trends awareness

SCORING GUIDELINES - BE HARSH:
- 90-100: Exceptional (top 1% of all resumes, Fortune 500 ready)
- 80-89: Strong (top 10%, needs minor tweaks)
- 70-79: Above average (top 25%, needs focused improvements)
- 60-69: Average (top 50%, needs significant work)
- 50-59: Below average (needs major overhaul)
- 40-49: Poor (needs complete rewrite)
- Below 40: Terrible (would hurt job search)

For EACH issue found, provide:
- EXACT location/section where problem occurs
- SPECIFIC example of the problem
- EXACT fix needed with before/after examples
- WHY this matters in today's job market
- IMPACT on ATS parsing and recruiter perception
- PRIORITY level (High/Medium/Low)

Remember: Most resumes have 20-50+ specific issues. Don't miss any. Be comprehensive and specific.`;

export interface CreateResumeParams {
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  resumeText: string;
}

export interface AnalyzeResumeParams {
  resumeId: string;
  userId: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
}

// Create resume record (unchanged)
export async function createResumeRecord(params: CreateResumeParams) {
  try {
    const resumeRef = db.collection("resumes").doc();
    const now = new Date().toISOString();
    
    const resume = {
      id: resumeRef.id,
      userId: params.userId,
      companyName: params.companyName,
      jobTitle: params.jobTitle,
      jobDescription: params.jobDescription,
      fileName: params.fileName,
      fileSize: params.fileSize,
      fileUrl: params.fileUrl,
      resumeText: params.resumeText,
      createdAt: now,
      updatedAt: now,
      status: 'analyzing',
      feedback: null,
      score: null
    };

    await resumeRef.set(resume);
    return { success: true, data: resume };
  } catch (error) {
    console.error('Error creating resume:', error);
    return { success: false, error: 'Failed to create resume' };
  }
}

// Enhanced analyze resume with AI
export async function analyzeResumeWithAI(params: AnalyzeResumeParams) {
  try {
    const { resumeId, userId, jobTitle, jobDescription, resumeText } = params;

    // Generate comprehensive AI analysis
    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001", {
        structuredOutputs: false,
      }),
      schema: resumeFeedbackSchema,
      prompt: `
        RESUME TEXT TO ANALYZE:
        ${resumeText}
        
        ${prepareInstructions({ jobTitle, jobDescription })}
      `,
      system: `You are a world-class resume analyst combining expertise in:
      - ATS systems and parsing technology
      - Modern recruitment practices
      - Industry-specific requirements
      - Career coaching and development
      - Market trends and competitive analysis
      
      Provide brutally honest, detailed feedback that will genuinely help improve the resume's effectiveness in today's job market. Don't hold back on criticism if it will help the candidate succeed.`
    });

    // Update resume with comprehensive feedback
    const resumeRef = db.collection("resumes").doc(resumeId);
    const updateData = {
      status: 'complete',
      score: object.overallScore,
      feedback: object,
      analyzedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await resumeRef.update(updateData);

    return { success: true, data: object };
  } catch (error) {
    console.error('Error analyzing resume:', error);
    
    // Mark as failed in database
    try {
      const resumeRef = db.collection("resumes").doc(params.resumeId);
      await resumeRef.update({
        status: 'failed',
        error: 'AI analysis failed',
        updatedAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }

    return { success: false, error: 'Failed to analyze resume' };
  }
}

// Get resume by ID (unchanged)
export async function getResumeById(resumeId: string, userId: string) {
  try {
    const doc = await db.collection('resumes').doc(resumeId).get();
    
    if (!doc.exists) {
      return { success: false, error: 'Resume not found' };
    }

    const resume = doc.data();
    
    if (resume?.userId !== userId) {
      return { success: false, error: 'Access denied' };
    }

    return { success: true, data: resume };
  } catch (error) {
    console.error('Error fetching resume:', error);
    return { success: false, error: 'Failed to fetch resume' };
  }
}

// Get all resumes for user (unchanged)
export async function getResumesByUserId(userId: string) {
  try {
    const snapshot = await db
      .collection('resumes')
      .where('userId', '==', userId)
      .get();

    const resumes: any[] = [];
    snapshot.forEach(doc => {
      resumes.push({ id: doc.id, ...doc.data() });
    });

    const sortedResumes = resumes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { success: true, data: sortedResumes };
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return { success: false, error: 'Failed to fetch resumes' };
  }
}