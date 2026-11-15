'use client';
// components/ui/info-tip.tsx
//
// A small explainer on hover, keyboard focus or tap: a title, a sentence or
// two, and where the data comes from. Use it on any label a student may not
// know (E-Verified, H-1B, percentiles). Terms used in several places live in
// lib/glossary.ts so they read the same everywhere.
import { useState, type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { GLOSSARY, type GlossaryTerm } from '@/lib/glossary';

type Content = { title: string; body: ReactNode; source?: ReactNode };

export default function InfoTip({ term, title, body, source, children, side = 'top', icon = false, wrap = false, className = '' }: {
  /** A glossary entry, or pass title and body. */
  term?: GlossaryTerm;
  title?: string;
  body?: ReactNode;
  source?: ReactNode;
  /** The label it explains. Without children, an info icon is shown. */
  children?: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Also show a small info icon after the label. */
  icon?: boolean;
  /** The children are already focusable (a button): no tab stop of its own. */
  wrap?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const entry: Content | undefined = term ? GLOSSARY[term] : undefined;
  const c: Content = { title: title ?? entry?.title ?? '', body: body ?? entry?.body ?? '', source: source ?? entry?.source };

  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={300}>
      <Tooltip.Root open={open} onOpenChange={setOpen}>
        <Tooltip.Trigger asChild>
          {/* A span, so it can sit inside buttons and labels; focusable for
              keyboards, and a tap opens it on touch screens. */}
          <span
            tabIndex={wrap ? undefined : 0}
            aria-label={children ? undefined : `About ${c.title}`}
            onClick={wrap ? undefined : e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
            className={`inline-flex items-center gap-1 ${wrap ? "" : "cursor-help"} rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 ${className}`}
          >
            {children}
            {(icon || !children) && <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0" aria-hidden="true" />}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={6}
            collisionPadding={12}
            className="z-[100] max-w-[290px] rounded-xl border border-white/[0.1] bg-[var(--bg-surface)] px-3.5 py-3 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]
                       data-[state=delayed-open]:animate-fade-in-up data-[state=instant-open]:animate-fade-in-up"
          >
            <p className="text-[12.5px] font-semibold text-white leading-snug">{c.title}</p>
            <div className="text-[12px] text-slate-300 leading-relaxed mt-1">{c.body}</div>
            {c.source && <p className="text-[11px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/[0.06]">{c.source}</p>}
            <Tooltip.Arrow className="fill-[var(--bg-surface)]" width={12} height={6} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
