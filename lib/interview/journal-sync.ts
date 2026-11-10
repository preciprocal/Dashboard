// lib/interview/journal-sync.ts
// "Save to Interview Journal" on the interview results page: copy a mock
// interview into interview_debriefs so the journal's own analysis
// (app/api/debrief/analyze) can look at it alongside real interviews.
//
// Server only (service-role client).
//
// The entry is marked outcome = 'practice', never a real-interview outcome:
// the journal is for interviews the user sat elsewhere, and a mock dressed up
// as "pending" or "moved forward" would skew their advance rate and the
// analysis. For the same reason it is not charged against the
// interviewDebriefs quota, which is labelled "real interviews logged"
// (lib/config/plan-features.ts); the mock interview was already paid for.

import { supabaseAdmin } from "@/supabase/admin";
import { isMissingColumn, readCachedReview } from "@/lib/interview/transcript-review";
import { buildTurns, transcriptHash, type TranscriptReview, type Turn } from "@/lib/interview/transcript-analysis";

/**
 * The results link written into every synced entry's notes. Useful to the
 * reader, and also the fallback way to find an entry again while migration
 * 0059's source_interview_id column has not been applied.
 */
export function resultsPath(interviewId: string): string {
  return `/interview/${interviewId}/feedback`;
}

/** The journal entry already made from this interview, or null. */
export async function findSyncedEntry(interviewId: string, supabaseUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("interview_debriefs")
    .select("id")
    .eq("user_id", supabaseUserId)
    .eq("source_interview_id", interviewId)
    .limit(1)
    .maybeSingle();
  if (!error) {
    if (data) return data.id as string;
    // Entries synced before the column existed only carry the link in their
    // notes, so a miss here still checks the notes below.
  } else if (!isMissingColumn(error)) {
    throw error;
  }

  // interviewId is a validated uuid, so it cannot carry % or _ wildcards.
  const { data: byNote, error: noteError } = await supabaseAdmin
    .from("interview_debriefs")
    .select("id")
    .eq("user_id", supabaseUserId)
    .eq("outcome", "practice")
    .ilike("overall_notes", `%${resultsPath(interviewId)}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (noteError) throw noteError;
  return (byNote?.id as string | undefined) ?? null;
}

// interviews.type to the journal's stage list (STAGE_LABELS in the debrief
// page). Coding is a technical round; a mixed interview has no single stage,
// so it is filed as technical and the notes say it was mixed.
function stageFor(type: string): string {
  if (type === "behavioral" || type === "system-design" || type === "technical") return type;
  return "technical";
}

const MAX_QUESTIONS = 25;
const MAX_NOTES = 12000;

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s;
}

/** What the interviewer asked: their turns that contain a question. */
function questionsFrom(turns: Turn[], fallback: string[]): string[] {
  const asked = turns
    .filter((t) => t.speaker === "interviewer" && t.text.includes("?"))
    .map((t) => {
      // Keep the question, not the "Great answer, thanks." in front of it.
      const sentences = t.text.match(/[^.!?]+[.!?]*/g) ?? [t.text];
      const qs = sentences.filter((s) => s.includes("?")).map((s) => s.trim());
      return clip(qs.join(" ") || t.text, 300);
    })
    .filter((q) => q.length >= 8);
  const list = asked.length ? asked : fallback.map((q) => clip(q, 300));
  return list.slice(0, MAX_QUESTIONS);
}

function bullets(items: string[]): string {
  return items.filter(Boolean).map((s) => `- ${s}`).join("\n");
}

/** Question, what the candidate said, and the coach's fix when there is one. */
function answerByAnswer(turns: Turn[], review: TranscriptReview | null): string {
  const byTurn = new Map((review?.answers ?? []).map((a) => [a.turnIndex, a]));
  const blocks: string[] = [];
  let lastQuestion = "";
  let n = 0;
  for (const t of turns) {
    if (t.speaker === "interviewer") { lastQuestion = t.text; continue; }
    const r = byTurn.get(t.index);
    // Without a review, skip one-liners like "Yes, I can hear you".
    if (!r && t.text.split(/\s+/).length < 8) continue;
    n++;
    const lines = [`Q${n}: ${clip(lastQuestion || "(no question)", 300)}`, `You said: ${clip(t.text, 600)}`];
    if (r) {
      if (r.why) lines.push(`Coach: ${r.why}`);
      if (r.betterAnswer) lines.push(`Better answer: ${r.betterAnswer}`);
      if (r.practiseTip) lines.push(`Practise: ${r.practiseTip}`);
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

export type SyncResult = { status: "created" | "exists"; id: string } | { status: "not_found" };

export async function syncInterviewToJournal(interviewId: string, supabaseUserId: string): Promise<SyncResult> {
  const { data: interview, error: interviewError } = await supabaseAdmin
    .from("interviews")
    .select("id, role, company, position, type, duration, questions, transcript, created_at")
    .eq("id", interviewId)
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  if (interviewError) throw interviewError;
  if (!interview) return { status: "not_found" };

  const existing = await findSyncedEntry(interviewId, supabaseUserId);
  if (existing) return { status: "exists", id: existing };

  const { data: feedback, error: feedbackError } = await supabaseAdmin
    .from("interview_feedback")
    .select("total_score, strengths, areas_for_improvement, final_assessment")
    .eq("interview_id", interviewId)
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  if (feedbackError) throw feedbackError;

  const turns = buildTurns(interview.transcript);
  // Read only: syncing must not wait on, or pay for, a review nobody opened.
  const review = turns.length ? await readCachedReview(interviewId, supabaseUserId, transcriptHash(turns)) : null;

  const type = (interview.type as string | null) ?? "";
  const role = ((interview.role as string | null) || (interview.position as string | null) || "Mock interview").trim();
  const company = ((interview.company as string | null) || "").trim() || "Practice interview";
  const score = typeof feedback?.total_score === "number" ? feedback.total_score : null;
  const strengths = (feedback?.strengths as string[] | null) ?? [];
  const areas = (feedback?.areas_for_improvement as string[] | null) ?? [];
  const fallbackQuestions = Array.isArray(interview.questions)
    ? (interview.questions as unknown[]).filter((q): q is string => typeof q === "string")
    : [];

  const followUps = review
    ? [...review.patterns, ...review.answers.map((a) => a.practiseTip).filter(Boolean)]
    : areas;

  const notes = [
    `Practice interview: an AI mock interview on Preciprocal, not a real interview.${type === "mixed" ? " Mixed technical and behavioural." : ""}`,
    score !== null ? `Score from the AI interviewer: ${score}/100 (shown as the score on this entry).` : "",
    (feedback?.final_assessment as string | null) || "",
    answerByAnswer(turns, review),
    `Full results and annotated transcript: ${resultsPath(interviewId)}`,
  ].filter(Boolean).join("\n\n");

  // The link has to survive the length cap: it is how the entry is found
  // again before migration 0059.
  const link = `\n\nFull results and annotated transcript: ${resultsPath(interviewId)}`;
  const overallNotes = notes.length > MAX_NOTES
    ? `${clip(notes.slice(0, notes.length - link.length), MAX_NOTES - link.length)}${link}`
    : notes;

  const duration = Number(interview.duration);
  const row: Record<string, unknown> = {
    user_id: supabaseUserId,
    company_name: clip(company, 200),
    job_title: clip(role, 200),
    interview_date: String(interview.created_at ?? new Date().toISOString()).slice(0, 10),
    stage: stageFor(type),
    outcome: "practice",
    duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    interviewer_count: 1,
    questions_asked: questionsFrom(turns, fallbackQuestions),
    what_went_well: strengths.length ? bullets(strengths) : null,
    what_went_poorly: areas.length ? bullets(areas) : null,
    follow_up_actions: followUps.length ? bullets(followUps.slice(0, 8)) : null,
    overall_notes: overallNotes,
    self_score: score,
    // Emotional state, difficulty and surprises are the user's to fill in;
    // nothing here can know them, so they stay empty rather than guessed.
  };

  let { data: created, error } = await supabaseAdmin
    .from("interview_debriefs")
    .insert({ ...row, source_interview_id: interviewId })
    .select("id")
    .single();
  if (error && isMissingColumn(error)) {
    ({ data: created, error } = await supabaseAdmin.from("interview_debriefs").insert(row).select("id").single());
  }
  if (error?.code === "23505") {
    // Lost a race with a second click: the unique index kept one entry.
    const winner = await findSyncedEntry(interviewId, supabaseUserId);
    if (winner) return { status: "exists", id: winner };
  }
  if (error) throw error;
  if (!created) throw new Error("Insert returned no row");
  return { status: "created", id: created.id as string };
}
