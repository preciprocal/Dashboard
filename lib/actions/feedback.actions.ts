import { GoogleGenerativeAI } from "@google/generative-ai";
import { redis } from "@/lib/redis/redis-client";
import { hashResumeContent } from "@/lib/redis/resume-cache";

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
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return (data as CachedFeedback).feedback;
    }

    console.log('❌ Cache MISS - Generated feedback not found');
    return null;
  } catch (error) {
    console.error('Redis get error:', error);
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

    await redis.setex(key, FEEDBACK_GENERATION_CACHE_TTL, JSON.stringify(data));
    console.log('✅ Cached generated feedback for 7 days');
  } catch (error) {
    console.error('Redis set error:', error);
  }
}

function assessAnswerQuality(answer: string, question: string): {
  quality: number;
  hasExamples: boolean;
  hasStructure: boolean;
  isRelevant: boolean;
} {
  const wordCount = answer.trim().split(/\s+/).length;
  
  // Basic quality based on length
  let quality = 1;
  if (wordCount >= 5) quality = 2;
  if (wordCount >= 15) quality = 3;
  if (wordCount >= 30) quality = 4;
  if (wordCount >= 50) quality = 5;
  
  // Check for structure indicators
  const hasExamples = /for example|such as|like when|instance|specifically|in my experience/i.test(answer);
  const hasStructure = /first|second|third|finally|however|therefore|additionally|moreover|because/i.test(answer);
  const hasSpecifics = /\d+|percent|%|specific|exactly|approximately/i.test(answer);
  
  if (hasExamples) quality += 2;
  if (hasStructure) quality += 2;
  if (hasSpecifics) quality += 1;
  
  // Check relevance to question
  const questionKeywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const answerLower = answer.toLowerCase();
  const relevantKeywords = questionKeywords.filter(kw => answerLower.includes(kw)).length;
  const isRelevant = relevantKeywords > 0;
  
  if (!isRelevant && wordCount > 10) quality = Math.min(quality, 4);
  
  return {
    quality: Math.min(quality, 10),
    hasExamples,
    hasStructure,
    isRelevant
  };
}

function analyzeAnswers(questions: Array<{ question: string; answer: string }>): {
  analytics: AnswerAnalytics[];
  summary: InterviewAnalytics;
} {
  const analytics: AnswerAnalytics[] = questions.map(qa => {
    const answer = qa.answer?.trim() || "";
    const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;
    
    const qualityMetrics = assessAnswerQuality(answer, qa.question);
    
    return {
      question: qa.question,
      answer: answer,
      wordCount,
      sentenceCount,
      avgWordsPerSentence: wordCount / Math.max(sentenceCount, 1),
      hasSubstance: wordCount >= 40,
      isEmpty: wordCount < 10,
      isOneWord: wordCount <= 3,
      quality: qualityMetrics.quality,
      hasExamples: qualityMetrics.hasExamples,
      hasStructure: qualityMetrics.hasStructure,
      isRelevant: qualityMetrics.isRelevant
    };
  });

  const totalWords = analytics.reduce((sum, a) => sum + a.wordCount, 0);
  const emptyAnswers = analytics.filter(a => a.isEmpty).length;
  const substantiveAnswers = analytics.filter(a => a.hasSubstance).length;
  const averageQuality = analytics.reduce((sum, a) => sum + a.quality, 0) / analytics.length;

  return {
    analytics,
    summary: {
      totalWords,
      avgWordsPerAnswer: totalWords / questions.length,
      emptyAnswers,
      substantiveAnswers,
      completionRate: (substantiveAnswers / questions.length) * 100,
      interviewDuration: 0, // Set from interview data
      expectedDuration: questions.length * 3,
      wasRushed: false, // Set from interview data
      averageQuality
    }
  };
}

