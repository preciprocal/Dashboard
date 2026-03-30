'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import {
  collection, addDoc, query, where, orderBy,
  getDocs, doc, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  BookOpen, Plus, Loader2, Trash2, ChevronDown, ChevronUp,
  Calendar, Building2, TrendingUp, AlertTriangle, CheckCircle2,
  Brain, MessageSquare, Target, BarChart3, Lightbulb, Clock,
  Star, Edit3, X, Save, ArrowLeft, Activity, Award, Zap, Eye,
  Heart, Filter, Search, RefreshCw, XCircle, ArrowRight, Flame,
  Users, MapPin, Sparkles, Shield,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { SeeExampleButton } from '@/components/ServiceModal';


// ─── Types ────────────────────────────────────────────────────────────────────

type InterviewStage   = 'phone-screen' | 'technical' | 'behavioral' | 'system-design' | 'final' | 'onsite';
type InterviewOutcome = 'pending' | 'moved-forward' | 'rejected' | 'ghosted' | 'withdrew' | 'offer';
type EmotionalState   = 'confident' | 'nervous' | 'neutral' | 'excited' | 'anxious' | 'exhausted';
type DifficultyRating = 1 | 2 | 3 | 4 | 5;

interface DebriefEntry {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  interviewDate: string;
  stage: InterviewStage;
  outcome: InterviewOutcome;
  emotionalStateBefore: EmotionalState;
  emotionalStateAfter: EmotionalState;
  difficultyRating: DifficultyRating;
  durationMinutes: number;
  interviewerCount: number;
  questionsAsked: string[];
  whatWentWell: string;
  whatWentPoorly: string;
  surprises: string;
  followUpActions: string;
  overallNotes: string;
  selfScore: number;
  createdAt: unknown;
}

