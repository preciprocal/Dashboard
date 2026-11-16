// components/ui/feature-empty.tsx
//
// The first-run state of a feature page, across the full width of the sheet:
// what it does and how to start on the left, the three steps on the right.
import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';

export interface FeatureStep { icon: ElementType; title: string; text: string }

export default function FeatureEmpty({ icon: Icon, title, body, steps, primary, secondary, note }: {
  icon: ElementType;
  title: string;
  body: string;
  steps: FeatureStep[];
  primary: { href: string; label: string; icon?: ElementType };
  /** A second action, such as the See Example button. */
  secondary?: ReactNode;
  note?: string;
}) {
  const PrimaryIcon = primary.icon;
  return (
    <section className="glass-card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="p-6 sm:p-9 flex flex-col justify-center">
          <span className="w-11 h-11 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[var(--accent)]" />
          </span>
          <h3 className="font-display text-[22px] sm:text-[24px] font-semibold tracking-[-0.02em] text-white mt-5">{title}</h3>
          <p className="text-[14px] text-[var(--text-3)] mt-2 leading-relaxed max-w-lg">{body}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href={primary.href} className="btn-primary">{PrimaryIcon && <PrimaryIcon className="w-4 h-4" />}{primary.label}</Link>
            {secondary}
          </div>
          {note && <p className="text-[12px] text-[var(--text-4)] mt-4">{note}</p>}
        </div>
        <ol className="border-t lg:border-t-0 lg:border-l border-white/[0.06] bg-white/[0.015] p-6 sm:p-9 flex flex-col justify-center gap-5">
          <li className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-4)]">How it works</li>
          {steps.map(({ icon: StepIcon, title: t, text }, i) => (
            <li key={t} className="flex gap-4">
              <span className="relative w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]">
                <StepIcon className="w-[18px] h-[18px] text-[var(--text-2)]" />
                <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-[var(--bg-raised)] ring-1 ring-white/[0.1] text-[10px] font-semibold text-[var(--text-2)] flex items-center justify-center tabular-nums">{i + 1}</span>
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[14px] font-medium text-white">{t}</p>
                <p className="text-[12.5px] text-[var(--text-3)] mt-0.5 leading-relaxed">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
