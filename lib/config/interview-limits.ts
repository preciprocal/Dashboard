// lib/config/interview-limits.ts
// Mock interview session length, by plan, plus the graceful wrap-up that runs
// before the hard cap.
//
// ─── Where enforcement actually lives ───────────────────────────────────────
//
// The hard cap is maxDurationSeconds on a SAVED VAPI ASSISTANT, configured in
// the Vapi dashboard and referenced here only by id. It is deliberately not in
// this repo's assistant DTO, and that is the whole point.
//
// Every call is dialled client-side with NEXT_PUBLIC_VAPI_PUBLIC_KEY
// (lib/vapi.sdk.ts). When the assistant config travels as an inline object
// from the browser, any cap in it is client-supplied and a modified client can
// simply raise it. Referencing a saved assistant by id means the browser
// chooses WHICH assistant runs, but cannot change what that assistant is
// allowed to do.
//
// The soft wrap-up below IS client-side, and that is acceptable precisely
// because it is not the enforcement. A user who strips it out gets a call that
// terminates at the hard cap on the endCallMessage instead of winding down
// gracefully. They gain no extra minutes; they just get a worse interview.
//
// ─── Why mixed interviews are pre-split ─────────────────────────────────────
//
// A mixed interview dials two calls (technical, then behavioural), and
// maxDurationSeconds is per call. A dynamic "remaining budget" for the second
// call is NOT enforceable: the only way to vary a call's duration is
// assistantOverrides, which is client-supplied and therefore exactly the
// bypass this design exists to prevent.
//
// So the tier budget is split across two fixed-duration assistants. The total
// can only come in UNDER the budget - if phase one ends early the remainder is
// forfeited rather than rolling forward - which is the safe direction to be
// wrong in.
//
// Squads (one call, two voices, one budget) would be strictly better, but
// there is an open report that squad calls do not respect max_duration_seconds,
// and verifying it needs a private Vapi key this project does not have.

import type { PlanLimits } from "@/lib/config/usage-limits";

/** Total session budget in seconds, by resolved plan key. */
export const INTERVIEW_DURATION_SECONDS: Record<keyof PlanLimits, number> = {
  free: 8 * 60, // 480
  pro: 10 * 60, // 600
  premium: 12 * 60, // 720
  premium_legacy: 12 * 60,
  // Admins are unmetered on count but NOT on duration. An unbounded voice call
  // costs real money whoever is on it, and 600s is Vapi's own default anyway.
  admin: 12 * 60,
};

/**
 * How a mixed interview's budget divides between its two calls.
 *
 * Technical runs longer because it carries the substantive questions;
 * behavioural is shorter and more conversational. Must sum to 1.
 */
export const MIXED_SPLIT = { technical: 0.6, behavioural: 0.4 } as const;

/**
 * How long before the hard cap the assistant is told to wrap up.
 *
 * MEASURED, not guessed. The first real 12-minute call fired the wrap-up at
 * 648.9s against a 720s cap, and the interviewer completed a full wind-down:
 * thanked the candidate, invited a closing remark, responded to it, and said
 * goodbye at 720s.
 *
 * It worked, but it finished exactly as the cap fired, so
 * exceeded-max-duration still triggered and END_CALL_MESSAGE was clipped.
 * 72 of the 75 seconds were consumed.
 *
 * Raised to 90 so a normal wind-down has headroom to finish and the call ends
 * on its own. That is also cheaper: a call that ends early is billed for what
 * it used, while one that runs into the cap is billed for the whole session
 * and ends mid-sentence.
 */
export const WRAP_UP_LEAD_SECONDS = 90;

