'use client';
// components/resume/AnalysisPanel.tsx
//
// The Analysis tab beside the resume: a score summary (overall ring and one
// bar per category, each a link to its section), the first things to fix,
// then each category with its issues and what already works, and the
// roadmap when the analysis has one. Everything shown comes from the stored
// analysis; nothing here is estimated.
import { useId, useRef, useState } from 'react';
import { Shield, FileText, LayoutTemplate, Sparkles, PenLine, CheckCircle2, AlertCircle, ChevronDown, Wrench, Zap, Clock, TrendingUp } from 'lucide-react';

export interface Tip { type: string; tip?: string; message?: string; explanation?: string; solution?: string; priority?: string }
export interface Section { score: number; tips: Tip[] }
interface RoadmapItem { action: string; timeToComplete?: string; impact?: 'high' | 'medium' | 'low' }
export interface Roadmap { quickWins?: RoadmapItem[]; mediumTermGoals?: RoadmapItem[]; mediumTerm?: RoadmapItem[]; longTermStrategies?: RoadmapItem[]; longTerm?: RoadmapItem[] }

export interface AnalysisData {
  overallScore: number;
  ATS?: Section; content?: Section; structure?: Section; skills?: Section; toneAndStyle?: Section;
  roadmap?: Roadmap;
}

const CATEGORIES = [
  { key: 'ATS', label: 'ATS compatibility', blurb: 'How cleanly applicant tracking systems can read it', icon: Shield },
  { key: 'content', label: 'Content', blurb: 'Relevance and impact of what you describe', icon: FileText },
  { key: 'structure', label: 'Structure and format', blurb: 'Organisation, layout and length', icon: LayoutTemplate },
  { key: 'skills', label: 'Skills and keywords', blurb: 'Technical and soft skills a reader can find', icon: Sparkles },
  { key: 'toneAndStyle', label: 'Tone and style', blurb: 'Clarity and strength of the writing', icon: PenLine },
] as const;
type CatKey = typeof CATEGORIES[number]['key'];

export const scoreWord = (s: number) => (s >= 90 ? 'Excellent' : s >= 80 ? 'Very good' : s >= 70 ? 'Good' : s >= 60 ? 'Fair' : 'Needs work');
const tone = (s: number) => (s >= 80 ? { text: 'text-emerald-300', bar: 'bg-emerald-400', ring: ['#34d399', '#10b981'] } : s >= 60 ? { text: 'text-amber-300', bar: 'bg-amber-400', ring: ['#fbbf24', '#f59e0b'] } : { text: 'text-rose-300', bar: 'bg-rose-400', ring: ['#fb7185', '#f43f5e'] });
const textOf = (t: Tip) => t.tip || t.message || '';

