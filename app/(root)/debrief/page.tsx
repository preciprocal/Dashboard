'use client';
import { AppSelect } from '@/components/ui/select';
import PageHeader from '@/components/PageHeader';
import { NotebookPen as HeaderIcon } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import {
  BookOpen, Plus, Loader2, Trash2, ChevronDown, ChevronUp,
  Calendar, Building2, AlertTriangle, CheckCircle2,
  Brain, MessageSquare, Target, BarChart3, Lightbulb, Clock,
  Star, Edit3, X, Save, Activity, Zap, Eye,
  Heart, Filter, Search, RefreshCw, XCircle, ArrowRight, Flame,
  Users, MapPin, Shield,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { isUnlimited } from '@/lib/config/usage-limits';
import { SeeExampleButton } from '@/components/ServiceModal';
import DateInput from '@/components/ui/date-input';
import { FormSection } from '@/components/profile/FormKit';
import FeatureEmpty from '@/components/ui/feature-empty';
import AutoTextarea from '@/components/ui/auto-textarea';
import NextStepPrompt from '@/components/NextStepPrompt'; // ← NEW

// ─── Types ────────────────────────────────────────────────────────────────────

type InterviewStage   = 'phone-screen' | 'technical' | 'behavioral' | 'system-design' | 'final' | 'onsite';
// 'practice' marks an entry copied from a Preciprocal mock interview ("Save to
// Interview Journal" on the results page, lib/interview/journal-sync.ts). It is
// not a real-interview outcome, so it stays out of the advance rate.
type InterviewOutcome = 'pending' | 'moved-forward' | 'rejected' | 'ghosted' | 'withdrew' | 'offer' | 'practice';
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
  withdrew:        'text-slate-300  bg-white/[0.05]  border-white/[0.1]',
  offer:           'text-blue-400   bg-blue-400/10   border-blue-400/20',
  practice:        'text-sky-300    bg-sky-400/10    border-sky-400/20',
};

const OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  pending:         'Pending',
  'moved-forward': 'Moved Forward',
  rejected:        'Rejected',
  ghosted:         'Ghosted',
  withdrew:        'Withdrew',
  offer:           'Offer',
  practice:        'Practice',
};

