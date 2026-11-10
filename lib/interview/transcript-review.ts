// lib/interview/transcript-review.ts
// Server side of the annotated transcript: load the stored transcript, ask
// Claude for a per-answer critique once, and cache the result.
//
// Server only (service-role client). The pure parts - turn merging, filler
// detection, quote validation - live in transcript-analysis.ts so the browser
// can use them too.

import { supabaseAdmin } from "@/supabase/admin";
import { redis } from "@/lib/redis/redis-client";
import { anthropic, CLAUDE_MODEL, createMessage, extractJsonString, extractText, logUsage } from "@/lib/ai/claude";
import {
  buildTurns, isTooShort, transcriptHash, validateReview,
  type Turn, type TranscriptReview,
} from "@/lib/interview/transcript-analysis";

// Same check as app/api/extension/track-job: Postgres says 42703, PostgREST
// says PGRST204 when its schema cache has not seen the column yet.
export function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(err.message ?? "");
}

// ─── Loading ─────────────────────────────────────────────────────────────────

export interface InterviewForReview {
  role: string;
  company: string;
  type: string;
  turns: Turn[];
}

/**
 * The interview's merged turns, only when it belongs to `supabaseUserId`.
 * Null when there is no such interview for this user. An interview taken
 * before 0038 has no stored transcript and comes back with no turns.
 */
export async function loadInterviewForReview(interviewId: string, supabaseUserId: string): Promise<InterviewForReview | null> {
  const { data, error } = await supabaseAdmin
    .from("interviews")
    .select("role, company, type, transcript")
    .eq("id", interviewId)
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    role: (data.role as string | null) ?? "",
    company: (data.company as string | null) ?? "",
    type: (data.type as string | null) ?? "",
    turns: buildTurns(data.transcript),
  };
}

// ─── Cache ───────────────────────────────────────────────────────────────────
// Primary home is interview_feedback.transcript_review (migration 0059). Until
// that column exists, or when there is no feedback row to hang it on, the
// review goes to Redis instead, so a missing migration costs a cache miss
// after 30 days rather than a Claude call on every page view.

const REDIS_TTL = 30 * 24 * 60 * 60;
const redisKey = (interviewId: string, userId: string) => `transcript-review:v1:${userId}:${interviewId}`;
const lockKey = (interviewId: string, userId: string) => `transcript-review:lock:${userId}:${interviewId}`;

function asReview(v: unknown): TranscriptReview | null {
  const parsed = typeof v === "string" ? safeParse(v) : v;
  if (!parsed || typeof parsed !== "object") return null;
  const r = parsed as TranscriptReview;
  return r.version === 1 && typeof r.transcriptHash === "string" && Array.isArray(r.answers) ? r : null;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

/** A cached review for exactly this transcript, or null. Never throws. */
export async function readCachedReview(interviewId: string, supabaseUserId: string, hash: string): Promise<TranscriptReview | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("interview_feedback")
      .select("transcript_review")
      .eq("interview_id", interviewId)
      .eq("user_id", supabaseUserId)
      .maybeSingle();
    if (error && !isMissingColumn(error)) throw error;
    const fromRow = !error ? asReview(data?.transcript_review) : null;
    if (fromRow?.transcriptHash === hash) return fromRow;
  } catch (err) {
    console.warn("⚠️ transcript review: feedback row read failed:", err);
  }
  if (!redis) return null;
  try {
    const fromRedis = asReview(await redis.get(redisKey(interviewId, supabaseUserId)));
    return fromRedis?.transcriptHash === hash ? fromRedis : null;
  } catch {
    return null;
  }
}

