'use client';
// components/ServiceModal/examples/salary/SalaryPreview.tsx
//
// The Market Pay example: a title and city typed in, the wage percentiles
// for that occupation and area, an offer placed on the range, and the search
// kept under Recent searches. Every figure here is a sample for the
// illustration, said so on screen; the real page reads BLS tables.
import { Search, MapPin, Briefcase, Loader2, History, FileText, Info } from 'lucide-react';
import { FadeIn, TypingText } from '../../primitives';
import { demoClick } from '../../DemoCursor';

// Sample percentiles, for the illustration only.
const BAND = [
  { k: '10th', v: 61000 },
  { k: '25th', v: 74000 },
  { k: 'Median', v: 92000 },
  { k: '75th', v: 113000 },
  { k: '90th', v: 134000 },
];
const usd = (n: number) => `$${n.toLocaleString('en-US')}`;
const pct = (v: number) => ((v - BAND[0].v) / (BAND[4].v - BAND[0].v)) * 84 + 8;

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10px] font-medium text-[var(--text-4)] mb-1">{label}</span>
      <span className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] text-[12px] text-white">
        <Icon className="w-3.5 h-3.5 text-[var(--text-4)] flex-shrink-0" />{children}
      </span>
    </label>
  );
}

export function SalaryExamplePreview({ step }: { step: number }) {
  const searched = step >= 2;
  const offerShown = step >= 3;
  const saved = step >= 4;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-3.5">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5 items-end">
          <Field label="Job title" icon={Briefcase}>
            {step === 0 ? <TypingText text="Data Analyst" speed={70} delay={300} /> : <span>Data Analyst</span>}
          </Field>
          <Field label="Location" icon={MapPin}>
            {step === 0 ? <TypingText text="Boston, MA" speed={70} delay={1400} /> : <span>Boston, MA</span>}
          </Field>
          <span {...demoClick(0)} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[12px] font-semibold text-[var(--on-primary)] bg-[var(--primary)]">
            {step === 1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Check pay
          </span>
        </div>
      </div>

      {/* Recent searches */}
      {saved && (
        <FadeIn>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)] flex items-center gap-1.5 mb-1.5"><History className="w-3 h-3" />Recent searches</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg ring-1 ring-inset ring-[var(--accent-border)] bg-[var(--accent-subtle)] px-3 py-2">
              <p className="text-[11.5px] font-medium text-white">Data Analyst</p>
              <p className="text-[10px] text-[var(--text-3)]">Boston, MA · {usd(92000)} median</p>
            </div>
            <div className="rounded-lg ring-1 ring-inset ring-white/[0.07] px-3 py-2">
              <p className="text-[11.5px] font-medium text-white">Business Analyst</p>
              <p className="text-[10px] text-[var(--text-3)]">Remote · {usd(88000)} median</p>
            </div>
          </div>
        </FadeIn>
      )}

      {step === 1 && (
        <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] p-8 flex flex-col items-center gap-2 text-[11px] text-[var(--text-3)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" /> Reading the wage tables for this occupation and area
        </div>
      )}

      {/* Result */}
      {searched && (
        <FadeIn>
          <section className="rounded-xl ring-1 ring-inset ring-white/[0.07] overflow-hidden">
            <div className="grid grid-cols-2 gap-3 p-3.5 border-b border-white/[0.06]">
              <div>
                <p className="text-[10px] text-[var(--text-4)] flex items-center gap-1"><Briefcase className="w-3 h-3" />Occupation</p>
                <p className="text-[12px] text-white font-medium mt-1">Data Scientists</p>
                <p className="text-[10px] text-[var(--text-4)] mt-0.5">Matched from your job title</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--text-4)] flex items-center gap-1"><MapPin className="w-3 h-3" />Area</p>
                <p className="text-[12px] text-white font-medium mt-1">Boston metro area</p>
                <p className="text-[10px] text-[var(--text-4)] mt-0.5">Metropolitan area</p>
              </div>
            </div>
            <div className="p-3.5">
              <p className="text-[10px] text-[var(--text-4)]">Median annual wage</p>
              <p className="text-[24px] leading-tight font-semibold text-white tabular-nums">{usd(92000)}</p>

              {/* Percentile band */}
              <div className="relative h-10 mt-3">
                <div className="absolute left-[8%] right-[8%] top-3 h-1.5 rounded-full bg-white/[0.06]" />
                <div className="absolute top-3 h-1.5 rounded-full bg-[var(--accent)]" style={{ left: `${pct(BAND[1].v)}%`, width: `${pct(BAND[3].v) - pct(BAND[1].v)}%` }} />
                {offerShown && (
                  <FadeIn className="absolute top-0" >
                    <span className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pct(85000)}%` }}>
                      <span className="w-0.5 h-5 bg-white rounded-full" />
                      <span className="mt-0.5 text-[9px] font-semibold text-white whitespace-nowrap">Your offer</span>
                    </span>
                  </FadeIn>
                )}
              </div>
              <div className="grid grid-cols-5 text-center mt-1">
                {BAND.map(b => (
                  <div key={b.k}>
                    <p className={`text-[9.5px] ${b.k === 'Median' ? 'text-white font-semibold' : 'text-[var(--text-4)]'}`}>{b.k}</p>
                    <p className={`text-[11px] tabular-nums ${b.k === 'Median' ? 'text-white font-semibold' : 'text-[var(--text-2)]'}`}>{usd(b.v)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Offer */}
            <div className="p-3.5 border-t border-white/[0.06] bg-white/[0.015] grid grid-cols-[180px_1fr] gap-3 items-start">
              <label className="block">
                <span className="block text-[10px] font-medium text-[var(--text-4)] mb-1">Enter your offer (base salary)</span>
                <span {...demoClick(2)} className="flex items-center h-9 px-3 rounded-lg bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] text-[12px] text-white">
                  {step === 2 ? <span className="text-[var(--text-5)]">e.g. $85,000</span> : step === 3 ? <TypingText text="$85,000" speed={80} /> : '$85,000'}
                </span>
              </label>
              <div className="pt-4">
                {offerShown ? (
                  <FadeIn delay={500}>
                    <p className="text-[12px] text-white">$85,000 is <span className="font-semibold text-[#c5cbf5]">between the 25th percentile and the median</span> here.</p>
                    <p className="text-[11px] text-[var(--text-3)] mt-1 leading-relaxed">A counter toward the median is reasonable if the role matches the occupation.</p>
                  </FadeIn>
                ) : (
                  <p className="text-[11px] text-[var(--text-3)]">See where your offer sits in the range.</p>
                )}
                <p className="mt-2 text-[11px] text-[#a9b0f7] flex items-center gap-1.5"><FileText className="w-3 h-3" />Salary negotiation email template</p>
              </div>
            </div>
          </section>
          <p className="mt-2 text-[10px] text-[var(--text-5)] flex items-center gap-1.5"><Info className="w-3 h-3" />Example figures for this illustration. The real page shows US Bureau of Labor Statistics wages.</p>
        </FadeIn>
      )}
    </div>
  );
}
