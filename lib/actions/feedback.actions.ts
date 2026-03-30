// lib/actions/feedback.actions.ts

import OpenAI from "openai";
import { redis } from "@/lib/redis/redis-client";
import { hashResumeContent } from "@/lib/redis/resume-cache";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache TTL for interview feedback (7 days - feedback doesn't change)
const FEEDBACK_GENERATION_CACHE_TTL = 7 * 24 * 60 * 60;

interface AnswerAnalytics {
  question: string;
  answer: string;
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
  hasSubstance: boolean;
  isEmpty: boolean;
  isOneWord: boolean;
  quality: number;
  hasExamples: boolean;
  hasStructure: boolean;
  isRelevant: boolean;
}

interface InterviewAnalytics {
  totalWords: number;
  avgWordsPerAnswer: number;
  emptyAnswers: number;
  substantiveAnswers: number;
  completionRate: number;
  interviewDuration: number;
  expectedDuration: number;
  wasRushed: boolean;
  averageQuality: number;
}

interface GeneratedFeedback {
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  analytics?: InterviewAnalytics;
  answerDetails?: AnswerAnalytics[];
}

interface CachedFeedback {
  feedback: GeneratedFeedback;
  cachedAt: string;
}

/**
 * Generate cache key for feedback
 */
function generateFeedbackCacheKey(
  questions: Array<{ question: string; answer: string }>,
  role: string,
  type: string,
  techstack: string[]
): string {
  const content = JSON.stringify({
    questions,
    role,
    type,
    techstack: techstack.sort()
  });
  return hashResumeContent(content);
}

/**
 * Get cached feedback
 */
async function getCachedGeneratedFeedback(cacheKey: string): Promise<GeneratedFeedback | null> {
  if (!redis) return null;

  try {
    const key = `feedback-generation:${cacheKey}`;
    const cached = await redis.get(key);

    if (cached) {
      console.log('✅ Cache HIT - Generated feedback found');
      const data = typeof cached === 'string'
        ? JSON.parse(cached) as CachedFeedback
        : cached as CachedFeedback;
      return data.feedback;
    }

    console.log('📭 Cache MISS - No generated feedback found');
    return null;
  } catch (error) {
    console.error('⚠️ Cache read error:', error);
    return null;
  }
}

/**
 * Cache generated feedback
 */
async function cacheGeneratedFeedback(cacheKey: string, feedback: GeneratedFeedback): Promise<void> {
  if (!redis) return;

  try {
    const key = `feedback-generation:${cacheKey}`;
    const data: CachedFeedback = {
      feedback,
      cachedAt: new Date().toISOString()
    };
    await redis.set(key, JSON.stringify(data), { ex: FEEDBACK_GENERATION_CACHE_TTL });
    console.log('✅ Feedback cached successfully');
  } catch (error) {
    console.error('⚠️ Cache write error:', error);
  }
}

/**
 * Analyze individual answers
 */
function analyzeAnswers(
  questions: Array<{ question: string; answer: string }>
): AnswerAnalytics[] {
  return questions.map(({ question, answer }) => {
    const words = answer.trim().split(/\s+/).filter(Boolean);
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const wordCount = words.length;
    const sentenceCount = sentences.length;

    const hasExamples = /for example|for instance|such as|like when|I remember|one time|in my experience/i.test(answer);
    const hasStructure = /first|second|third|additionally|moreover|furthermore|in conclusion|to summarize/i.test(answer);
    const isRelevant = wordCount > 10;

    let quality = 0;
    if (wordCount >= 80) quality += 30;
    else if (wordCount >= 40) quality += 20;
    else if (wordCount >= 15) quality += 10;
    if (hasExamples) quality += 25;
    if (hasStructure) quality += 20;
    if (isRelevant) quality += 15;
    if (sentenceCount >= 3) quality += 10;

    return {
      question,
      answer,
      wordCount,
      sentenceCount,
      avgWordsPerSentence: sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0,
      hasSubstance: wordCount >= 20,
      isEmpty: wordCount === 0,
      isOneWord: wordCount === 1,
      quality: Math.min(quality, 100),
      hasExamples,
      hasStructure,
      isRelevant,
    };
  });
}

/**
 * Summarize interview analytics
 */
function summarizeInterview(
  analytics: AnswerAnalytics[],
  interviewDuration: number
): InterviewAnalytics {
  const totalWords = analytics.reduce((sum, a) => sum + a.wordCount, 0);
  const emptyAnswers = analytics.filter(a => a.isEmpty).length;
  const substantiveAnswers = analytics.filter(a => a.hasSubstance).length;
  const expectedDuration = analytics.length * 3 * 60; // 3 min per question

  return {
    totalWords,
    avgWordsPerAnswer: analytics.length > 0 ? Math.round(totalWords / analytics.length) : 0,
    emptyAnswers,
    substantiveAnswers,
    completionRate: analytics.length > 0
      ? Math.round(((analytics.length - emptyAnswers) / analytics.length) * 100)
      : 0,
    interviewDuration,
    expectedDuration,
    wasRushed: interviewDuration < expectedDuration * 0.5,
    averageQuality: analytics.length > 0
      ? Math.round(analytics.reduce((sum, a) => sum + a.quality, 0) / analytics.length)
      : 0,
  };
}

/**
 * Generate feedback using OpenAI
 */
export async function generateInterviewFeedback(
  interviewData: {
    questions: Array<{ question: string; answer: string }>;
    role: string;
    type: string;
    techstack: string[];
    interviewDuration?: number;
  }
): Promise<GeneratedFeedback> {
  const startTime = Date.now();

  // Check cache first
  const cacheKey = generateFeedbackCacheKey(
    interviewData.questions,
    interviewData.role,
    interviewData.type,
    interviewData.techstack
  );

  const cached = await getCachedGeneratedFeedback(cacheKey);
  if (cached) return cached;

  // Analyze answers
  const analytics = analyzeAnswers(interviewData.questions);
  const summary = summarizeInterview(analytics, interviewData.interviewDuration || 0);

  const strictPrompt = `You are a BRUTALLY HONEST interview evaluator. Analyze this ${interviewData.type} interview for a ${interviewData.role} position.

TECH STACK: ${interviewData.techstack.join(', ')}

INTERVIEW ANALYTICS:
- Total words spoken: ${summary.totalWords}
- Average words per answer: ${summary.avgWordsPerAnswer}
- Empty/skipped answers: ${summary.emptyAnswers} out of ${analytics.length}
- Substantive answers (20+ words): ${summary.substantiveAnswers}
- Completion rate: ${summary.completionRate}%
- Interview duration: ${summary.interviewDuration}s (expected: ${summary.expectedDuration}s)
- Was rushed: ${summary.wasRushed}
- Average answer quality: ${summary.averageQuality}/100

DETAILED ANSWER ANALYSIS:
${analytics.map((a, i) => `
Q${i + 1}: ${a.question}
A${i + 1}: ${a.answer || '[NO ANSWER PROVIDED]'}
Stats: ${a.wordCount} words, ${a.sentenceCount} sentences, quality: ${a.quality}/100
Has examples: ${a.hasExamples}, Has structure: ${a.hasStructure}, Is relevant: ${a.isRelevant}
`).join('\n')}

SCORING RULES:
- If average words per answer < 20: MAX total score is 40
- If empty answers > 30% of total: MAX total score is 30
- If no examples used in any answer: Deduct 15 points from Communication score
- If interview was rushed (< 50% expected time): Deduct 20 points from total
- Base your scores on ACTUAL EVIDENCE from the answers, not assumptions

Respond with ONLY valid JSON in this exact format:
{
  "totalScore": <number 0-100>,
  "categoryScores": [
    { "name": "Communication Skills", "score": <0-100>, "comment": "<specific feedback>" },
    { "name": "Technical Knowledge", "score": <0-100>, "comment": "<specific feedback>" },
    { "name": "Problem Solving", "score": <0-100>, "comment": "<specific feedback>" },
    { "name": "Cultural & Behavioral Fit", "score": <0-100>, "comment": "<specific feedback>" },
    { "name": "Confidence & Clarity", "score": <0-100>, "comment": "<specific feedback>" }
  ],
  "strengths": [
    "<Be SPECIFIC. Reference actual answers. If there are NO real strengths, include just one: 'You completed the interview and showed willingness to try.'>"
  ],
  "areasForImprovement": [
    "<Be SPECIFIC and ACTIONABLE. Example: 'Your answers averaged only 25 words - aim for 80-150 word responses. Study the STAR method (Situation, Task, Action, Result) and prepare 5 detailed examples from your experience.'>",
    "<Another SPECIFIC issue. Example: 'You couldn't explain basic ${interviewData.techstack[0]} concepts. Spend 20-30 hours with official documentation and build 2-3 projects before your next interview.'>",
    "<At least 5-8 improvement areas if score is below 70>"
  ],
  "finalAssessment": "<Be honest about readiness. If score < 60: 'You are not ready for ${interviewData.role} interviews. Your brief responses and knowledge gaps indicate you need significant preparation. Focus on [specific areas] for 4-8 weeks before interviewing again.' If 60-75: 'You show potential but need more preparation in [areas]. With focused study for 2-4 weeks, you could be competitive.' If 75-85: 'You performed well with room for improvement in [areas].' If 85+: 'Strong performance showing readiness for this role.'>"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert interview evaluator. Respond ONLY with valid JSON, no markdown, no backticks, no preamble."
        },
        { role: "user", content: strictPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4096,
    });

    const responseText = response.choices[0]?.message?.content?.trim() ?? '';

    // Clean the response to extract JSON
    let jsonText = responseText;
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "");
    }

    const feedback = JSON.parse(jsonText) as GeneratedFeedback;

    // Add analytics to feedback
    feedback.analytics = summary;
    feedback.answerDetails = analytics;

    const generationTime = Date.now() - startTime;
    console.log(`✅ Feedback generated in ${generationTime}ms`);

    // Cache the feedback
    await cacheGeneratedFeedback(cacheKey, feedback);

    return feedback;
  } catch (error) {
    console.error("Error generating feedback:", error);
    throw new Error("Failed to generate honest feedback");
  }
}