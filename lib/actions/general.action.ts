"use server";

import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { redis } from "@/lib/redis/redis-client";
import { getUserAIContext, buildUserContextPrompt } from "@/lib/ai/user-context";

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
}

interface Feedback {
  id: string; interviewId: string; userId: string;
  totalScore: number; categoryScores: Record<string, number>;
  strengths: string[]; areasForImprovement: string[];
  finalAssessment: string; createdAt: string; updatedAt?: string;
}

interface CachedData<T> { data: T; cachedAt: string; }

// ============ CACHE HELPERS ============

async function getCachedInterview(interviewId: string): Promise<Interview | null> {
  if (!redis) return null;
  try { const c = await redis.get(`interview:${interviewId}`); if (c) { const d = typeof c === 'string' ? JSON.parse(c) : c; return (d as CachedData<Interview>).data; } return null; }
  catch { return null; }
}

async function cacheInterview(interview: Interview): Promise<void> {
  if (!redis) return;
  try { await redis.setex(`interview:${interview.id}`, INTERVIEW_CACHE_TTL, JSON.stringify({ data: interview, cachedAt: new Date().toISOString() })); }
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
  try { await redis.del(`interview:${interviewId}`); } catch { /* ignore */ }
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

    const prompt = `You are an AI interviewer analyzing a mock interview. Be thorough and honest. Don't be lenient — point out mistakes clearly.
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

    const feedback = {
      interviewId, userId,
      totalScore: object.totalScore,
      categoryScores: categoryScoresRecord,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    const feedbackRef = feedbackId
      ? db.collection("feedback").doc(feedbackId)
      : db.collection("feedback").doc();

    await feedbackRef.set(feedback);

    const feedbackWithId: Feedback = { id: feedbackRef.id, ...feedback };
    await cacheFeedback(feedbackWithId);
    await invalidateUserInterviewsCache(userId);
    await invalidateInterviewCache(interviewId);

    console.log('✅ Feedback created (OpenAI + user context)');
    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

// ============ READ FUNCTIONS (unchanged) ============

export async function getInterviewById(id: string): Promise<Interview | null> {
  const cached = await getCachedInterview(id);
  if (cached) return cached;
  const doc = await db.collection("interviews").doc(id).get();
  if (!doc.exists) return null;
  const data = { id: doc.id, ...doc.data() } as Interview;
  await cacheInterview(data);
  return data;
}

export async function getFeedbackByInterviewId(params: GetFeedbackByInterviewIdParams): Promise<Feedback | null> {
  const { interviewId, userId } = params;
  const cached = await getCachedFeedback(interviewId, userId);
  if (cached) return cached;
  const snap = await db.collection("feedback").where("interviewId", "==", interviewId).where("userId", "==", userId).limit(1).get();
  if (snap.empty) {
    if (redis) { try { await redis.setex(`feedback:${userId}:${interviewId}`, 60, JSON.stringify({ data: null, cachedAt: new Date().toISOString() })); } catch {} }
    return null;
  }
  const doc = snap.docs[0];
  const d = doc.data();
  let scores: Record<string, number> = {};
  if (Array.isArray(d.categoryScores)) { d.categoryScores.forEach((c: { name: string; score: number }) => { scores[c.name] = c.score; }); }
  else if (d.categoryScores && typeof d.categoryScores === 'object') { scores = d.categoryScores as Record<string, number>; }
  const feedback: Feedback = { id: doc.id, ...d, categoryScores: scores } as Feedback;
  await cacheFeedback(feedback);
  return feedback;
}

export async function getLatestInterviews(params: GetLatestInterviewsParams): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;
  const cached = await getCachedLatestInterviews(limit);
  if (cached) return cached;
  const snap = await db.collection("interviews").orderBy("createdAt", "desc").where("finalized", "==", true).where("userId", "!=", userId).limit(limit).get();
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Interview[];
  await cacheLatestInterviews(list, limit);
  return list;
}

export async function getInterviewsByUserId(userId: string): Promise<Interview[] | null> {
  const cached = await getCachedInterviews(userId);
  if (cached) return cached;
  const snap = await db.collection("interviews").where("userId", "==", userId).orderBy("createdAt", "desc").get();
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Interview[];
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