export async function generateHonestFeedback(interviewData: {
  questions: Array<{ question: string; answer: string }>;
  duration: number;
  role: string;
  type: string;
  company?: string;
  techstack: string[];
}) {
  // Generate cache key
  const cacheKey = generateFeedbackCacheKey(
    interviewData.questions,
    interviewData.role,
    interviewData.type,
    interviewData.techstack
  );

  console.log('🔑 Feedback generation cache key:', cacheKey);

  // Check cache first
  const cachedFeedback = await getCachedGeneratedFeedback(cacheKey);
  if (cachedFeedback) {
    console.log('⚡ Returning cached feedback (instant!)');
    return cachedFeedback;
  }

  // Generate new feedback
  console.log('🤖 Generating new feedback with AI...');
  const startTime = Date.now();

  const { analytics, summary } = analyzeAnswers(interviewData.questions);
  
  // Update duration metrics
  summary.interviewDuration = interviewData.duration;
  summary.wasRushed = interviewData.duration < interviewData.questions.length * 2;

  // Build detailed analysis for AI
  const detailedAnalysis = analytics.map((a, i) => `
Question ${i + 1}: ${a.question}
Answer: ${a.answer || "[NO ANSWER PROVIDED]"}
Metrics:
- Word Count: ${a.wordCount} ${a.wordCount < 30 ? "⚠️ TOO SHORT" : a.wordCount < 50 ? "⚠️ BRIEF" : "✓"}
- Sentences: ${a.sentenceCount}
- Quality Score: ${a.quality}/10
- Has Examples: ${a.hasExamples ? "Yes ✓" : "No ✗"}
- Has Structure: ${a.hasStructure ? "Yes ✓" : "No ✗"}
- Relevant to Question: ${a.isRelevant ? "Yes ✓" : "No ✗"}
- Assessment: ${a.isEmpty ? "EMPTY/MINIMAL - CRITICAL ISSUE" : a.wordCount < 30 ? "INSUFFICIENT DETAIL" : a.wordCount < 50 ? "NEEDS MORE DEPTH" : "ADEQUATE LENGTH"}
`).join('\n---\n');

  const strictPrompt = `You are a BRUTALLY HONEST senior technical interviewer conducting a performance review. Your reputation depends on accurate assessments.

INTERVIEW CONTEXT:
- Position: ${interviewData.role}
- Type: ${interviewData.type}
- Company: ${interviewData.company || "Technical Assessment"}
- Tech Stack: ${interviewData.techstack.join(", ")}
- Total Questions: ${interviewData.questions.length}
- Interview Duration: ${summary.interviewDuration} minutes
- Expected Duration: ${summary.expectedDuration} minutes

OBJECTIVE PERFORMANCE METRICS:
- Total Words Spoken: ${summary.totalWords}
- Average Words Per Answer: ${summary.avgWordsPerAnswer.toFixed(1)}
- Empty/Minimal Answers (<10 words): ${summary.emptyAnswers}/${interviewData.questions.length}
- Substantive Answers (≥40 words): ${summary.substantiveAnswers}/${interviewData.questions.length}
- Quality Completion Rate: ${summary.completionRate.toFixed(1)}%
- Average Answer Quality: ${summary.averageQuality.toFixed(1)}/10
- Interview Pace: ${summary.wasRushed ? "RUSHED ⚠️" : "APPROPRIATE ✓"}

DETAILED ANSWER ANALYSIS:
${detailedAnalysis}

═══════════════════════════════════════════════════════════
CRITICAL SCORING INSTRUCTIONS - FOLLOW EXACTLY:
═══════════════════════════════════════════════════════════

YOU MUST BE HARSH AND REALISTIC. This is not a participation trophy.

COMMUNICATION SKILLS SCORING:
- 0-20: No meaningful communication, one-word answers, refused to engage
- 21-35: Gave minimal responses (1-2 sentences), no elaboration, unprofessional
- 36-50: Brief answers lacking detail, poor structure, many "um/uh", incomplete thoughts
- 51-65: Answers questions but needs more depth, some structure, lacks examples
- 66-75: Adequate communication, answers are clear but could be more detailed
- 76-85: Good communication, clear structure, provides examples, articulate
- 86-95: Excellent communication, well-structured, detailed, professional, engaging
- 96-100: Outstanding, exceptional clarity, perfect structure, compelling storytelling

TECHNICAL KNOWLEDGE SCORING:
- 0-20: Wrong answers, no understanding, made up information
- 21-35: Minimal knowledge, major gaps, surface-level only
- 36-50: Basic understanding but significant gaps, needs much more study
- 51-65: Adequate knowledge for junior level, some gaps remain
- 66-75: Solid understanding, minor gaps, good for mid-level
- 76-85: Strong knowledge, detailed understanding, senior level
- 86-95: Expert level, deep understanding, teaches others
- 96-100: Exceptional mastery, industry thought leader level

PROBLEM SOLVING SCORING:
- 0-20: Cannot solve basic problems, no logical approach
- 21-35: Attempts but fails, illogical approach, gives up easily
- 36-50: Solves simple problems with heavy guidance, struggles with complexity
- 51-65: Solves problems but needs hints, approach is basic
- 66-75: Independent problem solving, decent approach, some optimization
- 76-85: Strong problem solver, considers edge cases, good optimization
- 86-95: Excellent problem solver, multiple approaches, optimal solutions
- 96-100: Exceptional, innovative solutions, considers trade-offs masterfully

BEHAVIORAL/SITUATIONAL SCORING:
- 0-20: No examples, vague responses, cannot articulate experiences
- 21-35: Vague examples, no STAR method, lacks detail
- 36-50: Some examples but poorly structured, missing key details
- 51-65: Basic examples with some structure, could be more specific
- 66-75: Good examples, uses STAR method, clear outcomes
- 76-85: Strong examples, detailed STAR, quantified results
- 86-95: Excellent examples, compelling stories, leadership shown
- 96-100: Outstanding examples, exceptional impact, inspirational

MANDATORY PENALTIES (APPLY THESE):
- If avg words/answer < 20: MAX score 35 across all categories
- If avg words/answer < 30: MAX score 45 across all categories  
- If avg words/answer < 40: MAX score 55 in communication
- If empty answers > 2: Deduct 10 points from total score
- If completion rate < 50%: MAX total score 40
- If completion rate < 70%: MAX total score 55
- If interview was rushed: Deduct 5 points from total
- If answers lack examples: MAX 60 in behavioral
- If no technical specifics: MAX 50 in technical
- If one-word answers exist: MAX 30 in communication

REALITY CHECK:
- Average candidate scores: 55-70
- Good candidate scores: 70-80  
- Strong candidate scores: 80-90
- Exceptional candidate scores: 90-95
- Perfect scores (96-100): Extremely rare, maybe 1 in 1000 interviews

Based on the metrics:
- Avg ${summary.avgWordsPerAnswer.toFixed(0)} words/answer ${summary.avgWordsPerAnswer < 40 ? "= RED FLAG 🚩" : summary.avgWordsPerAnswer < 60 ? "= NEEDS WORK ⚠️" : "= GOOD ✓"}
- ${summary.emptyAnswers} empty answers ${summary.emptyAnswers > 0 ? "= MAJOR ISSUE 🚩" : "= GOOD ✓"}
- ${summary.completionRate.toFixed(0)}% completion ${summary.completionRate < 70 ? "= POOR 🚩" : summary.completionRate < 85 ? "= FAIR ⚠️" : "= GOOD ✓"}

YOUR TASK:
1. Analyze each answer critically against the question asked
2. Identify specific failures, gaps, and weaknesses
3. Give credit ONLY where truly deserved
4. Provide actionable, specific feedback
5. Don't soften the truth - candidates need reality to improve

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "totalScore": <number 0-100>,
  "categoryScores": [
    {
      "name": "Communication Skills",
      "score": <number 0-100>,
      "comment": "<Honest assessment. If they gave 1-sentence answers, say: 'Your answers were far too brief, averaging only X words. This suggests lack of preparation or inability to articulate thoughts. You need to provide detailed, structured responses with examples.'>"
    },
    {
      "name": "Technical Knowledge - ${interviewData.techstack[0] || "Core Concepts"}",
      "score": <number 0-100>,
      "comment": "<Specific technical gaps. Example: 'You demonstrated only surface-level understanding of React. You couldn't explain hooks, state management, or component lifecycle. This is fundamental knowledge expected for this role.'>"
    },
    {
      "name": "Problem Solving & Logic",
      "score": <number 0-100>,
      "comment": "<Real assessment. Example: 'You failed to demonstrate systematic problem-solving. You jumped to solutions without analyzing requirements or considering edge cases.'>"
    },
    {
      "name": "Behavioral & Situational",
      "score": <number 0-100>,
      "comment": "<Honest feedback. Example: 'Your examples lacked detail and structure. You didn't use STAR method, provided no metrics, and couldn't articulate your specific contributions vs team efforts.'>"
    },
    {
      "name": "Role-Specific Knowledge",
      "score": <number 0-100>,
      "comment": "<Industry/role specific assessment with specific gaps identified>"
    }
  ],
  "strengths": [
    "<Only include REAL strengths with specific evidence. Example: 'You demonstrated strong knowledge of database indexing by explaining B-tree vs Hash indexes with specific use cases.' If there are NO real strengths, include just one: 'You completed the interview and showed willingness to try.'>"
  ],
  "areasForImprovement": [
    "<Be SPECIFIC and ACTIONABLE. Example: 'Your answers averaged only 25 words - aim for 80-150 word responses. Study the STAR method (Situation, Task, Action, Result) and prepare 5 detailed examples from your experience.'>",
    "<Another SPECIFIC issue. Example: 'You couldn't explain basic ${interviewData.techstack[0]} concepts. Spend 20-30 hours with official documentation and build 2-3 projects before your next interview.'>",
    "<At least 5-8 improvement areas if score is below 70>"
  ],
  "finalAssessment": "<Be honest about readiness. If score < 60: 'You are not ready for ${interviewData.role} interviews. Your brief responses and knowledge gaps indicate you need significant preparation. Focus on [specific areas] for 4-8 weeks before interviewing again.' If 60-75: 'You show potential but need more preparation in [areas]. With focused study for 2-4 weeks, you could be competitive.' If 75-85: 'You performed well with room for improvement in [areas].' If 85+: 'Strong performance showing readiness for this role.'>"
}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(strictPrompt);
    const responseText = result.response.text();
    
    // Clean the response to extract JSON
    let jsonText = responseText.trim();
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