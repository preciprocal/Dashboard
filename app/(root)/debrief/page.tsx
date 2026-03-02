'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  BookOpen, Plus, Loader2, Trash2, ChevronDown, ChevronUp,
  Calendar, Building2, TrendingUp, AlertTriangle, CheckCircle2,
  Brain, MessageSquare, Target, BarChart3, Lightbulb, Clock,
  Star, Edit3, X, Save, ArrowLeft, Activity, Award, Zap, Eye,
  Heart, Filter, Search, RefreshCw, XCircle, ArrowRight, Flame,
  Users, MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { NotificationService } from '@/lib/services/notification-services';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<InterviewStage, string> = {
  'phone-screen':  'Phone Screen',
  'technical':     'Technical',
  'behavioral':    'Behavioral',
  'system-design': 'System Design',
  'final':         'Final Round',
  'onsite':        'Onsite',
};

const OUTCOME_COLORS: Record<InterviewOutcome, string> = {
  pending:          'text-amber-400  bg-amber-400/10  border-amber-400/20',
  'moved-forward':  'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  rejected:         'text-red-400    bg-red-400/10    border-red-400/20',
  ghosted:          'text-slate-400  bg-slate-400/10  border-slate-400/20',
  withdrew:         'text-purple-400 bg-purple-400/10 border-purple-400/20',
  offer:            'text-blue-400   bg-blue-400/10   border-blue-400/20',
};

const OUTCOME_LABELS: Record<InterviewOutcome, string> = {
  pending:          'Pending',
  'moved-forward':  'Moved Forward',
  rejected:         'Rejected',
  ghosted:          'Ghosted',
  withdrew:         'Withdrew',
  offer:            '🎉 Offer!',
};

const EMOTIONAL_EMOJIS: Record<EmotionalState, string> = {
  confident: '😎', nervous: '😰', neutral: '😐',
  excited: '🤩', anxious: '😟', exhausted: '😓',
};

