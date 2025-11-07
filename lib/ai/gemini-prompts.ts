// lib/ai/gemini-prompts.ts

/**
 * Build comprehensive analysis prompt
 */
export function buildAnalysisPrompt(
  resumeText: string,
  options: {
    jobTitle?: string;
    jobDescription?: string;
    companyName?: string;
    analysisType?: string;
  }
): string {
  return `
You are an expert resume analyst, ATS specialist, and career coach with 15+ years of experience helping candidates land top-tier positions.

# RESUME TO ANALYZE
${resumeText}

${options.jobDescription ? `\n# TARGET JOB DESCRIPTION\n${options.jobDescription}\n` : ''}
${options.jobTitle ? `\n# TARGET ROLE: ${options.jobTitle}\n` : ''}
${options.companyName ? `\n# TARGET COMPANY: ${options.companyName}\n` : ''}

# YOUR TASK
Provide a comprehensive, brutally honest analysis of this resume. Your feedback should be:
- Actionable and specific
- Based on ATS best practices and recruiter insights
- Focused on measurable improvements

# ANALYSIS FRAMEWORK

Evaluate the resume across these dimensions (each scored 0-100):

## 1. ATS COMPATIBILITY (Weight: 30%)
- Format readability by ATS systems
- Standard section headers
- Keyword optimization
- No graphics/tables/columns
- File format compatibility

## 2. CONTENT QUALITY (Weight: 25%)
- Achievement-focused bullet points
- Quantifiable results with metrics
- Relevant experience for target role
- Skill demonstration with context
- Career progression clarity

## 3. STRUCTURE & FORMAT (Weight: 15%)
- Logical information hierarchy
- Consistent formatting
- Appropriate length (1-2 pages)
- White space and readability
- Professional design

## 4. SKILLS & KEYWORDS (Weight: 15%)
- Relevant technical skills
- Industry-specific terminology
- Soft skills demonstration
- Certification listings
- Tool/technology proficiency

## 5. IMPACT & METRICS (Weight: 10%)
- Quantified achievements (%, $, time)
- Action verb usage
- Results-oriented language
- Business impact clarity
- ROI demonstration

## 6. GRAMMAR & STYLE (Weight: 5%)
- Professional tone
- Error-free text
- Concise language
- Consistent tense
- Active voice usage

# OUTPUT FORMAT

Return ONLY valid JSON (no markdown, no explanations outside JSON):

{
  "overallScore": <number 0-100>,
  
  "ats": {
    "score": <number>,
    "tips": [
      {
        "type": "good" | "warning" | "critical",
        "message": "...",
        "explanation": "...",
        "priority": "high" | "medium" | "low",
        "fix": "..."
      }
    ],
    "issues": [
      {
        "severity": "critical" | "major" | "minor",
        "description": "...",
        "location": "...",
        "fix": "..."
      }
    ],
    "metrics": {
      "formatScore": <number>,
      "keywordDensity": <number>,
      "readabilityScore": <number>
    }
  },
  
  "content": {
    "score": <number>,
    "tips": [...],
    "issues": [...],
    "metrics": {
      "quantifiableAchievements": <number>,
      "actionVerbs": <number>,
      "averageBulletLength": <number>
    }
  },
  
  "structure": {
    "score": <number>,
    "tips": [...],
    "metrics": {
      "sections": <number>,
      "length": <number>,
      "consistency": <number>
    }
  },
  
  "skills": {
    "score": <number>,
    "tips": [...],
    "matchedSkills": ["..."],
    "missingSkills": ["..."],
    "skillGaps": [
      {
        "skill": "...",
        "importance": "critical" | "important" | "nice-to-have",
        "recommendation": "..."
      }
    ]
  },
  
  "impact": {
    "score": <number>,
    "tips": [...],
    "metrics": {
      "metricsCount": <number>,
      "impactScore": <number>
    }
  },
  
  "grammar": {
    "score": <number>,
    "tips": [...],
    "issues": [
      {
        "error": "...",
        "location": "...",
        "correction": "..."
      }
    ]
  },
  
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    "Specific strength 3"
  ],
  
  "weaknesses": [
    "Specific weakness 1",
    "Specific weakness 2",
    "Specific weakness 3"
  ],
  
  "criticalIssues": [
    {
      "severity": "critical",
      "category": "ATS" | "Content" | "Format",
      "description": "...",
      "impact": "...",
      "fix": "..."
    }
  ],
  
  "atsKeywords": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword3", "keyword4"],
    "score": <number>
  },
  
  "suggestions": [
    {
      "category": "...",
      "title": "...",
      "description": "...",
      "impact": "high" | "medium" | "low",
      "effort": "quick" | "moderate" | "extensive",
      "before": "...",
      "after": "..."
    }
  ],
  
  "roadmap": {
    "quickWins": [
      {
        "action": "...",
        "impact": "high" | "medium" | "low",
        "timeToComplete": "...",
        "priority": <number>
      }
    ],
    "mediumTerm": [...],
    "longTerm": [...]
  }
}

