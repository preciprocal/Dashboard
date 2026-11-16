// components/apply/WordDiff.tsx
//
// One resume line, before and after, with only the changed words marked:
// removed words struck through in red, new words in green.
'use client';

import { useMemo } from 'react';
import { wordDiff, diffCounts, type DiffOp } from '@/lib/text/word-diff';

/** Groups runs of the same kind so each mark is one span. */
function runs(ops: DiffOp[]) {
  const out: { t: DiffOp['t']; text: string }[] = [];
  for (const o of ops) {
    const last = out[out.length - 1];
    if (last && last.t === o.t) last.text += ' ' + o.w;
    else out.push({ t: o.t, text: o.w });
  }
  return out;
}

const DEL = 'rounded-[3px] px-0.5 bg-rose-500/15 text-rose-300 line-through decoration-rose-400/70';
const ADD = 'rounded-[3px] px-0.5 bg-emerald-500/15 text-emerald-200';

/** Inline redline: one paragraph with removed and added words in place. */
export function InlineDiff({ before, after, className = '' }: { before: string; after: string; className?: string }) {
  const parts = useMemo(() => runs(wordDiff(before, after)), [before, after]);
  return (
    <p className={`text-[13px] leading-[1.7] text-[var(--text-2)] ${className}`}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span className={p.t === 'del' ? DEL : p.t === 'add' ? ADD : ''}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}

/** One side of the change: the original with removed words, or the rewrite with new words. */
export function SideDiff({ before, after, side, className = '' }: { before: string; after: string; side: 'before' | 'after'; className?: string }) {
  const parts = useMemo(() => runs(wordDiff(before, after)).filter(p => p.t === 'same' || p.t === (side === 'before' ? 'del' : 'add')), [before, after, side]);
  return (
    <p className={`text-[13px] leading-[1.7] ${side === 'before' ? 'text-[var(--text-3)]' : 'text-white'} ${className}`}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span className={p.t === 'del' ? DEL : p.t === 'add' ? ADD : ''}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}

export function useDiffCounts(before: string, after: string) {
  return useMemo(() => diffCounts(wordDiff(before, after)), [before, after]);
}
