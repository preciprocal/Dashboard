// components/ServiceExampleModal/primitives.tsx
'use client';

import { useState, useEffect } from 'react';

// ─── Animated Score Ring ──────────────────────────────────────────────────────

export function ScoreRing({ score, size = 64, color = '#a855f7', delay = 0 }: {
  score: number; size?: number; color?: string; delay?: number;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;

  useEffect(() => {
    const t = setTimeout(() => {
      let frame = 0;
      const total = 40;
      const interval = setInterval(() => {
        frame++;
        setAnimatedScore(Math.round((frame / total) * score));
        if (frame >= total) clearInterval(interval);
      }, 20);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * animatedScore) / 100}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-bold" style={{ fontSize: size * 0.25 }}>{animatedScore}</span>
      </div>
    </div>
  );
}

// ─── Typing Text ──────────────────────────────────────────────────────────────

export function TypingText({ text, speed = 25, delay = 0, className = '' }: {
  text: string; speed?: number; delay?: number; className?: string;
}) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    setDisplayed('');
    const t = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(t);
  }, [text, speed, delay]);

  return <span className={className}>{displayed}<span className="animate-pulse">|</span></span>;
}

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────

export function FadeIn({ delay = 0, children, className = '' }: {
  delay?: number; children: React.ReactNode; className?: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${className}`}
    >
      {children}
    </div>
  );
}

// ─── Animated progress bar ────────────────────────────────────────────────────

export function AnimatedBar({ value, color = 'bg-purple-500', delay = 0 }: {
  value: number; color?: string; delay?: number;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ─── Percentile Gauge (semicircle meter) ──────────────────────────────────────

export function PercentileGauge({ percentile }: { percentile: number }) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const angle = (animatedPct / 100) * 180;
  const color = animatedPct >= 70 ? '#10b981' : animatedPct >= 40 ? '#f59e0b' : '#ef4444';

  useEffect(() => {
    let frame = 0;
    const total = 50;
    const interval = setInterval(() => {
      frame++;
      setAnimatedPct(Math.round((frame / total) * percentile));
      if (frame >= total) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [percentile]);

  const r = 40;
  const cx = 50;
  const cy = 50;
  const startX = cx - r;
  const startY = cy;
  const rad = (angle * Math.PI) / 180;
  const endX = cx - r * Math.cos(rad);
  const endY = cy - r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  return (
    <div className="relative" style={{ width: 100, height: 60 }}>
      <svg viewBox="0 0 100 55" width="100" height="60">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"
        />
        {animatedPct > 0 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[16px] font-bold leading-none" style={{ color }}>{animatedPct}th</p>
        <p className="text-[7px] text-slate-500">percentile</p>
      </div>
    </div>
  );
}