interface AIPattern {
  pattern: string;
  evidence: string;
  impact: 'positive' | 'negative' | 'mixed';
  explanation: string;
}
interface AIWeakness {
  area: string;
  frequency: number;
  severity: 'minor' | 'moderate' | 'severe';
  specificExample: string;
  fix: string;
}
interface AIStrength {
  area: string;
  evidence: string;
  howToLeverage: string;
}
interface AIWeekPlan {
  week: 1 | 2 | 3 | 4;
  focus: string;
  actions: string[];
  successMetric: string;
}
interface AIQuestion {
  question: string;
  whyItMatters: string;
  howToAnswer: string;
}
interface AIAnalysis {
  overallReadiness: number;
  readinessLabel: string;
  oneLinerVerdict: string;
  topPatterns: AIPattern[];
  weaknessMap: AIWeakness[];
  strengthMap: AIStrength[];
  emotionalProfile: {
    dominantStateBefore: string;
    dominantStateAfter: string;
    anxietyImpact: string;
    recommendation: string;
  };
  stageAnalysis: {
    strongestStage: string;
    weakestStage: string;
    bottleneck: string;
  };
  blindSpots: string[];
  next30DayPlan: AIWeekPlan[];
  questionsToMaster: AIQuestion[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<InterviewStage, string> = {
  'phone-screen':  'Phone Screen',
  'technical':     'Technical',
  'behavioral':    'Behavioral',
  'system-design': 'System Design',
  'final':         'Final Round',
  'onsite':        'Onsite',
};

const OUTCOME_COLORS: Record<InterviewOutcome, string> = {
  pending:         'text-amber-400  bg-amber-400/10  border-amber-400/20',
  'moved-forward': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  rejected:        'text-red-400    bg-red-400/10    border-red-400/20',
  ghosted:         'text-slate-400  bg-slate-400/10  border-slate-400/20',
  withdrew:        'text-purple-400 bg-purple-400/10 border-purple-400/20',
  offer:           'text-blue-400   bg-blue-400/10   border-blue-400/20',
};

const OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  pending:         'Pending',
  'moved-forward': 'Moved Forward',
  rejected:        'Rejected',
  ghosted:         'Ghosted',
  withdrew:        'Withdrew',
  offer:           '🎉 Offer!',
};

const EMOTIONAL_EMOJIS: Record<EmotionalState, string> = {
  confident: '😎', nervous: '😰', neutral: '😐',
  excited: '🤩', anxious: '😟', exhausted: '😓',
};

const SEVERITY_COLORS: Record<AIWeakness['severity'], string> = {
  minor:    'bg-amber-500/[0.08] border-amber-500/20 text-amber-400',
  moderate: 'bg-orange-500/[0.08] border-orange-500/20 text-orange-400',
  severe:   'bg-red-500/[0.08] border-red-500/20 text-red-400',
};

const EMPTY_FORM: Omit<DebriefEntry, 'id' | 'userId' | 'createdAt'> = {
  companyName: '', jobTitle: '',
  interviewDate: new Date().toISOString().split('T')[0],
  stage: 'phone-screen', outcome: 'pending',
  emotionalStateBefore: 'neutral', emotionalStateAfter: 'neutral',
  difficultyRating: 3, durationMinutes: 45, interviewerCount: 1,
  questionsAsked: [''], whatWentWell: '', whatWentPoorly: '',
  surprises: '', followUpActions: '', overallNotes: '', selfScore: 70,
};

// ─── Shared input styles ──────────────────────────────────────────────────────

const inp = [
  'w-full px-3 py-2.5 rounded-xl text-[13px] text-white',
  'bg-white/[0.04] border border-white/[0.08]',
  'placeholder-slate-600',
  'focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40',
  'transition-all duration-150',
].join(' ');

const ta = `${inp} resize-none`;

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accentClass }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; accentClass: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentClass.replace('text-', 'bg-').replace('-400', '-500/10')}`}>
          <Icon className={`w-4 h-4 ${accentClass}`} />
        </div>
        <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
      {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function ProgressBar({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-slate-400 truncate pr-2">{label}</span>
        <span className="text-[11px] text-slate-500 flex-shrink-0">{sub || `${value}%`}</span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-[width] duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ReadinessGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  const angle = (score / 100) * 180;
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <div className="relative w-28 h-14 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.3} 141.3`}
            style={{ transition: 'stroke-dasharray 1.2s ease' }} />
          <line x1="50" y1="50"
            x2={50 + 35 * Math.cos(Math.PI - angle * Math.PI / 180)}
            y2={50 - 35 * Math.sin(Math.PI - angle * Math.PI / 180)}
            stroke="white" strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3" fill="white" />
        </svg>
      </div>
      <p className="text-2xl font-bold -mt-1 tabular-nums" style={{ color }}>{score}</p>
      <p className="text-[11px] font-semibold mt-0.5" style={{ color }}>{label}</p>
    </div>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass-card p-5 ${className}`}>{children}</div>;
}

function SectionHeader({ icon: Icon, title, sub, accentClass }: {
  icon: React.ElementType; title: string; sub?: string; accentClass: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accentClass.replace('text-', 'bg-').replace('-400', '-500/15')}`}>
        <Icon className={`w-4 h-4 ${accentClass}`} />
      </div>
      <div>
        <h4 className="text-[13px] font-bold text-white">{title}</h4>
        {sub && <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function TabBar<T extends string>({ tabs, active, onChange }: {
  tabs: { id: T; label: string; icon: React.ElementType }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit overflow-x-auto scrollbar-hide">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all duration-150
                      ${active === t.id
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)]'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'}`}
        >
          <t.icon className="w-3.5 h-3.5" />{t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ used, limit }: { used: number; limit: number }) {
  const [activeStat, setActiveStat] = useState(0);

  const STATS = [
    { num: '47%',  line: 'of interview failures come from not knowing enough about the company' },
    { num: '94%',  line: 'want feedback after interviews — but only 1% ever receive it' },
    { num: '51%',  line: 'chance of getting hired after 3+ interviews — if you learn from each one' },
    { num: '57%',  line: 'of candidates skip follow-ups — the ones who don\'t get 25% more offers' },
  ];

  useEffect(() => {
    const t = setInterval(() => setActiveStat(i => (i + 1) % STATS.length), 4000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 animate-fade-in-up">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]
                      bg-gradient-to-br from-[#0d1526] via-[#111c35] to-[#0d1526]">
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full
                        bg-violet-500/[0.06] blur-3xl pointer-events-none" />
        <div className="relative p-6">
          <div className="inline-flex items-center gap-1.5 bg-amber-500/[0.08] border border-amber-500/20
                          rounded-full px-3 py-1 mb-4">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">
              {used}/{limit} debriefs used
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white leading-snug mb-2">
            The interview isn&apos;t over when you walk out.
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            Every interview you don&apos;t debrief is a lesson wasted. The candidates who
            reflect, track patterns, and fix weaknesses are the ones who convert rejections into offers.
          </p>
          <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.06]
                          rounded-xl px-5 py-4 mb-6 min-h-[64px]">
            <span className="text-3xl font-black text-violet-400 flex-shrink-0 w-16 text-center">
              {STATS[activeStat].num}
            </span>
            <span className="text-sm text-slate-400 leading-snug">
              {STATS[activeStat].line}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         text-sm font-bold text-white
                         bg-gradient-to-r from-violet-600 to-indigo-600
                         hover:from-violet-500 hover:to-indigo-500
                         shadow-[0_4px_20px_rgba(124,58,237,0.3)]
                         hover:shadow-[0_6px_28px_rgba(124,58,237,0.4)]
                         transition-all group"
            >
              Go Unlimited
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <span className="text-[10px] text-slate-600">
              Cancel anytime · Instant access
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { num: '47%',  label: 'fail from poor prep'       },
          { num: '1%',   label: 'ever get real feedback'    },
          { num: '25%',  label: 'more offers with follow-up'},
        ].map(s => (
          <div key={s.num} className="glass-card py-4 text-center">
            <p className="text-xl font-black text-violet-400">{s.num}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Insights Panel ────────────────────────────────────────────────────────

function AIInsightsPanel({ entries }: { entries: DebriefEntry[] }) {
  const [analysis,      setAnalysis]      = useState<AIAnalysis | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'patterns' | 'plan' | 'questions'>('overview');

  const runAnalysis = useCallback(async () => {
    if (!entries.length) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/interview-debrief/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setAnalysis((await res.json()).data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [entries]);

  if (loading) {
    return (
      <SectionCard>
        <div className="flex flex-col items-center justify-center py-14 gap-4">
          <div className="relative">
            <Loader2 className="w-9 h-9 text-violet-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-violet-300" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-white mb-1">Analysing your interview history…</p>
            <p className="text-[12px] text-slate-500">Identifying patterns across {entries.length} entries</p>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard className="text-center">
        <XCircle className="w-9 h-9 text-red-400 mx-auto mb-4" />
        <p className="text-[14px] font-semibold text-white mb-1">Analysis failed</p>
        <p className="text-[12px] text-slate-500 mb-5">{error}</p>
        <button onClick={runAnalysis}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[13px] font-semibold transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </SectionCard>
    );
  }

  if (!analysis) {
    return (
      <SectionCard className="text-center">
        <div className="w-12 h-12 bg-violet-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Brain className="w-6 h-6 text-violet-400" />
        </div>
        <h3 className="text-[15px] font-bold text-white mb-2">AI Pattern Analysis</h3>
        <p className="text-[13px] text-slate-500 mb-1.5 max-w-sm mx-auto leading-relaxed">
          Analyse all {entries.length} debrief entries and identify what&apos;s actually holding you back.
        </p>
        <p className="text-[11px] text-amber-400 mb-6">Brutally honest. No sugarcoating.</p>
        <button onClick={runAnalysis}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold shadow-[0_4px_16px_rgba(124,58,237,0.3)] transition-all duration-200">
          <Zap className="w-4 h-4" /> Analyse My Interviews
        </button>
      </SectionCard>
    );
  }

  const sectionTabs = [
    { id: 'overview'  as const, label: 'Overview',    icon: BarChart3     },
    { id: 'patterns'  as const, label: 'Patterns',    icon: Brain         },
    { id: 'plan'      as const, label: '30-Day Plan', icon: Target        },
    { id: 'questions' as const, label: 'Questions',   icon: MessageSquare },
  ];

  return (
    <div className="space-y-3">
      <SectionCard>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-bold text-white">AI Career Coach Analysis</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">Based on {entries.length} entries</p>
          </div>
          <button onClick={runAnalysis} title="Re-run analysis"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-violet-400 hover:bg-white/[0.05] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <ReadinessGauge score={analysis.overallReadiness} label={analysis.readinessLabel} />
          <div className="flex-1 w-full">
            <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-1.5">Coach&apos;s Verdict</p>
              <p className="text-[13px] text-white leading-relaxed italic">&ldquo;{analysis.oneLinerVerdict}&rdquo;</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <TabBar tabs={sectionTabs} active={activeSection} onChange={setActiveSection} />

      {activeSection === 'overview' && (
        <div className="space-y-3">
          {analysis.strengthMap?.length > 0 && (
            <SectionCard>
              <SectionHeader icon={CheckCircle2} title="Your Strengths" accentClass="text-emerald-400" />
              <div className="space-y-2.5">
                {analysis.strengthMap.map((s, i) => (
                  <div key={i} className="p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl">
                    <p className="text-[13px] font-semibold text-emerald-300 mb-1">{s.area}</p>
                    <p className="text-[12px] text-slate-500 mb-2">{s.evidence}</p>
                    <div className="flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-emerald-400">{s.howToLeverage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {analysis.weaknessMap?.length > 0 && (
            <SectionCard>
              <SectionHeader icon={AlertTriangle} title="Weakness Map" accentClass="text-red-400" />
              <div className="space-y-2.5">
                {analysis.weaknessMap.map((w, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${SEVERITY_COLORS[w.severity]}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[13px] font-semibold">{w.area}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-60">{w.frequency}× seen</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] font-semibold capitalize">{w.severity}</span>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-500 mb-2 italic">&ldquo;{w.specificExample}&rdquo;</p>
                    <div className="flex items-start gap-1.5">
                      <Zap className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-70" />
                      <p className="text-[12px] opacity-90">{w.fix}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {analysis.emotionalProfile && (
            <SectionCard>
              <SectionHeader icon={Heart} title="Emotional Profile" accentClass="text-pink-400" />
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {[
                  { label: 'Usually before', val: analysis.emotionalProfile.dominantStateBefore },
                  { label: 'Usually after',  val: analysis.emotionalProfile.dominantStateAfter  },
                ].map((x, i) => (
                  <div key={i} className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl text-center">
                    <p className="text-[10px] text-slate-600 mb-1">{x.label}</p>
                    <p className="text-[13px] text-white font-semibold capitalize">{x.val}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="p-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold mb-1">Anxiety impact</p>
                  <p className="text-[12px] text-slate-300">{analysis.emotionalProfile.anxietyImpact}</p>
                </div>
                <div className="p-2.5 bg-violet-500/[0.06] border border-violet-500/15 rounded-xl">
                  <p className="text-[10px] text-violet-400 uppercase tracking-wide font-semibold mb-1">Recommendation</p>
                  <p className="text-[12px] text-slate-300">{analysis.emotionalProfile.recommendation}</p>
                </div>
              </div>
            </SectionCard>
          )}
          {analysis.stageAnalysis && (
            <SectionCard>
              <SectionHeader icon={MapPin} title="Stage Analysis" accentClass="text-blue-400" />
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="p-2.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wide font-semibold mb-1">Strongest</p>
                  <p className="text-[13px] text-white">{analysis.stageAnalysis.strongestStage}</p>
                </div>
                <div className="p-2.5 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                  <p className="text-[10px] text-red-400 uppercase tracking-wide font-semibold mb-1">Weakest</p>
                  <p className="text-[13px] text-white">{analysis.stageAnalysis.weakestStage}</p>
                </div>
              </div>
              <div className="p-2.5 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl">
                <p className="text-[10px] text-amber-400 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Bottleneck
                </p>
                <p className="text-[12px] text-slate-300">{analysis.stageAnalysis.bottleneck}</p>
              </div>
            </SectionCard>
          )}
          {analysis.blindSpots?.length > 0 && (
            <SectionCard>
              <SectionHeader icon={Eye} title="Blind Spots" sub="Things you're probably not seeing" accentClass="text-amber-400" />
              <div className="space-y-2">
                {analysis.blindSpots.map((bs, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2.5 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-slate-300 leading-relaxed">{bs}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {activeSection === 'patterns' && (
        <div className="space-y-3">
          {analysis.topPatterns?.length > 0 ? analysis.topPatterns.map((p, i) => (
            <SectionCard key={i}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.impact === 'positive' ? 'bg-emerald-400' : p.impact === 'negative' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <h4 className="text-[13px] font-bold text-white flex-1">{p.pattern}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${p.impact === 'positive' ? 'bg-emerald-500/15 text-emerald-400' : p.impact === 'negative' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {p.impact}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mb-2 italic">Evidence: {p.evidence}</p>
              <p className="text-[13px] text-slate-300 leading-relaxed">{p.explanation}</p>
            </SectionCard>
          )) : (
            <SectionCard className="text-center py-8">
              <p className="text-[13px] text-slate-500">No patterns detected yet.</p>
            </SectionCard>
          )}
        </div>
      )}

      {activeSection === 'plan' && (
        <div className="space-y-3">
          {analysis.next30DayPlan?.length > 0 ? analysis.next30DayPlan.map((week, i) => (
            <SectionCard key={i}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  W{week.week}
                </div>
                <div>
                  <p className="text-[10px] text-slate-600">Week {week.week}</p>
                  <p className="text-[13px] font-bold text-white">{week.focus}</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                {week.actions.map((action, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <div className="w-4 h-4 border border-white/[0.12] rounded flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-slate-300 leading-relaxed">{action}</p>
                  </div>
                ))}
              </div>
              <div className="p-2.5 bg-violet-500/[0.06] border border-violet-500/15 rounded-lg">
                <p className="text-[11px] text-violet-400 font-semibold flex items-center gap-1">
                  <Target className="w-3 h-3" /> {week.successMetric}
                </p>
              </div>
            </SectionCard>
          )) : (
            <SectionCard className="text-center py-8">
              <p className="text-[13px] text-slate-500">No plan generated. Re-run the analysis.</p>
            </SectionCard>
          )}
        </div>
      )}

      {activeSection === 'questions' && (
        <div className="space-y-3">
          {analysis.questionsToMaster?.length > 0 ? analysis.questionsToMaster.map((q, i) => (
            <SectionCard key={i}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-[13px] font-semibold text-white leading-relaxed">&ldquo;{q.question}&rdquo;</p>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wide font-semibold mb-1">Why it matters</p>
                  <p className="text-[12px] text-slate-300">{q.whyItMatters}</p>
                </div>
                <div className="p-2.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wide font-semibold mb-1">How to answer</p>
                  <p className="text-[12px] text-slate-300">{q.howToAnswer}</p>
                </div>
              </div>
            </SectionCard>
          )) : (
            <SectionCard className="text-center py-8">
              <p className="text-[13px] text-slate-500">No questions identified. Run the analysis to get personalised questions.</p>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewDebriefPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  // ── Subscription / usage ──────────────────────────────────────────────────
  const {
    canUseFeature, getRemainingCount, getUsedCount,
    getLimit, incrementUsage, usageData,
  } = useUsageTracking();
  const isUnlimitedPlan = usageData?.plan === 'pro' || usageData?.plan === 'premium';
  const debriefUsed  = getUsedCount('interviewDebriefs');
  const debriefLimit = getLimit('interviewDebriefs');
  const debriefLeft  = getRemainingCount('interviewDebriefs');

  const [entries,        setEntries]        = useState<DebriefEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingStep,    setLoadingStep]    = useState(0);
  const [showForm,       setShowForm]       = useState(false);
  const [formData,       setFormData]       = useState({ ...EMPTY_FORM });
  const [isSaving,       setIsSaving]       = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterOutcome,  setFilterOutcome]  = useState<InterviewOutcome | 'all'>('all');
  const [activeView,     setActiveView]     = useState<'log' | 'insights' | 'ai'>('log');
  const [showFeedback,   setShowFeedback]   = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true); setLoadingStep(0);
    try {
      setLoadingStep(1);
      const q = query(collection(db, 'interviewDebrief'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      setLoadingStep(2);
      const snap = await getDocs(q);
      setLoadingStep(3);
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as DebriefEntry)));
      setLoadingStep(4);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      toast.error('Failed to load journal entries');
    } finally {
      setLoadingEntries(false);
    }
  }, [user]);

  useEffect(() => { if (user) fetchEntries(); }, [user, fetchEntries]);

  const handleSave = async () => {
    if (!user) return;
    if (!formData.companyName.trim() || !formData.jobTitle.trim()) {
      toast.error('Company name and job title are required');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        questionsAsked: formData.questionsAsked.filter(q => q.trim()),
        userId: user.uid,
        createdAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, 'interviewDebrief', editingId), { ...payload, updatedAt: serverTimestamp() });
        toast.success('Entry updated');
        await NotificationService.createNotification(
          user.uid, 'planner', 'Debrief Entry Updated 📝',
          `Your debrief for ${formData.jobTitle} at ${formData.companyName} has been updated.`,
          { actionUrl: '/debrief', actionLabel: 'View Journal' }
        );
      } else {
        await addDoc(collection(db, 'interviewDebrief'), payload);
        toast.success('Debrief saved to your journal');

        await incrementUsage('interviewDebriefs');

        const msgs: Record<InterviewOutcome, string> = {
          offer:           `🎉 You got an offer for ${formData.jobTitle} at ${formData.companyName}!`,
          'moved-forward': `You moved forward for ${formData.jobTitle} at ${formData.companyName}. Keep going!`,
          rejected:        `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Learn and keep pushing.`,
          ghosted:         `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Ghosted — their loss.`,
          withdrew:        `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. You withdrew — good self-awareness.`,
          pending:         `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Awaiting outcome.`,
        };
        await NotificationService.createNotification(
          user.uid,
          formData.outcome === 'offer' ? 'achievement' : 'planner',
          formData.outcome === 'offer' ? 'Offer Received! 🏆' : 'Interview Debrief Logged 📓',
          msgs[formData.outcome],
          { actionUrl: '/debrief', actionLabel: 'View Journal' }
        );
      }
      setShowFeedback(true);
      setFormData({ ...EMPTY_FORM }); setShowForm(false); setEditingId(null);
      await fetchEntries();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Failed to save entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteDoc(doc(db, 'interviewDebrief', id));
      toast.success('Entry deleted');
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch { toast.error('Failed to delete entry'); }
  };

  const handleEdit = (entry: DebriefEntry) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, userId, createdAt, ...rest } = entry;
    setFormData({ ...rest });
    setEditingId(id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogInterview = () => {
    if (!canUseFeature('interviewDebriefs')) {
      toast.error(`You've used all ${debriefLimit} free debriefs this month. Upgrade to Pro for more.`);
      return;
    }
    setShowForm(!showForm);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  };

  const totalEntries  = entries.length;
  const avgSelfScore  = totalEntries > 0 ? Math.round(entries.reduce((s, e) => s + e.selfScore, 0) / totalEntries) : 0;
  const advancedCount = entries.filter(e => e.outcome === 'moved-forward' || e.outcome === 'offer').length;
  const advanceRate   = totalEntries > 0 ? Math.round((advancedCount / totalEntries) * 100) : 0;
  const offerCount    = entries.filter(e => e.outcome === 'offer').length;

  const filtered = entries.filter(e => {
    const matchSearch  = !searchTerm || e.companyName.toLowerCase().includes(searchTerm.toLowerCase()) || e.jobTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchOutcome = filterOutcome === 'all' || e.outcome === filterOutcome;
    return matchSearch && matchOutcome;
  });

  const loadingSteps = [
    { name: 'Authenticating…',          weight: 1 },
    { name: 'Connecting…',              weight: 1 },
    { name: 'Loading journal entries…', weight: 3 },
    { name: 'Calculating insights…',    weight: 2 },
    { name: 'Ready!',                   weight: 1 },
  ];

  if (loading || loadingEntries) {
    return (
      <AnimatedLoader isVisible={true} mode="steps" steps={loadingSteps} currentStep={loadingStep}
        loadingText="Loading your Interview Journal…" showNavigation={true} />
    );
  }
  if (!user) { router.push('/auth'); return null; }

  const sel = `${inp} appearance-none cursor-pointer`;

  const mainTabs = [
    { id: 'log'      as const, label: 'Journal Log', icon: BookOpen  },
    { id: 'insights' as const, label: 'Stats',       icon: BarChart3 },
    { id: 'ai'       as const, label: 'AI Analysis', icon: Brain     },
  ];

  return (
    <div className="space-y-4 pt-4">

      {/* Page header */}
      <div className="glass-card p-5 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard"
              className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 transition-colors mb-3">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_4px_14px_rgba(124,58,237,0.35)]">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-[18px] font-bold text-white">Interview Debrief Journal</h1>
            </div>
            <p className="text-[12px] text-slate-500 ml-12">Log real interviews, let AI find your patterns, turn losses into learning.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* See Example */}
            <SeeExampleButton serviceId="debrief" />
            {/* Usage badge */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/[0.07] border border-violet-500/20">
              <Shield className="w-4 h-4 text-violet-400" />
              <span className="text-[13px] font-semibold text-violet-400">
                {isUnlimitedPlan ? 'Unlimited' : `${debriefLeft} left`}
              </span>
            </div>
            {/* Log Interview button */}
            <button
              onClick={handleLogInterview}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold shadow-[0_4px_14px_rgba(124,58,237,0.3)] transition-all duration-200"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancel' : 'Log Interview'}
            </button>
          </div>
        </div>
      </div>

      {/* Show upgrade gate when limit reached and no entries to view */}
      {!canUseFeature('interviewDebriefs') && entries.length === 0 ? (
        <UpgradeGate used={debriefUsed} limit={debriefLimit} />
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <StatCard icon={BookOpen}   label="Total Logged"   value={totalEntries}        accentClass="text-violet-400" />
            <StatCard icon={Star}       label="Avg Self-Score" value={`${avgSelfScore}%`}  accentClass="text-amber-400" />
            <StatCard icon={TrendingUp} label="Advance Rate"   value={`${advanceRate}%`}   sub={`${advancedCount} of ${totalEntries}`} accentClass="text-emerald-400" />
            <StatCard icon={Award}      label="Offers"         value={offerCount}           accentClass="text-blue-400" />
          </div>

          {/* Log form */}
          {showForm && (
            <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <div className="px-5 py-4 border-b border-white/[0.06] bg-gradient-to-r from-violet-600/[0.10] to-indigo-600/[0.10]">
                <h2 className="text-[14px] font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-violet-400" />
                  {editingId ? 'Edit Entry' : 'New Debrief Entry'}
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5">The more detail you log, the better the AI insights.</p>
              </div>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { key: 'companyName', label: 'Company *',   placeholder: 'e.g. Google'      },
                    { key: 'jobTitle',    label: 'Job Title *', placeholder: 'e.g. Senior SWE'  },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[12px] font-medium text-slate-400 mb-1.5">{f.label}</label>
                      <input type="text" value={(formData as Record<string, unknown>)[f.key] as string}
                        onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} className={inp} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Interview Date</label>
                    <input type="date" value={formData.interviewDate}
                      onChange={e => setFormData(p => ({ ...p, interviewDate: e.target.value }))}
                      className={inp} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Stage</label>
                    <select value={formData.stage} onChange={e => setFormData(p => ({ ...p, stage: e.target.value as InterviewStage }))} className={sel}>
                      {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Outcome</label>
                    <select value={formData.outcome} onChange={e => setFormData(p => ({ ...p, outcome: e.target.value as InterviewOutcome }))} className={sel}>
                      {Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Duration (min)</label>
                    <input type="number" min={10} max={300} value={formData.durationMinutes}
                      onChange={e => setFormData(p => ({ ...p, durationMinutes: Number(e.target.value) }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Interviewers</label>
                    <input type="number" min={1} max={10} value={formData.interviewerCount}
                      onChange={e => setFormData(p => ({ ...p, interviewerCount: Number(e.target.value) }))} className={inp} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {(['emotionalStateBefore', 'emotionalStateAfter'] as const).map((field, fi) => (
                    <div key={field}>
                      <label className="block text-[12px] font-medium text-slate-400 mb-2">
                        {fi === 0 ? 'Feeling Before' : 'Feeling After'}
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(Object.keys(EMOTIONAL_EMOJIS) as EmotionalState[]).map(e => (
                          <button key={e} type="button" onClick={() => setFormData(p => ({ ...p, [field]: e }))}
                            className={`p-2 rounded-xl text-center text-[10px] transition-all duration-150
                                        ${formData[field] === e
                                          ? 'bg-violet-500/20 border border-violet-500/40 text-white'
                                          : 'bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:border-white/[0.12]'}`}>
                            <span className="block text-lg leading-none mb-1">{EMOTIONAL_EMOJIS[e]}</span>
                            <span className="block leading-none">{e}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="space-y-5">
                    <div>
                      <label className="block text-[12px] font-medium text-slate-400 mb-2">
                        Self Score: <span className="text-white font-bold">{formData.selfScore}%</span>
                      </label>
                      <input type="range" min={0} max={100} value={formData.selfScore}
                        onChange={e => setFormData(p => ({ ...p, selfScore: Number(e.target.value) }))}
                        className="w-full accent-violet-500" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-slate-400 mb-2">
                        Difficulty: <span className="text-white font-bold">{'★'.repeat(formData.difficultyRating)}</span>
                      </label>
                      <div className="flex gap-1">
                        {([1, 2, 3, 4, 5] as DifficultyRating[]).map(n => (
                          <button key={n} type="button"
                            onClick={() => setFormData(p => ({ ...p, difficultyRating: n }))}
                            className={`text-xl transition-colors ${n <= formData.difficultyRating ? 'text-amber-400' : 'text-slate-700'}`}>
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-2">Questions They Asked</label>
                  <div className="space-y-2">
                    {formData.questionsAsked.map((q, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" value={q}
                          onChange={e => {
                            const arr = [...formData.questionsAsked];
                            arr[idx] = e.target.value;
                            setFormData(p => ({ ...p, questionsAsked: arr }));
                          }}
                          placeholder={`Question ${idx + 1}`} className={inp} />
                        <button type="button"
                          onClick={() => {
                            const arr = formData.questionsAsked.filter((_, i) => i !== idx);
                            setFormData(p => ({ ...p, questionsAsked: arr.length ? arr : [''] }));
                          }}
                          className="w-9 h-10 flex items-center justify-center rounded-xl text-slate-600 hover:text-red-400 hover:bg-red-500/[0.08] border border-white/[0.07] transition-all flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => setFormData(p => ({ ...p, questionsAsked: [...p.questionsAsked, ''] }))}
                      className="inline-flex items-center gap-1.5 text-[12px] text-violet-400 hover:text-violet-300 transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add question
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'whatWentWell',    label: 'What went well?',        accentClass: 'text-emerald-400', placeholder: 'Strong answers, good rapport…'                   },
                    { key: 'whatWentPoorly',  label: 'What went poorly?',      accentClass: 'text-red-400',     placeholder: 'Got stuck on system design…'                     },
                    { key: 'surprises',       label: 'Surprises / Unexpected',  accentClass: 'text-amber-400',   placeholder: "They asked about X which I didn't prepare for…"  },
                    { key: 'followUpActions', label: 'Follow-up Actions',       accentClass: 'text-blue-400',    placeholder: 'Study X, practice Y…'                            },
                  ].map(f => (
                    <div key={f.key}>
                      <label className={`block text-[12px] font-medium mb-1.5 ${f.accentClass}`}>{f.label}</label>
                      <textarea rows={3} value={(formData as Record<string, unknown>)[f.key] as string}
                        onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} className={ta} />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-slate-400 mb-1.5">Overall Notes</label>
                  <textarea rows={2} value={formData.overallNotes}
                    onChange={e => setFormData(p => ({ ...p, overallNotes: e.target.value }))}
                    placeholder="General impressions, company culture vibe, interviewer style…"
                    className={ta} />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={handleSave} disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-[13px] font-semibold transition-all duration-150 disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving…' : editingId ? 'Update Entry' : 'Save to Journal'}
                  </button>
                  <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
                    className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-slate-300 rounded-xl text-[13px] font-semibold transition-all">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* View tabs */}
          {entries.length > 0 && (
            <TabBar tabs={mainTabs} active={activeView} onChange={setActiveView} />
          )}

          {/* AI view */}
          {activeView === 'ai' && entries.length > 0 && <AIInsightsPanel entries={entries} />}

          {/* Stats view */}
          {activeView === 'insights' && entries.length > 0 && (
            <div className="space-y-4">
              <SectionCard>
                <SectionHeader icon={Activity} title="Self-Score Trend" sub="How you feel about your performance over time" accentClass="text-amber-400" />
                <div className="space-y-2.5">
                  {[...entries].slice(0, 10).reverse().map(e => (
                    <ProgressBar key={e.id} label={`${e.companyName} — ${STAGE_LABELS[e.stage]}`} value={e.selfScore} />
                  ))}
                </div>
              </SectionCard>
              <SectionCard>
                <SectionHeader icon={BarChart3} title="Outcome Breakdown" accentClass="text-blue-400" />
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(Object.keys(OUTCOME_LABELS) as InterviewOutcome[]).map(o => {
                    const count = entries.filter(e => e.outcome === o).length;
                    return (
                      <div key={o} className={`p-3 rounded-xl border text-center ${OUTCOME_COLORS[o]}`}>
                        <p className="text-lg font-bold tabular-nums">{count}</p>
                        <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{OUTCOME_LABELS[o]}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard>
                <SectionHeader icon={Heart} title="Emotional State vs Performance" sub="Average self-score when you felt each way before" accentClass="text-pink-400" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(Object.keys(EMOTIONAL_EMOJIS) as EmotionalState[]).map(emotion => {
                    const relevant = entries.filter(e => e.emotionalStateBefore === emotion);
                    if (!relevant.length) return null;
                    const avg      = Math.round(relevant.reduce((s, e) => s + e.selfScore, 0) / relevant.length);
                    const clr      = avg >= 75 ? 'text-emerald-400' : avg >= 50 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <div key={emotion} className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                        <div className="text-2xl mb-1">{EMOTIONAL_EMOJIS[emotion]}</div>
                        <p className={`text-[14px] font-bold ${clr}`}>{avg}%</p>
                        <p className="text-[11px] text-slate-600 capitalize">{emotion} ({relevant.length}×)</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard>
                <SectionHeader icon={Users} title="Performance by Stage" accentClass="text-violet-400" />
                <div className="space-y-3">
                  {(Object.keys(STAGE_LABELS) as InterviewStage[]).map(stage => {
                    const se = entries.filter(e => e.stage === stage);
                    if (!se.length) return null;
                    const avg = Math.round(se.reduce((s, e) => s + e.selfScore, 0) / se.length);
                    return (
                      <ProgressBar key={stage} label={STAGE_LABELS[stage]} value={avg}
                        sub={`${se.length} interview${se.length > 1 ? 's' : ''} · ${avg}% avg`} />
                    );
                  })}
                </div>
              </SectionCard>
            </div>
          )}

          {/* Log view */}
          {activeView === 'log' && (
            <>
              {entries.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                    <input type="text" placeholder="Search by company or role…" value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} className={`${inp} pl-9`} />
                  </div>
                  <div className="relative sm:w-48">
                    <Filter className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                    <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value as InterviewOutcome | 'all')}
                      className={`${sel} pl-9`}>
                      <option value="all">All Outcomes</option>
                      {(Object.entries(OUTCOME_LABELS) as [InterviewOutcome, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="text-[14px] font-bold text-slate-400 mb-2">
                    {entries.length === 0 ? 'Your journal is empty' : 'No results found'}
                  </h3>
                  <p className="text-[12px] text-slate-600 mb-6 max-w-xs mx-auto leading-relaxed">
                    {entries.length === 0
                      ? 'Log your first real interview to start tracking patterns and getting AI insights.'
                      : 'Try adjusting your search or filter.'}
                  </p>
                  {entries.length === 0 && canUseFeature('interviewDebriefs') && (
                    <button onClick={() => setShowForm(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[13px] font-semibold transition-all duration-150">
                      <Plus className="w-4 h-4" /> Log Your First Interview
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(entry => {
                    const isExpanded = expandedId === entry.id;
                    const dateStr    = entry.interviewDate
                      ? new Date(entry.interviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '';
                    return (
                      <div key={entry.id} className="glass-card overflow-hidden">
                        <div className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 bg-violet-500/[0.12] border border-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-violet-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h3 className="text-[14px] font-bold text-white">{entry.companyName}</h3>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${OUTCOME_COLORS[entry.outcome]}`}>
                                    {OUTCOME_LABELS[entry.outcome]}
                                  </span>
                                </div>
                                <p className="text-[12px] text-slate-500">{entry.jobTitle} · {STAGE_LABELS[entry.stage]}</p>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                    <Calendar className="w-3 h-3" />{dateStr}
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                    <Clock className="w-3 h-3" />{entry.durationMinutes}m
                                  </span>
                                  <span className="flex items-center gap-1 text-[11px] text-slate-600">
                                    <Star className="w-3 h-3" />{entry.selfScore}%
                                  </span>
                                  <span className="text-[13px]">
                                    {EMOTIONAL_EMOJIS[entry.emotionalStateBefore]} → {EMOTIONAL_EMOJIS[entry.emotionalStateAfter]}
                                  </span>
                                  <span className="text-amber-400 text-[11px]">{'★'.repeat(entry.difficultyRating)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button onClick={ev => { ev.stopPropagation(); handleEdit(entry); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-violet-400 hover:bg-violet-500/[0.08] transition-all">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={ev => { ev.stopPropagation(); handleDelete(entry.id); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-slate-600 ml-1" />
                                : <ChevronDown className="w-4 h-4 text-slate-600 ml-1" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-white/[0.05] px-4 pb-4 pt-4 space-y-4">
                            {entry.questionsAsked.filter(Boolean).length > 0 && (
                              <div>
                                <p className="text-[11px] text-slate-600 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                                  <MessageSquare className="w-3.5 h-3.5" /> Questions Asked
                                </p>
                                <ul className="space-y-1">
                                  {entry.questionsAsked.filter(Boolean).map((q, i) => (
                                    <li key={i} className="text-[13px] text-slate-300 flex items-start gap-2">
                                      <span className="text-violet-400 flex-shrink-0 mt-0.5">›</span> {q}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {entry.whatWentWell && (
                                <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl">
                                  <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> What Went Well
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed">{entry.whatWentWell}</p>
                                </div>
                              )}
                              {entry.whatWentPoorly && (
                                <div className="p-3 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                                  <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> What Went Poorly
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed">{entry.whatWentPoorly}</p>
                                </div>
                              )}
                              {entry.surprises && (
                                <div className="p-3 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl">
                                  <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Lightbulb className="w-3.5 h-3.5" /> Surprises
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed">{entry.surprises}</p>
                                </div>
                              )}
                              {entry.followUpActions && (
                                <div className="p-3 bg-blue-500/[0.06] border border-blue-500/15 rounded-xl">
                                  <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Target className="w-3.5 h-3.5" /> Follow-up Actions
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed">{entry.followUpActions}</p>
                                </div>
                              )}
                            </div>
                            {entry.overallNotes && (
                              <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                                <p className="text-[10px] text-slate-600 uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> Overall Notes
                                </p>
                                <p className="text-[13px] text-slate-300 leading-relaxed">{entry.overallNotes}</p>
                              </div>
                            )}
                            <p className="text-[11px] text-slate-600">
                              Difficulty: <span className="text-amber-400">{'★'.repeat(entry.difficultyRating)}{'☆'.repeat(5 - entry.difficultyRating)}</span>
                              <span className="mx-2">·</span>
                              {entry.interviewerCount} interviewer{entry.interviewerCount > 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      <UsersFeedback
        page="interviews"
        forceOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
    </div>
  );
}