async function writeCachedReview(interviewId: string, supabaseUserId: string, review: TranscriptReview): Promise<void> {
  let stored = false;
  try {
    const { data, error } = await supabaseAdmin
      .from("interview_feedback")
      .update({ transcript_review: review })
      .eq("interview_id", interviewId)
      .eq("user_id", supabaseUserId)
      .select("id");
    if (error && !isMissingColumn(error)) throw error;
    stored = !error && (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn("⚠️ transcript review: feedback row write failed:", err);
  }
  if (stored || !redis) return;
  try {
    await redis.setex(redisKey(interviewId, supabaseUserId), REDIS_TTL, JSON.stringify(review));
  } catch { /* a cache write failing only means generating again next time */ }
}

// ─── Generation ──────────────────────────────────────────────────────────────

const SYSTEM = `You are an experienced interview coach reviewing the transcript of a mock interview a candidate just did with an AI interviewer. Your job is to show the candidate, answer by answer, exactly what cost them points and how they could have said it better.

For EVERY candidate turn (marked CANDIDATE), return one entry:
- verdict: "strong" (would impress a real interviewer), "ok" (acceptable, could be sharper), "weak" (lost real points), or "skip" (not an answer: small talk, "can you hear me", "yes", "thank you", a clarifying question).
- issues: the specific places that cost points. Each issue has:
  - quote: an EXACT, VERBATIM substring copied character for character from that candidate turn. Usually one sentence or clause, never the whole answer unless it is one sentence. If you cannot quote it exactly, leave the issue out.
  - type, one of:
    "vague": a claim with no specifics or numbers ("I improved performance a lot", "I worked on many projects").
    "no_structure": a behavioural answer (tell me about a time...) with no clear Situation, Task, Action, Result. Quote where the structure breaks down, e.g. the opening that never sets the scene, or the place the result should have been.
    "rambling": a sentence that repeats itself, wanders, or adds nothing.
    "off_topic": content unrelated to the question that was asked.
    "not_answered": the answer avoids or misses the question actually asked. Quote the part that went in the wrong direction.
    "wrong": a technically incorrect statement. Only flag what is clearly wrong, not a matter of opinion, and say what is correct in "why".
  - why: one short sentence saying what the problem is, in plain words.
  Do NOT report filler words (um, uh, like, you know, so, basically, kind of) or hedges (I think maybe, I'm not sure, I guess): those are counted separately. Mention them in "why" only if they are the main problem.
- betterAnswer: for "weak" and "ok" answers, a rewritten version of the answer the candidate could have given, in first person, spoken style, about 60 to 150 words. Use STAR for behavioural questions. Null for "strong" and "skip".
- why: one plain-English sentence on why the original lost points.
- practiseTip: one short, concrete thing to practise next time (e.g. "Before answering, name the result in one sentence with a number.").

Also return "patterns": the 2 or 3 most important habits to work on across the whole interview, each one short sentence, most important first, specific to this candidate.

THE MOST IMPORTANT RULE, betterAnswer must use ONLY facts the candidate actually said in this interview. Never invent experience, employers, projects, technologies, team sizes, dates, numbers, metrics, credentials or outcomes. You may reorder, tighten, add structure, and add a framing sentence. Where a specific number or detail would make the answer stronger but the candidate did not give one, write a clearly marked placeholder in square brackets for them to fill in, such as [X%], [number of users], [time saved], [team size]. If the candidate gave almost no material, keep the better answer short and lean on placeholders rather than inventing a story. For a technical question the candidate got wrong, the better answer may state the correct concept, because that is knowledge, not a claim about the candidate's experience.

Tone: plain, specific and encouraging, like a good coach after a practice round. Talk to the candidate as "you". No jargon, no lecturing, no generic advice that would fit anyone.

Write in the language the candidate spoke. Never use em dashes or en dashes in text you write; use commas, periods or a plain hyphen. Quotes stay exactly as the candidate said them.

Return ONLY valid JSON, no markdown, in exactly this shape:
{
  "patterns": ["..."],
  "answers": [
    { "turn": <turn number>, "verdict": "strong|ok|weak|skip", "issues": [{ "quote": "...", "type": "vague|no_structure|rambling|off_topic|not_answered|wrong", "why": "..." }], "betterAnswer": "..." | null, "why": "...", "practiseTip": "..." }
  ]
}`;

// Bounds on what is sent: a long interview is still well under these, and
// they stop a pathological transcript from blowing the context or the bill.
const MAX_TURN_CHARS = 4000;
const MAX_TURNS = 120;
const MAX_TOKENS = 5000;

function buildPrompt(interview: InterviewForReview): string {
  const lines = interview.turns.slice(0, MAX_TURNS).map((t) =>
    `[${t.index}] ${t.speaker === "interviewer" ? "INTERVIEWER" : "CANDIDATE"}: ${t.text.slice(0, MAX_TURN_CHARS)}`,
  );
  const about = [
    interview.role && `Role: ${interview.role}`,
    interview.company && `Company: ${interview.company}`,
    interview.type && `Interview type: ${interview.type}`,
  ].filter(Boolean).join("\n");
  return `${about}\n\nTranscript (turn numbers in square brackets; review every CANDIDATE turn by its number):\n\n${lines.join("\n\n")}`;
}

export type ReviewResult =
  | { status: "ready"; review: TranscriptReview }
  | { status: "pending" }
  | { status: "no_transcript" }
  | { status: "too_short" }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * The review for this interview: from cache when it was made for this exact
 * transcript, otherwise generated now and cached.
 *
 * A short Redis lock stops two concurrent requests (React strict mode, two
 * tabs) from both paying for the same generation; the loser gets "pending"
 * and the client asks again shortly.
 */
export async function getTranscriptReview(interviewId: string, supabaseUserId: string): Promise<ReviewResult> {
  const interview = await loadInterviewForReview(interviewId, supabaseUserId);
  if (!interview) return { status: "not_found" };
  if (interview.turns.length === 0) return { status: "no_transcript" };
  if (isTooShort(interview.turns)) return { status: "too_short" };

  const hash = transcriptHash(interview.turns);
  const cached = await readCachedReview(interviewId, supabaseUserId, hash);
  if (cached) return { status: "ready", review: cached };

  if (!anthropic) return { status: "unavailable" };

  let locked = false;
  if (redis) {
    try {
      locked = (await redis.set(lockKey(interviewId, supabaseUserId), "1", { nx: true, ex: 120 })) === "OK";
      if (!locked) return { status: "pending" };
    } catch { /* no lock without Redis; generate anyway */ }
  }

  try {
    const response = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(interview) }],
    });
    logUsage("transcript-review", response);

    let raw: unknown = null;
    try {
      raw = JSON.parse(extractJsonString(extractText(response)));
    } catch (err) {
      // Unparseable even after repair: show the transcript with the
      // deterministic highlights and no critique, rather than an error.
      console.error("❌ transcript review: unparseable JSON:", err);
    }
    const { patterns, answers } = validateReview(raw, interview.turns);
    const review: TranscriptReview = {
      version: 1,
      transcriptHash: hash,
      generatedAt: new Date().toISOString(),
      patterns,
      answers,
    };
    // Only cache a review that has something in it, so a bad response is
    // retried on the next visit instead of being remembered.
    if (raw && (answers.length > 0 || patterns.length > 0)) {
      await writeCachedReview(interviewId, supabaseUserId, review);
    }
    return { status: "ready", review };
  } finally {
    if (locked && redis) {
      try { await redis.del(lockKey(interviewId, supabaseUserId)); } catch { /* expires on its own */ }
    }
  }
}
