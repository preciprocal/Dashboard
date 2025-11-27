// lib/ai/gemini-parser.ts

import type { ResumeFeedback, CategoryScore } from '@/types/resume';

interface RawCategoryScore {
  score?: number;
  weight?: number;
  tips?: unknown[];
  issues?: unknown[];
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

      // Lists
      strengths: Array.isArray(raw.strengths) ? raw.strengths as string[] : [],
      weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses as string[] : [],
      criticalIssues: Array.isArray(raw.criticalIssues) ? raw.criticalIssues as string[] : [],
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions as string[] : [],

      // ATS Keywords
      atsKeywords: {
        matched: raw.atsKeywords?.matched || [],
        missing: raw.atsKeywords?.missing || [],
        score: validateScore(raw.atsKeywords?.score || 0),
      },

      // Roadmap
      roadmap: {
        quickWins: raw.roadmap?.quickWins as string[] || [],
        mediumTerm: raw.roadmap?.mediumTerm as string[] || [],
        longTerm: raw.roadmap?.longTerm as string[] || [],
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
    tips: Array.isArray(raw?.tips) ? raw.tips as string[] : [],
    issues: Array.isArray(raw?.issues) ? raw.issues as string[] : [],
    metrics: raw?.metrics || {},
  };
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