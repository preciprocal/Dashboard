// lib/abuse/resume-hash.ts
// Content hashing for resumes, used to spot the same person re-uploading the
// same CV across multiple Free accounts.
//
// WHAT THIS CATCHES, AND WHAT IT DOESN'T
// This is an EXACT hash over aggressively-normalised text, not a fuzzy
// similarity score. It catches the actual farming pattern - burn the free
// quota, make a new account, upload the same PDF - including when the obvious
// identifying details are swapped, because normalisation strips exactly the
// fields a farmer edits (email, phone, URLs) before hashing.
//
// It does NOT catch someone who rewords a bullet point. Real near-duplicate
// detection needs simhash/minhash and a similarity threshold, which is a
// meaningfully bigger piece of work and much harder to tune without a corpus
// of true and false positives to test against. Since the output here only
// ever feeds a human review queue - never an automatic block - an exact hash
// that is cheap and has almost no false positives is the right first cut.
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/supabase/admin';
import { flagAccount } from '@/lib/abuse/flag-account';
import { FLAG_REASONS, MIN_RESUME_CHARS_FOR_HASH } from '@/lib/config/abuse-guard';

/**
 * Reduce resume text to its substantive content.
 *
 * The contact-detail stripping is the part doing the real work: two accounts
 * sharing a CV will differ exactly there, so removing those fields before
 * hashing is what turns "identical file" detection into "same underlying
 * resume" detection.
 */
export function normaliseResumeText(raw: string): string {
  return raw
    .toLowerCase()
    // Contact details - the fields most likely to be edited between accounts
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ')                      // emails
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, ' ')                    // phone numbers
    .replace(/https?:\/\/\S+/g, ' ')                               // urls
    .replace(/\b(?:linkedin|github)\.com\/\S+/g, ' ')              // bare profile links
    // Formatting noise: PDF extraction produces wildly different whitespace
    // and bullet glyphs for the same document depending on the parser path.
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns null when the text is too short to hash meaningfully. */
export function hashResumeText(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const normalised = normaliseResumeText(raw);
  // Below the floor is almost always a failed PDF parse rather than a real
  // resume. Hashing those would collide unrelated accounts on the same
  // near-empty string and bury the review queue in noise.
  if (normalised.length < MIN_RESUME_CHARS_FOR_HASH) return null;

  return createHash('sha256').update(normalised).digest('hex');
}

/**
 * Look for the same resume content on OTHER accounts and, if found, flag every
 * account involved for human review.
 *
 * Never throws and never blocks: the caller's upload must succeed regardless.
 * Deliberately flags both sides - at detection time there is no way to tell
 * which account is the original and which is the copy, and presenting one as
 * the culprit would bias whoever works the queue.
 */
export async function checkDuplicateResume(
  supabaseUserId: string,
  contentHash: string,
  resumeId: string,
): Promise<void> {
  try {
    const { data: matches, error } = await supabaseAdmin
      .from('resumes')
      .select('id, user_id')
      .eq('content_hash', contentHash)
      .eq('deleted', false)
      .neq('user_id', supabaseUserId)
      .limit(25);
    if (error) throw error;
    if (!matches || matches.length === 0) return;

    const otherUserIds = [...new Set(matches.map(m => m.user_id as string))];

    // Only Free accounts are interesting. A paying user uploading the same CV
    // as someone else is far more likely to be a shared template, a career
    // coach, or a university careers service than quota farming.
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, plan')
      .in('user_id', [supabaseUserId, ...otherUserIds]);

    const freeUserIds = new Set(
      (subs ?? [])
        .filter(s => (s.plan as string | null)?.toLowerCase() !== 'pro'
                  && (s.plan as string | null)?.toLowerCase() !== 'premium')
        .map(s => s.user_id as string),
    );

    const involved = [supabaseUserId, ...otherUserIds].filter(id => freeUserIds.has(id));
    // Needs at least two free accounts sharing the content to mean anything.
    if (involved.length < 2) return;

    await Promise.all(
      involved.map(id =>
        flagAccount(id, FLAG_REASONS.duplicateResume, {
          contentHash,
          resumeId: id === supabaseUserId ? resumeId : undefined,
          sharedWith: involved.filter(other => other !== id),
          detectedAt: new Date().toISOString(),
        }),
      ),
    );

    console.log(
      `🚩 Duplicate resume content across ${involved.length} free accounts: ${involved.join(', ')}`,
    );
  } catch (err) {
    console.error('⚠️ Duplicate resume check failed (non-fatal):', err);
  }
}
