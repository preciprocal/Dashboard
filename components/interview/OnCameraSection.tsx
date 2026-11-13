// components/interview/OnCameraSection.tsx
// "On camera" on the interview results page: four tiles from the on-device
// body-language numbers, each with one plain tip. Rendered only for
// interviews taken with on-camera feedback switched on.

import { ScanFace, Eye, Frame, Move, Sun, Lock } from "lucide-react";
import { cameraTiles, type CameraMetrics, type CameraTile, type TileTone } from "@/lib/interview/camera-metrics";

// Full class names per tone: Tailwind cannot see built strings.
const TONE: Record<TileTone, { value: string; border: string; label: string }> = {
  good: { value: "text-emerald-400", border: "border-emerald-500/20", label: "Good" },
  ok:   { value: "text-amber-400",   border: "border-amber-500/20",   label: "Could improve" },
  low:  { value: "text-red-400",     border: "border-red-500/20",     label: "Work on this" },
};

const ICON: Record<CameraTile["key"], typeof Eye> = {
  eye: Eye, framing: Frame, steadiness: Move, lighting: Sun,
};

export default function OnCameraSection({ metrics }: { metrics: CameraMetrics }) {
  const tiles = cameraTiles(metrics);
  const minutes = Math.max(1, Math.round(metrics.durationSec / 60));

  return (
    <section className="glass-card" aria-labelledby="on-camera-heading">
      <div className="flex items-center gap-3 border-b border-white/5 p-4 sm:p-6">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--accent-subtle)] sm:h-10 sm:w-10">
          <ScanFace className="h-4 w-4 text-[var(--accent)] sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <h2 id="on-camera-heading" className="text-base font-semibold text-white sm:text-lg">On camera</h2>
          <p className="text-xs text-slate-400 sm:text-sm">How you came across on video, over about {minutes} min</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        {tiles.map((t) => {
          const tone = TONE[t.tone];
          const Icon = ICON[t.key];
          return (
            <div key={t.key} className={`rounded-xl border bg-[var(--bg-raised)] p-4 ${tone.border}`}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">{t.label}</span>
              </div>
              <p className={`text-2xl font-semibold ${tone.value}`}>{t.value}</p>
              <p className={`mb-2 text-xs font-medium ${tone.value}`}>{tone.label}</p>
              <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">{t.tip}</p>
            </div>
          );
        })}
      </div>

      <p className="flex items-start gap-2 px-4 pb-4 text-xs leading-relaxed text-slate-400 sm:px-6 sm:pb-6">
        <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
        Measured in your browser during the interview. Your video never left your device and was not recorded; only these numbers were saved.
      </p>
    </section>
  );
}
