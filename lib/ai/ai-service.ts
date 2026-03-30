// lib/ai/ai-service.ts

import OpenAI from 'openai';
import {
  buildAnalysisPrompt,
  buildRewritePrompt,
  buildJobMatchPrompt,
  buildKeywordExtractionPrompt,
} from '@/lib/ai/gemini-prompts'; // Prompts are provider-agnostic, keep as-is
import { parseAnalysisResponse, parseRewriteResponse } from '@/lib/ai/gemini-parser';
import type { ResumeFeedback } from '@/types/resume';
import { API_CONFIG, AI_CONFIG } from './ai-config';

const openai = new OpenAI({ apiKey: API_CONFIG.apiKey });

// Parsed response types
interface ParsedATSScan {
  score?: number;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  criticalIssues?: string[];
}

interface ParsedJobMatch {
  matchScore?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  recommendations?: string[];
  alignment?: {
    technical: number;
    experience: number;
    culture: number;
  };
}

interface ParsedKeywords {
  keywords?: string[];
}

interface ParsedPortfolio {
  summary?: string;
  highlights?: string[];
  tagline?: string;
}

interface ParsedBenchmark {
  percentile?: number;
  strengths?: string[];
  gaps?: string[];
  recommendations?: string[];
}

/**
 * AIService — provider-agnostic class name, currently backed by OpenAI
 */
export class AIService {
  /**
   * Generate with retry logic
   */
  private static async generateWithRetry(
    prompt: string,
    options: { model?: 'primary' | 'fast'; temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    const model = options.model === 'fast'
      ? AI_CONFIG.models.fast
      : AI_CONFIG.models.primary;

    const maxAttempts = AI_CONFIG.retry.maxAttempts;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert resume analyst and career coach. Respond ONLY with valid JSON when the prompt asks for JSON. Never wrap JSON in markdown code blocks.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: options.temperature ?? AI_CONFIG.generationConfig.temperature,
          max_tokens: options.maxTokens ?? AI_CONFIG.generationConfig.maxTokens,
        });

        const text = completion.choices[0]?.message?.content?.trim() ?? '';
        if (!text) throw new Error('Empty response from AI');
        return text;
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ AI attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

        if (attempt < maxAttempts) {
          const delay = Math.min(
            AI_CONFIG.retry.initialDelay * Math.pow(AI_CONFIG.retry.backoffMultiplier, attempt - 1),
            AI_CONFIG.retry.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`AI failed after ${maxAttempts} attempts: ${lastError?.message}`);
  }

