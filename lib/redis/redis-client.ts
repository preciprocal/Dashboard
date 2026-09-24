// lib/redis/redis-client.ts
import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn('⚠️ Redis credentials not found - caching disabled');
}

export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

/**
 * Version stamp for anything whose cached value is a model response shaped by a
 * system prompt in this repo.
 *
 * v2: the resume analysis and fix prompts were told to stop producing tips
 *     about summary / objective / profile sections.
 */
export const ANALYSIS_PROMPT_VERSION = 2;

// Helper functions for key generation
export const RedisKeys = {
  // Resume analysis cache
  // Keyed on the resume hash AND the prompt version, because the cached value
  // is the model's OUTPUT, not the resume. Without the version, editing a
  // system prompt changes nothing for anyone who has already been analysed:
  // their old result keeps being served for the full 7-day TTL, so the change
  // looks like it silently failed.
  //
  // Bump ANALYSIS_PROMPT_VERSION in the same commit as any edit to
  // ANALYSIS_SYSTEM or FIX_SYSTEM in app/api/analyze-resume/route.ts. Old keys
  // are not deleted; they simply stop being read and expire on their own.
  resumeAnalysis: (hash: string) => `resume:analysis:v${ANALYSIS_PROMPT_VERSION}:${hash}`,
  resumeText: (hash: string) => `resume:text:${hash}`,

  // Resume fixes cache
  resumeFixes: (hash: string) => `resume:fixes:v${ANALYSIS_PROMPT_VERSION}:${hash}`,
  
  // Company info cache (for cover letters and research)
  company: (domain: string) => `company:${domain}`,
  companyInfo: (domain: string) => `company:${domain}`, // Alias for backwards compatibility
  
  // Usage tracking per user per feature per month
  usage: (userId: string, feature: string) => {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    return `usage:${userId}:${feature}:${month}`;
  },
  
  // User preferences
  userPrefs: (userId: string) => `prefs:${userId}`,

  // Quiz cache (per plan - quiz is regenerated only when plan progress changes)
  quiz: (planId: string) => `quiz:${planId}`,
};

// TTL constants (in seconds)
export const TTL = {
  RESUME_ANALYSIS: 7 * 24 * 60 * 60,      // 7 days
  RESUME_TEXT: 30 * 24 * 60 * 60,          // 30 days
  RESUME_FIXES: 7 * 24 * 60 * 60,          // 7 days
  COMPANY_INFO: 30 * 24 * 60 * 60,         // 30 days (company info doesn't change often)
  COVER_LETTER: 7 * 24 * 60 * 60,          // 7 days
  JOB_SEARCH: 6 * 60 * 60,                 // 6 hours (jobs change frequently)
  USAGE_COUNTER: 32 * 24 * 60 * 60,        // 32 days (slightly longer than a month)
  QUIZ: 24 * 60 * 60,                      // 24 hours (quiz per plan)
};