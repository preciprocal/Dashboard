// lib/ai/gemini-parser.ts

import type { ResumeFeedback, CategoryScore, Issue, Suggestion } from '@/types/resume';

interface RawTip {
  type?: string;
  tip?: string;
  message?: string;
  explanation?: string;
}

interface RawCategoryScore {
  score?: number;
  weight?: number;
  tips?: RawTip[];
  issues?: RawTip[];
  metrics?: Record<string, unknown>;
}

interface RawATSKeywords {
  matched?: string[];
  missing?: string[];
  score?: number;
}

interface RawRoadmap {
  quickWins?: unknown[];
  mediumTerm?: unknown[];
  longTerm?: unknown[];
}

interface RawSkills {
  matchedSkills?: string[];
  missingSkills?: string[];
}

interface RawJobMatch {
  score?: number;
}

interface RawAnalysisResponse {
  overallScore?: number;
  ats?: RawCategoryScore;
  content?: RawCategoryScore;
  structure?: RawCategoryScore;
  skills?: RawCategoryScore & RawSkills;
  impact?: RawCategoryScore;
  grammar?: RawCategoryScore;
  strengths?: unknown[];
  weaknesses?: unknown[];
  criticalIssues?: unknown[];
  suggestions?: unknown[];
  atsKeywords?: RawATSKeywords;
  roadmap?: RawRoadmap;
  jobMatch?: RawJobMatch;
  recommendations?: string[];
}

interface RawRewriteSuggestion {
  version?: number;
  text?: string;
  improvements?: unknown[];
  score?: number;
}

interface RawRewriteResponse {
  suggestions?: RawRewriteSuggestion[];
}

/**
 * Parse and validate Gemini analysis response
 */
export function parseAnalysisResponse(
  responseText: string,
  _resumeText: string,
  jobDescription?: string
): ResumeFeedback {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const raw: RawAnalysisResponse = JSON.parse(jsonMatch[0]);

    // Validate and build feedback object
    const feedback: ResumeFeedback = {
      overallScore: validateScore(raw.overallScore),

      // Category scores with validation
      ats: parseCategoryScore(raw.ats),
      content: parseCategoryScore(raw.content),
      structure: parseCategoryScore(raw.structure),
      skills: parseCategoryScore(raw.skills),
      impact: parseCategoryScore(raw.impact),
      grammar: parseCategoryScore(raw.grammar),

      // Lists - properly typed
      strengths: parseStringArray(raw.strengths),
      weaknesses: parseStringArray(raw.weaknesses),
      criticalIssues: parseIssueArray(raw.criticalIssues),
      suggestions: parseSuggestionArray(raw.suggestions),

      // ATS Keywords
      atsKeywords: {
        matched: raw.atsKeywords?.matched || [],
        missing: raw.atsKeywords?.missing || [],
        score: validateScore(raw.atsKeywords?.score || 0),
      },

      // Roadmap
      roadmap: {
        quickWins: parseRoadmapArray(raw.roadmap?.quickWins),
        mediumTerm: parseRoadmapArray(raw.roadmap?.mediumTerm),
        longTerm: parseRoadmapArray(raw.roadmap?.longTerm),
      },

      // Job match (if JD provided)
      jobMatch: jobDescription
        ? {
            score: validateScore(raw.jobMatch?.score || 0),
            matchedSkills: raw.skills?.matchedSkills || [],
            missingSkills: raw.skills?.missingSkills || [],
            recommendations: raw.recommendations || [],
          }
        : undefined,
    };

    return feedback;
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    throw new Error('Invalid AI response format');
  }
}

/**
 * Parse category score with validation
 */
function parseCategoryScore(raw: RawCategoryScore | undefined): CategoryScore {
  return {
    score: validateScore(raw?.score || 0),
    weight: raw?.weight || 0,
    tips: Array.isArray(raw?.tips) 
      ? raw.tips.map(tip => ({
          type: (tip.type as 'good' | 'warning' | 'critical') || 'warning',
          message: tip.tip || tip.message || '',
          explanation: tip.explanation,
          tip: tip.tip || tip.message || ''
        }))
      : [],
    issues: Array.isArray(raw?.issues) 
      ? raw.issues.map(issue => ({
          severity: 'minor' as const,
          category: 'Content' as const,
          description: issue.tip || issue.message || '',
          fix: issue.explanation || 'Review and improve this section'
        }))
      : [],
    metrics: normalizeMetrics(raw?.metrics || {}),
  };
}

