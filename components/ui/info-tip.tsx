'use client';
// components/ui/info-tip.tsx
//
// A small explainer on hover, keyboard focus or tap: a title, a sentence or
// two, and where the data comes from. Use it on any label a student may not
// know (E-Verified, H-1B, percentiles). Terms used in several places live in
// lib/glossary.ts so they read the same everywhere.
import { useState, type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { BookOpen, Info } from 'lucide-react';
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
            {(icon || !children) && <Info className="w-3.5 h-3.5 text-[var(--text-5)] hover:text-[var(--text-2)] transition-colors flex-shrink-0" aria-hidden="true" />}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          {/* The Sectira panel: raised, hairline edge, soft shadow, no arrow;
              it slides in a few pixels from the side it opens on (globals.css
              .prc-tip). */}
          <Tooltip.Content
            side={side}
            sideOffset={8}
            collisionPadding={12}
            className="prc-tip z-[100] w-max max-w-[300px] overflow-hidden rounded-[10px] bg-[#151618] text-left
                       shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75),0_4px_12px_-4px_rgba(0,0,0,0.4)]"
          >
            <div className="px-3.5 pt-3 pb-3">
              {c.title && <p className="text-[12.5px] font-semibold tracking-[-0.005em] text-[var(--text-1)] leading-snug">{c.title}</p>}
              {c.body && <div className={`text-[12px] text-[var(--text-3)] leading-[1.55] ${c.title ? 'mt-1' : ''}`}>{c.body}</div>}
            </div>
            {c.source && (
              <div className="flex items-start gap-1.5 px-3.5 py-2 border-t border-white/[0.06] bg-white/[0.02]">
                <BookOpen className="w-3 h-3 mt-[2px] flex-shrink-0 text-[var(--text-5)]" aria-hidden="true" />
                <p className="text-[11px] text-[var(--text-4)] leading-snug">{c.source}</p>
              </div>
            )}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
