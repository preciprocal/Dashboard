'use client';
// components/resume/TabIntro.tsx
//
// The start screen of a resume tab that runs on request (Benchmark,
// Recruiter, Intel): what it does, what you get, one button, and a plain
// note on what the result is based on. Shared so the tabs read the same.
import type { ReactNode } from 'react';
import { Check, Info } from 'lucide-react';

export default function TabIntro({ icon: Icon, eyebrow, title, body, points, action, note, children }: {
  icon: React.ElementType;
  /** A short label above the title, e.g. "Benchmark". */
  eyebrow: string;
  title: string;
  body: ReactNode;
  /** What the student gets, three short lines. */
  points: string[];
  /** The primary button (or a form, via children). */
  action?: ReactNode;
  /** What the result is based on, shown under the button. */
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="prc-rail rounded-2xl ring-1 ring-inset ring-white/[0.07] overflow-hidden">
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="w-11 h-11 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-[var(--accent)]" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">{eyebrow}</p>
            <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-white mt-0.5">{title}</h3>
            <p className="text-[13.5px] text-[var(--text-3)] mt-1.5 leading-relaxed max-w-[56ch]">{body}</p>
          </div>
        </div>

        <ul className="mt-6 grid gap-2.5 sm:grid-cols-3">
          {points.map(p => (
            <li key={p} className="flex gap-2.5 rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.05] px-3.5 py-3">
              <Check className="w-4 h-4 mt-[1px] text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-[12.5px] text-[var(--text-2)] leading-snug">{p}</span>
            </li>
          ))}
        </ul>

        {children}
        {action && <div className="mt-6 flex flex-wrap items-center gap-3">{action}</div>}
      </div>
      {note && (
        <div className="flex items-start gap-2 px-6 sm:px-7 py-3 border-t border-white/[0.06] bg-black/10">
          <Info className="w-3.5 h-3.5 mt-[2px] text-[var(--text-5)] flex-shrink-0" />
          <p className="text-[11.5px] text-[var(--text-4)] leading-relaxed">{note}</p>
        </div>
      )}
    </section>
  );
}
