"use client";
// components/interview/CameraFeedbackToggle.tsx
// The opt-in for on-camera feedback, on the waiting-room device check.
// Off by default. The copy says exactly what happens, because "we analyse
// your face" is only acceptable when it is true that nothing leaves the
// device.

import { ScanFace, Lock } from "lucide-react";

export default function CameraFeedbackToggle({
  checked,
  onChange,
  available,
  unavailableReason,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  /** False with no working camera, or with the camera switched off. */
  available: boolean;
  unavailableReason?: string;
}) {
  const on = checked && available;
  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-colors ${on ? "border-[var(--accent-border)] bg-[var(--accent-subtle)]" : "border-[var(--border)] bg-white/[0.042]"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-raised)]">
          <ScanFace className="h-4 w-4 text-[var(--accent)]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="camera-feedback" className="text-sm font-medium text-white">
              On-camera feedback
            </label>
            <button
              id="camera-feedback"
              type="button"
              role="switch"
              aria-checked={on}
              disabled={!available}
              onClick={() => onChange(!checked)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-[var(--accent)]" : "bg-slate-600"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
            </button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Scores your eye contact, framing, steadiness and lighting while you answer.
          </p>
          <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-300">
            <Lock className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-400" />
            <span>Runs in your browser. Your video never leaves your device; only the scores are saved.</span>
          </p>
          {!available && unavailableReason && (
            <p className="mt-1.5 text-xs text-amber-400">{unavailableReason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
