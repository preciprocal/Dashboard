"use server";

import OpenAI from "openai";
import { supabaseAdmin } from "@/supabase/admin";
import { toSupabaseUserId } from "@/lib/auth/verify-request";
import { redis } from "@/lib/redis/redis-client";
import { getUserAIContext, buildUserContextPrompt } from "@/lib/ai/user-context";
// checkAndIncrementUsage was imported here to charge for an interview on
// feedback creation. It is gone: app/api/vapi/generate is the single charge
// point. See the note in createFeedback.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache TTLs
const INTERVIEW_CACHE_TTL = 5 * 60;
const INTERVIEWS_LIST_CACHE_TTL = 5 * 60;
const FEEDBACK_CACHE_TTL = 7 * 24 * 60 * 60;
const LATEST_INTERVIEWS_CACHE_TTL = 10 * 60;

// ============ TYPE DEFINITIONS ============

interface TranscriptMessage { role: string; content: string; }
interface CreateFeedbackParams { interviewId: string; userId: string; transcript: TranscriptMessage[]; feedbackId?: string; }
interface GetFeedbackByInterviewIdParams { interviewId: string; userId: string; }
interface GetLatestInterviewsParams { userId: string; limit?: number; }
interface FirestoreTimestamp { seconds: number; nanoseconds: number; toDate: () => Date; }

interface Interview {
  id: string; userId: string; role: string;
  type: "technical" | "behavioral" | "system-design" | "coding";
  techstack: string[]; company: string; position: string;
  createdAt: FirestoreTimestamp | Date | string;
  updatedAt: FirestoreTimestamp | Date | string;
  duration: number; status: "completed" | "in-progress" | "scheduled";
  finalized?: boolean; questions?: string[]; level?: string;
  feedback?: Record<string, unknown>; score?: number;
  /**
   * The real technical/behavioural split for a mixed interview.
   *
   * app/api/vapi/generate writes these into interviews.metadata when it
   * generates the two halves, and toInterview() used to drop metadata on the
   * floor. With them missing the panel fell back to slicing the flat
   * `questions` array down the middle, which is positional rather than
   * semantic: a mixed interview whose first half happened to be technical
   * asked technical questions in the HR interviewer's voice.
   */
  technicalQuestions?: string[];
  behavioralQuestions?: string[];
}

interface Feedback {
  id: string; interviewId: string; userId: string;
  totalScore: number; categoryScores: Record<string, number>;
  strengths: string[]; areasForImprovement: string[];
  finalAssessment: string; createdAt: string; updatedAt?: string;
}

interface CachedData<T> { data: T; cachedAt: string; }

interface InterviewRow {
  id: string; user_id: string; role: string | null; type: string | null;
  techstack: string[] | null; company: string | null; position: string | null;
  level: string | null; duration: string | null; status: string | null;
  finalized: boolean; questions: unknown; metadata: Record<string, unknown> | null;
  created_at: string; updated_at: string;
}

function toInterview(row: InterviewRow): Interview {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role ?? "",
    type: (row.type as Interview["type"]) ?? "technical",
    techstack: row.techstack ?? [],
    company: row.company ?? "",
    position: row.position ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    duration: row.duration ? Number(row.duration) || 0 : 0,
    status: (row.status as Interview["status"]) ?? "completed",
    finalized: row.finalized,
    questions: (row.questions as string[]) ?? [],
    level: row.level ?? undefined,
    // Carried out of metadata so a mixed interview can be split by MEANING
    // rather than by array position. Only present on interviews the generator
    // produced as mixed; everything else falls back as before.
    technicalQuestions: asStringArray(row.metadata?.technicalQuestions),
    behavioralQuestions: asStringArray(row.metadata?.behavioralQuestions),
  };
}

/** metadata is untyped jsonb, so anything in it has to be checked, not cast. */
function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  return strings.length ? strings : undefined;
}

interface FeedbackRow {
  id: string; interview_id: string; user_id: string;
  total_score: number | null; category_scores: Record<string, number> | null;
  strengths: string[] | null; areas_for_improvement: string[] | null;
  final_assessment: string | null; created_at: string;
}

function toFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    interviewId: row.interview_id,
    userId: row.user_id,
    totalScore: row.total_score ?? 0,
    categoryScores: row.category_scores ?? {},
    strengths: row.strengths ?? [],
    areasForImprovement: row.areas_for_improvement ?? [],
    finalAssessment: row.final_assessment ?? "",
    createdAt: row.created_at,
  };
}

// ============ CACHE HELPERS ============

// Bumped to v2 when technicalQuestions/behavioralQuestions were added to
// Interview. Entries cached under the old key lack those fields, and a mixed
// interview read from one would silently fall back to splitting its question
// list by position - the exact bug the new fields fix, reappearing for anyone
// whose interview happened to be cached. Changing the key retires them
// immediately instead of waiting out the TTL.
const INTERVIEW_KEY = (id: string) => `interview:v2:${id}`;

