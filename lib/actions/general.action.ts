"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";
import { redis } from "@/lib/redis/redis-client";

// Cache TTLs
const INTERVIEW_CACHE_TTL = 5 * 60; // 5 minutes
const INTERVIEWS_LIST_CACHE_TTL = 5 * 60; // 5 minutes
const FEEDBACK_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days (feedback doesn't change)
const LATEST_INTERVIEWS_CACHE_TTL = 10 * 60; // 10 minutes

// ============ TYPE DEFINITIONS ============

interface TranscriptMessage {
  role: string;
  content: string;
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: TranscriptMessage[];
  feedbackId?: string;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

// Firestore Timestamp type
interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}

interface Interview {
  id: string;
  userId: string;
  role: string;
  type: "technical" | "behavioral" | "system-design" | "coding";
  techstack: string[];
  company: string;
  position: string;
  createdAt: FirestoreTimestamp | Date | string;
  updatedAt: FirestoreTimestamp | Date | string;
  duration: number;
  status: "completed" | "in-progress" | "scheduled";
  finalized?: boolean;
  questions?: string[];
  level?: string;
  feedback?: Record<string, unknown>;
  score?: number;
}

interface Feedback {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
  updatedAt?: string;
  technicalAccuracy?: number;
  communication?: number;
  problemSolving?: number;
  confidence?: number;
  overallRating?: number;
}

interface CachedData<T> {
  data: T;
  cachedAt: string;
}

// ============ CACHE HELPER FUNCTIONS ============

/**
 * Get cached interview by ID
 */
async function getCachedInterview(interviewId: string): Promise<Interview | null> {
  if (!redis) return null;

  try {
    const key = `interview:${interviewId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - Interview ${interviewId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedData<Interview>).data;
    }

    console.log(`❌ Cache MISS - Interview ${interviewId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache interview
 */
async function cacheInterview(interview: Interview): Promise<void> {
  if (!redis) return;

  try {
    const key = `interview:${interview.id}`;
    const data: CachedData<Interview> = {
      data: interview,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, INTERVIEW_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached interview ${interview.id}`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Get cached interviews list for user
 */
async function getCachedInterviews(userId: string): Promise<Interview[] | null> {
  if (!redis) return null;

  try {
    const key = `interviews:${userId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - Interviews for user ${userId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedData<Interview[]>).data;
    }

    console.log(`❌ Cache MISS - Interviews for user ${userId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache interviews list
 */
async function cacheInterviews(userId: string, interviews: Interview[]): Promise<void> {
  if (!redis) return;

  try {
    const key = `interviews:${userId}`;
    const data: CachedData<Interview[]> = {
      data: interviews,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, INTERVIEWS_LIST_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached interviews list for user ${userId} (${interviews.length} items)`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Get cached feedback
 */
async function getCachedFeedback(interviewId: string, userId: string): Promise<Feedback | null> {
  if (!redis) return null;

  try {
    const key = `feedback:${userId}:${interviewId}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - Feedback for interview ${interviewId}`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedData<Feedback>).data;
    }

    console.log(`❌ Cache MISS - Feedback for interview ${interviewId}`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache feedback
 */
async function cacheFeedback(feedback: Feedback): Promise<void> {
  if (!redis) return;

  try {
    const key = `feedback:${feedback.userId}:${feedback.interviewId}`;
    const data: CachedData<Feedback> = {
      data: feedback,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, FEEDBACK_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached feedback for interview ${feedback.interviewId}`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Get cached latest interviews
 */
async function getCachedLatestInterviews(limit: number): Promise<Interview[] | null> {
  if (!redis) return null;

  try {
    const key = `latest-interviews:${limit}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log(`✅ Cache HIT - Latest ${limit} interviews`);
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedData<Interview[]>).data;
    }

    console.log(`❌ Cache MISS - Latest ${limit} interviews`);
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  }
}

/**
 * Cache latest interviews
 */
async function cacheLatestInterviews(interviews: Interview[], limit: number): Promise<void> {
  if (!redis) return;

  try {
    const key = `latest-interviews:${limit}`;
    const data: CachedData<Interview[]> = {
      data: interviews,
      cachedAt: new Date().toISOString()
    };

    await redis.setex(key, LATEST_INTERVIEWS_CACHE_TTL, JSON.stringify(data));
    console.log(`✅ Cached latest ${limit} interviews`);
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

/**
 * Invalidate user's interviews cache
 */
async function invalidateUserInterviewsCache(userId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `interviews:${userId}`;
    await redis.del(key);
    console.log(`✅ Invalidated interviews cache for user ${userId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

/**
 * Invalidate interview cache
 */
async function invalidateInterviewCache(interviewId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = `interview:${interviewId}`;
    await redis.del(key);
    console.log(`✅ Invalidated interview cache ${interviewId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}

// ============ MAIN FUNCTIONS ============

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: TranscriptMessage) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const { object } = await generateObject({
      model: google("gemini-2.5-flash", {
        structuredOutputs: false,
      }),
      schema: feedbackSchema,
      prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem-Solving**: Ability to analyze problems and propose solutions.
        - **Cultural & Role Fit**: Alignment with company values and job role.
        - **Confidence & Clarity**: Confidence in responses, engagement, and clarity.
        `,
      system:
        "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
    });

    // Convert categoryScores array to Record<string, number> if needed
    let categoryScoresRecord: Record<string, number> = {};
    
    if (Array.isArray(object.categoryScores)) {
      // If it's an array, convert to object
      object.categoryScores.forEach((category: { name: string; score: number }) => {
        categoryScoresRecord[category.name] = category.score;
      });
    } else {
      // If it's already an object, use it directly
      categoryScoresRecord = object.categoryScores as Record<string, number>;
    }

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: categoryScoresRecord,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    // Cache the feedback with proper typing
    const feedbackWithId: Feedback = { 
      id: feedbackRef.id, 
      ...feedback 
    };
    
    await cacheFeedback(feedbackWithId);

    // Invalidate related caches
    await invalidateUserInterviewsCache(userId);
    await invalidateInterviewCache(interviewId);

    console.log('✅ Feedback created and cached');

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  // Check cache first
  const cached = await getCachedInterview(id);
  if (cached) return cached;

  // Fetch from Firestore
  const interview = await db.collection("interviews").doc(id).get();

  if (!interview.exists) {
    return null;
  }

  const interviewData = { id: interview.id, ...interview.data() } as Interview;

  // Cache the interview
  await cacheInterview(interviewData);

  return interviewData;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  // Check cache first
  const cached = await getCachedFeedback(interviewId, userId);
  if (cached) return cached;

  // Fetch from Firestore
  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) {
    // Cache null result to prevent repeated lookups
    if (redis) {
      try {
        const key = `feedback:${userId}:${interviewId}`;
        await redis.setex(key, 60, JSON.stringify({ data: null, cachedAt: new Date().toISOString() }));
      } catch (error) {
        console.error('Redis cache null error:', error);
      }
    }
    return null;
  }

  const feedbackDoc = querySnapshot.docs[0];
  const feedbackData = feedbackDoc.data();
  
  // Ensure categoryScores is in the correct format
  let categoryScoresRecord: Record<string, number> = {};
  
  if (Array.isArray(feedbackData.categoryScores)) {
    feedbackData.categoryScores.forEach((category: { name: string; score: number }) => {
      categoryScoresRecord[category.name] = category.score;
    });
  } else if (feedbackData.categoryScores && typeof feedbackData.categoryScores === 'object') {
    categoryScoresRecord = feedbackData.categoryScores as Record<string, number>;
  }

  const feedback: Feedback = { 
    id: feedbackDoc.id, 
    ...feedbackData,
    categoryScores: categoryScoresRecord
  } as Feedback;

  // Cache the feedback
  await cacheFeedback(feedback);

  return feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  // Check cache first
  const cached = await getCachedLatestInterviews(limit);
  if (cached) return cached;

  // Fetch from Firestore
  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  const interviewsList = interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];

  // Cache the results
  await cacheLatestInterviews(interviewsList, limit);

  return interviewsList;
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  // Check cache first
  const cached = await getCachedInterviews(userId);
  if (cached) return cached;

  // Fetch from Firestore
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .get();

  const interviewsList = interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];

  // Cache the results
  await cacheInterviews(userId, interviewsList);

  return interviewsList;
}

// ============ EXPORT CACHE INVALIDATION FUNCTIONS ============

/**
 * Call this when user completes a new interview
 */
export async function invalidateInterviewCaches(userId: string, interviewId?: string) {
  await invalidateUserInterviewsCache(userId);
  if (interviewId) {
    await invalidateInterviewCache(interviewId);
  }
  console.log('✅ Interview caches invalidated');
}

/**
 * Call this when feedback is updated
 */
export async function invalidateFeedbackCache(userId: string, interviewId: string) {
  if (!redis) return;

  try {
    const key = `feedback:${userId}:${interviewId}`;
    await redis.del(key);
    console.log(`✅ Invalidated feedback cache for interview ${interviewId}`);
  } catch (error) {
    console.error('Redis delete error:', error);
  }
}