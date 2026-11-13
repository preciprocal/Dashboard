'use client';
// components/salary/PercentileBand.tsx
// The 10th to 90th percentile range as one bar: the middle half (25th to
// 75th) highlighted, the median marked, and the user's offer pinned on it
// when they enter one. Values sit in a five-column row underneath rather than
// at their positions on the bar, so close percentiles never overlap on a
// phone.

import React from 'react';
import { PCT_KEYS, formatUsd, formatUsdShort, isCapped, type PctKey, type WageBand } from '@/lib/salary/position';

const LABELS: Record<PctKey, string> = { p10: '10th', p25: '25th', p50: 'Median', p75: '75th', p90: '90th' };

export default function PercentileBand({ band, offer }: { band: WageBand; offer?: number | null }) {
  const known = PCT_KEYS.map((k) => band[k]).filter((v): v is number => v !== null);
  const lowest = Math.min(...known, offer ?? Infinity);
  const highest = Math.max(...known, offer ?? -Infinity);
  // A little room either side, so the ends of the band and an offer just
  // outside it are not drawn flush against the edge.
  const pad = (highest - lowest) * 0.08 || highest * 0.1;
  const min = Math.max(0, lowest - pad);
  const max = highest + pad;
  const x = (v: number) => `${((v - min) / (max - min)) * 100}%`;

  const lo = band.p10 ?? band.p25 ?? band.p50;
  const hi = band.p90 ?? band.p75 ?? band.p50;
  const midLo = band.p25 ?? band.p50;
  const midHi = band.p75 ?? band.p50;

  return (
    <div>
      <div className="relative h-14" role="img"
        aria-label={`Annual wages: 10th percentile ${band.p10 ? formatUsd(band.p10) : 'not published'}, median ${formatUsd(band.p50)}, 90th percentile ${band.p90 ? formatUsd(band.p90, isCapped(band, 'p90')) : 'not published'}${offer ? `, your offer ${formatUsd(offer)}` : ''}`}>
        {/* Offer marker, above the bar */}
        {offer ? (
          <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center" style={{ left: x(offer) }}>
            <span className="text-xs font-semibold text-white whitespace-nowrap px-1.5 py-0.5 rounded-md bg-[var(--bg-raised)] border border-[var(--border-hover)]">
              You {formatUsdShort(offer)}
            </span>
            <span className="w-px h-3 bg-white/70" />
          </div>
        ) : null}
        {/* Track */}
        <div className="absolute left-0 right-0 top-[34px] h-2 rounded-full bg-white/[0.04]" />
        {/* 10th to 90th */}
        <div className="absolute top-[34px] h-2 rounded-full bg-indigo-400/20" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
        {/* 25th to 75th */}
        <div className="absolute top-[32px] h-3 rounded-full bg-indigo-500/70 border border-[var(--accent-border)]" style={{ left: x(midLo), width: `calc(${x(midHi)} - ${x(midLo)})` }} />
        {/* Median */}
        <div className="absolute top-[27px] h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-white" style={{ left: x(band.p50) }} />
        {/* Offer dot */}
        {offer ? (
          <div className="absolute top-[31px] w-3.5 h-3.5 -translate-x-1/2 rounded-full bg-white border-[3px] border-[var(--accent)]" style={{ left: x(offer) }} />
        ) : null}
      </div>

      <dl className="grid grid-cols-5 gap-1 mt-1">
        {PCT_KEYS.map((k) => {
          const v = band[k];
          const median = k === 'p50';
          return (
            <div key={k} className="min-w-0 text-center">
              <dt className={`text-xs ${median ? 'text-indigo-200 font-semibold' : 'text-slate-400'}`}>{LABELS[k]}</dt>
              <dd className={`mt-0.5 tabular-nums truncate ${median ? 'text-sm font-semibold text-white' : 'text-[13px] text-slate-200'}`}>
                {v === null ? <span className="text-slate-400">n/a</span> : (
                  <>
                    <span className="hidden sm:inline">{formatUsd(v, isCapped(band, k))}</span>
                    <span className="sm:hidden">{formatUsdShort(v, isCapped(band, k))}</span>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