# IMPORTANT RULES
1. Be specific - cite actual text from the resume when possible
2. Provide actionable fixes, not just problems
3. Consider the target role/company if provided
4. Focus on high-impact improvements first
5. Return ONLY valid JSON - no extra text
6. Ensure all scores are realistic and justified
`;
}

/**
 * Build rewrite prompt
 */
export function buildRewritePrompt(
  originalText: string,
  options: {
    context?: string;
    role?: string;
    tone?: string;
    targetImprovement?: string;
  }
): string {
  return `
You are a professional resume writer specializing in ${options.role || 'various roles'}.

# ORIGINAL TEXT
"${originalText}"

${options.context ? `\n# CONTEXT\n${options.context}\n` : ''}

# REWRITE REQUIREMENTS
- Tone: ${options.tone || 'Professional and achievement-focused'}
- Target: ${options.targetImprovement || 'Make more impactful and ATS-friendly'}
- Focus: Use action verbs, add metrics, demonstrate impact

# YOUR TASK
Create 3 improved versions of this text, each progressively better.

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "version": 1,
      "text": "...",
      "improvements": ["What changed", "Why it's better"],
      "score": <number 0-100>
    },
    {
      "version": 2,
      "text": "...",
      "improvements": ["..."],
      "score": <number>
    },
    {
      "version": 3,
      "text": "...",
      "improvements": ["..."],
      "score": <number>
    }
  ],
  "keyImprovements": [
    "Added quantifiable metrics",
    "Used stronger action verbs",
    "Demonstrated business impact"
  ]
}

RULES:
1. Keep the core meaning but enhance impact
2. Add metrics/numbers where possible
3. Use strong action verbs (Led, Drove, Achieved, Implemented)
4. Make it ATS-friendly (no fancy formatting)
5. Each version should be progressively better (higher score)
`;
}

/**
 * Build job matching prompt
 */
export function buildJobMatchPrompt(
  resumeText: string,
  jobDescription: string
): string {
  return `
You are an expert at matching candidates to job requirements.

# RESUME
${resumeText}

# JOB DESCRIPTION
${jobDescription}

# TASK
Analyze how well this resume matches the job requirements.

Return ONLY valid JSON:
{
  "matchScore": <number 0-100>,
  
  "matchedSkills": [
    "Skill 1 found in both",
    "Skill 2 found in both"
  ],
  
  "missingSkills": [
    "Required skill missing from resume",
    "Preferred skill missing from resume"
  ],
  
  "recommendations": [
    "Add experience with X to demonstrate Y capability",
    "Highlight your Z skills more prominently",
    "Quantify your achievements in A area"
  ],
  
  "alignment": {
    "technical": <number 0-100>,
    "experience": <number 0-100>,
    "culture": <number 0-100>
  },
  
  "detailedAnalysis": {
    "requirements": [
      {
        "requirement": "...",
        "met": true | false,
        "evidence": "..." or "Not found"
      }
    ],
    "competitiveAdvantages": ["..."],
    "redFlags": ["..."]
  }
}
`;
}

/**
 * Build keyword extraction prompt
 */
export function buildKeywordExtractionPrompt(text: string): string {
  return `
Extract the most important keywords and skills from this job description.

Text:
${text}

Return the top 30 keywords as JSON:
{
  "keywords": ["keyword1", "keyword2", ...],
  "categories": {
    "technical": ["..."],
    "soft": ["..."],
    "tools": ["..."],
    "certifications": ["..."]
  }
}
`;
}