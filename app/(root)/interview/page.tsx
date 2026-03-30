'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import ProfileInterviewCard from '@/components/ProfileInterviewCard';
import { SeeExampleButton } from '@/components/ServiceModal';
import {
  Target, TrendingUp, Zap, LayoutGrid, List, Filter,
  CheckCircle, AlertCircle, RefreshCw, Award, Clock,
  Brain, Plus, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = 'all' | 'high-scores' | 'needs-improvement' | 'recent' | 'technical' | 'behavioral';
type ViewMode   = 'grid' | 'list';

interface InterviewFeedback {
  strengths: string[];
  weaknesses: string[];
  overallRating: number;
  technicalAccuracy: number;
  communication: number;
  problemSolving: number;
  confidence: number;
  totalScore?: number;
  finalAssessment?: string;
  categoryScores?: { [key: string]: number };
  areasForImprovement?: string[];
}

interface Interview {
  id: string;
  userId: string;
  role: string;
  type: 'technical' | 'behavioral' | 'system-design' | 'coding';
  techstack: string[];
  company: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  score?: number;
  status: 'completed' | 'in-progress' | 'scheduled';
  feedback?: InterviewFeedback;
  questions?: { question: string; answer: string; score: number; feedback: string }[];
}

interface InterviewStats {
  averageScore: number;
  totalInterviews: number;
  totalHours: number;
  completionRate: number;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FirestoreTimestamp { toDate: () => Date }
type RawDateField = Date | string | FirestoreTimestamp | null | undefined;

interface RawInterview {
  id: string;
  userId: string;
  role: string;
  type: Interview['type'];
  techstack: string[];
  company: string;
  position: string;
  duration: number;
  score?: number;
  status: Interview['status'];
  createdAt: RawDateField;
  updatedAt?: RawDateField;
}

function toDate(val: RawDateField, fallback = new Date()): Date {
  if (!val) return fallback;
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return val.toDate();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, accentClass }: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  accentClass: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                         ${accentClass.replace('text-', 'bg-').replace('-400', '-500/10')}`}>
          <Icon className={`w-4 h-4 ${accentClass}`} />
        </div>
        <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
      </div>
      <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{label}</p>
    </div>
  );
}

function EmptyFiltered({ onClear }: { onClear: () => void }) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                      flex items-center justify-center mx-auto mb-4">
        <Target className="w-5 h-5 text-slate-600" />
      </div>
      <p className="text-[14px] font-semibold text-slate-400 mb-2">No interviews match this filter</p>
      <p className="text-[12px] text-slate-600 mb-5">Try a different filter or start a new session</p>
      <button
        onClick={onClear}
        className="text-[12px] text-slate-400 hover:text-white underline transition-colors"
      >
        Clear filter
      </button>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                      flex items-center justify-center mx-auto mb-6">
        <Target className="w-7 h-7 text-slate-600" />
      </div>
      <h3 className="text-[17px] font-bold text-white mb-2">Welcome to Interview Practice</h3>
      <p className="text-[13px] text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
        Get AI-powered mock interviews, personalised feedback, and track your progress to ace your next interview.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {[
          { icon: Brain,      label: 'AI Feedback',        color: 'text-blue-400   bg-blue-500/10   border-blue-500/20'   },
          { icon: Award,      label: 'Performance Score',  color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
          { icon: TrendingUp, label: 'Track Progress',     color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
          { icon: Zap,        label: 'Real-time Practice', color: 'text-amber-400  bg-amber-500/10  border-amber-500/20'  },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-medium ${color}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <Link
          href="/interview/create"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-gradient-to-r from-indigo-600 to-purple-600
                     hover:from-indigo-500 hover:to-purple-500
                     text-white text-[13px] font-semibold
                     shadow-[0_4px_16px_rgba(102,126,234,0.3)]
                     hover:shadow-[0_6px_20px_rgba(102,126,234,0.4)]
                     transition-all duration-200"
        >
          <Plus className="w-4 h-4" /> Start First Interview
        </Link>
        <SeeExampleButton
          serviceId="interview"
          className="!px-5 !py-2.5 !text-[13px] !font-semibold"
        />
      </div>
      <p className="text-[11px] text-slate-700 mt-4">
        Choose from Technical, Behavioral, or System Design interviews
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewsDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [interviews,        setInterviews]        = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [loadingStep,       setLoadingStep]       = useState(0);
  const [sortFilter,        setSortFilter]        = useState<SortOption>('all');
  const [viewMode,          setViewMode]          = useState<ViewMode>('grid');
  const [showFilterMenu,    setShowFilterMenu]    = useState(false);
  const [stats,             setStats]             = useState<InterviewStats>({
    averageScore: 0, totalInterviews: 0, totalHours: 0, completionRate: 0,
  });
  const [criticalError,  setCriticalError]  = useState<CriticalError | null>(null);
  const [interviewsError,setInterviewsError]= useState('');

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating…',              weight: 1 },
    { name: 'Loading interview history…',   weight: 2 },
    { name: 'Converting data formats…',     weight: 1 },
    { name: 'Fetching feedback data…',      weight: 3 },
    { name: 'Calculating metrics…',         weight: 2 },
    { name: 'Organising interviews…',       weight: 1 },
    { name: 'Done!',                        weight: 1 },
  ];

  // Close filter on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (showFilterMenu && !(e.target as HTMLElement).closest('.filter-dropdown'))
        setShowFilterMenu(false);
    };
    if (showFilterMenu) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showFilterMenu]);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  const loadInterviews = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingInterviews(true); setInterviewsError(''); setLoadingStep(0);
      setLoadingStep(1);

      const profileRes = await fetch('/api/profile');
      if (!profileRes.ok) {
        if (profileRes.status === 401) throw new Error('invalid token');
        throw new Error(`HTTP ${profileRes.status}`);
      }
      const { interviews: raw } = await profileRes.json();

      if (!raw?.length) {
        setInterviews([]); setLoadingStep(6);
        await new Promise(r => setTimeout(r, 200));
        setLoadingInterviews(false);
        return;
      }

      setLoadingStep(2);
      const withDates: Interview[] = (raw as RawInterview[]).map(i => ({
        id: i.id, userId: i.userId, role: i.role, type: i.type,
        techstack: i.techstack, company: i.company, position: i.position,
        duration: i.duration, score: i.score, status: i.status,
        createdAt: toDate(i.createdAt),
        updatedAt: toDate(i.updatedAt, toDate(i.createdAt)),
      }));

      setLoadingStep(3);
      const batchRes = await fetch('/api/feedback/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviews: withDates, userId: user.uid }),
      });

      let withFeedback: Interview[] = withDates;
      if (batchRes.ok) {
        const { interviews: batchData } = await batchRes.json();
        withFeedback = (batchData as RawInterview[]).map(i => ({
          ...i,
          createdAt: toDate(i.createdAt),
          updatedAt: toDate(i.updatedAt, toDate(i.createdAt)),
          feedback: (i as unknown as { feedback?: InterviewFeedback }).feedback,
        }));
      }

      setInterviews(withFeedback);

      setLoadingStep(4);
      const completed = withFeedback.filter(i => i.feedback && (i.score ?? 0) > 0);
      setStats({
        averageScore:   completed.length ? Math.round(completed.reduce((s, i) => s + (i.score || 0), 0) / completed.length) : 0,
        totalInterviews: withFeedback.length,
        totalHours:      Math.round(withFeedback.length * 0.75),
        completionRate:  Math.round((completed.length / withFeedback.length) * 100),
      });

      setLoadingStep(5); await new Promise(r => setTimeout(r, 100));
      setLoadingStep(6); await new Promise(r => setTimeout(r, 100));

    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('Firebase') || msg.includes('firestore')) {
        setCriticalError({ code: 'DATABASE', title: 'Database Error', message: 'Unable to load your interviews.', details: msg });
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Check your internet connection and try again.', details: msg });
      } else {
        setInterviewsError('Failed to load interviews. Please try again.');
      }
    } finally {
      setLoadingInterviews(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadInterviews(); }, [user, loadInterviews]);

  const filteredInterviews = useMemo(() => {
    const arr = [...interviews];
    switch (sortFilter) {
      case 'high-scores':       return arr.filter(i => (i.score || 0) >= 80).sort((a, b) => (b.score || 0) - (a.score || 0));
      case 'needs-improvement': return arr.filter(i => (i.score || 0) < 70);
      case 'technical':         return arr.filter(i => ['technical','coding','system-design'].includes(i.type));
      case 'behavioral':        return arr.filter(i => i.type === 'behavioral');
      default:                  return arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    }
  }, [interviews, sortFilter]);

  const filterCount = (opt: SortOption): number => {
    switch (opt) {
      case 'high-scores':       return interviews.filter(i => (i.score || 0) >= 80).length;
      case 'needs-improvement': return interviews.filter(i => (i.score || 0) < 70).length;
      case 'technical':         return interviews.filter(i => ['technical','coding','system-design'].includes(i.type)).length;
      case 'behavioral':        return interviews.filter(i => i.type === 'behavioral').length;
      default:                  return interviews.length;
    }
  };

  const filterLabel = (opt: SortOption): string => ({
    all:               `All (${filterCount('all')})`,
    'high-scores':     `High Scores (${filterCount('high-scores')})`,
    'needs-improvement':`Needs Work (${filterCount('needs-improvement')})`,
    technical:         `Technical (${filterCount('technical')})`,
    behavioral:        `Behavioral (${filterCount('behavioral')})`,
    recent:            `Recent (${filterCount('recent')})`,
  }[opt] ?? 'All');

  const filterOptions: SortOption[] = ['all','high-scores','needs-improvement','technical','behavioral','recent'];

  // ── Guards ────────────────────────────────────────────────────
  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code} errorTitle={criticalError.title}
        errorMessage={criticalError.message} errorDetails={criticalError.details}
        showBackButton showHomeButton showRefreshButton
        onRetry={() => { setCriticalError(null); setInterviewsError(''); if (user) loadInterviews(); }}
      />
    );
  }

  if (loading || loadingInterviews) {
    return (
      <AnimatedLoader isVisible={true} mode="steps" steps={loadingSteps}
        currentStep={loadingStep} loadingText="Loading your interviews…" showNavigation={true} />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-[17px] font-bold text-white mb-2">Sign in required</h2>
          <p className="text-[13px] text-slate-500 mb-6">Please sign in to view your interviews</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                       text-[13px] font-semibold hover:from-indigo-500 hover:to-purple-500
                       transition-all duration-150"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-4">

      {/* Page header */}
      <div className="glass-card p-5 animate-fade-in-up">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[18px] font-bold text-white leading-tight">Interview Practice</h1>
            <p className="text-[12px] text-slate-500 mt-0.5">AI-powered interview preparation</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SeeExampleButton
              serviceId="interview"
              className="!px-4 !py-2.5 !text-[13px] !font-semibold"
            />
            <Link
              href="/interview/create"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                         bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-500 hover:to-purple-500
                         text-white text-[13px] font-semibold
                         shadow-[0_4px_14px_rgba(102,126,234,0.28)]
                         hover:shadow-[0_6px_18px_rgba(102,126,234,0.38)]
                         transition-all duration-200"
            >
              <Plus className="w-4 h-4" /> New Interview
            </Link>
          </div>
        </div>
      </div>

      {/* Inline error */}
      {interviewsError && (
        <div className="glass-card p-4 animate-fade-in-up">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-[13px] text-red-300 mb-3">{interviewsError}</p>
              <button
                onClick={() => { setInterviewsError(''); loadInterviews(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-white/[0.05] border border-white/[0.08]
                           text-[12px] font-medium text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {interviews.length > 0 ? (
        <div className="space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
            <StatCard icon={Target}      value={stats.totalInterviews}  label="Total Interviews" accentClass="text-blue-400"    />
            <StatCard icon={CheckCircle} value={`${stats.averageScore}%`} label="Average Score"  accentClass="text-emerald-400" />
            <StatCard icon={Clock}       value={`${stats.totalHours}h`} label="Practice Time"    accentClass="text-violet-400"  />
            <StatCard icon={Award}       value={`${stats.completionRate}%`} label="Completion"   accentClass="text-amber-400"   />
          </div>

          {/* Controls bar */}
          <div className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[14px] font-bold text-white">Your Interviews</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {filteredInterviews.length} of {interviews.length}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Filter dropdown */}
                <div className="relative filter-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg
                               bg-white/[0.04] border border-white/[0.07]
                               text-[12px] font-medium text-slate-400 hover:text-slate-200
                               transition-colors min-w-[180px] justify-between"
                  >
                    <span className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      {filterLabel(sortFilter)}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showFilterMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showFilterMenu && (
                    <div className="absolute right-0 top-full mt-2 w-52
                                    bg-[#0d1526]/98 border border-white/[0.08]
                                    rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)]
                                    z-20 overflow-hidden">
                      {filterOptions.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setSortFilter(opt); setShowFilterMenu(false); }}
                          className={`w-full px-4 py-2.5 text-left text-[12px] font-medium transition-colors
                                      ${sortFilter === opt
                                        ? 'bg-indigo-500/15 text-indigo-300'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
                        >
                          {filterLabel(opt)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View toggle */}
                <div className="flex items-center gap-0.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                  {(['grid', 'list'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      aria-label={`${mode} view`}
                      className={`p-1.5 rounded transition-all duration-150
                                  ${viewMode === mode
                                    ? 'bg-white/[0.10] text-white'
                                    : 'text-slate-600 hover:text-slate-300'}`}
                    >
                      {mode === 'grid'
                        ? <LayoutGrid className="w-3.5 h-3.5" />
                        : <List className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interview grid / list */}
          {filteredInterviews.length > 0 ? (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'space-y-3'}>
              {filteredInterviews.map((interview, idx) => (
                <div
                  key={`interview-${interview.id}-${idx}`}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <ProfileInterviewCard interview={interview} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyFiltered onClear={() => setSortFilter('all')} />
          )}
        </div>
      ) : !interviewsError ? (
        <EmptyDashboard />
      ) : null}
    </div>
  );
}