/**
 * Parse array into string array
 */
function parseStringArray(raw: unknown[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => String(item));
}

/**
 * Parse array into Issue objects
 */
function parseIssueArray(raw: unknown[] | undefined): Issue[] {
  if (!Array.isArray(raw)) return [];
  
  return raw.map((item) => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        severity: (obj.severity as 'critical' | 'major' | 'minor') || 'minor',
        category: (obj.category as Issue['category']) || 'Content',
        description: String(obj.description || obj.message || obj.issue || ''),
        location: obj.location ? String(obj.location) : undefined,
        impact: obj.impact ? String(obj.impact) : undefined,
        fix: String(obj.fix || obj.suggestion || 'Review and address this issue'),
        example: obj.example ? String(obj.example) : undefined
      };
    }
    
    // If item is a string, convert to Issue object
    return {
      severity: 'minor' as const,
      category: 'Content' as const,
      description: String(item),
      fix: 'Review and address this issue'
    };
  });
}

/**
 * Parse array into Suggestion objects
 */
function parseSuggestionArray(raw: unknown[] | undefined): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  
  return raw.map((item, index) => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        id: obj.id ? String(obj.id) : `suggestion-${index}`,
        category: String(obj.category || 'General'),
        title: String(obj.title || obj.message || 'Improvement Suggestion'),
        description: String(obj.description || obj.message || item),
        impact: (obj.impact as 'high' | 'medium' | 'low') || 'medium',
        effort: (obj.effort as 'quick' | 'moderate' | 'extensive') || 'moderate',
        before: obj.before ? String(obj.before) : undefined,
        after: obj.after ? String(obj.after) : undefined,
        priority: typeof obj.priority === 'number' ? obj.priority : index + 1
      };
    }
    
    // If item is a string, convert to Suggestion object
    return {
      id: `suggestion-${index}`,
      category: 'General',
      title: 'Improvement Suggestion',
      description: String(item),
      impact: 'medium' as const,
      effort: 'moderate' as const,
      priority: index + 1
    };
  });
}

/**
 * Parse roadmap items
 */
function parseRoadmapArray(raw: unknown[] | undefined): Array<{
  action: string;
  impact: 'high' | 'medium' | 'low';
  timeToComplete: string;
  priority: number;
}> {
  if (!Array.isArray(raw)) return [];
  
  return raw.map((item, index) => {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        action: String(obj.action || obj.message || item),
        impact: (obj.impact as 'high' | 'medium' | 'low') || 'medium',
        timeToComplete: String(obj.timeToComplete || obj.time || '1-2 days'),
        priority: typeof obj.priority === 'number' ? obj.priority : index + 1,
        category: obj.category ? String(obj.category) : undefined,
        estimatedScoreIncrease: typeof obj.estimatedScoreIncrease === 'number' 
          ? obj.estimatedScoreIncrease 
          : undefined
      };
    }
    
    return {
      action: String(item),
      impact: 'medium' as const,
      timeToComplete: '1-2 days',
      priority: index + 1
    };
  });
}

/**
 * Normalize metrics to ensure only string | number values
 */
function normalizeMetrics(raw: Record<string, unknown>): Record<string, string | number> {
  const normalized: Record<string, string | number> = {};
  
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' || typeof value === 'number') {
      normalized[key] = value;
    } else if (value !== null && value !== undefined) {
      // Convert other types to string representation
      normalized[key] = String(value);
    }
  }
  
  return normalized;
}

/**
 * Validate score is between 0-100
 */
function validateScore(score: number | undefined): number {
  const num = Number(score);
  if (isNaN(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Parse rewrite suggestions
 */
export function parseRewriteResponse(
  responseText: string,
  originalText: string
): {
  suggestions: Array<{
    version: number;
    text: string;
    improvements: string[];
    score: number;
  }>;
} {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const raw: RawRewriteResponse = JSON.parse(jsonMatch[0]);

    return {
      suggestions: (raw.suggestions || []).map((s: RawRewriteSuggestion, idx: number) => ({
        version: s.version || idx + 1,
        text: s.text || '',
        improvements: Array.isArray(s.improvements) ? s.improvements as string[] : [],
        score: validateScore(s.score || 0),
      })),
    };
  } catch (error) {
    console.error('Failed to parse rewrite response:', error);
    // Return fallback
    return {
      suggestions: [
        {
          version: 1,
          text: originalText,
          improvements: ['Original text preserved due to parsing error'],
          score: 50,
        },
      ],
    };
  }
}