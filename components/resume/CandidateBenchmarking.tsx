'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Target,
  Zap,
  BarChart3,
  Loader2,
  Info,
  Star,
  RefreshCw,
  XCircle,
  Flame,
  MessageSquare,
  ArrowRight,
  Eye,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Types matching the API response
// ─────────────────────────────────────────────────────────────────

interface BenchmarkDimension {
  name: string;
  userScore: number;
  peerMedian: number;
  hiredMedian: number;
  topTen: number;
  userPercentile: number;
  verdict: 'strong' | 'competitive' | 'weak' | 'critical';
  honestTake: string;
}

interface FixAction {
  action: string;
  whyItMatters: string;
  estimatedScoreGain: string;
}

interface BenchmarkResult {
  overallPercentile: number;
  hiringChance: 'very low' | 'low' | 'moderate' | 'high' | 'very high';
  hiringChanceReason: string;
  killerFlaw: {
    title: string;
    detail: string;
    urgency: 'critical' | 'high' | 'medium';
  };
  dimensions: BenchmarkDimension[];
  whatHiredCandidatesHaveThatYouDont: string[];
  threeThingsToFixNow: FixAction[];
  recruitersFirstImpression: string;
  ifThisResumeAppliedToday: string;
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<BenchmarkDimension['verdict'], { bar: string; badge: string; label: string }> = {
  strong:      { bar: 'from-emerald-500 to-teal-500',   badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Strong'      },
  competitive: { bar: 'from-amber-400 to-yellow-500',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       label: 'Competitive' },
  weak:        { bar: 'from-orange-500 to-amber-600',   badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',   label: 'Weak'        },
  critical:    { bar: 'from-red-500 to-rose-600',       badge: 'bg-red-500/15 text-red-400 border-red-500/30',            label: 'Critical'    },
};

const HIRING_CHANCE_STYLES: Record<BenchmarkResult['hiringChance'], { color: string; icon: React.ElementType; bg: string }> = {
  'very low':  { color: 'text-red-400',     icon: XCircle,     bg: 'bg-red-500/10 border-red-500/20'         },
  'low':       { color: 'text-orange-400',  icon: TrendingDown, bg: 'bg-orange-500/10 border-orange-500/20'  },
  'moderate':  { color: 'text-amber-400',   icon: Minus,        bg: 'bg-amber-500/10 border-amber-500/20'    },
  'high':      { color: 'text-emerald-400', icon: TrendingUp,   bg: 'bg-emerald-500/10 border-emerald-500/20'},
  'very high': { color: 'text-teal-400',    icon: Award,        bg: 'bg-teal-500/10 border-teal-500/20'      },
};

const BENCHMARK_FACTS = [
  "Recruiters spend an average of 7 seconds scanning a resume before deciding.",
  "75% of resumes are rejected by ATS before a human ever sees them.",
  "Resumes with quantified achievements are 40% more likely to get an interview.",
  "The average corporate job opening attracts 250 applications.",
  "Only 2% of applicants make it to the interview stage for any given role.",
  "Using the exact job title from the posting increases callback rates by 31%.",
  "Resumes with a LinkedIn URL get 71% more responses from recruiters.",
  "Action verbs at the start of bullet points increase perceived impact by 38%.",
  "Hiring managers prefer one-page resumes for candidates with under 10 years of experience.",
  "Candidates who tailor their resume per application are 3× more likely to get interviews.",
];

function BenchmarkLoadingState() {
  const [factIndex, setFactIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setFactIndex(i => (i + 1) % BENCHMARK_FACTS.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div className="glass-card-gradient hover-lift">
      <div className="glass-card-gradient-inner flex flex-col items-center justify-center py-16 gap-6">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="w-4 h-4 text-purple-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-medium mb-1">Analysing against hired candidates…</p>
          <p className="text-slate-400 text-sm mb-2">Benchmarking your resume against real-world data</p>
        </div>
        {/* Rotating fact */}
        <div className="w-full max-w-sm mx-auto px-2">
          <div className="glass-morphism rounded-xl border border-white/5 p-4 min-h-[72px] flex flex-col items-center justify-center text-center">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-2">Did you know?</p>
            <p
              className="text-sm text-slate-300 leading-relaxed"
              style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.4s ease' }}
            >
              {BENCHMARK_FACTS[factIndex]}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PercentileGauge({ percentile }: { percentile: number }) {
  const angle = (percentile / 100) * 180;
  const color = percentile >= 70 ? '#10b981' : percentile >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-14 overflow-hidden">
        {/* Track */}
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          {/* Fill */}
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.3} 141.3`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
          {/* Needle */}
          <line
            x1="50" y1="50"
            x2={50 + 35 * Math.cos(Math.PI - (angle * Math.PI / 180))}
            y2={50 - 35 * Math.sin(Math.PI - (angle * Math.PI / 180))}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="50" cy="50" r="3" fill="white" />
        </svg>
      </div>
      <div className="text-center -mt-1">
        <span className="text-2xl font-bold" style={{ color }}>{percentile}th</span>
        <span className="text-xs text-slate-400 block">percentile</span>
      </div>
    </div>
  );
}

function DimensionRow({ dim }: { dim: BenchmarkDimension }) {
  const [expanded, setExpanded] = useState(false);
  const style = VERDICT_STYLES[dim.verdict] || VERDICT_STYLES.weak;
  const gapToHired = dim.hiredMedian - dim.userScore;

  return (
    <div
      className="glass-morphism rounded-xl border border-white/5 overflow-hidden cursor-pointer transition-all hover:border-white/10"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium">{dim.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.badge}`}>
              {style.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-bold text-white">{dim.userScore}</span>
            <span>/100</span>
            <span className={`font-medium ${gapToHired > 8 ? 'text-red-400' : gapToHired > 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {gapToHired > 0 ? `▼${gapToHired} behind hired` : `▲${Math.abs(gapToHired)} above hired`}
            </span>
          </div>
        </div>

        {/* 3-marker bar */}
        <div className="relative h-5 bg-slate-900/60 rounded-lg overflow-hidden border border-slate-700/30 mb-2">
          {/* User fill */}
          <div
            className={`absolute top-0 left-0 bottom-0 bg-gradient-to-r ${style.bar} opacity-80 rounded-r-md transition-all duration-700`}
            style={{ width: `${Math.min(dim.userScore, 100)}%` }}
          />
          {/* Peer median */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-slate-400/60 z-10" style={{ left: `${dim.peerMedian}%` }} />
          {/* Hired median */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-violet-400/80 z-10" style={{ left: `${dim.hiredMedian}%` }} />
          {/* Top 10% */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-teal-400/60 z-10" style={{ left: `${dim.topTen}%` }} />
          {/* Score label */}
          <div className="absolute inset-0 flex items-center px-2 z-20 pointer-events-none">
            <span className="text-xs font-bold text-white drop-shadow">{dim.userScore}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-slate-400/60 inline-block" />All applicants: {dim.peerMedian}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-violet-400/80 inline-block" />Hired: {dim.hiredMedian}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-teal-400/60 inline-block" />Top 10%: {dim.topTen}</span>
          <span className="ml-auto text-slate-400">You: {dim.userPercentile}th pct</span>
        </div>
      </div>

      {/* Expanded honest take */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-white/5 pt-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">{dim.honestTake}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────

interface CandidateBenchmarkingProps {
  resumeId: string;
  overallScore: number;
  jobTitle?: string;
}

export default function CandidateBenchmarking({ resumeId, jobTitle }: CandidateBenchmarkingProps) {
  const [data,    setData]    = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [cached,  setCached]  = useState(false);

  const fetchBenchmark = useCallback(async (force = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/resume/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, force }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json.data);
      setCached(json.cached);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load benchmark');
    } finally {
      setLoading(false);
    }
  }, [resumeId, loading]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchBenchmark();
  }, [resumeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading state ──
  if (loading) {
    return <BenchmarkLoadingState />;
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner text-center py-12">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Benchmark failed</p>
          <p className="text-slate-400 text-sm mb-5">{error}</p>
          <button
            onClick={() => fetchBenchmark(true)}
            className="glass-button hover-lift inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (!data) {
    return (
      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner text-center py-12">
          <Users className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <p className="text-white font-medium mb-1">Get your benchmark</p>
          <p className="text-slate-400 text-sm mb-5">
            See how your resume compares to candidates who actually got hired{jobTitle ? ` for ${jobTitle} roles` : ''}.
            <br />
            <span className="text-amber-400">Honest feedback only — no sugarcoating.</span>
          </p>
          <button
            onClick={() => fetchBenchmark()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-500/25"
          >
            <Zap className="w-4 h-4" /> Run Benchmark
          </button>
        </div>
      </div>
    );
  }

  // ── Render results ──
  const chanceStyle   = HIRING_CHANCE_STYLES[data.hiringChance] || HIRING_CHANCE_STYLES['moderate'];
  const HireIcon      = chanceStyle.icon;
  const urgencyColors = { critical: 'border-red-500/40 bg-red-500/10', high: 'border-orange-500/40 bg-orange-500/10', medium: 'border-amber-500/40 bg-amber-500/10' };

  return (
    <div className="space-y-5">

      {/* ── Header: percentile + hiring chance ── */}
      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glass">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Candidate Benchmark</h3>
                <p className="text-slate-400 text-xs">
                  AI analysis vs. real hired candidates{jobTitle ? ` for ${jobTitle}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cached && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Info className="w-3 h-3" /> cached
                </span>
              )}
              <button
                onClick={() => fetchBenchmark(true)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                title="Refresh benchmark"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Percentile gauge + hiring chance side by side */}
          <div className="flex flex-col sm:flex-row items-center gap-5 mb-5">
            <PercentileGauge percentile={data.overallPercentile} />
            <div className={`flex-1 w-full p-4 rounded-xl border ${chanceStyle.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <HireIcon className={`w-4 h-4 ${chanceStyle.color}`} />
                <span className={`text-sm font-bold capitalize ${chanceStyle.color}`}>
                  {data.hiringChance} chance of interview
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{data.hiringChanceReason}</p>
            </div>
          </div>

          {/* Recruiter's first impression */}
          <div className="glass-morphism rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Recruiter&apos;s first impression (6 seconds)</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed italic">&quot;{data.recruitersFirstImpression}&quot;</p>
          </div>
        </div>
      </div>

      {/* ── Killer flaw ── */}
      {data.killerFlaw && (
        <div className={`glass-card-gradient hover-lift`}>
          <div className={`glass-card-gradient-inner rounded-xl border ${urgencyColors[data.killerFlaw.urgency] || urgencyColors.high}`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center ${
                data.killerFlaw.urgency === 'critical' ? 'bg-red-500/20' : 'bg-orange-500/20'
              }`}>
                <Flame className={`w-5 h-5 ${data.killerFlaw.urgency === 'critical' ? 'text-red-400' : 'text-orange-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs uppercase tracking-wide font-bold ${data.killerFlaw.urgency === 'critical' ? 'text-red-400' : 'text-orange-400'}`}>
                    {data.killerFlaw.urgency === 'critical' ? '🚨 Critical issue' : '⚠️ Major issue'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{data.killerFlaw.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{data.killerFlaw.detail}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dimension breakdown ── */}
      <div className="glass-card-gradient hover-lift">
        <div className="glass-card-gradient-inner">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 gradient-accent rounded-lg flex items-center justify-center shadow-glass">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Dimension Breakdown</h3>
              <p className="text-xs text-slate-400">Click any row to see the honest take</p>
            </div>
          </div>
          <div className="space-y-3">
            {data.dimensions.map(dim => <DimensionRow key={dim.name} dim={dim} />)}
          </div>
        </div>
      </div>

      {/* ── What hired candidates have that you don't ── */}
      {data.whatHiredCandidatesHaveThatYouDont?.length > 0 && (
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Star className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">What Hired Candidates Have That You Don&apos;t</h3>
                <p className="text-xs text-slate-400">Specific gaps vs. people who got the offer</p>
              </div>
            </div>
            <div className="space-y-2">
              {data.whatHiredCandidatesHaveThatYouDont.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 3 things to fix now ── */}
      {data.threeThingsToFixNow?.length > 0 && (
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">3 Things to Fix Right Now</h3>
                <p className="text-xs text-slate-400">Highest-leverage improvements, in order of priority</p>
              </div>
            </div>
            <div className="space-y-3">
              {data.threeThingsToFixNow.map((fix, i) => (
                <div key={i} className="glass-morphism rounded-xl p-4 border border-white/5">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white mb-1">{fix.action}</p>
                      <p className="text-xs text-slate-400 mb-2 leading-relaxed">{fix.whyItMatters}</p>
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        {fix.estimatedScoreGain}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom line verdict ── */}
      {data.ifThisResumeAppliedToday && (
        <div className="glass-card-gradient hover-lift">
          <div className={`glass-card-gradient-inner rounded-xl border ${chanceStyle.bg}`}>
            <div className="flex items-start gap-3">
              <Target className={`w-5 h-5 flex-shrink-0 mt-0.5 ${chanceStyle.color}`} />
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Bottom Line</p>
                <p className="text-sm text-white font-medium leading-relaxed">{data.ifThisResumeAppliedToday}</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}