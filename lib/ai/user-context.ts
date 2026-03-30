// lib/ai/user-context.ts
//
// Shared helper that fetches a user's resume text, transcript text, and profile
// metadata so any AI route can inject personalised context into its prompts.

import { db } from '@/firebase/admin';
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
      console.log(`✅ Cache HIT — ${fileType} text for ${userId}`);
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
 * Checks Redis cache first, then Storage, then falls back to old base64 in Firestore.
 */
async function extractFileText(
  userId: string,
  fileType: 'resume' | 'transcript',
  firestoreData?: Record<string, unknown>
): Promise<string | null> {
  // 1. Check cache
  const cached = await getCachedText(userId, fileType);
  if (cached) return cached;

  // 2. Try downloading from Firebase Storage (new path)
  let buffer = await downloadUserFile(userId, fileType);

  // 3. Fallback: check if old base64 data exists in Firestore
  if (!buffer && firestoreData) {
    const base64Field = firestoreData[fileType] as string | undefined;
    if (base64Field && typeof base64Field === 'string' && base64Field.startsWith('data:')) {
      try {
        const base64Content = base64Field.includes(',') ? base64Field.split(',')[1] : base64Field;
        buffer = Buffer.from(base64Content, 'base64');
        console.log(`📦 Using legacy base64 ${fileType} from Firestore for ${userId} (${buffer.length} bytes)`);
      } catch (err) {
        console.warn(`⚠️ Failed to decode legacy base64 ${fileType}:`, err);
      }
    }
  }

  if (!buffer) return null;

  // 4. Extract text with pdf-parse
  try {
    const text = await parsePdf(buffer);
    if (!text || text.length < 10) {
      console.warn(`⚠️ Extracted very little text from ${fileType} for ${userId}`);
      return null;
    }

    // 5. Cache for future requests
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
  // Fetch profile first so we can pass it to extractFileText for base64 fallback
  const userDoc = await db.collection('users').doc(userId).get();
  const data = userDoc.data() || {};

  // Fetch file texts in parallel, with Firestore fallback for legacy base64
  const [resumeText, transcriptText] = await Promise.all([
    extractFileText(userId, 'resume', data),
    extractFileText(userId, 'transcript', data),
  ]);

  return {
    resumeText,
    transcriptText,
    profile: {
      name: data.name || '',
      email: data.email || '',
      targetRole: data.targetRole || '',
      experienceLevel: data.experienceLevel || 'mid',
      preferredTech: Array.isArray(data.preferredTech) ? data.preferredTech : [],
      careerGoals: data.careerGoals || '',
      bio: data.bio || '',
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