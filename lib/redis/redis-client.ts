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

// Helper functions for key generation
export const RedisKeys = {
  // Resume analysis cache
  resumeAnalysis: (hash: string) => `resume:analysis:${hash}`,
  resumeText: (hash: string) => `resume:text:${hash}`,
  
  // Resume fixes cache
  resumeFixes: (hash: string) => `resume:fixes:${hash}`,
  
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
};