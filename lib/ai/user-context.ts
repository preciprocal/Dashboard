// lib/ai/user-context.ts
//
// Shared helper that fetches a user's resume text, transcript text, and profile
// metadata so any AI route can inject personalised context into its prompts.

import { supabaseAdmin } from '@/supabase/admin';
import { toSupabaseUserId } from '@/lib/auth/verify-request';
import { downloadUserFile } from '@/lib/storage/file-storage';
import { redis } from '@/lib/redis/redis-client';

// Use dynamic import for pdf-parse to avoid bundling issues
async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(buffer);
  return result.text?.trim() || '';
}

// Cache extracted text for 30 minutes to avoid re-parsing on every request
const TEXT_CACHE_TTL = 30 * 60;

export interface UserAIContext {
  /** Extracted plain text from the user's resume PDF */
  resumeText: string | null;
  /** Extracted plain text from the user's transcript PDF */
  transcriptText: string | null;
  /** Basic profile metadata useful for personalisation */
  profile: {
    name: string;
    email: string;
    targetRole: string;
    experienceLevel: string;
    preferredTech: string[];
    careerGoals: string;
    bio: string;
  };
}

/**
 * Try to get cached extracted text from Redis
 */
async function getCachedText(userId: string, fileType: 'resume' | 'transcript'): Promise<string | null> {
  if (!redis) return null;
  try {
    const key = `user-file-text:${userId}:${fileType}`;
    const cached = await redis.get(key);
    if (cached) {
      console.log(`✅ Cache HIT - ${fileType} text for ${userId}`);
      return typeof cached === 'string' ? cached : null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache extracted text in Redis
 */
async function cacheText(userId: string, fileType: 'resume' | 'transcript', text: string): Promise<void> {
  if (!redis) return;
  try {
    const key = `user-file-text:${userId}:${fileType}`;
    await redis.setex(key, TEXT_CACHE_TTL, text);
    console.log(`✅ Cached ${fileType} text for ${userId} (${text.length} chars)`);
  } catch (error) {
    console.error(`⚠️ Failed to cache ${fileType} text:`, error);
  }
}

/**
 * Invalidate cached text (call after file upload/delete)
 */
export async function invalidateUserTextCache(userId: string, fileType?: 'resume' | 'transcript'): Promise<void> {
  if (!redis) return;
  try {
    if (fileType) {
      await redis.del(`user-file-text:${userId}:${fileType}`);
    } else {
      await redis.del(`user-file-text:${userId}:resume`);
      await redis.del(`user-file-text:${userId}:transcript`);
    }
    console.log(`✅ Invalidated text cache for ${userId}${fileType ? ` (${fileType})` : ''}`);
  } catch (error) {
    console.error('⚠️ Failed to invalidate text cache:', error);
  }
}

/**
 * Extract text from a user's uploaded PDF file.
 * Checks Redis cache first, then Storage.
 */
async function extractFileText(
  userId: string,
  fileType: 'resume' | 'transcript',
): Promise<string | null> {
  // 1. Check cache
  const cached = await getCachedText(userId, fileType);
  if (cached) return cached;

  // 2. Try downloading from Storage
  const buffer = await downloadUserFile(userId, fileType);
  if (!buffer) return null;

  // 3. Extract text with pdf-parse
  try {
    const text = await parsePdf(buffer);
    if (!text || text.length < 10) {
      console.warn(`⚠️ Extracted very little text from ${fileType} for ${userId}`);
      return null;
    }

    // 4. Cache for future requests
    await cacheText(userId, fileType, text);
    console.log(`✅ Extracted ${text.length} chars from ${fileType} for ${userId}`);
    return text;
  } catch (error) {
    console.error(`❌ Failed to parse ${fileType} PDF for ${userId}:`, error);
    return null;
  }
}

/**
 * Fetch the complete AI context for a user.
 * This is the single function all AI routes should call.
 *
 * Usage:
 *   const ctx = await getUserAIContext(userId);
 *   // then inject ctx.resumeText, ctx.transcriptText, ctx.profile into your prompt
 */
export async function getUserAIContext(userId: string): Promise<UserAIContext> {
  const supabaseUserId = await toSupabaseUserId(userId);
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('name, email, target_role, experience_level, preferred_tech, career_goals, bio')
    .eq('user_id', supabaseUserId)
    .maybeSingle();

  // Fetch file texts in parallel
  const [resumeText, transcriptText] = await Promise.all([
    extractFileText(userId, 'resume'),
    extractFileText(userId, 'transcript'),
  ]);

  return {
    resumeText,
    transcriptText,
    profile: {
      name: data?.name || '',
      email: data?.email || '',
      targetRole: data?.target_role || '',
      experienceLevel: data?.experience_level || 'mid',
      preferredTech: Array.isArray(data?.preferred_tech) ? data.preferred_tech : [],
      careerGoals: data?.career_goals || '',
      bio: data?.bio || '',
    },
  };
}

/**
 * Build a prompt section from the user's AI context.
 * Returns an empty string if no data is available, so it's safe to
 * always include in your prompt template.
 */
export function buildUserContextPrompt(ctx: UserAIContext): string {
  const sections: string[] = [];

  if (ctx.profile.name) {
    sections.push(`CANDIDATE NAME: ${ctx.profile.name}`);
  }

  if (ctx.profile.targetRole) {
    sections.push(`TARGET ROLE: ${ctx.profile.targetRole}`);
  }

  if (ctx.profile.experienceLevel) {
    sections.push(`EXPERIENCE LEVEL: ${ctx.profile.experienceLevel}`);
  }

  if (ctx.profile.preferredTech.length > 0) {
    sections.push(`PREFERRED TECHNOLOGIES: ${ctx.profile.preferredTech.join(', ')}`);
  }

  if (ctx.profile.careerGoals) {
    sections.push(`CAREER GOALS: ${ctx.profile.careerGoals}`);
  }

  if (ctx.profile.bio) {
    sections.push(`CANDIDATE BIO: ${ctx.profile.bio}`);
  }

  if (ctx.resumeText) {
    // Truncate to ~6000 chars to stay within prompt limits
    const truncated = ctx.resumeText.length > 6000
      ? ctx.resumeText.substring(0, 6000) + '\n[... resume truncated for length ...]'
      : ctx.resumeText;
    sections.push(`CANDIDATE RESUME:\n${truncated}`);
  }

  if (ctx.transcriptText) {
    // Truncate to ~3000 chars
    const truncated = ctx.transcriptText.length > 3000
      ? ctx.transcriptText.substring(0, 3000) + '\n[... transcript truncated for length ...]'
      : ctx.transcriptText;
    sections.push(`ACADEMIC TRANSCRIPT:\n${truncated}`);
  }

  if (sections.length === 0) return '';

  return `\n# CANDIDATE PROFILE & BACKGROUND\n${sections.join('\n\n')}\n`;
}