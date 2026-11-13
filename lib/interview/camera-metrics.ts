// lib/interview/camera-metrics.ts
// Body-language numbers for a mock interview taken with on-camera feedback.
//
// The face model runs in the browser (lib/interview/face-tracker.ts) and
// hands this file one small sample a few times a second: is there a face,
// which way is the head turned, where are the eyes looking, where is the
// face in the frame, how bright is it. Nothing here sees a pixel. Samples
// are folded into running counts as they arrive, so not even the samples are
// kept, and only the final aggregate leaves the device.
//
// Pure and dependency-free so the thresholds can be asserted
// (scripts/verify-camera-metrics.ts) and read by the server action that
// stores the result. Every threshold is a named constant with the reason it
// sits where it does; the tips on the results page are only as honest as
// these numbers.

// ─── Thresholds ──────────────────────────────────────────────────────────────

/**
 * Head turned less than this (degrees, either way) counts as facing the
 * camera. About the angle at which a viewer stops reading "looking at me";
 * small enough that reading notes beside the screen fails it.
 */
export const FACING_MAX_YAW_DEG = 15;
export const FACING_MAX_PITCH_DEG = 15;

/**
 * Eye direction from the model's gaze blendshapes, roughly -1..1. Past this
 * the eyes are visibly off to one side even when the head faces forward,
 * which is the classic "reading the other monitor" look.
 */
export const GAZE_MAX_OFFSET = 0.4;

/** Face centre must sit inside this box (fractions of the frame). */
export const FRAME_X_MIN = 0.3;
export const FRAME_X_MAX = 0.7;
export const FRAME_Y_MIN = 0.2;
export const FRAME_Y_MAX = 0.65;
/**
 * Face width as a fraction of frame width. Under the minimum the candidate is
 * a small figure across the room; over the maximum they are leaning into the
 * lens and the forehead or chin is cut off. The minimum is generous on
 * purpose: a 78-degree laptop webcam at arm's length puts a face at about
 * 0.15 of the frame, and that is a normal setup, not a framing mistake.
 */
export const FACE_SIZE_MIN = 0.1;
export const FACE_SIZE_MAX = 0.6;

/**
 * Head rotation speed (degrees per second, yaw and pitch combined) under which
 * the head counts as steady. Nodding while talking is roughly 10-20 deg/s in
 * bursts; constant swaying or looking around runs well above it.
 */
export const STEADY_MAX_DEG_PER_SEC = 25;
/** Gaps longer than this between face samples are not treated as motion. */
export const STEADY_MAX_GAP_MS = 2_000;

/** Mean face brightness on a 0-255 luma scale. */
export const BRIGHTNESS_DARK = 70;
export const BRIGHTNESS_BRIGHT = 215;

/** Smile blendshape score over this counts as smiling. */
export const SMILE_MIN = 0.3;

/** Below this many samples (about 10 seconds at 3 fps) nothing is reported. */
export const MIN_SAMPLES = 30;

// Tile grading. "good" and "ok" floors, in percent.
export const EYE_CONTACT_GOOD = 60;
export const EYE_CONTACT_OK = 40;
export const FRAMING_GOOD = 75;
export const FRAMING_OK = 50;
export const STEADY_GOOD = 80;
export const STEADY_OK = 60;

// ─── Samples and accumulation ────────────────────────────────────────────────

export interface FaceSample {
  /** Milliseconds, any monotonic clock. */
  t: number;
  face: boolean;
  yawDeg?: number;
  pitchDeg?: number;
  gazeX?: number;
  gazeY?: number;
  /** Face centre, 0..1 of frame width and height. */
  cx?: number;
  cy?: number;
  /** Face width, 0..1 of frame width. */
  size?: number;
  /** Mean luma of the face region, 0..255. */
  brightness?: number;
  /** 0..1 */
  smile?: number;
}

export interface CameraAccumulator {
  samples: number;
  faceSamples: number;
  facing: number;
  framed: number;
  steadyIntervals: number;
  motionIntervals: number;
  brightnessSum: number;
  brightnessCount: number;
  smiling: number;
  firstT: number | null;
  lastT: number | null;
  prev: { t: number; yaw: number; pitch: number } | null;
}