function Ring({ score, size = 112 }: { score: number; size?: number }) {
  const id = useId();
  const stroke = 8, r = size / 2 - stroke, c = 2 * Math.PI * r;
  const [a, b] = tone(score).ring;
  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, score)) / 100)} className="prc-ring" style={{ ['--ring-c' as string]: c } as React.CSSProperties} />
      </svg>
      <span className="absolute flex flex-col items-center leading-none">
        <span className="font-display text-[34px] font-semibold tracking-[-0.03em] text-white tabular-nums">{score}</span>
        <span className="text-[11px] text-[var(--text-4)] mt-1">of 100</span>
      </span>
    </span>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function Summary({ data, cats, go }: { data: AnalysisData; cats: { key: CatKey; label: string; s: Section }[]; go: (k: string) => void }) {
  const issues = cats.reduce((n, c) => n + c.s.tips.filter(t => t.type !== 'good').length, 0);
  const good = cats.reduce((n, c) => n + c.s.tips.filter(t => t.type === 'good').length, 0);
  return (
    <section className="prc-rail rounded-2xl ring-1 ring-inset ring-white/[0.07] p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex items-center gap-5 sm:w-[240px] flex-shrink-0">
          <Ring score={data.overallScore} />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">Overall</p>
            <p className={`text-[18px] font-semibold mt-0.5 ${tone(data.overallScore).text}`}>{scoreWord(data.overallScore)}</p>
            <p className="text-[12px] text-[var(--text-3)] mt-1.5 leading-snug">{issues} to improve<br />{good} already working</p>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2.5 sm:pl-6 sm:border-l border-white/[0.07]">
          {cats.map(c => (
            <button key={c.key} onClick={() => go(c.key)} className="group w-full grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 text-left">
              <span className="text-[13px] text-[var(--text-2)] group-hover:text-white transition-colors truncate">{c.label}</span>
              <span className={`text-[13px] font-semibold tabular-nums ${tone(c.s.score).text}`}>{c.s.score}</span>
              <span className="col-span-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <span className={`block h-full rounded-full ${tone(c.s.score).bar} transition-[width] duration-700`} style={{ width: `${Math.max(2, c.s.score)}%` }} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Fix first ───────────────────────────────────────────────────────────────

function FixFirst({ cats }: { cats: { key: CatKey; label: string; s: Section }[] }) {
  // One issue from each of the lowest-scoring categories, those with a fix first.
  const picks = [...cats].sort((a, b) => a.s.score - b.s.score)
    .map(c => ({ c, t: [...c.s.tips.filter(t => t.type !== 'good')].sort((x, y) => Number(!!y.solution) - Number(!!x.solution))[0] }))
    .filter(x => x.t && textOf(x.t)).slice(0, 3);
  if (!picks.length) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">Fix these first</h3>
        <p className="text-[12px] text-[var(--text-4)]">From your lowest-scoring areas</p>
      </div>
      <ol className="space-y-2.5">
        {picks.map(({ c, t }, i) => (
          <li key={c.key} className="flex gap-3.5 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] text-[12px] font-semibold text-[var(--text-2)] flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-4)]">{c.label}</p>
              <p className="text-[13.5px] text-white mt-1 leading-snug">{textOf(t!)}</p>
              {t!.solution && (
                <p className="mt-2 text-[12.5px] text-[var(--text-2)] leading-relaxed flex gap-2"><Wrench className="w-3.5 h-3.5 mt-[3px] text-[var(--accent)] flex-shrink-0" />{t!.solution}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── A category ──────────────────────────────────────────────────────────────

function Category({ k, label, blurb, icon: Icon, s, open: startOpen }: { k: CatKey; label: string; blurb: string; icon: React.ElementType; s: Section; open: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const issues = s.tips.filter(t => t.type !== 'good');
  const good = s.tips.filter(t => t.type === 'good');
  const t = tone(s.score);
  return (
    <section data-cat={k} className="scroll-mt-4 rounded-2xl ring-1 ring-inset ring-white/[0.07] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center gap-4 p-4 sm:p-5 text-left hover:bg-white/[0.02] transition-colors">
        <span className="w-10 h-10 rounded-[10px] bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] flex items-center justify-center flex-shrink-0"><Icon className="w-[18px] h-[18px] text-[var(--accent)]" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[14.5px] font-semibold text-white truncate">{label}</span>
            <span className={`text-[11.5px] font-medium px-2 py-[2px] rounded-full bg-white/[0.04] ${t.text}`}>{scoreWord(s.score)}</span>
          </span>
          <span className="block text-[12.5px] text-[var(--text-3)] mt-0.5 truncate">{blurb}</span>
        </span>
        <span className="hidden sm:flex flex-col items-end gap-1.5 w-24 flex-shrink-0">
          <span className={`text-[15px] font-semibold tabular-nums ${t.text}`}>{s.score}<span className="text-[11px] text-[var(--text-5)] font-normal">/100</span></span>
          <span className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden"><span className={`block h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(2, s.score)}%` }} /></span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--text-4)] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-4 sm:px-5 py-4 space-y-5 prc-fade">
          {issues.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)] mb-2.5">To improve · {issues.length}</p>
              <ul className="space-y-3">
                {issues.map((x, i) => (
                  <li key={i} className="flex gap-3">
                    <AlertCircle className="w-4 h-4 mt-[2px] text-amber-300 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] text-white leading-snug">{textOf(x)}</p>
                      {x.explanation && <p className="text-[12.5px] text-[var(--text-3)] mt-1 leading-relaxed">{x.explanation}</p>}
                      {x.solution && (
                        <div className="mt-2 rounded-lg bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)] px-3 py-2 flex gap-2">
                          <Wrench className="w-3.5 h-3.5 mt-[3px] text-[#a9b0f7] flex-shrink-0" />
                          <p className="text-[12.5px] text-[#d6daff] leading-relaxed">{x.solution}</p>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {good.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)] mb-2.5">Already working · {good.length}</p>
              <ul className="space-y-2">
                {good.map((x, i) => (
                  <li key={i} className="flex gap-3">
                    <CheckCircle2 className="w-4 h-4 mt-[2px] text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] text-[var(--text-2)] leading-snug">{textOf(x)}</p>
                      {x.explanation && <p className="text-[12px] text-[var(--text-4)] mt-0.5 leading-relaxed">{x.explanation}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!issues.length && !good.length && <p className="text-[13px] text-[var(--text-3)]">No notes for this area.</p>}
        </div>
      )}
    </section>
  );
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────

function RoadmapView({ r }: { r: Roadmap }) {
  const stages = [
    { label: 'Quick wins', icon: Zap, items: r.quickWins ?? [] },
    { label: 'Next few weeks', icon: Clock, items: r.mediumTermGoals ?? r.mediumTerm ?? [] },
    { label: 'Longer term', icon: TrendingUp, items: r.longTermStrategies ?? r.longTerm ?? [] },
  ].filter(s => s.items.length);
  if (!stages.length) return null;
  return (
    <section>
      <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white mb-3">Roadmap</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {stages.map(s => (
          <div key={s.label} className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-[12.5px] font-semibold text-white flex items-center gap-1.5 mb-3"><s.icon className="w-3.5 h-3.5 text-[var(--accent)]" />{s.label}</p>
            <ul className="space-y-2.5">
              {s.items.map((it, i) => (
                <li key={i} className="text-[12.5px] text-[var(--text-2)] leading-snug">
                  {it.action}
                  {(it.timeToComplete || it.impact) && <span className="block text-[11px] text-[var(--text-4)] mt-0.5">{[it.timeToComplete, it.impact ? `${it.impact} impact` : ''].filter(Boolean).join(' · ')}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── The tab ─────────────────────────────────────────────────────────────────

export default function AnalysisPanel({ data }: { data: AnalysisData }) {
  const cats = CATEGORIES.map(c => ({ ...c, s: data[c.key] as Section | undefined }))
    .filter((c): c is typeof c & { s: Section } => !!c.s && (c.s.score > 0 || c.s.tips.length > 0));
  const lowest = [...cats].sort((a, b) => a.s.score - b.s.score)[0]?.key;
  // The page renders this panel twice (phone and desktop layouts), so sections
  // are found within this copy rather than by id.
  const root = useRef<HTMLDivElement | null>(null);
  const go = (k: string) => root.current?.querySelector(`[data-cat="${k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <div ref={root} className="space-y-7">
      <Summary data={data} cats={cats} go={go} />
      <FixFirst cats={cats} />
      <section>
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white mb-3">By area</h3>
        <div className="space-y-2.5">
          {cats.map(c => <Category key={c.key} k={c.key} label={c.label} blurb={c.blurb} icon={c.icon} s={c.s} open={c.key === lowest} />)}
        </div>
      </section>
      {data.roadmap && <RoadmapView r={data.roadmap} />}
    </div>
  );
}

/** The overall score as a compact chip, for the header on every tab. */
export function ScoreChip({ score }: { score: number }) {
  const t = tone(score);
  return (
    <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] text-[12px]">
      <span className={`w-1.5 h-1.5 rounded-full ${t.bar}`} />
      <span className="text-[var(--text-3)]">Score</span>
      <span className={`font-semibold tabular-nums ${t.text}`}>{score}</span>
    </span>
  );
}
