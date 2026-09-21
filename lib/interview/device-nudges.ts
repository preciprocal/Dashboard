// lib/interview/device-nudges.ts
// What the interviewer says when the candidate's mic or camera is off.
//
// ─── Why the interviewer says it rather than a toast ────────────────────────
//
// A muted microphone is the single most expensive failure in this product. The
// candidate sits in silence, the interviewer waits, the call runs to its cap,
// the transcript comes back empty, and the session is spent for nothing. A
// banner in the corner does not help, because the person is looking at the
// interviewer and waiting to be asked something.
//
// Vapi's say() speaks a line in the interviewer's own voice mid-call, which is
// what a real interviewer would do: "I can't hear you, I think you're on mute."
//
// ─── Why the timings are what they are ──────────────────────────────────────
//
// say() interrupts. Firing it the instant someone hits mute would talk over
// them the moment they pressed a button deliberately - people mute to cough,
// to take a sip, to tell someone to be quiet. So nothing happens for a while,
// and a candidate who unmutes within the grace period is never interrupted.
//
// Repeats are capped. An interviewer who says "you appear to be muted" every
// twenty seconds is worse than one who says it once and waits.

/** Grace period before the interviewer mentions a muted mic. */
export const MIC_NUDGE_AFTER_MS = 20_000;

/** How long before it is worth saying again, for someone who did not react. */
export const MIC_NUDGE_REPEAT_MS = 45_000;

/** Most times the interviewer will raise the mic in one session. */
export const MIC_NUDGE_MAX = 3;

/**
 * The camera is mentioned ONCE, late, and never again.
 *
 * These interviews are scored on what the candidate says, not on video, and the
 * avatar tiles are initials rather than faces. Pressing someone about their
 * camera would be nagging about something that does not affect their result.
 * It is mentioned at all only because an interviewee who turned it off by
 * accident would want to know.
 */
export const CAMERA_NUDGE_AFTER_MS = 60_000;

/**
 * Varied so a second nudge does not repeat the first word for word, which is
 * what makes a system sound like a recording rather than a person.
 */
export const MIC_NUDGE_LINES = [
  "Sorry to interrupt - I can't hear anything on my end. It looks like your microphone might be muted. Whenever you're ready, unmute and we'll carry on.",
  "I still don't have any audio from you. Could you check that your mic is unmuted and that the right input device is selected? Take your time, I'll wait.",
  "I'm still not hearing you. If the microphone isn't cooperating, it's absolutely fine to end here and start again - this session won't count against you.",
] as const;

export const CAMERA_NUDGE_LINE =
  "By the way, your camera is off. That's completely fine and it won't affect anything we discuss - I just wanted to flag it in case it wasn't intentional.";

/** The nudge for a given attempt, clamped to the last line. */
export function micNudgeLine(attempt: number): string {
  return MIC_NUDGE_LINES[Math.min(attempt, MIC_NUDGE_LINES.length - 1)];
}
