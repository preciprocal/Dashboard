'use client';
// components/ServiceModal/DemoCursor.tsx
//
// A pointer that shows what each example demo is about to use. Previews mark
// the element a step acts on with `data-demo-click="<step>"` (several steps
// separated by spaces, e.g. "2 5"). During that step the cursor travels to the
// element, then presses it shortly before the next step begins, so the
// viewer sees where to click and what happens next.
//
// The pointer is Sectira's (components/marketing/fx/HeroDemo.tsx there): a
// light arrowhead with a soft shadow drawn as offset copies, travelling on a
// gentle curve like a hand moving a mouse, squeezing slightly on the press,
// with a thin ring rippling out from the click point.
//
// With reduced motion the pointer does not travel: the element gets a quiet
// highlight ring for the step instead.
import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The data attribute a preview puts on the element a step clicks. */
export const demoClick = (...steps: number[]) => ({ 'data-demo-click': steps.join(' ') });

type XY = { x: number; y: number };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
// Slow out of the start, glide, settle on the target.
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const MOVE_MS = 760;

export default function DemoCursor({ step, stepDuration, playing, rootRef }: {
  step: number;
  stepDuration: number;
  playing: boolean;
  /** The positioned wrapper around the preview; the cursor lives inside it. */
  rootRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [shown, setShown] = useState(false);
  const [pressKey, setPressKey] = useState(0);
  const [ripple, setRipple] = useState<(XY & { key: number }) | null>(null);
  const [ring, setRing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const curRef = useRef<HTMLSpanElement | null>(null);
  const posRef = useRef<XY | null>(null);
  const raf = useRef<number | null>(null);

  const draw = (p: XY) => { if (curRef.current) curRef.current.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; };

  // Travel from where the pointer is to `to` on a curve that bows a little to one side.
  const travel = (to: XY, root: HTMLElement) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    const b = root.getBoundingClientRect();
    const from = posRef.current ?? { x: b.width * 0.74, y: b.height * 0.94 };
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    const bow = Math.min(60, d * 0.18);
    const c = { x: (from.x + to.x) / 2 + (dy / d) * bow, y: (from.y + to.y) / 2 - (dx / d) * bow };
    const start = performance.now();
    const frame = (now: number) => {
      const p = ease(clamp01((now - start) / MOVE_MS)), q = 1 - p;
      const at = { x: q * q * from.x + 2 * q * p * c.x + p * p * to.x, y: q * q * from.y + 2 * q * p * c.y + p * p * to.y };
      posRef.current = at; draw(at);
      if (p < 1) raf.current = requestAnimationFrame(frame);
      else raf.current = null;
    };
    setShown(true);
    raf.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRing(null);
    if (!playing) { setShown(false); posRef.current = null; return; }
    const root = rootRef.current;
    if (!root) return;
    const reduced = prefersReducedMotion();

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
    // Press just before the next step starts, and never before the pointer lands.
    const pressAt = Math.min(stepDuration - 300, stepDuration * 0.85);

    const go = (el: HTMLElement) => {
      el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      timers.current.push(setTimeout(() => {
        const p = place(el);
        if (reduced) { setRing(p.box); return; }
        travel({ x: p.x, y: p.y }, root);
        const elapsed = performance.now() - started;
        timers.current.push(setTimeout(() => {
          setPressKey(k => k + 1);
          setRipple({ x: p.x, y: p.y, key: Date.now() });
        }, Math.max(MOVE_MS + 120, pressAt - elapsed)));
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
  // travel only reads refs and sets state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stepDuration, playing, rootRef]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return (
    <>
      <style>{`
        @keyframes demoPress { 0% { transform: scale(1); } 35% { transform: scale(0.86); } 100% { transform: scale(1); } }
        @keyframes demoRipple { 0% { opacity: 0.6; transform: scale(0.25); } 100% { opacity: 0; transform: scale(1.2); } }
        @keyframes demoRing { 0%, 100% { box-shadow: 0 0 0 2px rgba(110,121,214,0.55); } 50% { box-shadow: 0 0 0 4px rgba(110,121,214,0.25); } }
        @keyframes demoIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .demo-cursor, .demo-ripple { display: none; } }
      `}</style>
      {ring && (
        <span aria-hidden="true" className="pointer-events-none absolute z-30 rounded-lg"
          style={{ left: ring.x - 3, top: ring.y - 3, width: ring.w + 6, height: ring.h + 6, animation: 'demoRing 1.6s ease-in-out infinite' }} />
      )}
      {/* The ripple of a click: a thin light ring growing out from the point. */}
      {ripple && (
        <span key={ripple.key} aria-hidden="true" className="demo-ripple pointer-events-none absolute z-30 w-0 h-0" style={{ left: ripple.x, top: ripple.y }}>
          <span className="absolute -left-[18px] -top-[18px] h-9 w-9 rounded-full border-[1.5px] border-white/70 bg-white/[0.12]" style={{ animation: 'demoRipple 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }} />
        </span>
      )}
      <span ref={curRef} aria-hidden="true" className="demo-cursor pointer-events-none absolute left-0 top-0 z-40 w-0 h-0"
        style={{ visibility: shown ? 'visible' : 'hidden', animation: shown ? 'demoIn 300ms ease-out' : undefined }}>
        <span key={pressKey} className="block origin-top-left" style={{ animation: pressKey > 0 ? 'demoPress 300ms ease-out' : undefined }}>
          {/* The arrowhead, its tip on the point; the shadow is offset copies, so no filter is needed. */}
          <svg width="22" height="22" viewBox="0 0 18 18" className="absolute -left-[3px] -top-[2.2px] overflow-visible">
            <path d="M2.5 1.8 15 8.6l-5.4 1.3-2.4 5.3z" transform="translate(0.7 1.9)" fill="#000" opacity="0.2" stroke="#000" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M2.5 1.8 15 8.6l-5.4 1.3-2.4 5.3z" transform="translate(0.35 0.9)" fill="#000" opacity="0.32" />
            <path d="M2.5 1.8 15 8.6l-5.4 1.3-2.4 5.3z" fill="#f7f8f8" stroke="#08090a" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    </>
  );
}