async function getCachedInterview(interviewId: string): Promise<Interview | null> {
  if (!redis) return null;
  try { const c = await redis.get(INTERVIEW_KEY(interviewId)); if (c) { const d = typeof c === 'string' ? JSON.parse(c) : c; return (d as CachedData<Interview>).data; } return null; }
  catch { return null; }
}

async function cacheInterview(interview: Interview): Promise<void> {
  if (!redis) return;
  try { await redis.setex(INTERVIEW_KEY(interview.id), INTERVIEW_CACHE_TTL, JSON.stringify({ data: interview, cachedAt: new Date().toISOString() })); }
  catch { /* ignore */ }
}

async function getCachedInterviews(userId: string): Promise<Interview[] | null> {
  if (!redis) return null;
  try { const c = await redis.get(`interviews:${userId}`); if (c) { const d = typeof c === 'string' ? JSON.parse(c) : c; return (d as CachedData<Interview[]>).data; } return null; }
  catch { return null; }
}

async function cacheInterviews(userId: string, interviews: Interview[]): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`interviews:${userId}`, INTERVIEWS_LIST_CACHE_TTL, JSON.stringify({ data: interviews, cachedAt: new Date().toISOString() })); }
  catch { /* ignore */ }
}

async function getCachedFeedback(interviewId: string, userId: string): Promise<Feedback | null> {
  if (!redis) return null;
  try { const c = await redis.get(`feedback:${userId}:${interviewId}`); if (c) { const d = typeof c === 'string' ? JSON.parse(c) : c; return (d as CachedData<Feedback>).data; } return null; }
  catch { return null; }
}

async function cacheFeedback(feedback: Feedback): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`feedback:${feedback.userId}:${feedback.interviewId}`, FEEDBACK_CACHE_TTL, JSON.stringify({ data: feedback, cachedAt: new Date().toISOString() })); }
  catch { /* ignore */ }
}

async function getCachedLatestInterviews(limit: number): Promise<Interview[] | null> {
  if (!redis) return null;
  try { const c = await redis.get(`latest-interviews:${limit}`); if (c) { const d = typeof c === 'string' ? JSON.parse(c) : c; return (d as CachedData<Interview[]>).data; } return null; }
  catch { return null; }
}

async function cacheLatestInterviews(interviews: Interview[], limit: number): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`latest-interviews:${limit}`, LATEST_INTERVIEWS_CACHE_TTL, JSON.stringify({ data: interviews, cachedAt: new Date().toISOString() })); }
  catch { /* ignore */ }
}

async function invalidateUserInterviewsCache(userId: string): Promise<void> {
  if (!redis) return;
  try { await redis.del(`interviews:${userId}`); } catch { /* ignore */ }
}

async function invalidateInterviewCache(interviewId: string): Promise<void> {
  if (!redis) return;
  // Both keys: the v1 entry may still exist and, while it does, nothing else
  // would ever clear it.
  try { await redis.del(INTERVIEW_KEY(interviewId), `interview:${interviewId}`); } catch { /* ignore */ }
}

// ============ MAIN FUNCTIONS ============

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map((s: TranscriptMessage) => `- ${s.role}: ${s.content}\n`)
      .join("");

    // ── Fetch user context for personalised feedback ──
    let userContext = '';
    try {
      const ctx = await getUserAIContext(userId);
      userContext = buildUserContextPrompt(ctx);
      if (userContext) console.log(`✅ Feedback: user context loaded (resume: ${!!ctx.resumeText}, transcript: ${!!ctx.transcriptText})`);
    } catch (err) {
      console.warn('⚠️ Failed to load user context for feedback:', err);
    }

    const prompt = `You are an AI interviewer analyzing a mock interview. Be thorough and honest. Don't be lenient - point out mistakes clearly.
${userContext ? `\n${userContext}\nIMPORTANT: Use the candidate's resume and academic background to evaluate whether their answers align with their claimed experience. Flag any inconsistencies.\n` : ''}
Transcript:
${formattedTranscript}

Score the candidate 0-100 in these categories ONLY:
- Communication Skills: Clarity, articulation, structured responses.
- Technical Knowledge: Understanding of key concepts for the role.
- Problem-Solving: Ability to analyze problems and propose solutions.
- Cultural & Role Fit: Alignment with company values and job role.
- Confidence & Clarity: Confidence in responses, engagement, and clarity.

