// components/planner/ReadinessScore.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target, Brain, MessageSquare, Flame, TrendingUp,
  RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';

interface ReadinessBreakdown {
  taskCompletion: { score: number; weight: number; detail: string };
  quizPerformance: { score: number; weight: number; detail: string };
  interviewPerformance: { score: number; weight: number; detail: string };
  consistency: { score: number; weight: number; detail: string };
  overallScore: number;
  level: string;
  recommendation: string;
  weakAreas: string[];
  strongAreas: string[];
}

interface Props { planId: string; }

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  'Interview Ready': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'Almost Ready':    { color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20'  },
  'Building Up':     { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  'Getting Started': { color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20'  },
  'Just Beginning':  { color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20'   },
};

const CATEGORIES = [
  { key: 'taskCompletion',        icon: Target,        label: 'Tasks',       accent: 'indigo' },
  { key: 'quizPerformance',       icon: Brain,         label: 'Quiz',        accent: 'violet' },
  { key: 'interviewPerformance',  icon: MessageSquare, label: 'Interviews',  accent: 'blue'   },
  { key: 'consistency',           icon: Flame,         label: 'Consistency', accent: 'orange' },
] as const;

// ── Skeleton that matches the loaded layout exactly ───────────

function ReadinessSkeleton() {
  const shimmer = 'animate-pulse bg-white/[0.04] rounded';
  return (
    <div className="space-y-3">
      {/* Main score skeleton */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${shimmer}`} />
            <div className="space-y-1.5">
              <div className={`h-3.5 w-28 ${shimmer}`} />
              <div className={`h-3 w-20 ${shimmer}`} />
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className={`h-8 w-12 ml-auto ${shimmer}`} />
            <div className={`h-2.5 w-8 ml-auto ${shimmer}`} />
          </div>
        </div>
        <div className={`h-2 w-full rounded-full ${shimmer} mb-3`} />
        <div className={`h-3 w-full ${shimmer} mb-1`} />
        <div className={`h-3 w-3/4 ${shimmer}`} />
      </div>

      {/* Category cards skeleton */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-7 h-7 rounded-lg ${shimmer}`} />
              <div className={`h-5 w-10 ${shimmer}`} />
            </div>
            <div className={`h-2.5 w-20 ${shimmer} mb-1.5`} />
            <div className={`h-1 w-full rounded-full ${shimmer} mb-1.5`} />
            <div className={`h-2.5 w-full ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function ReadinessScore({ planId }: Props) {
  const [data, setData] = useState<ReadinessBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReadiness = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/planner/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) throw new Error('Failed to compute readiness');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { fetchReadiness(); }, [fetchReadiness]);

  // Loading — skeleton with same dimensions as loaded state
  if (loading) return <ReadinessSkeleton />;

  // Error
  if (error || !data) {
    return (
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-xs">{error || 'Could not load readiness score'}</span>
          <button onClick={fetchReadiness} className="text-slate-400 hover:text-white transition-colors p-1">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const cfg = LEVEL_CONFIG[data.level] || LEVEL_CONFIG['Just Beginning'];

  return (
    <div className="space-y-3">
      {/* Main score */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
              <TrendingUp className={`w-5 h-5 ${cfg.color}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Readiness Score</p>
              <p className={`text-xs font-medium ${cfg.color}`}>{data.level}</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold tabular-nums ${cfg.color}`}>{data.overallScore}</p>
            <p className="text-[10px] text-slate-600">/ 100</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${data.overallScore}%`,
              background: data.overallScore >= 70
                ? 'linear-gradient(90deg, #10b981, #34d399)'
                : data.overallScore >= 40
                ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            }} />
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{data.recommendation}</p>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(({ key, icon: Icon, label, accent }) => {
          const cat = data[key];
          return (
            <div key={key} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${accent}-500/[0.08] border border-${accent}-500/20`}>
                  <Icon className={`w-3.5 h-3.5 text-${accent}-400`} />
                </div>
                <span className="text-lg font-bold text-white tabular-nums">{cat.score}%</span>
              </div>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-medium mb-1.5">
                {label} <span className="text-slate-700">({cat.weight}%)</span>
              </p>
              <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden mb-1.5">
                <div className={`h-full rounded-full bg-${accent}-500 transition-all duration-500`}
                  style={{ width: `${cat.score}%` }} />
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">{cat.detail}</p>
            </div>
          );
        })}
      </div>

      {/* Weak / Strong areas */}
      {(data.weakAreas.length > 0 || data.strongAreas.length > 0) && (
        <div className="glass-card p-4">
          <div className="flex gap-4">
            {data.strongAreas.length > 0 && (
              <div className="flex-1">
                <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Strong
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.strongAreas.map(a => (
                    <span key={a} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400 capitalize">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {data.weakAreas.length > 0 && (
              <div className="flex-1">
                <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Needs work
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {data.weakAreas.map(a => (
                    <span key={a} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-400 capitalize">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}