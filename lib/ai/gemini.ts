// lib/ai/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

import { 
  buildAnalysisPrompt, 
  buildRewritePrompt, 
  buildJobMatchPrompt,
  buildKeywordExtractionPrompt,
} from '@/lib/ai/gemini-prompts';
import { parseAnalysisResponse, parseRewriteResponse } from '@/lib/ai/gemini-parser';
import type { ResumeFeedback } from '@/types/resume';
import { API_CONFIG, GEMINI_CONFIG } from './gemini-config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(API_CONFIG.apiKey);

// Define type for parsed JSON responses
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
 * Gemini AI Service - Comprehensive Resume Analysis
 */
export class GeminiService {
  private static model = genAI.getGenerativeModel({
    model: GEMINI_CONFIG.models.pro,
  });

  private static flashModel = genAI.getGenerativeModel({
    model: GEMINI_CONFIG.models.flash,
  });

  /**
   * Analyze resume comprehensively with Gemini Pro
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
      console.log('🤖 Starting Gemini analysis...');

      // Build the analysis prompt
      const prompt = buildAnalysisPrompt(resumeText, options);

      // Generate content with retry logic
      const result = await this.generateWithRetry(prompt);

      // Parse the response
      const feedback = parseAnalysisResponse(result, resumeText, options.jobDescription);

      console.log('✅ Gemini analysis complete:', {
        overallScore: feedback.overallScore,
        categories: Object.keys(feedback).filter(k => {
          const value = feedback[k as keyof ResumeFeedback];
          return typeof value === 'object' && value !== null && 'score' in value;
        }),
      });

      return feedback;
    } catch (error) {
      console.error('❌ Gemini analysis failed:', error);
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Quick ATS scan using Gemini Flash (faster)
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

      const result = await this.generateWithRetry(prompt, { model: 'flash' });
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
   * Rewrite resume section with AI suggestions
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
      const result = await this.generateWithRetry(prompt, { model: 'flash' });
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
3. A memorable tagline (10 words max)

Return as JSON:
{
  "summary": "...",
  "highlights": ["...", "..."],
  "tagline": "..."
}
`;

      const result = await this.generateWithRetry(prompt);
      const parsed = this.extractJSON<ParsedPortfolio>(result);

      return {
        summary: parsed.summary || '',
        highlights: parsed.highlights || [],
        tagline: parsed.tagline || '',
      };
    } catch (error) {
      console.error('Portfolio generation failed:', error);
      throw error;
    }
  }

  /**
   * Benchmarking against role standards
   */
  static async benchmarkAgainstRole(
    resumeText: string,
    targetRole: string
  ): Promise<{
    percentile: number;
    strengths: string[];
    gaps: string[];
    recommendations: string[];
  }> {
    try {
      const prompt = `
Benchmark this resume against industry standards for: ${targetRole}

Resume:
${resumeText}

Analyze:
1. Estimated percentile (0-100) compared to top professionals
2. Competitive strengths
3. Skill/experience gaps
4. Specific recommendations to reach top 10%

Return as JSON with: percentile, strengths[], gaps[], recommendations[]
`;

      const result = await this.generateWithRetry(prompt);
      const parsed = this.extractJSON<ParsedBenchmark>(result);

      return {
        percentile: parsed.percentile || 50,
        strengths: parsed.strengths || [],
        gaps: parsed.gaps || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (error) {
      console.error('Benchmarking failed:', error);
      throw error;
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Generate content with retry logic
   */
  private static async generateWithRetry(
    prompt: string,
    options: { model?: 'pro' | 'flash' } = {}
  ): Promise<string> {
    const { maxAttempts, initialDelay, maxDelay, backoffMultiplier } = GEMINI_CONFIG.retry;
    const model = options.model === 'flash' ? this.flashModel : this.model;

    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);

        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: GEMINI_CONFIG.generationConfig,
          safetySettings: GEMINI_CONFIG.safetySettings,
        });

        const response = result.response;
        const text = response.text();

        if (!text) {
          throw new Error('Empty response from Gemini');
        }

        return text;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Attempt ${attempt} failed:`, lastError.message);

        // Don't retry on certain errors
        if (
          lastError.message.includes('API key') ||
          lastError.message.includes('quota') ||
          lastError.message.includes('invalid')
        ) {
          throw lastError;
        }

        // Wait before retrying
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Extract JSON from Gemini response (handles markdown code blocks)
   */
  private static extractJSON<T>(text: string): T {
    try {
      // Remove markdown code blocks if present
      let cleaned = text.trim();

      // Remove ```json and ``` markers
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*$/g, '');

      // Find JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
      console.error('JSON parsing failed:', error);
      console.error('Raw text:', text);
      throw new Error('Failed to parse AI response');
    }
  }

  /**
   * Check if API is properly configured
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const result = await this.flashModel.generateContent('Hello');
      return !!result.response.text();
    } catch (error) {
      console.error('Gemini health check failed:', error);
      return false;
    }
  }
}