export function createAccumulator(): CameraAccumulator {
  return {
    samples: 0, faceSamples: 0, facing: 0, framed: 0,
    steadyIntervals: 0, motionIntervals: 0,
    brightnessSum: 0, brightnessCount: 0, smiling: 0,
    firstT: null, lastT: null, prev: null,
  };
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function isFacingCamera(s: FaceSample): boolean {
  if (!s.face || !finite(s.yawDeg) || !finite(s.pitchDeg)) return false;
  if (Math.abs(s.yawDeg) > FACING_MAX_YAW_DEG || Math.abs(s.pitchDeg) > FACING_MAX_PITCH_DEG) return false;
  // Gaze is optional: without blendshapes, head pose alone decides.
  if (finite(s.gazeX) && Math.abs(s.gazeX) > GAZE_MAX_OFFSET) return false;
  if (finite(s.gazeY) && Math.abs(s.gazeY) > GAZE_MAX_OFFSET) return false;
  return true;
}

export function isWellFramed(s: FaceSample): boolean {
  if (!s.face || !finite(s.cx) || !finite(s.cy) || !finite(s.size)) return false;
  return s.cx >= FRAME_X_MIN && s.cx <= FRAME_X_MAX &&
    s.cy >= FRAME_Y_MIN && s.cy <= FRAME_Y_MAX &&
    s.size >= FACE_SIZE_MIN && s.size <= FACE_SIZE_MAX;
}

/** Fold one sample in. Mutates and returns the accumulator. */
export function addSample(acc: CameraAccumulator, s: FaceSample): CameraAccumulator {
  acc.samples += 1;
  if (acc.firstT === null) acc.firstT = s.t;
  acc.lastT = s.t;

  if (!s.face) {
    // A gap in the face breaks the motion chain: the next face sample is
    // compared with nothing rather than with a pose from before the gap.
    acc.prev = null;
    return acc;
  }

  acc.faceSamples += 1;
  if (isFacingCamera(s)) acc.facing += 1;
  if (isWellFramed(s)) acc.framed += 1;
  if (finite(s.brightness)) { acc.brightnessSum += s.brightness; acc.brightnessCount += 1; }
  if (finite(s.smile) && s.smile >= SMILE_MIN) acc.smiling += 1;

  if (finite(s.yawDeg) && finite(s.pitchDeg)) {
    const p = acc.prev;
    if (p && s.t > p.t && s.t - p.t <= STEADY_MAX_GAP_MS) {
      const deg = Math.hypot(s.yawDeg - p.yaw, s.pitchDeg - p.pitch);
      const speed = deg / ((s.t - p.t) / 1000);
      acc.motionIntervals += 1;
      if (speed <= STEADY_MAX_DEG_PER_SEC) acc.steadyIntervals += 1;
    }
    acc.prev = { t: s.t, yaw: s.yawDeg, pitch: s.pitchDeg };
  }
  return acc;
}

// ─── Result ──────────────────────────────────────────────────────────────────

export interface CameraMetrics {
  version: 1;
  durationSec: number;
  samples: number;
  /** % of samples with a face in view. */
  faceVisiblePct: number;
  /** % of face-visible samples facing the camera. */
  eyeContactPct: number;
  /** % of ALL samples with a well-framed face (being out of frame counts against it). */
  framingPct: number;
  /** % of head-motion intervals that were steady. */
  steadinessPct: number;
  /** Mean face brightness 0-255, or null if never measured. */
  avgBrightness: number | null;
  /** % of face-visible samples smiling. */
  smilePct: number;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

/** Null when there is too little to say anything honest. */
export function finalizeMetrics(acc: CameraAccumulator): CameraMetrics | null {
  if (acc.samples < MIN_SAMPLES) return null;
  return {
    version: 1,
    durationSec: acc.firstT !== null && acc.lastT !== null ? Math.round((acc.lastT - acc.firstT) / 1000) : 0,
    samples: acc.samples,
    faceVisiblePct: pct(acc.faceSamples, acc.samples),
    eyeContactPct: pct(acc.facing, acc.faceSamples),
    framingPct: pct(acc.framed, acc.samples),
    // No motion intervals means the face was never seen twice in a row; call
    // that unmeasured (100 would praise someone who was never on camera).
    steadinessPct: acc.motionIntervals > 0 ? pct(acc.steadyIntervals, acc.motionIntervals) : 0,
    avgBrightness: acc.brightnessCount > 0 ? Math.round(acc.brightnessSum / acc.brightnessCount) : null,
    smilePct: pct(acc.smiling, acc.faceSamples),
  };
}

/**
 * Validate what the browser sent before it is stored. A server action is a
 * public endpoint; this keeps the column to numbers in range.
 */
export function sanitizeCameraMetrics(input: unknown): CameraMetrics | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const p = (v: unknown) => (finite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null);
  const samples = finite(r.samples) ? Math.max(0, Math.round(r.samples)) : 0;
  if (samples < MIN_SAMPLES) return null;
  const fields = {
    faceVisiblePct: p(r.faceVisiblePct),
    eyeContactPct: p(r.eyeContactPct),
    framingPct: p(r.framingPct),
    steadinessPct: p(r.steadinessPct),
    smilePct: p(r.smilePct),
  };
  if (Object.values(fields).some((v) => v === null)) return null;
  return {
    version: 1,
    durationSec: finite(r.durationSec) ? Math.max(0, Math.min(6 * 3600, Math.round(r.durationSec))) : 0,
    samples: Math.min(samples, 1_000_000),
    faceVisiblePct: fields.faceVisiblePct!,
    eyeContactPct: fields.eyeContactPct!,
    framingPct: fields.framingPct!,
    steadinessPct: fields.steadinessPct!,
    avgBrightness: finite(r.avgBrightness) ? Math.max(0, Math.min(255, Math.round(r.avgBrightness))) : null,
    smilePct: fields.smilePct!,
  };
}

// ─── Results page tiles ──────────────────────────────────────────────────────

export type TileTone = "good" | "ok" | "low";

export interface CameraTile {
  key: "eye" | "framing" | "steadiness" | "lighting";
  label: string;
  value: string;
  tone: TileTone;
  tip: string;
}

const grade = (v: number, good: number, ok: number): TileTone => (v >= good ? "good" : v >= ok ? "ok" : "low");

export function cameraTiles(m: CameraMetrics): CameraTile[] {
  const eye = grade(m.eyeContactPct, EYE_CONTACT_GOOD, EYE_CONTACT_OK);
  const framing = grade(m.framingPct, FRAMING_GOOD, FRAMING_OK);
  const steady = grade(m.steadinessPct, STEADY_GOOD, STEADY_OK);
  const b = m.avgBrightness;
  const light: TileTone = b === null ? "ok" : b < BRIGHTNESS_DARK || b > BRIGHTNESS_BRIGHT ? "low" : "good";

  return [
    {
      key: "eye", label: "Eye contact", value: `${m.eyeContactPct}%`, tone: eye,
      tip: eye === "good"
        ? "You faced the camera for most of the interview. Keep doing that."
        : eye === "ok"
          ? "You looked away for a fair part of your answers. Glance back at the camera when you make your main point."
          : "You looked away for most answers. Put your notes right beside the camera so reading them keeps your eyes up.",
    },
    {
      key: "framing", label: "Framing", value: `${m.framingPct}%`, tone: framing,
      tip: framing === "good"
        ? "Your face stayed centred and at a good distance."
        : m.faceVisiblePct < 80
          ? "Your face was out of view at times. Sit square to the screen and keep the camera at eye level."
          : "You were often off-centre or too near or far. Aim for head and shoulders, centred, about an arm's length away.",
    },
    {
      key: "steadiness", label: "Steadiness", value: `${m.steadinessPct}%`, tone: steady,
      tip: steady === "good"
        ? "Your head movement was calm and natural."
        : "Your head moved a lot. A chair that does not swivel and both feet on the floor make it easier to stay still.",
    },
    {
      key: "lighting", label: "Lighting",
      value: b === null ? "n/a" : b < BRIGHTNESS_DARK ? "Too dark" : b > BRIGHTNESS_BRIGHT ? "Too bright" : "Good",
      tone: light,
      tip: b === null
        ? "Lighting could not be measured this time."
        : b < BRIGHTNESS_DARK
          ? "Your face was hard to see. Face a window or put a lamp behind your screen, not behind you."
          : b > BRIGHTNESS_BRIGHT
            ? "Your face was washed out. Move away from direct light or turn the screen brightness down."
            : "Your face was clearly lit.",
    },
  ];
}
