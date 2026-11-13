// scripts/verify-camera-metrics.ts
//
//   npm run verify:camera-metrics
//
// On-camera feedback tells a candidate "you looked away for most answers".
// That is only fair if the thresholds behind it do what their names say, so
// they are asserted here against the real scoring in
// lib/interview/camera-metrics.ts, with synthetic samples at 3 fps.

import {
  createAccumulator, addSample, finalizeMetrics, sanitizeCameraMetrics, cameraTiles,
  isFacingCamera, isWellFramed,
  FACING_MAX_YAW_DEG, FACING_MAX_PITCH_DEG, GAZE_MAX_OFFSET, FACE_SIZE_MIN, FACE_SIZE_MAX,
  STEADY_MAX_DEG_PER_SEC, BRIGHTNESS_DARK, BRIGHTNESS_BRIGHT, MIN_SAMPLES,
  EYE_CONTACT_GOOD, EYE_CONTACT_OK,
  type FaceSample, type CameraMetrics,
} from "@/lib/interview/camera-metrics";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else    { fail++; console.log("  FAIL  " + name + (detail ? "  -> " + detail : "")); }
};

const STEP = 333;
const good: Omit<FaceSample, "t"> = {
  face: true, yawDeg: 2, pitchDeg: -3, gazeX: 0.05, gazeY: -0.1,
  cx: 0.5, cy: 0.42, size: 0.32, brightness: 130, smile: 0.1,
};
function run(n: number, make: (i: number) => Omit<FaceSample, "t">): CameraMetrics | null {
  const acc = createAccumulator();
  for (let i = 0; i < n; i++) addSample(acc, { t: i * STEP, ...make(i) });
  return finalizeMetrics(acc);
}

console.log("[1] facing the camera");
check("straight on counts", isFacingCamera({ t: 0, ...good }));
check(`head turned past ${FACING_MAX_YAW_DEG} deg does not`, !isFacingCamera({ t: 0, ...good, yawDeg: FACING_MAX_YAW_DEG + 1 }));
check("head turned the other way does not", !isFacingCamera({ t: 0, ...good, yawDeg: -(FACING_MAX_YAW_DEG + 1) }));
check(`looking down past ${FACING_MAX_PITCH_DEG} deg does not`, !isFacingCamera({ t: 0, ...good, pitchDeg: FACING_MAX_PITCH_DEG + 5 }));
check("eyes off to the side with head forward does not", !isFacingCamera({ t: 0, ...good, gazeX: GAZE_MAX_OFFSET + 0.1 }));
check("eyes down at notes does not", !isFacingCamera({ t: 0, ...good, gazeY: -(GAZE_MAX_OFFSET + 0.1) }));
check("no gaze data falls back to head pose", isFacingCamera({ t: 0, ...good, gazeX: undefined, gazeY: undefined }));
check("no face never counts", !isFacingCamera({ t: 0, face: false }));

console.log("\n[2] framing");
check("centred, mid-size counts", isWellFramed({ t: 0, ...good }));
check("off to the side does not", !isWellFramed({ t: 0, ...good, cx: 0.15 }));
check("too far away does not", !isWellFramed({ t: 0, ...good, size: FACE_SIZE_MIN - 0.02 }));
check("too close does not", !isWellFramed({ t: 0, ...good, size: FACE_SIZE_MAX + 0.05 }));
check("head cut off at the top does not", !isWellFramed({ t: 0, ...good, cy: 0.1 }));

console.log("\n[3] aggregates");
check(`fewer than ${MIN_SAMPLES} samples reports nothing`, run(MIN_SAMPLES - 1, () => good) === null);
const perfect = run(300, () => good)!;
check("perfect run: eye contact 100", perfect.eyeContactPct === 100, String(perfect.eyeContactPct));
check("perfect run: framing 100", perfect.framingPct === 100);
check("perfect run: steadiness 100", perfect.steadinessPct === 100);
check("perfect run: brightness carried", perfect.avgBrightness === 130);
check("duration about 100s", Math.abs(perfect.durationSec - 100) <= 1, String(perfect.durationSec));