  /**
   * Extract JSON from response text
   */
  private static extractJSON<T>(text: string): T {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]) as T;
  }

  /**
   * Analyze resume comprehensively
   */
  static async analyzeResume(
    resumeText: string,
    options: {
      jobTitle?: string;
      jobDescription?: string;
      companyName?: string;
      analysisType?: 'full' | 'quick' | 'ats-only';
    } = {}
  ): Promise<ResumeFeedback> {
    try {
      console.log('🤖 Starting AI analysis...');
      const prompt = buildAnalysisPrompt(resumeText, options);
      const result = await this.generateWithRetry(prompt);
      const feedback = parseAnalysisResponse(result, resumeText, options.jobDescription);

      console.log('✅ AI analysis complete:', {
        overallScore: feedback.overallScore,
        categories: Object.keys(feedback).filter(k => {
          const value = feedback[k as keyof ResumeFeedback];
          return typeof value === 'object' && value !== null && 'score' in value;
        }),
      });

      return feedback;
    } catch (error) {
      console.error('❌ AI analysis failed:', error);
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Quick ATS scan (uses fast model)
   */
  static async quickATSScan(
    resumeText: string,
    jobDescription?: string
  ): Promise<{
    score: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    criticalIssues: string[];
  }> {
    try {
      const prompt = `
Perform a QUICK ATS compatibility scan of this resume.

Resume:
${resumeText}

${jobDescription ? `Job Description:\n${jobDescription}\n` : ''}

Analyze ONLY:
1. ATS compatibility score (0-100)
2. Keyword matching
3. Critical formatting issues

Return ONLY valid JSON:
{
  "score": <number>,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "criticalIssues": ["issue1", "issue2"]
}
`;

      const result = await this.generateWithRetry(prompt, { model: 'fast' });
      const parsed = this.extractJSON<ParsedATSScan>(result);

      return {
        score: parsed.score || 0,
        matchedKeywords: parsed.matchedKeywords || [],
        missingKeywords: parsed.missingKeywords || [],
        criticalIssues: parsed.criticalIssues || [],
      };
    } catch (error) {
      console.error('Quick scan failed:', error);
      throw error;
    }
  }

  /**
   * Rewrite resume section
   */
  static async rewriteSection(
    originalText: string,
    options: {
      context?: string;
      role?: string;
      tone?: 'professional' | 'creative' | 'technical' | 'executive';
      targetImprovement?: string;
    } = {}
  ): Promise<{
    suggestions: Array<{
      version: number;
      text: string;
      improvements: string[];
      score: number;
    }>;
  }> {
    try {
      const prompt = buildRewritePrompt(originalText, options);
      const result = await this.generateWithRetry(prompt);
      return parseRewriteResponse(result, originalText);
    } catch (error) {
      console.error('Rewrite failed:', error);
      throw error;
    }
  }

  /**
   * Match resume to job description
   */
  static async matchJobDescription(
    resumeText: string,
    jobDescription: string
  ): Promise<{
    matchScore: number;
    matchedSkills: string[];
    missingSkills: string[];
    recommendations: string[];
    alignment: {
      technical: number;
      experience: number;
      culture: number;
    };
  }> {
    try {
      const prompt = buildJobMatchPrompt(resumeText, jobDescription);
      const result = await this.generateWithRetry(prompt);
      const parsed = this.extractJSON<ParsedJobMatch>(result);

      return {
        matchScore: parsed.matchScore || 0,
        matchedSkills: parsed.matchedSkills || [],
        missingSkills: parsed.missingSkills || [],
        recommendations: parsed.recommendations || [],
        alignment: parsed.alignment || { technical: 0, experience: 0, culture: 0 },
      };
    } catch (error) {
      console.error('Job matching failed:', error);
      throw error;
    }
  }

  /**
   * Extract keywords from job description
   */
  static async extractKeywords(text: string): Promise<string[]> {
    try {
      const prompt = buildKeywordExtractionPrompt(text);
      const result = await this.generateWithRetry(prompt, { model: 'fast' });
      const parsed = this.extractJSON<ParsedKeywords>(result);
      return parsed.keywords || [];
    } catch (error) {
      console.error('Keyword extraction failed:', error);
      return [];
    }
  }

  /**
   * Generate portfolio summary from resume
   */
  static async generatePortfolioSummary(
    resumeText: string,
    options: {
      tone?: string;
      length?: 'short' | 'medium' | 'long';
    } = {}
  ): Promise<{
    summary: string;
    highlights: string[];
    tagline: string;
  }> {
    try {
      const prompt = `
Create a compelling portfolio summary from this resume.

Resume:
${resumeText}

Generate:
1. A ${options.length || 'medium'}-length professional summary (${options.tone || 'professional'} tone)
2. Top 5 career highlights
3. A catchy professional tagline

Return ONLY valid JSON:
{
  "summary": "...",
  "highlights": ["...", "...", "...", "...", "..."],
  "tagline": "..."
}
`;

      const result = await this.generateWithRetry(prompt, { model: 'fast' });
      const parsed = this.extractJSON<ParsedPortfolio>(result);

      return {
        summary: parsed.summary || '',
        highlights: parsed.highlights || [],
        tagline: parsed.tagline || '',
      };
    } catch (error) {
      console.error('Portfolio summary failed:', error);
      throw error;
    }
  }

  /**
   * Benchmark resume against industry standards
   */
  static async benchmarkResume(
    resumeText: string,
    options: {
      targetRole?: string;
      industry?: string;
      experienceLevel?: string;
    } = {}
  ): Promise<{
    percentile: number;
    strengths: string[];
    gaps: string[];
    recommendations: string[];
  }> {
    try {
      const prompt = `
Benchmark this resume against industry standards.

Resume:
${resumeText}

${options.targetRole ? `Target Role: ${options.targetRole}` : ''}
${options.industry ? `Industry: ${options.industry}` : ''}
${options.experienceLevel ? `Experience Level: ${options.experienceLevel}` : ''}

Return ONLY valid JSON:
{
  "percentile": <number 0-100>,
  "strengths": ["...", "..."],
  "gaps": ["...", "..."],
  "recommendations": ["...", "..."]
}
`;

      const result = await this.generateWithRetry(prompt, { model: 'fast' });
      const parsed = this.extractJSON<ParsedBenchmark>(result);

      return {
        percentile: parsed.percentile || 50,
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error('Benchmark failed:', error);
      throw error;
    }
  }
}