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
    analysisType?: 'full' | 'quick' | 'ats-only';
  }
): string {
  const { jobTitle, jobDescription, companyName, analysisType = 'full' } = options;

  const basePrompt = `
You are an expert resume analyst and career coach. Analyze this resume comprehensively.

Resume Text:
${resumeText}

${jobTitle ? `Target Job Title: ${jobTitle}` : ''}
${companyName ? `Target Company: ${companyName}` : ''}
${jobDescription ? `Job Description:\n${jobDescription}` : ''}

Analysis Type: ${analysisType}

Provide a detailed analysis in the following JSON format:
{
  "overallScore": <number 0-100>,
  "ats": {
    "score": <number 0-100>,
    "weight": 0.25,
    "tips": [
      {
        "type": "good" | "warning" | "critical",
        "message": "...",
        "explanation": "...",
        "tip": "..."
      }
    ],
    "issues": [
      {
        "severity": "critical" | "major" | "minor",
        "category": "ATS",
        "description": "...",
        "fix": "..."
      }
    ],
    "metrics": {
      "keywordDensity": <number>,
      "formattingScore": <number>
    }
  },
  "content": {
    "score": <number 0-100>,
    "weight": 0.25,
    "tips": [...],
    "issues": [...],
    "metrics": {
      "impactStatements": <number>,
      "quantifiableResults": <number>
    }
  },
  "structure": {
    "score": <number 0-100>,
    "weight": 0.15,
    "tips": [...],
    "issues": [...],
    "metrics": {
      "sectionCount": <number>,
      "organizationScore": <number>
    }
  },
  "skills": {
    "score": <number 0-100>,
    "weight": 0.20,
    "tips": [...],
    "issues": [...],
    "metrics": {
      "technicalSkills": <number>,
      "softSkills": <number>
    },
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["skill1", "skill2"]
  },
  "impact": {
    "score": <number 0-100>,
    "weight": 0.10,
    "tips": [...],
    "issues": [...],
    "metrics": {
      "actionVerbCount": <number>,
      "quantificationScore": <number>
    }
  },
  "grammar": {
    "score": <number 0-100>,
    "weight": 0.05,
    "tips": [...],
    "issues": [...],
    "metrics": {
      "errorCount": <number>
    }
  },
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "criticalIssues": [
    {
      "severity": "critical",
      "category": "Content",
      "description": "...",
      "fix": "..."
    }
  ],
  "suggestions": [
    {
      "id": "suggestion-1",
      "category": "Content",
      "title": "...",
      "description": "...",
      "impact": "high" | "medium" | "low",
      "effort": "quick" | "moderate" | "extensive",
      "priority": 1
    }
  ],
  "atsKeywords": {
    "matched": ["keyword1", "keyword2"],
    "missing": ["keyword1", "keyword2"],
    "score": <number 0-100>
  },
  "roadmap": {
    "quickWins": [
      {
        "action": "...",
        "impact": "high" | "medium" | "low",
        "timeToComplete": "1-2 hours",
        "priority": 1
      }
    ],
    "mediumTerm": [...],
    "longTerm": [...]
  }${jobDescription ? `,
  "jobMatch": {
    "score": <number 0-100>,
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["skill1", "skill2"],
    "recommendations": ["rec1", "rec2"]
  }` : ''}
}

Return ONLY the JSON object, no additional text.
`;

  return basePrompt;
}

/**
 * Build rewrite prompt for resume sections
 */
export function buildRewritePrompt(
  originalText: string,
  options: {
    context?: string;
    role?: string;
    tone?: 'professional' | 'creative' | 'technical' | 'executive';
    targetImprovement?: string;
  }
): string {
  const { context, role, tone = 'professional', targetImprovement } = options;

  return `
You are an expert resume writer. Rewrite this resume section to be more impactful.

Original Text:
${originalText}

${context ? `Context: ${context}` : ''}
${role ? `Target Role: ${role}` : ''}
Tone: ${tone}
${targetImprovement ? `Focus on: ${targetImprovement}` : ''}

Provide 3 improved versions in JSON format:
{
  "suggestions": [
    {
      "version": 1,
      "text": "...",
      "improvements": ["improvement1", "improvement2"],
      "score": <number 0-100>
    },
    {
      "version": 2,
      "text": "...",
      "improvements": ["improvement1", "improvement2"],
      "score": <number 0-100>
    },
    {
      "version": 3,
      "text": "...",
      "improvements": ["improvement1", "improvement2"],
      "score": <number 0-100>
    }
  ]
}

Return ONLY the JSON object.
`;
}

/**
 * Build job match prompt
 */
export function buildJobMatchPrompt(
  resumeText: string,
  jobDescription: string
): string {
  return `
Analyze how well this resume matches the job description.

Resume:
${resumeText}

Job Description:
${jobDescription}

Provide detailed matching analysis in JSON format:
{
  "matchScore": <number 0-100>,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "recommendations": ["rec1", "rec2"],
  "alignment": {
    "technical": <number 0-100>,
    "experience": <number 0-100>,
    "culture": <number 0-100>
  }
}

Return ONLY the JSON object.
`;
}

/**
 * Build keyword extraction prompt
 */
export function buildKeywordExtractionPrompt(text: string): string {
  return `
Extract the most important keywords and phrases from this job description or text.
Focus on skills, qualifications, and requirements.

Text:
${text}

Return as JSON:
{
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

Return ONLY the JSON object with 15-25 most relevant keywords.
`;
}
