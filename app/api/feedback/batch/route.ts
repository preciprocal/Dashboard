// app/api/feedback/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";
import { redis } from "@/lib/redis/redis-client";

// Cache TTL for feedback (7 days - feedback doesn't change after creation)
const FEEDBACK_CACHE_TTL = 7 * 24 * 60 * 60;

// Define interfaces
interface Interview {
  id: string;
  [key: string]: unknown;
}

interface InterviewWithFeedback extends Interview {
  feedback?: FeedbackData | null;
  score: number;
}

interface BatchFeedbackRequest {
  interviews: Interview[];
  userId: string;
}

interface FeedbackData {
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

interface CachedFeedback {
  feedback: FeedbackData | null;
  cachedAt: string;
}

/**
 * Batch get multiple feedbacks from cache
 */
async function batchGetCachedFeedback(
  interviews: Interview[],
  userId: string
): Promise<Map<string, FeedbackData | null>> {
  if (!redis) return new Map();

  const feedbackMap = new Map<string, FeedbackData | null>();

  try {
    // Use Redis pipeline for efficient batch operations
    const pipeline = redis.pipeline();
    
    interviews.forEach(interview => {
      const key = `feedback:${userId}:${interview.id}`;
      pipeline.get(key);
    });

    const results = await pipeline.exec();
    
    if (Array.isArray(results)) {
      results.forEach((result, index) => {
        const interviewId = interviews[index].id;
        
        if (result && typeof result === 'object' && 'data' in result) {
          const cached = result.data;
          if (cached) {
            const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
            feedbackMap.set(interviewId, (data as CachedFeedback).feedback);
          }
        }
      });
    }

    console.log(`✅ Batch cache check: ${feedbackMap.size}/${interviews.length} hits`);
    return feedbackMap;
  } catch (error) {
    console.error('Redis batch get error:', error);
    return new Map();
  }
}

/**
 * Batch cache multiple feedbacks
 */
async function batchCacheFeedback(
  feedbackItems: Array<{ interviewId: string; userId: string; feedback: FeedbackData | null }>
): Promise<void> {
  if (!redis || feedbackItems.length === 0) return;

  try {
    const pipeline = redis.pipeline();
    
    feedbackItems.forEach(({ interviewId, userId, feedback }) => {
      const key = `feedback:${userId}:${interviewId}`;
      const data: CachedFeedback = {
        feedback,
        cachedAt: new Date().toISOString()
      };
      
      pipeline.setex(key, FEEDBACK_CACHE_TTL, JSON.stringify(data));
    });

    await pipeline.exec();
    console.log(`✅ Batch cached ${feedbackItems.length} feedbacks`);
  } catch (error) {
    console.error('Redis batch cache error:', error);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('📊 Batch feedback request started');
    console.log('   Redis available:', !!redis);

    const body = await request.json() as BatchFeedbackRequest;
    const { interviews, userId } = body;

    if (!interviews || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log(`📋 Processing ${interviews.length} interviews for user ${userId}`);

    // Try to get cached feedback in batch
    const cachedFeedbackMap = await batchGetCachedFeedback(interviews, userId);
    
    // Separate cached and uncached interviews
    const cachedInterviews: InterviewWithFeedback[] = [];
    const uncachedInterviews: Interview[] = [];

    interviews.forEach(interview => {
      const cached = cachedFeedbackMap.get(interview.id);
      
      if (cached !== undefined) {
        // Found in cache
        cachedInterviews.push({
          ...interview,
          feedback: cached,
          score: cached?.totalScore || 0,
        });
      } else {
        // Not in cache, need to fetch
        uncachedInterviews.push(interview);
      }
    });

    console.log(`⚡ Cache performance: ${cachedInterviews.length} hits, ${uncachedInterviews.length} misses`);

    // Fetch feedback for uncached interviews
    let newlyFetchedFeedback: InterviewWithFeedback[] = [];
    const feedbackToCache: Array<{ interviewId: string; userId: string; feedback: FeedbackData | null }> = [];

    if (uncachedInterviews.length > 0) {
      console.log(`🔍 Fetching ${uncachedInterviews.length} feedbacks from database...`);
      
      const feedbackPromises = uncachedInterviews.map(async (interview: Interview): Promise<InterviewWithFeedback> => {
        try {
          const feedback = await getFeedbackByInterviewId({
            interviewId: interview.id,
            userId: userId,
          });
          
          // Prepare for caching
          feedbackToCache.push({
            interviewId: interview.id,
            userId,
            feedback
          });

          return {
            ...interview,
            feedback: feedback,
            score: feedback?.totalScore || 0,
          };
        } catch (error) {
          console.error(`❌ Error fetching feedback for interview ${interview.id}:`, error);
          
          // Cache null result to prevent repeated failed lookups
          feedbackToCache.push({
            interviewId: interview.id,
            userId,
            feedback: null
          });

          return { 
            ...interview, 
            feedback: null,
            score: 0 
          };
        }
      });

      newlyFetchedFeedback = await Promise.all(feedbackPromises);
      
      // Batch cache the newly fetched feedback
      if (feedbackToCache.length > 0) {
        await batchCacheFeedback(feedbackToCache);
      }
    }

    // Combine cached and newly fetched results
    const interviewsWithFeedback = [...cachedInterviews, ...newlyFetchedFeedback];

    const totalTime = Date.now() - startTime;
    console.log(`✅ Batch feedback completed in ${totalTime}ms`);
    console.log(`   Total interviews: ${interviews.length}`);
    console.log(`   Cache hits: ${cachedInterviews.length}`);
    console.log(`   Database queries: ${uncachedInterviews.length}`);
    console.log(`   Cache hit rate: ${((cachedInterviews.length / interviews.length) * 100).toFixed(1)}%`);

    return NextResponse.json({ 
      interviews: interviewsWithFeedback,
      metadata: {
        totalRequests: interviews.length,
        cacheHits: cachedInterviews.length,
        cacheMisses: uncachedInterviews.length,
        cacheHitRate: ((cachedInterviews.length / interviews.length) * 100).toFixed(1) + '%',
        responseTime: totalTime
      }
    });
  } catch (error) {
    console.error("❌ Error fetching batch feedback:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}