// lib/interview/face-tracker.ts
// Turns a video frame into one FaceSample (lib/interview/camera-metrics.ts),
// entirely in the browser.
//
// MediaPipe's FaceLandmarker runs as WebAssembly on the candidate's machine.
// The library is imported dynamically so only someone who switches on
// on-camera feedback downloads it, and the WASM runtime and model file come
// from pinned, versioned URLs so a CDN update cannot change behaviour under
// us. Frames go from the <video> element to the model and a tiny canvas, and
// nowhere else: nothing is uploaded, recorded or kept. What comes out is a
// handful of numbers per frame.

import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { FaceSample } from "./camera-metrics";

// Must match the version pinned in package.json: the JS and the WASM it
// loads are built together.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
// "/float16/1/" is the model's version path; Google publishes new versions
// under new paths, so this file never changes.
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export interface FaceTracker {
  sample: (video: HTMLVideoElement, t: number) => FaceSample;
  close: () => void;
}

const RAD = 180 / Math.PI;

function blend(categories: { categoryName: string; score: number }[] | undefined, name: string): number {
  return categories?.find((c) => c.categoryName === name)?.score ?? 0;
}

async function createLandmarker(delegate: "GPU" | "CPU"): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
}

/**
 * Null when the model cannot load (offline, blocked CDN, no WebAssembly).
 * The interview carries on without on-camera feedback in that case; this
 * must never be the reason a session fails.
 */
export async function createFaceTracker(): Promise<FaceTracker | null> {
  if (typeof window === "undefined") return null;
  let landmarker: FaceLandmarker;
  try {
    landmarker = await createLandmarker("GPU");
  } catch {
    try {
      landmarker = await createLandmarker("CPU");
    } catch (err) {
      console.warn("On-camera feedback unavailable (face model did not load):", err);
      return null;
    }
  }

  // Brightness is read from a 64x48 copy of the frame: plenty to average a
  // face region, and small enough that reading it back costs nothing.
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let lastTs = -1;

  return {
    sample(video, t) {
      // detectForVideo requires strictly increasing timestamps.
      const ts = Math.max(Math.round(t), lastTs + 1);
      lastTs = ts;
      let result;
      try {
        result = landmarker.detectForVideo(video, ts);
      } catch {
        return { t, face: false };
      }
      const pts = result.faceLandmarks?.[0];
      if (!pts || pts.length === 0) return { t, face: false };

      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      // Head pose from the face's forward axis: the third column of the
      // column-major 4x4 transform. abs(z) makes this indifferent to which
      // way the model's z axis points; only the size of the turn matters.
      let yawDeg: number | undefined;
      let pitchDeg: number | undefined;
      const m = result.facialTransformationMatrixes?.[0]?.data;
      if (m && m.length >= 16) {
        const fx = m[8], fy = m[9], fz = Math.abs(m[10]);
        yawDeg = Math.atan2(fx, fz) * RAD;
        pitchDeg = Math.atan2(fy, Math.hypot(fx, fz)) * RAD;
      }

      const cats = result.faceBlendshapes?.[0]?.categories;
      const gazeX = cats
        ? ((blend(cats, "eyeLookOutLeft") - blend(cats, "eyeLookInLeft")) +
           (blend(cats, "eyeLookInRight") - blend(cats, "eyeLookOutRight"))) / 2
        : undefined;
      const gazeY = cats
        ? ((blend(cats, "eyeLookUpLeft") + blend(cats, "eyeLookUpRight")) -
           (blend(cats, "eyeLookDownLeft") + blend(cats, "eyeLookDownRight"))) / 2
        : undefined;
      const smile = cats ? (blend(cats, "mouthSmileLeft") + blend(cats, "mouthSmileRight")) / 2 : undefined;

      let brightness: number | undefined;
      if (ctx) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const x0 = Math.max(0, Math.floor(minX * canvas.width));
          const y0 = Math.max(0, Math.floor(minY * canvas.height));
          const w = Math.max(1, Math.min(canvas.width - x0, Math.ceil((maxX - minX) * canvas.width)));
          const h = Math.max(1, Math.min(canvas.height - y0, Math.ceil((maxY - minY) * canvas.height)));
          const data = ctx.getImageData(x0, y0, w, h).data;
          let sum = 0;
          for (let i = 0; i < data.length; i += 4) {
            sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          }
          brightness = sum / (data.length / 4);
        } catch { /* a frame that cannot be read just skips lighting */ }
      }

      return {
        t, face: true, yawDeg, pitchDeg, gazeX, gazeY, smile, brightness,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        size: maxX - minX,
      };
    },
    close() {
      try { landmarker.close(); } catch { /* already closed */ }
    },
  };
}