// Looks at notes 70% of the time.
const notes = run(300, (i) => (i % 10 < 7 ? { ...good, pitchDeg: 25, gazeY: -0.6 } : good))!;
check("reading notes 70% of the time: eye contact 30", notes.eyeContactPct === 30, String(notes.eyeContactPct));
check("that grades low", cameraTiles(notes)[0].tone === "low");
check("and the tip mentions notes beside the camera", /notes right beside the camera/.test(cameraTiles(notes)[0].tip));

// Out of frame half the time: framing counts absence against them.
const half = run(300, (i) => (i % 2 ? good : { face: false }))!;
check("away from camera half the time: face visible 50", half.faceVisiblePct === 50);
check("framing counts absence against them", half.framingPct === 50);
check("eye contact is measured over visible time only", half.eyeContactPct === 100);

// Swaying: alternate yaw +-10 every sample = 20 deg per 0.333s = 60 deg/s.
const sway = run(300, (i) => ({ ...good, yawDeg: i % 2 ? 10 : -10 }))!;
check(`constant swaying over ${STEADY_MAX_DEG_PER_SEC} deg/s is unsteady`, sway.steadinessPct === 0, String(sway.steadinessPct));
// Gentle drift: 1 degree per sample = 3 deg/s.
const drift = run(300, (i) => ({ ...good, yawDeg: (i % 20) - 10 }))!;
check("slow drift stays steady", drift.steadinessPct >= 90, String(drift.steadinessPct));
const gapAcc = createAccumulator();
addSample(gapAcc, { t: 0, ...good, yawDeg: -10 });
addSample(gapAcc, { t: 5_000, ...good, yawDeg: 10 });
check("a long gap is not treated as a fast turn", gapAcc.motionIntervals === 0);

console.log("\n[4] lighting");
const dark = run(100, () => ({ ...good, brightness: BRIGHTNESS_DARK - 10 }))!;
check("dark face grades low", cameraTiles(dark)[3].tone === "low" && cameraTiles(dark)[3].value === "Too dark");
const bright = run(100, () => ({ ...good, brightness: BRIGHTNESS_BRIGHT + 10 }))!;
check("washed-out face grades low", cameraTiles(bright)[3].value === "Too bright");
check("normal light grades good", cameraTiles(perfect)[3].tone === "good");

console.log("\n[5] tile thresholds");
const at = (eye: number) => cameraTiles({ ...perfect, eyeContactPct: eye })[0].tone;
check(`${EYE_CONTACT_GOOD}% eye contact is good`, at(EYE_CONTACT_GOOD) === "good");
check(`${EYE_CONTACT_GOOD - 1}% is ok`, at(EYE_CONTACT_GOOD - 1) === "ok");
check(`${EYE_CONTACT_OK - 1}% is low`, at(EYE_CONTACT_OK - 1) === "low");
check("four tiles", cameraTiles(perfect).length === 4);

console.log("\n[6] sanitising what the browser sends");
check("null is nothing", sanitizeCameraMetrics(null) === null);
check("too few samples is nothing", sanitizeCameraMetrics({ ...perfect, samples: 3 }) === null);
const clamped = sanitizeCameraMetrics({ ...perfect, eyeContactPct: 400, avgBrightness: -9 })!;
check("percent clamped to 100", clamped.eyeContactPct === 100);
check("brightness clamped to 0", clamped.avgBrightness === 0);
check("missing field rejects the whole thing", sanitizeCameraMetrics({ ...perfect, framingPct: "a lot" }) === null);
const extra = sanitizeCameraMetrics({ ...perfect, frame: "data:image/png;base64,AAAA" }) as unknown as Record<string, unknown>;
check("unknown keys (an image, say) are dropped, not stored", !("frame" in extra));

const copy = cameraTiles(notes).concat(cameraTiles(dark), cameraTiles(sway)).map((t) => t.tip + t.label + t.value).join(" ");
check("no em or en dashes in tips", !/[–—]/.test(copy));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