const EMOTIONAL_EMOJIS: Record<EmotionalState, string> = {
  confident: 'Confident', nervous: 'Nervous', neutral: 'Neutral',
  excited: 'Excited', anxious: 'Anxious', exhausted: 'Exhausted',
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

// Shared form-control size and style (globals.css .field), so every input,
// select and textarea on this page matches the rest of the app.
const inp = 'field';

const ta = `${inp} resize-none`;

// ─── Small helpers ────────────────────────────────────────────────────────────

// One cell of the KPI strip: label with how it is counted, value, a line under it.
function Kpi({ label, tip, value, sub, tone, className = '' }: { label: string; tip: string; value: React.ReactNode; sub?: string; tone?: string; className?: string }) {
  return (
    <div className={`px-5 py-4 border-[var(--border)] ${className}`}>
      <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">{label}<InfoTip title={label} body={tip} /></p>
      <p className={`font-display text-[26px] font-semibold tracking-[-0.02em] tabular-nums mt-1.5 ${tone ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-[12px] text-[var(--text-4)] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function ProgressBar({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const color = value >= 75 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-slate-400 truncate pr-2">{label}</span>
        <span className="text-xs text-slate-400 flex-shrink-0">{sub || `${value}%`}</span>
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
      <p className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</p>
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
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
        <Icon className={`w-4 h-4 ${accentClass}`} />
      </div>
      <div>
        <h4 className="text-[13px] font-bold text-white">{title}</h4>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
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
                        ? 'bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                        : 'text-slate-400 hover:text-slate-300 hover:bg-white/[0.04]'}`}
        >
          <t.icon className="w-3.5 h-3.5" />{t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ used, limit }: { used: number; limit: number }) {
  return (
    <section className="glass-card p-6 sm:p-8 animate-fade-in-up">
      <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />{used} of {limit} debriefs used this month
      </span>
      <h2 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-white mt-4">You have used this month&apos;s journal entries</h2>
      <p className="text-[13.5px] text-[var(--text-3)] mt-2 max-w-lg">Your limit resets on your billing date. Upgrade to keep logging rounds, the questions you were asked and what to work on next.</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <Link href="/pricing" className="btn-primary">See plans <ArrowRight className="w-4 h-4" /></Link>
      </div>
    </section>
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
      const res = await fetch('/api/debrief/analyze', {
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
            <Loader2 className="w-9 h-9 text-[#a9b0f7] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-[#a9b0f7]" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-white mb-1">Analysing your interview history…</p>
            <p className="text-[12px] text-slate-400">Identifying patterns across {entries.length} entries</p>
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
        <p className="text-[12px] text-slate-400 mb-5">{error}</p>
        <button onClick={runAnalysis} className="btn-primary">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </SectionCard>
    );
  }

  if (!analysis) {
    return (
      <SectionCard className="text-center">
        <div className="w-12 h-12 bg-[var(--accent-subtle)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Brain className="w-6 h-6 text-[#a9b0f7]" />
        </div>
        <h3 className="text-[15px] font-bold text-white mb-2">AI Pattern Analysis</h3>
        <p className="text-[13px] text-slate-400 mb-1.5 max-w-sm mx-auto leading-relaxed">
          Analyse all {entries.length} debrief entries and identify what&apos;s actually holding you back.
        </p>
        <p className="text-xs text-amber-400 mb-6">Brutally honest. No sugarcoating.</p>
        <button onClick={runAnalysis} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] text-[13px] font-semibold  transition-all duration-200">
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
            <p className="text-xs text-slate-500 mt-0.5">Based on {entries.length} entries</p>
          </div>
          <button onClick={runAnalysis} title="Re-run analysis" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#a9b0f7] hover:bg-white/[0.05] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <ReadinessGauge score={analysis.overallReadiness} label={analysis.readinessLabel} />
          <div className="flex-1 w-full">
            <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
              <p className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold mb-1.5">Coach&apos;s Verdict</p>
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
                    <p className="text-[12px] text-slate-400 mb-2">{s.evidence}</p>
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
                        <span className="text-[11px] opacity-60">{w.frequency}× seen</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.08] font-semibold capitalize">{w.severity}</span>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-400 mb-2 italic">&ldquo;{w.specificExample}&rdquo;</p>
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
              <SectionHeader icon={Heart} title="Emotional Profile" accentClass="text-[var(--text-2)]" />
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                {[
                  { label: 'Usually before', val: analysis.emotionalProfile.dominantStateBefore },
                  { label: 'Usually after',  val: analysis.emotionalProfile.dominantStateAfter  },
                ].map((x, i) => (
                  <div key={i} className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl text-center">
                    <p className="text-[11px] text-slate-500 mb-1">{x.label}</p>
                    <p className="text-[13px] text-white font-semibold capitalize">{x.val}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="p-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Anxiety impact</p>
                  <p className="text-[12px] text-slate-300">{analysis.emotionalProfile.anxietyImpact}</p>
                </div>
                <div className="p-2.5 bg-[var(--accent-subtle)] border border-[var(--accent-border)] rounded-xl">
                  <p className="text-[11px] text-[#a9b0f7] uppercase tracking-wide font-semibold mb-1">Recommendation</p>
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
                  <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-semibold mb-1">Strongest</p>
                  <p className="text-[13px] text-white">{analysis.stageAnalysis.strongestStage}</p>
                </div>
                <div className="p-2.5 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                  <p className="text-[11px] text-red-400 uppercase tracking-wide font-semibold mb-1">Weakest</p>
                  <p className="text-[13px] text-white">{analysis.stageAnalysis.weakestStage}</p>
                </div>
              </div>
              <div className="p-2.5 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl">
                <p className="text-[11px] text-amber-400 uppercase tracking-wide font-semibold mb-1 flex items-center gap-1">
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
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${p.impact === 'positive' ? 'bg-emerald-500/15 text-emerald-400' : p.impact === 'negative' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {p.impact}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2 italic">Evidence: {p.evidence}</p>
              <p className="text-[13px] text-slate-300 leading-relaxed">{p.explanation}</p>
            </SectionCard>
          )) : (
            <SectionCard className="text-center py-8">
              <p className="text-[13px] text-slate-400">No patterns detected yet.</p>
            </SectionCard>
          )}
        </div>
      )}

      {activeSection === 'plan' && (
        <div className="space-y-3">
          {analysis.next30DayPlan?.length > 0 ? analysis.next30DayPlan.map((week, i) => (
            <SectionCard key={i}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-white/[0.06] ring-1 ring-inset ring-white/[0.08] rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  W{week.week}
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Week {week.week}</p>
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
              <div className="p-2.5 bg-[var(--accent-subtle)] border border-[var(--accent-border)] rounded-lg">
                <p className="text-xs text-[#a9b0f7] font-semibold flex items-center gap-1">
                  <Target className="w-3 h-3" /> {week.successMetric}
                </p>
              </div>
            </SectionCard>
          )) : (
            <SectionCard className="text-center py-8">
              <p className="text-[13px] text-slate-400">No plan generated. Re-run the analysis.</p>
            </SectionCard>
          )}
        </div>
      )}

      {activeSection === 'questions' && (
        <div className="space-y-3">
          {analysis.questionsToMaster?.length > 0 ? analysis.questionsToMaster.map((q, i) => (
            <SectionCard key={i}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-7 h-7 bg-white/[0.06] ring-1 ring-inset ring-white/[0.08] rounded-lg flex items-center justify-center text-[var(--text-1)] text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-[13px] font-semibold text-white leading-relaxed">&ldquo;{q.question}&rdquo;</p>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-500/[0.06] border border-amber-500/15 rounded-lg">
                  <p className="text-[11px] text-amber-400 uppercase tracking-wide font-semibold mb-1">Why it matters</p>
                  <p className="text-[12px] text-slate-300">{q.whyItMatters}</p>
                </div>
                <div className="p-2.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                  <p className="text-[11px] text-emerald-400 uppercase tracking-wide font-semibold mb-1">How to answer</p>
                  <p className="text-[12px] text-slate-300">{q.howToAnswer}</p>
                </div>
              </div>
            </SectionCard>
          )) : (
            <SectionCard className="text-center py-8">
              <p className="text-[13px] text-slate-400">No questions identified. Run the analysis to get personalised questions.</p>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewDebriefPage() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    canUseFeature, getRemainingCount, getUsedCount,
    getLimit, refetch: refetchUsage, loading: usageLoading,
  } = useUsageTracking();
  const debriefUsed  = getUsedCount('interviewDebriefs');
  const debriefLimit = getLimit('interviewDebriefs');
  const debriefLeft  = getRemainingCount('interviewDebriefs');
  // Read "unlimited" off the quota table rather than off the plan name: only
  // some features are uncapped on paid plans, and admin is uncapped on all of
  // them without being called 'pro' or 'premium'.
  const debriefUnlimited = isUnlimited(debriefLimit);

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

  // ← NEW: next step state
  const [debriefNextStep, setDebriefNextStep] = useState<{
    company: string; outcome: string; stage: string;
  } | null>(null);

  // The AI/Insights tabs (and the tab bar itself) only render when there are
  // entries - if the last entry is deleted while on one of those tabs, fall
  // back to Log so the page doesn't go blank with no way to navigate back.
  useEffect(() => {
    if (entries.length === 0 && activeView !== 'log') setActiveView('log');
  }, [entries.length, activeView]);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true); setLoadingStep(0);
    try {
      setLoadingStep(1);
      setLoadingStep(2);
      const res = await fetch('/api/debrief');
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
      const { entries: fetched } = await res.json();
      setLoadingStep(3);
      setEntries(fetched as DebriefEntry[]);
      setLoadingStep(4);
    } catch (err) {
      console.error('Failed to fetch entries:', err);
      toast.error('Failed to load journal entries');
    } finally {
      setLoadingEntries(false);
    }
  }, [user]);

  useEffect(() => { if (user) fetchEntries(); }, [user, fetchEntries]);

  // /debrief?entry=<id> opens that entry: "Save to Interview Journal" on a
  // mock interview's results page lands here. Read once from the URL rather
  // than through useSearchParams, which would need a Suspense boundary
  // around the whole page.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [deepLinkDone, setDeepLinkDone] = useState(false);
  useEffect(() => {
    if (deepLinkDone || loadingEntries || entries.length === 0) return;
    setDeepLinkDone(true);
    const target = new URLSearchParams(window.location.search).get('entry');
    if (!target || !entries.some(e => e.id === target)) return;
    setActiveView('log');
    setSearchTerm('');
    setFilterOutcome('all');
    setExpandedId(target);
    setHighlightId(target);
    requestAnimationFrame(() => {
      document.getElementById(`entry-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [deepLinkDone, loadingEntries, entries]);

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
      };
      if (editingId) {
        const res = await fetch('/api/debrief', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (!res.ok) throw new Error('Update failed');
        toast.success('Entry updated');
        await NotificationService.createNotification(
          user.id, 'planner', 'Debrief Entry Updated',
          `Your debrief for ${formData.jobTitle} at ${formData.companyName} has been updated.`,
          { actionUrl: '/debrief', actionLabel: 'View Journal' }
        );
      } else {
        const res = await fetch('/api/debrief', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Save failed');
        toast.success('Debrief saved to your journal');
        await refetchUsage();

        const msgs: Record<InterviewOutcome, string> = {
          offer:           `🎉 You got an offer for ${formData.jobTitle} at ${formData.companyName}!`,
          'moved-forward': `You moved forward for ${formData.jobTitle} at ${formData.companyName}. Keep going!`,
          rejected:        `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Learn and keep pushing.`,
          ghosted:         `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Ghosted - their loss.`,
          withdrew:        `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. You withdrew - good self-awareness.`,
          pending:         `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Awaiting outcome.`,
          practice:        `Practice session logged for ${formData.jobTitle} at ${formData.companyName}.`,
        };
        await NotificationService.createNotification(
          user.id,
          formData.outcome === 'offer' ? 'achievement' : 'planner',
          formData.outcome === 'offer' ? 'Offer Received!' : 'Interview Debrief Logged',
          msgs[formData.outcome],
          { actionUrl: '/debrief', actionLabel: 'View Journal' }
        );

        // ← NEW: set next step context
        setDebriefNextStep({
          company: formData.companyName,
          outcome: formData.outcome,
          stage: formData.stage,
        });
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
    if (!(await confirm({ message: 'Delete this journal entry? This cannot be undone.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      const res = await fetch(`/api/debrief?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Entry deleted');
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch { toast.error('Failed to delete entry'); }
  };

  const handleEdit = (entry: DebriefEntry) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, userId, createdAt, ...rest } = entry;
    // Entries saved from a mock interview leave emotional state, difficulty
    // and the like empty for the user to fill in; the form needs values.
    const filled = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null && v !== undefined));
    setFormData({ ...EMPTY_FORM, ...filled });
    setEditingId(id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogInterview = () => {
    if (!canUseFeature('interviewDebriefs')) {
      toast.error(`You've used all ${debriefLimit} journal entries in your plan this month. Upgrade for a higher limit.`);
      return;
    }
    setShowForm(!showForm);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  };

  const totalEntries  = entries.length;
  // Practice entries carry the AI interviewer's score and have no outcome, so
  // the self-score average and advance rate are over real interviews only.
  const realEntries   = entries.filter(e => e.outcome !== 'practice');
  const avgSelfScore  = realEntries.length > 0 ? Math.round(realEntries.reduce((s, e) => s + (e.selfScore ?? 0), 0) / realEntries.length) : 0;
  const advancedCount = realEntries.filter(e => e.outcome === 'moved-forward' || e.outcome === 'offer').length;
  const advanceRate   = realEntries.length > 0 ? Math.round((advancedCount / realEntries.length) * 100) : 0;
  const offerCount    = entries.filter(e => e.outcome === 'offer').length;
  const questionCount = entries.reduce((n, e) => n + (e.questionsAsked ?? []).filter(q => q && q.trim()).length, 0);

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
  if (!user) { router.push('/sign-in'); return null; }


  const mainTabs = [
    { id: 'log'      as const, label: 'Journal Log', icon: BookOpen  },
    { id: 'insights' as const, label: 'Stats',       icon: BarChart3 },
    { id: 'ai'       as const, label: 'AI Analysis', icon: Brain     },
  ];

  return (
    <div className="space-y-4 pt-4">
      <ConfirmDialog />

      <PageHeader
        title="Interview Journal" description="Log real interviews and let AI find your patterns" icon={HeaderIcon}
        actions={<>
          <SeeExampleButton serviceId="debrief" />
          <span className="btn-pill"><Shield /> {usageLoading ? <span aria-hidden="true" className="inline-block w-10 h-3 rounded bg-current opacity-25 animate-pulse" /> : debriefUnlimited ? 'Unlimited' : `${debriefLeft} left`}</span>
          <button onClick={handleLogInterview} className="btn-primary">
            {showForm ? <X /> : <Plus />}
            {showForm ? 'Cancel' : 'Log Interview'}
          </button>
        </>}
      />

      {!canUseFeature('interviewDebriefs') && entries.length === 0 ? (
        <UpgradeGate used={debriefUsed} limit={debriefLimit} />
      ) : (
        <>
          {/* Stats row */}
          {entries.length > 0 && (
            <div className="glass-card grid grid-cols-2 lg:grid-cols-5 overflow-hidden animate-fade-in-up">
              <Kpi label="Rounds logged" tip="Real interview rounds in your journal. Practice sessions are counted separately and left out of the other figures."
                value={realEntries.length} sub={`${totalEntries - realEntries.length} practice session${totalEntries - realEntries.length === 1 ? '' : 's'}`} />
              <Kpi className="border-l" label="Moved forward" tip="Real rounds you marked Moved forward or Offer, out of all real rounds."
                value={realEntries.length ? `${advanceRate}%` : '-'} sub={`${advancedCount} of ${realEntries.length} rounds`} tone={realEntries.length && advanceRate >= 50 ? 'text-emerald-300' : undefined} />
              <Kpi className="border-t lg:border-t-0 lg:border-l" label="Offers" tip="Entries whose outcome is Offer."
                value={offerCount} sub={offerCount ? 'Congratulations' : 'None yet'} tone={offerCount ? 'text-emerald-300' : undefined} />
              <Kpi className="border-t border-l lg:border-t-0" label="Avg self-score" tip="The average of the score you gave yourself after each real round."
                value={realEntries.length ? `${avgSelfScore}%` : '-'} sub="How you rated your rounds" />
              <Kpi className="col-span-2 lg:col-span-1 border-t lg:border-t-0 lg:border-l" label="Questions saved" tip="Questions you wrote down across all entries, ready to practise."
                value={questionCount} sub={questionCount ? 'Across all entries' : 'Add the questions you were asked'} />
            </div>
          )}

          {/* ← NEW: NextStepPrompt after saving a new debrief */}
          {debriefNextStep && (
            <NextStepPrompt
              trigger="debrief_saved"
              context={debriefNextStep}
              delay={600}
            />
          )}

          {/* Log form */}
          {showForm && (() => {
            const lab = 'block text-[12.5px] font-medium text-[var(--text-2)] mb-1.5';
            const pick = (on: boolean) => `p-2 rounded-xl text-center text-[11px] transition-colors ring-1 ring-inset ${on ? 'bg-white/[0.1] ring-white/[0.18] text-white' : 'bg-white/[0.02] ring-white/[0.07] text-slate-400 hover:text-white hover:ring-white/[0.14]'}`;
            const filled = (v: string) => (v.trim() ? 1 : 0);
            return (
            <div className="glass-card overflow-hidden animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <div className="px-5 sm:px-7 py-5 border-b border-white/[0.06] flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
                  <Edit3 className="w-4 h-4 text-[var(--text-2)]" />
                </span>
                <div>
                  <h2 className="font-display text-[16px] font-semibold text-white">{editingId ? 'Edit entry' : 'New journal entry'}</h2>
                  <p className="text-[12.5px] text-[var(--text-4)] mt-0.5">The more you log, the more the insights can tell you.</p>
                </div>
              </div>

              <div className="px-5 sm:px-7 py-6">
                <FormSection id="db-round" title="The round" desc="Which interview this was and how it ended."
                  done={filled(formData.companyName) + filled(formData.jobTitle)} total={2}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className={lab}>Company</label>
                      <input type="text" value={formData.companyName} onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))} placeholder="e.g. Google" className={inp} /></div>
                    <div><label className={lab}>Job title</label>
                      <input type="text" value={formData.jobTitle} onChange={e => setFormData(p => ({ ...p, jobTitle: e.target.value }))} placeholder="e.g. Data Analyst" className={inp} /></div>
                    <div><label className={lab}>Interview date</label>
                      <DateInput value={formData.interviewDate} onChange={v => setFormData(p => ({ ...p, interviewDate: v }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><label className={lab}>Stage</label>
                      <AppSelect value={formData.stage} onValueChange={v => setFormData(p => ({ ...p, stage: v as InterviewStage }))} aria-label="Stage"
                        options={Object.entries(STAGE_LABELS).map(([k, v]) => ({ value: k, label: v }))} /></div>
                    <div><label className={lab}>Outcome</label>
                      <AppSelect value={formData.outcome} onValueChange={v => setFormData(p => ({ ...p, outcome: v as InterviewOutcome }))} aria-label="Outcome"
                        options={Object.entries(OUTCOME_LABELS).map(([k, v]) => ({ value: k, label: v }))} /></div>
                    <div><label className={lab}>Duration (min)</label>
                      <input type="number" min={10} max={300} value={formData.durationMinutes} onChange={e => setFormData(p => ({ ...p, durationMinutes: Number(e.target.value) }))} className={inp} /></div>
                    <div><label className={lab}>Interviewers</label>
                      <input type="number" min={1} max={10} value={formData.interviewerCount} onChange={e => setFormData(p => ({ ...p, interviewerCount: Number(e.target.value) }))} className={inp} /></div>
                  </div>
                </FormSection>

                <FormSection id="db-feel" title="How it went" desc="How you felt going in and coming out, and how you would score the round.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(['emotionalStateBefore', 'emotionalStateAfter'] as const).map((field, fi) => (
                      <div key={field}>
                        <label className={lab}>{fi === 0 ? 'Feeling before' : 'Feeling after'}</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(Object.keys(EMOTIONAL_EMOJIS) as EmotionalState[]).map(e => (
                            <button key={e} type="button" aria-pressed={formData[field] === e} onClick={() => setFormData(p => ({ ...p, [field]: e }))} className={pick(formData[field] === e)}>
                              <span className="block leading-none">{EMOTIONAL_EMOJIS[e]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className={lab}>Self score: <span className="text-white font-semibold tabular-nums">{formData.selfScore}%</span></label>
                      <input type="range" min={0} max={100} value={formData.selfScore} onChange={e => setFormData(p => ({ ...p, selfScore: Number(e.target.value) }))} className="w-full accent-white" />
                    </div>
                    <div>
                      <label className={lab}>Difficulty</label>
                      <div className="flex gap-1">
                        {([1, 2, 3, 4, 5] as DifficultyRating[]).map(n => (
                          <button key={n} type="button" aria-label={`Difficulty ${n} of 5`} onClick={() => setFormData(p => ({ ...p, difficultyRating: n }))}
                            className={`text-xl transition-colors ${n <= formData.difficultyRating ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}>★</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </FormSection>

                <FormSection id="db-q" title="Questions they asked" desc="Write them down while they are fresh. They show up later as practice."
                  done={formData.questionsAsked.filter(q => q.trim()).length} total={Math.max(1, formData.questionsAsked.length)}>
                  <div className="space-y-2">
                    {formData.questionsAsked.map((q, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" value={q} onChange={e => { const arr = [...formData.questionsAsked]; arr[idx] = e.target.value; setFormData(p => ({ ...p, questionsAsked: arr })); }}
                          placeholder={`Question ${idx + 1}`} className={inp} />
                        <button type="button" onClick={() => { const arr = formData.questionsAsked.filter((_, i) => i !== idx); setFormData(p => ({ ...p, questionsAsked: arr.length ? arr : [''] })); }}
                          className="h-11 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-4)] hover:text-rose-300 hover:bg-rose-500/[0.08] transition-colors flex-shrink-0">Remove</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setFormData(p => ({ ...p, questionsAsked: [...p.questionsAsked, ''] }))} className="btn-secondary !h-9 !text-[13px]">
                    <Plus className="w-3.5 h-3.5" /> Add question
                  </button>
                </FormSection>

                <FormSection id="db-notes" title="Reflection" desc="What to keep doing, what to fix, and what to do next."
                  done={[formData.whatWentWell, formData.whatWentPoorly, formData.surprises, formData.followUpActions].filter(v => v.trim()).length} total={4}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: 'whatWentWell', label: 'What went well', dot: 'bg-emerald-400', placeholder: 'Strong answers, good rapport' },
                      { key: 'whatWentPoorly', label: 'What went poorly', dot: 'bg-rose-400', placeholder: 'Got stuck on the SQL question' },
                      { key: 'surprises', label: 'Surprises', dot: 'bg-amber-400', placeholder: "They asked about something I didn't prepare" },
                      { key: 'followUpActions', label: 'Follow-up actions', dot: 'bg-sky-400', placeholder: 'Study window functions, send a thank-you' },
                    ].map(fd => (
                      <div key={fd.key}>
                        <label className={`${lab} flex items-center gap-2`}><span className={`w-1.5 h-1.5 rounded-full ${fd.dot}`} aria-hidden="true" />{fd.label}</label>
                        <AutoTextarea rows={3} value={(formData as Record<string, unknown>)[fd.key] as string}
                          onChange={e => setFormData(p => ({ ...p, [fd.key]: e.target.value }))} placeholder={fd.placeholder} className={ta} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className={lab}>Overall notes</label>
                    <AutoTextarea rows={2} value={formData.overallNotes} onChange={e => setFormData(p => ({ ...p, overallNotes: e.target.value }))}
                      placeholder="General impressions, the culture, the interviewer's style" className={ta} />
                  </div>
                </FormSection>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-5 border-t border-white/[0.06]">
                  <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }} className="btn-secondary">Cancel</button>
                  <button onClick={handleSave} disabled={isSaving} className="btn-primary disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'Saving' : editingId ? 'Update entry' : 'Save to journal'}
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

          {entries.length > 0 && (
            <TabBar tabs={mainTabs} active={activeView} onChange={setActiveView} />
          )}

          {activeView === 'ai' && entries.length > 0 && <AIInsightsPanel entries={entries} />}

          {activeView === 'insights' && entries.length > 0 && (
            <div className="space-y-4">
              <SectionCard>
                <SectionHeader icon={Activity} title="Self-Score Trend" sub="How you feel about your performance over time" accentClass="text-amber-400" />
                <div className="space-y-2.5">
                  {[...entries].slice(0, 10).reverse().map(e => (
                    <ProgressBar key={e.id} label={`${e.companyName} - ${STAGE_LABELS[e.stage]}`} value={e.selfScore} />
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
                        <p className="text-[11px] opacity-70 mt-0.5 leading-tight">{OUTCOME_LABELS[o]}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard>
                <SectionHeader icon={Heart} title="Emotional State vs Performance" sub="Average self-score when you felt each way before" accentClass="text-[var(--text-2)]" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(Object.keys(EMOTIONAL_EMOJIS) as EmotionalState[]).map(emotion => {
                    const relevant = entries.filter(e => e.emotionalStateBefore === emotion);
                    if (!relevant.length) return null;
                    const avg      = Math.round(relevant.reduce((s, e) => s + e.selfScore, 0) / relevant.length);
                    const clr      = avg >= 75 ? 'text-emerald-400' : avg >= 50 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <div key={emotion} className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                        <p className="text-[12.5px] text-[var(--text-2)]">{EMOTIONAL_EMOJIS[emotion]}</p>
                        <p className={`text-[16px] font-semibold tabular-nums mt-1 ${clr}`}>{avg}%</p>
                        <p className="text-xs text-slate-500">{relevant.length} {relevant.length === 1 ? 'entry' : 'entries'}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
              <SectionCard>
                <SectionHeader icon={Users} title="Performance by Stage" accentClass="text-[#a9b0f7]" />
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

          {activeView === 'log' && (
            <>
              {entries.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    <input type="text" placeholder="Search by company or role…" value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)} className={`${inp} pl-9`} />
                  </div>
                  <div className="sm:w-48">
                    <AppSelect value={filterOutcome} onValueChange={v => setFilterOutcome(v as InterviewOutcome | 'all')}
                      aria-label="Filter by outcome" icon={<Filter />}
                      options={[{ value: 'all', label: 'All Outcomes' },
                        ...(Object.entries(OUTCOME_LABELS) as [InterviewOutcome, string][]).map(([k, v]) => ({ value: k, label: v }))]} />
                  </div>
                </div>
              )}

              {entries.length === 0 && canUseFeature('interviewDebriefs') ? (showForm ? null : (
                <FeatureEmpty icon={BookOpen} title="Learn from every real interview"
                  body="Log each round right after it ends: how it went, the questions they asked and what to work on. Patterns across rounds show up in Insights."
                  steps={[
                    { icon: Edit3, title: 'Log the round', text: 'Company, stage, outcome and how you felt.' },
                    { icon: BookOpen, title: 'Save the questions', text: 'Every question you were asked, ready to practise.' },
                    { icon: BarChart3, title: 'See your patterns', text: 'Scores by stage and what keeps coming up, across rounds.' },
                  ]}
                  primary={{ label: 'Log your first interview', icon: Plus, onClick: () => setShowForm(true) }} />)
              ) : filtered.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-5 h-5 text-slate-500" />
                  </div>
                  <h3 className="text-[14px] font-bold text-slate-400 mb-2">
                    {entries.length === 0 ? 'Your journal is empty' : 'No results found'}
                  </h3>
                  <p className="text-[12px] text-slate-500 mb-6 max-w-xs mx-auto leading-relaxed">
                    {entries.length === 0
                      ? 'Log your first real interview to start tracking patterns and getting AI insights.'
                      : 'Try adjusting your search or filter.'}
                  </p>
                  {entries.length === 0 && canUseFeature('interviewDebriefs') && (
                    <button onClick={() => setShowForm(true)}
                      className="btn-primary">
                      <Plus className="w-4 h-4" /> Log Your First Interview
                    </button>
                  )}
                </div>
              ) : (
                <div className="glass-card overflow-hidden divide-y divide-white/[0.06]">
                  {filtered.map(entry => {
                    const isExpanded = expandedId === entry.id;
                    const dateStr    = entry.interviewDate
                      ? new Date(entry.interviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '';
                    return (
                      <div key={entry.id} id={`entry-${entry.id}`} className={`scroll-mt-24 ${highlightId === entry.id ? 'bg-[var(--accent-subtle)]' : ''}`}>
                        <div className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] rounded-xl flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-[var(--text-3)]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h3 className="text-[14px] font-bold text-white break-words min-w-0">{entry.companyName}</h3>
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${OUTCOME_COLORS[entry.outcome]}`}>
                                    {OUTCOME_LABELS[entry.outcome]}
                                  </span>
                                </div>
                                <p className="text-[12px] text-slate-400">{entry.jobTitle} · {STAGE_LABELS[entry.stage]}</p>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <Calendar className="w-3 h-3" />{dateStr}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="w-3 h-3" />{entry.durationMinutes ? `${entry.durationMinutes}m` : '-'}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <Star className="w-3 h-3" />{entry.selfScore}%
                                  </span>
                                  {entry.emotionalStateBefore && entry.emotionalStateAfter && (
                                    <span className="text-[13px]">
                                      {EMOTIONAL_EMOJIS[entry.emotionalStateBefore]} to {EMOTIONAL_EMOJIS[entry.emotionalStateAfter]}
                                    </span>
                                  )}
                                  {entry.difficultyRating > 0 && <span className="text-amber-400 text-xs">{'★'.repeat(entry.difficultyRating)}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button onClick={ev => { ev.stopPropagation(); handleEdit(entry); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#a9b0f7] hover:bg-[var(--accent-subtle)] transition-all">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={ev => { ev.stopPropagation(); handleDelete(entry.id); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              {isExpanded
                                ? <ChevronUp className="w-4 h-4 text-slate-500 ml-1" />
                                : <ChevronDown className="w-4 h-4 text-slate-500 ml-1" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-white/[0.05] px-4 pb-4 pt-4 space-y-4">
                            {entry.questionsAsked.filter(Boolean).length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2 flex items-center gap-1">
                                  <MessageSquare className="w-3.5 h-3.5" /> Questions Asked
                                </p>
                                <ul className="space-y-1">
                                  {entry.questionsAsked.filter(Boolean).map((q, i) => (
                                    <li key={i} className="text-[13px] text-slate-300 flex items-start gap-2">
                                      <span className="text-[#a9b0f7] flex-shrink-0 mt-0.5">›</span> {q}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {entry.whatWentWell && (
                                <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl">
                                  <p className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> What Went Well
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line break-words">{entry.whatWentWell}</p>
                                </div>
                              )}
                              {entry.whatWentPoorly && (
                                <div className="p-3 bg-red-500/[0.06] border border-red-500/15 rounded-xl">
                                  <p className="text-[11px] text-red-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> What Went Poorly
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line break-words">{entry.whatWentPoorly}</p>
                                </div>
                              )}
                              {entry.surprises && (
                                <div className="p-3 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl">
                                  <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Lightbulb className="w-3.5 h-3.5" /> Surprises
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line break-words">{entry.surprises}</p>
                                </div>
                              )}
                              {entry.followUpActions && (
                                <div className="p-3 bg-blue-500/[0.06] border border-blue-500/15 rounded-xl">
                                  <p className="text-[11px] text-blue-400 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                    <Target className="w-3.5 h-3.5" /> Follow-up Actions
                                  </p>
                                  <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line break-words">{entry.followUpActions}</p>
                                </div>
                              )}
                            </div>
                            {entry.overallNotes && (
                              <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                                <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" /> Overall Notes
                                </p>
                                <p className="text-[13px] text-slate-300 leading-relaxed whitespace-pre-line break-words">{entry.overallNotes}</p>
                              </div>
                            )}
                            <p className="text-xs text-slate-500">
                              {entry.difficultyRating > 0 && (
                                <>
                                  Difficulty: <span className="text-amber-400">{'★'.repeat(entry.difficultyRating)}{'☆'.repeat(5 - entry.difficultyRating)}</span>
                                  <span className="mx-2">·</span>
                                </>
                              )}
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
        page="debrief"
        forceOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
      />
    </div>
  );
}