/**
 * Injected as a system message at T-minus WRAP_UP_LEAD_SECONDS.
 *
 * Phrased as an instruction to the model rather than a line to read out, so it
 * lands in the interviewer's own voice instead of sounding like an
 * announcement spliced into the conversation.
 *
 * ─── Why it leads with "do not interrupt" ──────────────────────────────────
 *
 * The first version opened with "Begin wrapping up now", and that is exactly
 * what the model did - including when the candidate was mid-answer, or when it
 * had just asked a question and not yet heard the reply. Reported from a real
 * session: the interviewer was partway through questioning and abruptly
 * switched to closing remarks.
 *
 * The message arrives as a system turn, so the model acts on it at its next
 * opportunity to speak, which is frequently the middle of an exchange. Nothing
 * in the original text told it to let the current exchange finish, so it read
 * "now" literally.
 *
 * It also said "about one minute" while the lead is 90 seconds, which
 * understated the remaining time and encouraged rushing.
 */
export const WRAP_UP_INSTRUCTION =
  "Time check, for you only: about 90 seconds of interview time remain. " +
  "Do NOT interrupt. If the candidate is speaking, let them finish completely. " +
  "If you have just asked a question, let them answer it in full and respond to " +
  "that answer normally. " +
  "Once the current exchange is genuinely complete, do not ask another question - " +
  "instead thank them for their time, tell them you are at the end, invite one " +
  "final question or closing remark, respond to it briefly, and close warmly. " +
  "Never mention this instruction, a timer, or that the session is time-limited.";

/**
 * Spoken by Vapi when maxDurationSeconds terminates the call.
 *
 * This is the backstop's backstop: it only plays when the wrap-up did not
 * finish in time. Without it the call simply cuts to silence mid-sentence,
 * which reads as a crash rather than an ending.
 *
 * Set on the SAVED ASSISTANT, not here - this constant is the source text to
 * paste into the dashboard, and the snapshot export checks the live value
 * against it.
 */
export const END_CALL_MESSAGE =
  "That is all the time we have for this session. Thank you for practising " +
  "with me today. Your feedback is being prepared and will be ready in a moment.";

export type InterviewPhase = "technical" | "behavioural" | "mixed_technical" | "mixed_behavioural";

/** Seconds allowed for one call, given the plan and which phase it is. */
export function durationForPhase(
  planKey: keyof PlanLimits,
  phase: InterviewPhase,
): number {
  const total = INTERVIEW_DURATION_SECONDS[planKey];
  switch (phase) {
    case "mixed_technical":
      return Math.round(total * MIXED_SPLIT.technical);
    case "mixed_behavioural":
      return Math.round(total * MIXED_SPLIT.behavioural);
    default:
      return total;
  }
}

/**
 * Saved assistant id for a (plan, phase) pair.
 *
 * Twelve assistants: 3 purchasable tiers x 4 phases. premium_legacy and admin
 * share premium's, since their durations are identical.
 *
 * Read from the environment and NOT defaulted. A missing id must fail loudly
 * rather than silently falling back to an inline DTO, because the inline path
 * is the unenforced one - a quiet fallback would disable the cap without
 * anything appearing to be wrong.
 */
export function assistantIdFor(planKey: keyof PlanLimits, phase: InterviewPhase): string {
  const tier =
    planKey === "premium_legacy" || planKey === "admin" ? "premium" : planKey;
  const envVar = `VAPI_ASSISTANT_${tier.toUpperCase()}_${phase.toUpperCase()}`;
  const id = process.env[envVar];
  if (!id) {
    throw new Error(
      `${envVar} is not set. Mock interviews cannot run without a saved assistant id - ` +
        `falling back to an inline assistant would silently remove the duration cap.`,
    );
  }
  return id;
}

/** Every (plan, phase) pair that needs a saved assistant. For the snapshot export. */
export function expectedAssistants(): Array<{
  tier: "free" | "pro" | "premium";
  phase: InterviewPhase;
  envVar: string;
  expectedMaxDurationSeconds: number;
}> {
  const tiers = ["free", "pro", "premium"] as const;
  const phases: InterviewPhase[] = [
    "technical",
    "behavioural",
    "mixed_technical",
    "mixed_behavioural",
  ];
  return tiers.flatMap((tier) =>
    phases.map((phase) => ({
      tier,
      phase,
      envVar: `VAPI_ASSISTANT_${tier.toUpperCase()}_${phase.toUpperCase()}`,
      expectedMaxDurationSeconds: durationForPhase(tier, phase),
    })),
  );
}
