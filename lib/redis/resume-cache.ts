// lib/resume-cache.ts
import { redis, RedisKeys, TTL } from './redis-client';
import crypto from 'crypto';

// Define proper types for resume analysis
interface ResumeFeedback {
  overallScore: number;
  ATS: CategoryScore;
  toneAndStyle: CategoryScore;
  content: CategoryScore;
  structure: CategoryScore;
  skills: CategoryScore;
  resumeText?: string;
}

interface CategoryScore {
  score: number;
  tips: Array<{
    type: 'good' | 'improve';
    tip: string;
    explanation?: string;
  }>;
}

interface ResumeFix {
  id: string;
  category: string;
  issue: string;
  originalText: string;
  improvedText: string;
  explanation: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  location?: string;
}

/**
 * Generate hash from resume content for caching
 */
export function hashResumeContent(content: string): string {
  // Normalize content before hashing
  const normalized = content
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
  
  return crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex')
    .substring(0, 32); // Use first 32 chars for cleaner keys
}

/**
 * Get cached resume analysis
 */
export async function getCachedResumeAnalysis(resumeHash: string): Promise<ResumeFeedback | null> {
  if (!redis) return null;
  
  try {
    const key = RedisKeys.resumeAnalysis(resumeHash);
    const cached = await redis.get(key);
    
    if (cached) {
      console.log('✅ Cache HIT - Resume analysis found');
      return typeof cached === 'string' ? JSON.parse(cached) : (cached as ResumeFeedback);
    }
    
    console.log('❌ Cache MISS - Resume analysis not found');
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache resume analysis result
 */
export async function cacheResumeAnalysis(
  resumeHash: string,
  analysis: ResumeFeedback,
  ttl: number = TTL.RESUME_ANALYSIS
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = RedisKeys.resumeAnalysis(resumeHash);
    await redis.setex(key, ttl, JSON.stringify(analysis));
    console.log('✅ Cached resume analysis for', ttl / 86400, 'days');
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Get cached extracted text
 */
export async function getCachedResumeText(resumeHash: string): Promise<string | null> {
  if (!redis) return null;
  
  try {
    const key = RedisKeys.resumeText(resumeHash);
    const cached = await redis.get(key);
    
    if (cached) {
      console.log('✅ Cache HIT - Extracted text found');
      return cached as string;
    }
    
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache extracted resume text
 */
export async function cacheResumeText(
  resumeHash: string,
  text: string,
  ttl: number = TTL.RESUME_TEXT
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = RedisKeys.resumeText(resumeHash);
    await redis.setex(key, ttl, text);
    console.log('✅ Cached resume text for', ttl / 86400, 'days');
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Get cached resume fixes
 */
export async function getCachedResumeFixes(contentHash: string): Promise<ResumeFix[] | null> {
  if (!redis) return null;
  
  try {
    const key = RedisKeys.resumeFixes(contentHash);
    const cached = await redis.get(key);
    
    if (cached) {
      console.log('✅ Cache HIT - Resume fixes found');
      return typeof cached === 'string' ? JSON.parse(cached) : (cached as ResumeFix[]);
    }
    
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache resume fixes
 */
export async function cacheResumeFixes(
  contentHash: string,
  fixes: ResumeFix[],
  ttl: number = TTL.RESUME_FIXES
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = RedisKeys.resumeFixes(contentHash);
    await redis.setex(key, ttl, JSON.stringify(fixes));
    console.log('✅ Cached resume fixes for', ttl / 86400, 'days');
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  enabled: boolean;
  keys?: number;
}> {
  if (!redis) return { enabled: false };
  
  try {
    const info = await redis.dbsize();
    return {
      enabled: true,
      keys: info
    };
  } catch (error) {
    console.error('Redis stats error:', error);
    return { enabled: true };
  }
}

// Export types for use in other files
export type { ResumeFeedback, CategoryScore, ResumeFix };