const SEVERITY_COLORS: Record<AIWeakness['severity'], string> = {
  minor:    'bg-amber-500/10 border-amber-500/20 text-amber-400',
  moderate: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  severe:   'bg-red-500/10 border-red-500/20 text-red-400',
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

// ─────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 backdrop-blur-xl">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? 'from-emerald-500 to-teal-500' : value >= 50 ? 'from-amber-500 to-orange-500' : 'from-red-500 to-pink-500';
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-slate-400 truncate pr-2">{label}</span>
        <span className="text-xs text-white font-medium flex-shrink-0">{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ReadinessGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
  const angle = (score / 100) * 180;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          <path d="M 5 50 A 45 45 0 0 1 95 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 141.3} 141.3`}
            style={{ transition: 'stroke-dasharray 1.2s ease' }} />
          <line x1="50" y1="50"
            x2={50 + 35 * Math.cos(Math.PI - (angle * Math.PI / 180))}
            y2={50 - 35 * Math.sin(Math.PI - (angle * Math.PI / 180))}
            stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="50" r="3.5" fill="white" />
        </svg>
      </div>
      <p className="text-3xl font-bold -mt-2" style={{ color }}>{score}</p>
      <p className="text-xs font-medium mt-0.5" style={{ color }}>{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AI Insights Panel
// ─────────────────────────────────────────────────────────────────

function AIInsightsPanel({ entries }: { entries: DebriefEntry[] }) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'patterns' | 'plan' | 'questions'>('overview');

  const runAnalysis = useCallback(async () => {
    if (entries.length === 0) return;
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
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-300" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-medium mb-1">Analysing your interview history…</p>
          <p className="text-slate-400 text-sm">Identifying patterns across your {entries.length} entries</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl text-center">
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <p className="text-white font-medium mb-1">Analysis failed</p>
        <p className="text-slate-400 text-sm mb-5">{error}</p>
        <button onClick={runAnalysis} className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium text-sm transition-all">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl text-center">
        <div className="w-14 h-14 bg-violet-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Brain className="w-7 h-7 text-violet-400" />
        </div>
        <h3 className="text-white font-semibold mb-2">AI Pattern Analysis</h3>
        <p className="text-slate-400 text-sm mb-2">
          Let AI analyse all {entries.length} of your debrief entries and identify what&apos;s actually holding you back.
        </p>
        <p className="text-amber-400 text-xs mb-5">Brutally honest. No sugarcoating.</p>
        <button onClick={runAnalysis}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-violet-500/25">
          <Zap className="w-4 h-4" /> Analyse My Interviews
        </button>
      </div>
    );
  }

  const sectionTabs = [
    { id: 'overview'  as const, label: 'Overview',    icon: BarChart3    },
    { id: 'patterns'  as const, label: 'Patterns',    icon: Brain        },
    { id: 'plan'      as const, label: '30-Day Plan', icon: Target       },
    { id: 'questions' as const, label: 'Questions',   icon: MessageSquare },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-sm">AI Career Coach Analysis</h3>
            <p className="text-slate-400 text-xs mt-0.5">Based on {entries.length} interview entries</p>
          </div>
          <button onClick={runAnalysis} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-violet-400 transition-colors" title="Re-run">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <ReadinessGauge score={analysis.overallReadiness} label={analysis.readinessLabel} />
          <div className="flex-1">
            <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Coach&apos;s Verdict</p>
              <p className="text-sm text-white leading-relaxed italic">&quot;{analysis.oneLinerVerdict}&quot;</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-1.5 backdrop-blur-xl overflow-x-auto">
        <div className="flex gap-1 min-w-max sm:min-w-0">
          {sectionTabs.map(t => (
            <button key={t.id} onClick={() => setActiveSection(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeSection === t.id ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'overview' && (
        <div className="space-y-4">
          {analysis.strengthMap?.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                <h4 className="text-sm font-bold text-white">Your Strengths</h4>
              </div>
              <div className="space-y-3">
                {analysis.strengthMap.map((s, i) => (
                  <div key={i} className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                    <p className="text-sm font-semibold text-emerald-300 mb-1">{s.area}</p>
                    <p className="text-xs text-slate-400 mb-2">{s.evidence}</p>
                    <div className="flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-400">{s.howToLeverage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.weaknessMap?.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-400" /></div>
                <h4 className="text-sm font-bold text-white">Weakness Map</h4>
              </div>
              <div className="space-y-3">
                {analysis.weaknessMap.map((w, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${SEVERITY_COLORS[w.severity]}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold">{w.area}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs opacity-70">{w.frequency}x seen</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-medium capitalize">{w.severity}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-2 italic">&quot;{w.specificExample}&quot;</p>
                    <div className="flex items-start gap-1.5">
                      <Zap className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-70" />
                      <p className="text-xs opacity-90">{w.fix}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.emotionalProfile && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center"><Heart className="w-4 h-4 text-pink-400" /></div>
                <h4 className="text-sm font-bold text-white">Emotional Profile</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">Usually before</p>
                  <p className="text-sm text-white font-medium capitalize">{analysis.emotionalProfile.dominantStateBefore}</p>
                </div>
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50 text-center">
                  <p className="text-xs text-slate-400 mb-1">Usually after</p>
                  <p className="text-sm text-white font-medium capitalize">{analysis.emotionalProfile.dominantStateAfter}</p>
                </div>
              </div>
              <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-700/50 mb-2">
                <p className="text-xs text-slate-400 mb-1">Anxiety impact</p>
                <p className="text-sm text-slate-300">{analysis.emotionalProfile.anxietyImpact}</p>
              </div>
              <div className="p-3 bg-violet-500/5 rounded-xl border border-violet-500/20">
                <p className="text-xs text-violet-400 mb-1 font-medium">Recommendation</p>
                <p className="text-sm text-slate-300">{analysis.emotionalProfile.recommendation}</p>
              </div>
            </div>
          )}
          {analysis.stageAnalysis && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center"><MapPin className="w-4 h-4 text-blue-400" /></div>
                <h4 className="text-sm font-bold text-white">Stage Analysis</h4>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <p className="text-xs text-emerald-400 mb-1 font-medium">Strongest stage</p>
                  <p className="text-sm text-white">{analysis.stageAnalysis.strongestStage}</p>
                </div>
                <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-400 mb-1 font-medium">Weakest stage</p>
                  <p className="text-sm text-white">{analysis.stageAnalysis.weakestStage}</p>
                </div>
              </div>
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400 mb-1 font-medium flex items-center gap-1"><Flame className="w-3 h-3" /> Bottleneck</p>
                <p className="text-sm text-slate-300">{analysis.stageAnalysis.bottleneck}</p>
              </div>
            </div>
          )}
          {analysis.blindSpots?.length > 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center"><Eye className="w-4 h-4 text-amber-400" /></div>
                <div>
                  <h4 className="text-sm font-bold text-white">Blind Spots</h4>
                  <p className="text-xs text-slate-400">Things you&apos;re probably not seeing</p>
                </div>
              </div>
              <div className="space-y-2">
                {analysis.blindSpots.map((bs, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300">{bs}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'patterns' && (
        <div className="space-y-3">
          {analysis.topPatterns?.length > 0 ? analysis.topPatterns.map((p, i) => (
            <div key={i} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.impact === 'positive' ? 'bg-emerald-400' : p.impact === 'negative' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <h4 className="text-sm font-bold text-white">{p.pattern}</h4>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium capitalize ${p.impact === 'positive' ? 'bg-emerald-500/20 text-emerald-400' : p.impact === 'negative' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>{p.impact}</span>
              </div>
              <p className="text-xs text-slate-500 mb-2 italic">Evidence: {p.evidence}</p>
              <p className="text-sm text-slate-300 leading-relaxed">{p.explanation}</p>
            </div>
          )) : (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 text-center backdrop-blur-xl">
              <p className="text-slate-400 text-sm">No patterns detected yet.</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'plan' && (
        <div className="space-y-3">
          {analysis.next30DayPlan?.length > 0 ? analysis.next30DayPlan.map((week, i) => (
            <div key={i} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">W{week.week}</div>
                <div>
                  <p className="text-xs text-slate-400">Week {week.week}</p>
                  <p className="text-sm font-bold text-white">{week.focus}</p>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                {week.actions.map((action, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <div className="w-4 h-4 border border-slate-600 rounded flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300">{action}</p>
                  </div>
                ))}
              </div>
              <div className="p-2.5 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                <p className="text-xs text-violet-400 font-medium flex items-center gap-1"><Target className="w-3 h-3" /> Success metric: {week.successMetric}</p>
              </div>
            </div>
          )) : (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 text-center backdrop-blur-xl">
              <p className="text-slate-400 text-sm">No plan generated. Try running the analysis again.</p>
            </div>
          )}
        </div>
      )}

      {activeSection === 'questions' && (
        <div className="space-y-3">
          {analysis.questionsToMaster?.length > 0 ? analysis.questionsToMaster.map((q, i) => (
            <div key={i} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-sm font-semibold text-white leading-relaxed">&quot;{q.question}&quot;</p>
              </div>
              <div className="space-y-2">
                <div className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400 font-medium mb-0.5">Why it matters</p>
                  <p className="text-xs text-slate-300">{q.whyItMatters}</p>
                </div>
                <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-400 font-medium mb-0.5">How to answer it</p>
                  <p className="text-xs text-slate-300">{q.howToAnswer}</p>
                </div>
              </div>
            </div>
          )) : (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 text-center backdrop-blur-xl">
              <p className="text-slate-400 text-sm">No questions identified. Run the analysis to get personalised questions.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────

export default function InterviewDebriefPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

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

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoadingEntries(true); setLoadingStep(0);
    try {
      setLoadingStep(1);
      const q    = query(collection(db, 'interviewDebrief'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
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

  // ── Save (create or update) ───────────────────────────────────
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

        // ── Notification: entry updated ──
        await NotificationService.createNotification(
          user.uid,
          'planner',
          'Debrief Entry Updated 📝',
          `Your debrief for ${formData.jobTitle} at ${formData.companyName} has been updated.`,
          { actionUrl: '/debrief', actionLabel: 'View Journal' }
        );
      } else {
        await addDoc(collection(db, 'interviewDebrief'), payload);
        toast.success('Debrief saved to your journal');

        // ── Notification: new entry saved ──
        // Build a context-aware message based on outcome
        const outcomeMsg: Record<InterviewOutcome, string> = {
          'offer':          `🎉 You got an offer for ${formData.jobTitle} at ${formData.companyName}! Congrats!`,
          'moved-forward':  `You moved forward for ${formData.jobTitle} at ${formData.companyName}. Keep going!`,
          'rejected':       `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Learn from it and keep pushing.`,
          'ghosted':        `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Ghosted — their loss.`,
          'withdrew':       `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. You withdrew — good self-awareness.`,
          'pending':        `Debrief logged for ${formData.jobTitle} at ${formData.companyName}. Awaiting outcome.`,
        };

        await NotificationService.createNotification(
          user.uid,
          formData.outcome === 'offer' ? 'achievement' : 'planner',
          formData.outcome === 'offer' ? 'Offer Received! 🏆' : 'Interview Debrief Logged 📓',
          outcomeMsg[formData.outcome],
          { actionUrl: '/debrief', actionLabel: 'View Journal' }
        );
      }

      setFormData({ ...EMPTY_FORM });
      setShowForm(false);
      setEditingId(null);
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
    setEditingId(id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Stats ──
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
    { name: 'Connecting to database…',  weight: 1 },
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

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-3">
              <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
            </Link>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Interview Debrief Journal</h1>
            </div>
            <p className="text-slate-400 text-sm">Log real interviews, let AI find your patterns, turn losses into learning.</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-violet-500/25 flex-shrink-0"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Log Interview'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={BookOpen}   label="Total Logged"   value={totalEntries}        color="bg-violet-500/20 text-violet-400" />
          <StatCard icon={Star}       label="Avg Self-Score" value={`${avgSelfScore}%`}  color="bg-amber-500/20 text-amber-400" />
          <StatCard icon={TrendingUp} label="Advance Rate"   value={`${advanceRate}%`}   sub={`${advancedCount} of ${totalEntries}`} color="bg-emerald-500/20 text-emerald-400" />
          <StatCard icon={Award}      label="Offers"         value={offerCount}           color="bg-blue-500/20 text-blue-400" />
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl backdrop-blur-xl overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border-b border-slate-700/50 px-6 py-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-violet-400" />
                {editingId ? 'Edit Entry' : 'New Debrief Entry'}
              </h2>
              <p className="text-slate-400 text-xs mt-1">The more detail you log, the better the AI insights.</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Company + Title + Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { key: 'companyName', label: 'Company *',  placeholder: 'e.g. Google'      },
                  { key: 'jobTitle',    label: 'Job Title *', placeholder: 'e.g. Senior SWE' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">{f.label}</label>
                    <input type="text" value={(formData as Record<string,unknown>)[f.key] as string}
                      onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Interview Date</label>
                  <input type="date" value={formData.interviewDate}
                    onChange={e => setFormData(p => ({ ...p, interviewDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>

              {/* Stage + Outcome + Duration + Interviewers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Stage</label>
                  <select value={formData.stage} onChange={e => setFormData(p => ({ ...p, stage: e.target.value as InterviewStage }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Outcome</label>
                  <select value={formData.outcome} onChange={e => setFormData(p => ({ ...p, outcome: e.target.value as InterviewOutcome }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 transition-colors">
                    {Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Duration (min)</label>
                  <input type="number" min={10} max={300} value={formData.durationMinutes}
                    onChange={e => setFormData(p => ({ ...p, durationMinutes: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Interviewers</label>
                  <input type="number" min={1} max={10} value={formData.interviewerCount}
                    onChange={e => setFormData(p => ({ ...p, interviewerCount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>

              {/* Emotional state + Scores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['emotionalStateBefore', 'emotionalStateAfter'] as const).map((field, fi) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">{fi === 0 ? 'Feeling Before' : 'Feeling After'}</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(Object.keys(EMOTIONAL_EMOJIS) as EmotionalState[]).map(e => (
                        <button key={e} type="button" onClick={() => setFormData(p => ({ ...p, [field]: e }))}
                          className={`p-2 rounded-lg text-center text-xs transition-all ${
                            formData[field] === e
                              ? 'bg-violet-500/30 border border-violet-500/50 text-white'
                              : 'bg-slate-900/40 border border-slate-700 text-slate-400 hover:border-slate-600'
                          }`}>
                          <span className="block text-base">{EMOTIONAL_EMOJIS[e]}</span>
                          <span className="block">{e}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Self Score: <span className="text-white font-semibold">{formData.selfScore}%</span>
                    </label>
                    <input type="range" min={0} max={100} value={formData.selfScore}
                      onChange={e => setFormData(p => ({ ...p, selfScore: Number(e.target.value) }))}
                      className="w-full accent-violet-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Difficulty: <span className="text-white font-semibold">{'★'.repeat(formData.difficultyRating)}</span>
                    </label>
                    <div className="flex gap-1">
                      {([1, 2, 3, 4, 5] as DifficultyRating[]).map(n => (
                        <button key={n} type="button" onClick={() => setFormData(p => ({ ...p, difficultyRating: n }))}
                          className={`text-xl transition-colors ${n <= formData.difficultyRating ? 'text-amber-400' : 'text-slate-600'}`}>★</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Questions They Asked</label>
                <div className="space-y-2">
                  {formData.questionsAsked.map((q, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={q}
                        onChange={e => { const arr = [...formData.questionsAsked]; arr[idx] = e.target.value; setFormData(p => ({ ...p, questionsAsked: arr })); }}
                        placeholder={`Question ${idx + 1}`}
                        className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                      <button type="button"
                        onClick={() => { const arr = formData.questionsAsked.filter((_, i) => i !== idx); setFormData(p => ({ ...p, questionsAsked: arr.length ? arr : [''] })); }}
                        className="w-8 h-9 text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setFormData(p => ({ ...p, questionsAsked: [...p.questionsAsked, ''] }))}
                    className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> Add question
                  </button>
                </div>
              </div>

              {/* Reflection textareas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'whatWentWell',    label: 'What went well?',        color: 'emerald', placeholder: 'Strong answers, good rapport...', focusColor: 'focus:border-emerald-500' },
                  { key: 'whatWentPoorly',  label: 'What went poorly?',      color: 'red',     placeholder: 'Got stuck on system design...', focusColor: 'focus:border-red-500'     },
                  { key: 'surprises',       label: 'Surprises / Unexpected',  color: 'amber',   placeholder: "They asked about X which I didn't prepare for...", focusColor: 'focus:border-amber-500' },
                  { key: 'followUpActions', label: 'Follow-up Actions',       color: 'blue',    placeholder: 'Study X, practice Y...', focusColor: 'focus:border-blue-500' },
                ].map(f => (
                  <div key={f.key}>
                    <label className={`block text-xs font-medium text-${f.color}-400 mb-1.5`}>{f.label}</label>
                    <textarea rows={3} value={(formData as Record<string,unknown>)[f.key] as string}
                      onChange={e => setFormData(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={`w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none ${f.focusColor} transition-colors resize-none`} />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Overall Notes</label>
                <textarea rows={2} value={formData.overallNotes}
                  onChange={e => setFormData(p => ({ ...p, overallNotes: e.target.value }))}
                  placeholder="General impressions, company culture vibe, interviewer style..."
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-medium text-sm transition-all disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Saving...' : editingId ? 'Update Entry' : 'Save to Journal'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
                  className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl font-medium text-sm transition-all">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View toggle */}
        {entries.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-1.5 w-fit backdrop-blur-xl">
            {([
              { id: 'log',      label: 'Journal Log', icon: BookOpen  },
              { id: 'insights', label: 'Stats',       icon: BarChart3 },
              { id: 'ai',       label: 'AI Analysis', icon: Brain     },
            ] as { id: 'log' | 'insights' | 'ai'; label: string; icon: React.ElementType }[]).map(v => (
              <button key={v.id} onClick={() => setActiveView(v.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeView === v.id ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                <v.icon className="w-3.5 h-3.5" />{v.label}
              </button>
            ))}
          </div>
        )}

        {/* AI View */}
        {activeView === 'ai' && entries.length > 0 && <AIInsightsPanel entries={entries} />}

        {/* Stats View */}
        {activeView === 'insights' && entries.length > 0 && (
          <div className="space-y-5">
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-amber-500/20 rounded-lg flex items-center justify-center"><Activity className="w-4 h-4 text-amber-400" /></div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Self-Score Trend</h3>
                  <p className="text-slate-400 text-xs">How you feel about your performance over time</p>
                </div>
              </div>
              <div className="space-y-2">
                {[...entries].slice(0, 10).reverse().map(e => (
                  <ScoreBar key={e.id} label={`${e.companyName} — ${STAGE_LABELS[e.stage]}`} value={e.selfScore} />
                ))}
              </div>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center"><BarChart3 className="w-4 h-4 text-blue-400" /></div>
                <h3 className="text-white font-semibold text-sm">Outcome Breakdown</h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(Object.keys(OUTCOME_LABELS) as InterviewOutcome[]).map(o => {
                  const count = entries.filter(e => e.outcome === o).length;
                  return (
                    <div key={o} className={`p-3 rounded-xl border text-center ${OUTCOME_COLORS[o]}`}>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs opacity-80">{OUTCOME_LABELS[o]}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-pink-500/20 rounded-lg flex items-center justify-center"><Heart className="w-4 h-4 text-pink-400" /></div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Emotional State vs Performance</h3>
                  <p className="text-slate-400 text-xs">Average self-score when you felt each way before</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(Object.keys(EMOTIONAL_EMOJIS) as EmotionalState[]).map(emotion => {
                  const relevant = entries.filter(e => e.emotionalStateBefore === emotion);
                  if (!relevant.length) return null;
                  const avg = Math.round(relevant.reduce((s, e) => s + e.selfScore, 0) / relevant.length);
                  const avgColor = avg >= 75 ? 'text-emerald-400' : avg >= 50 ? 'text-amber-400' : 'text-red-400';
                  return (
                    <div key={emotion} className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/50">
                      <div className="text-2xl mb-1">{EMOTIONAL_EMOJIS[emotion]}</div>
                      <p className={`font-semibold text-sm ${avgColor}`}>{avg}% avg</p>
                      <p className="text-slate-400 text-xs capitalize">{emotion} ({relevant.length}x)</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-violet-500/20 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-violet-400" /></div>
                <h3 className="text-white font-semibold text-sm">Performance by Stage</h3>
              </div>
              <div className="space-y-3">
                {(Object.keys(STAGE_LABELS) as InterviewStage[]).map(stage => {
                  const stageEntries = entries.filter(e => e.stage === stage);
                  if (!stageEntries.length) return null;
                  const avg = Math.round(stageEntries.reduce((s, e) => s + e.selfScore, 0) / stageEntries.length);
                  return (
                    <div key={stage}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-slate-300">{STAGE_LABELS[stage]}</span>
                        <span className="text-xs text-slate-400">{stageEntries.length} interviews · {avg}% avg</span>
                      </div>
                      <div className="h-2 bg-slate-700/60 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${avg >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : avg >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-red-500 to-pink-500'}`}
                          style={{ width: `${avg}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Log View */}
        {activeView === 'log' && (
          <>
            {entries.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search by company or role..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <select value={filterOutcome} onChange={e => setFilterOutcome(e.target.value as InterviewOutcome | 'all')}
                    className="pl-9 pr-8 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none">
                    <option value="all">All Outcomes</option>
                    {(Object.entries(OUTCOME_LABELS) as [InterviewOutcome, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="bg-slate-800/20 border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-4" />
                <h3 className="text-white font-medium mb-2">{entries.length === 0 ? 'Your journal is empty' : 'No results found'}</h3>
                <p className="text-slate-500 text-sm mb-6">
                  {entries.length === 0 ? 'Log your first real interview to start tracking patterns and getting AI insights.' : 'Try adjusting your search or filters.'}
                </p>
                {entries.length === 0 && (
                  <button onClick={() => setShowForm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium text-sm">
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
                    <div key={entry.id} className="bg-slate-800/30 border border-slate-700/50 rounded-2xl backdrop-blur-xl overflow-hidden">
                      <div className="p-4 sm:p-5 cursor-pointer hover:bg-slate-700/20 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-violet-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h3 className="text-white font-semibold text-sm">{entry.companyName}</h3>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${OUTCOME_COLORS[entry.outcome]}`}>
                                  {OUTCOME_LABELS[entry.outcome]}
                                </span>
                              </div>
                              <p className="text-slate-400 text-xs">{entry.jobTitle} · {STAGE_LABELS[entry.stage]}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{dateStr}</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{entry.durationMinutes}m</span>
                                <span className="flex items-center gap-1"><Star className="w-3 h-3" />{entry.selfScore}%</span>
                                <span>{EMOTIONAL_EMOJIS[entry.emotionalStateBefore]} → {EMOTIONAL_EMOJIS[entry.emotionalStateAfter]}</span>
                                <span className="text-amber-400">{'★'.repeat(entry.difficultyRating)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={ev => { ev.stopPropagation(); handleEdit(entry); }}
                              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-violet-400 transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={ev => { ev.stopPropagation(); handleDelete(entry.id); }}
                              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-slate-700/50 p-4 sm:p-5 space-y-4">
                          {entry.questionsAsked.filter(Boolean).length > 0 && (
                            <div>
                              <h4 className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                                <MessageSquare className="w-3.5 h-3.5" /> Questions Asked
                              </h4>
                              <ul className="space-y-1">
                                {entry.questionsAsked.filter(Boolean).map((q, i) => (
                                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                    <span className="text-violet-400 mt-0.5 flex-shrink-0">›</span> {q}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {entry.whatWentWell && (
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                <h4 className="text-xs font-medium text-emerald-400 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> What Went Well</h4>
                                <p className="text-sm text-slate-300">{entry.whatWentWell}</p>
                              </div>
                            )}
                            {entry.whatWentPoorly && (
                              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                                <h4 className="text-xs font-medium text-red-400 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> What Went Poorly</h4>
                                <p className="text-sm text-slate-300">{entry.whatWentPoorly}</p>
                              </div>
                            )}
                            {entry.surprises && (
                              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                <h4 className="text-xs font-medium text-amber-400 mb-1 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Surprises</h4>
                                <p className="text-sm text-slate-300">{entry.surprises}</p>
                              </div>
                            )}
                            {entry.followUpActions && (
                              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
                                <h4 className="text-xs font-medium text-blue-400 mb-1 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Follow-up Actions</h4>
                                <p className="text-sm text-slate-300">{entry.followUpActions}</p>
                              </div>
                            )}
                          </div>
                          {entry.overallNotes && (
                            <div className="bg-slate-900/40 border border-slate-700/50 rounded-xl p-3">
                              <h4 className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Overall Notes</h4>
                              <p className="text-sm text-slate-300">{entry.overallNotes}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span>Difficulty: <span className="text-amber-400">{'★'.repeat(entry.difficultyRating)}{'☆'.repeat(5 - entry.difficultyRating)}</span></span>
                            <span>·</span>
                            <span>{entry.interviewerCount} interviewer{entry.interviewerCount > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}