Return ONLY valid JSON matching this schema:
{
  "totalScore": <number 0-100>,
  "categoryScores": [{ "name": "<category>", "score": <number 0-100>, "comment": "<specific feedback>" }],
  "strengths": ["<specific strength with evidence>"],
  "areasForImprovement": ["<specific area with actionable advice>"],
  "finalAssessment": "<honest 2-3 sentence assessment of readiness>"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2048,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You are a professional interviewer analyzing a mock interview. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: prompt },
      ],
    });

    const responseText = completion.choices[0]?.message?.content?.trim() ?? '';
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const object = JSON.parse(cleaned);

    // Convert categoryScores
    let categoryScoresRecord: Record<string, number> = {};
    if (Array.isArray(object.categoryScores)) {
      object.categoryScores.forEach((cat: { name: string; score: number }) => {
        categoryScoresRecord[cat.name] = cat.score;
      });
    } else {
      categoryScoresRecord = object.categoryScores as Record<string, number>;
    }

    const supabaseUserId = await toSupabaseUserId(userId);

    // Upsert on the table's (interview_id, user_id) unique constraint - this
    // is what the old feedbackId param manually achieved (reuse the same doc
    // when an interview is retaken), so feedbackId itself is now unused.
    void feedbackId;
    const { data: row, error } = await supabaseAdmin
      .from("interview_feedback")
      .upsert({
        interview_id: interviewId,
        user_id: supabaseUserId,
        total_score: object.totalScore,
        category_scores: categoryScoresRecord,
        strengths: object.strengths,
        areas_for_improvement: object.areasForImprovement,
        final_assessment: object.finalAssessment,
      }, { onConflict: "interview_id,user_id" })
      .select()
      .single();

    if (error) throw error;

    const feedbackWithId = toFeedback(row as FeedbackRow);
    await cacheFeedback(feedbackWithId);
    await invalidateUserInterviewsCache(userId);
    await invalidateInterviewCache(interviewId);

    // NO usage increment here. This used to call
    // checkAndIncrementUsage(userId, 'interviews'), described as replacing an
    // old client-side Firestore increment - but app/api/vapi/generate already
    // charges one 'interviews' unit when the interview is created, so every
    // completed interview was billed TWICE.
    //
    // Confirmed against production before removing: one account had 3
    // interviews and 2 feedback rows against interviews_used = 4. On Premium
    // that turns an advertised 5 mock interviews a month into 2.
    //
    // Generation is the right and only place to charge. It is where the limit
    // is checked, so it is where the user is told; and charging again on
    // completion would mean an interview costs more the further you get
    // through it.

    console.log('✅ Feedback created (OpenAI + user context)');
    return { success: true, feedbackId: feedbackWithId.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

// ============ READ FUNCTIONS (unchanged) ============

export async function getInterviewById(id: string): Promise<Interview | null> {
  const cached = await getCachedInterview(id);
  if (cached) return cached;
  const { data: row, error } = await supabaseAdmin.from("interviews").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const data = toInterview(row as InterviewRow);
  await cacheInterview(data);
  return data;
}

export async function getFeedbackByInterviewId(params: GetFeedbackByInterviewIdParams): Promise<Feedback | null> {
  const { interviewId, userId } = params;
  const cached = await getCachedFeedback(interviewId, userId);
  if (cached) return cached;

  const supabaseUserId = await toSupabaseUserId(userId);
  const { data: row, error } = await supabaseAdmin
    .from("interview_feedback")
    .select("*")
    .eq("interview_id", interviewId)
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  if (error) throw error;

  if (!row) {
    if (redis) { try { await redis.setex(`feedback:${userId}:${interviewId}`, 60, JSON.stringify({ data: null, cachedAt: new Date().toISOString() })); } catch {} }
    return null;
  }
  const feedback = toFeedback(row as FeedbackRow);
  await cacheFeedback(feedback);
  return feedback;
}

export async function getLatestInterviews(params: GetLatestInterviewsParams): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;
  const cached = await getCachedLatestInterviews(limit);
  if (cached) return cached;

  const supabaseUserId = await toSupabaseUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("interviews")
    .select("*")
    .eq("finalized", true)
    .neq("user_id", supabaseUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const list = (data as InterviewRow[]).map(toInterview);
  await cacheLatestInterviews(list, limit);
  return list;
}

export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
  const cached = await getCachedInterviews(userId);
  if (cached) return cached;

  const supabaseUserId = await toSupabaseUserId(userId);
  const { data, error } = await supabaseAdmin
    .from("interviews")
    .select("*")
    .eq("user_id", supabaseUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const list = (data as InterviewRow[]).map(toInterview);
  await cacheInterviews(userId, list);
  return list;
}

export async function invalidateInterviewCaches(userId: string, interviewId?: string) {
  await invalidateUserInterviewsCache(userId);
  if (interviewId) await invalidateInterviewCache(interviewId);
}

export async function invalidateFeedbackCache(userId: string, interviewId: string) {
  if (!redis) return;
  try { await redis.del(`feedback:${userId}:${interviewId}`); } catch { /* ignore */ }
}