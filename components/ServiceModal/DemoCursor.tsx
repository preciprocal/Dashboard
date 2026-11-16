'use client';
// components/ServiceModal/DemoCursor.tsx
//
// A pointer that shows what each example demo is about to use. Previews mark
// the element a step acts on with `data-demo-click="<step>"` (several steps
// separated by spaces, e.g. "2 5"). During that step the cursor glides to the
// element, then presses it shortly before the next step begins, so the
// viewer sees where to click and what happens next.
//
// With reduced motion the pointer does not travel: the element gets a quiet
// highlight ring for the step instead.
import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The data attribute a preview puts on the element a step clicks. */
export const demoClick = (...steps: number[]) => ({ 'data-demo-click': steps.join(' ') });

export default function DemoCursor({ step, stepDuration, playing, rootRef }: {
  step: number;
  stepDuration: number;
  playing: boolean;
  /** The positioned wrapper around the preview; the cursor lives inside it. */
  rootRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [pressKey, setPressKey] = useState(0);
  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRing(null);
    if (!playing) { setPos(null); return; }
    const root = rootRef.current;
    if (!root) return;
    const reduced = prefersReducedMotion();

    // Wait a moment for the step's content to render, then find its target.
    const findTarget = () => root.querySelector<HTMLElement>(`[data-demo-click~="${step}"]`);
    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
      return { x: r.left - b.left + Math.min(r.width * 0.5, 60), y: r.top - b.top + r.height * 0.55, box: { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height } };
    };

    // Visible means neither it nor a wrapper is still faded out.
    const visible = (el: HTMLElement) => {
      for (let n: HTMLElement | null = el; n && n !== root; n = n.parentElement) {
        if (Number(getComputedStyle(n).opacity) < 0.6) return false;
      }
      return el.getBoundingClientRect().width > 0;
    };
    const started = performance.now();
    // Press just before the next step starts, and never before the cursor lands.
    const pressAt = Math.min(stepDuration - 300, stepDuration * 0.85);

    const go = (el: HTMLElement) => {
      el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      timers.current.push(setTimeout(() => {
        const p = place(el);
        if (reduced) { setRing(p.box); return; }
        setPos({ x: p.x, y: p.y });
        const elapsed = performance.now() - started;
        timers.current.push(setTimeout(() => setPressKey(k => k + 1), Math.max(600, pressAt - elapsed)));
      }, reduced ? 0 : 200));
    };
    // Targets often fade in partway through a step: wait for it.
    const poll = () => {
      const el = findTarget();
      if (el && visible(el)) return go(el);
      if (performance.now() - started < stepDuration - 500) timers.current.push(setTimeout(poll, 120));
    };
    timers.current.push(setTimeout(poll, 160));

    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [step, stepDuration, playing, rootRef]);

  return (
    <>
      <style>{`
        @keyframes demoPress { 0% { transform: scale(1); } 40% { transform: scale(0.82); } 100% { transform: scale(1); } }
        @keyframes demoRipple { 0% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.2); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1); } }
        @keyframes demoRing { 0%, 100% { box-shadow: 0 0 0 2px rgba(110,121,214,0.55); } 50% { box-shadow: 0 0 0 4px rgba(110,121,214,0.25); } }
        @media (prefers-reduced-motion: reduce) { .demo-cursor, .demo-ripple { display: none; } }
      `}</style>
      {ring && (
        <span aria-hidden="true" className="pointer-events-none absolute z-30 rounded-lg"
          style={{ left: ring.x - 3, top: ring.y - 3, width: ring.w + 6, height: ring.h + 6, animation: 'demoRing 1.6s ease-in-out infinite' }} />
      )}
      {pos && (
        <span aria-hidden="true" className="demo-cursor pointer-events-none absolute z-40"
          style={{ left: 0, top: 0, transform: `translate(${pos.x}px, ${pos.y}px)`, transition: 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
          {pressKey > 0 && (
            <span key={pressKey} className="demo-ripple absolute left-0 top-0 w-12 h-12 rounded-full bg-white/40" style={{ animation: 'demoRipple 600ms ease-out forwards' }} />
          )}
          <span key={`p${pressKey}`} className="block origin-top-left" style={{ animation: pressKey > 0 ? 'demoPress 260ms ease-out' : undefined }}>
            <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              <path d="M5 3.2v15.6c0 .5.6.8 1 .4l3.7-3.6 2.4 5.5c.2.4.6.6 1 .4l2-.9c.4-.2.6-.6.4-1l-2.4-5.4h5.1c.5 0 .8-.6.4-1L6 2.8c-.4-.3-1-.1-1 .4Z" fill="#fff" stroke="#0b0c0e" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
      )}
    </>
  );
}
