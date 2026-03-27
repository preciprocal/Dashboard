// app/planner/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { PlannerService } from '@/lib/services/planner-services';
import { InterviewPlan, PlanStats } from '@/types/planner';
import Link from 'next/link';
import {
  Plus, Calendar, Target, Clock, CheckCircle2, Flame,
  AlertCircle, RefreshCw, Search, Filter, ChevronDown,
} from 'lucide-react';
import PlanCard from '@/components/planner/PlanCard';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [plans,       setPlans]       = useState<InterviewPlan[]>([]);
  const [stats,       setStats]       = useState<PlanStats | null>(null);
  const [loadingPlans,setLoadingPlans]= useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sortBy,      setSortBy]      = useState<'date' | 'progress' | 'name'>('date');
  const [filter,      setFilter]      = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu,setShowSortMenu]= useState(false);

  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [plansError,    setPlansError]    = useState('');
  const [statsError,    setStatsError]    = useState('');

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating…',           weight: 1 },
    { name: 'Loading preparation plans…',weight: 3 },
    { name: 'Calculating statistics…',   weight: 2 },
    { name: 'Organising data…',          weight: 1 },
    { name: 'Ready!',                    weight: 1 },
  ];

  // Close sort menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showSortMenu && !(e.target as HTMLElement).closest('.sort-dropdown'))
        setShowSortMenu(false);
    };
    if (showSortMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  const loadUserPlans = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingPlans(true); setPlansError(''); setLoadingStep(0);
      setLoadingStep(1);
      const userPlans = await PlannerService.getUserPlans(user.uid);
      setPlans(userPlans);
      setLoadingStep(3);
      await new Promise(r => setTimeout(r, 100));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Firebase') || msg.includes('firestore')) {
        setCriticalError({ code: 'DATABASE', title: 'Database Error', message: 'Unable to load your preparation plans.', details: msg });
      } else if (msg.includes('fetch') || msg.includes('network')) {
        setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Check your internet connection and try again.', details: msg });
      } else if (msg.includes('permission') || msg.includes('denied')) {
        setPlansError('You do not have permission to view plans. Please contact support.');
      } else {
        setPlansError('Failed to load plans. Please try again.');
      }
    } finally {
      setLoadingPlans(false);
    }
  }, [user]);

  const loadUserStats = useCallback(async () => {
    if (!user) return;
    try {
      setStatsError(''); setLoadingStep(2);
      const userStats = await PlannerService.getUserPlanStats(user.uid);
      setStats(userStats);
    } catch {
      setStatsError('Failed to load statistics');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) { router.push('/sign-in'); return; }
    if (user) {
      (async () => {
        await loadUserPlans();
        await loadUserStats();
        setLoadingStep(4);
        await new Promise(r => setTimeout(r, 100));
      })();
    }
  }, [user, loading, router, loadUserPlans, loadUserStats]);

  const handleRetry = () => {
    setCriticalError(null); setPlansError(''); setStatsError('');
    if (user) { loadUserPlans(); loadUserStats(); }
  };

  const filteredPlans = plans
    .filter(plan => {
      if (filter !== 'all' && plan.status !== filter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return plan.role.toLowerCase().includes(q) || plan.company?.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'progress') return b.progress.percentage - a.progress.percentage;
      if (sortBy === 'name')     return a.role.localeCompare(b.role);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const sortLabel = { date: 'Latest First', progress: 'By Progress', name: 'Alphabetical' }[sortBy];

  const sortOptions: { value: typeof sortBy; label: string }[] = [
    { value: 'date',     label: 'Latest First'  },
    { value: 'progress', label: 'By Progress'   },
    { value: 'name',     label: 'Alphabetical'  },
  ];

  const filterTabs: { value: typeof filter; label: string; count: number }[] = [
    { value: 'all',       label: 'All',       count: plans.length },
    { value: 'active',    label: 'Active',    count: plans.filter(p => p.status === 'active').length    },
    { value: 'completed', label: 'Completed', count: plans.filter(p => p.status === 'completed').length },
  ];

  // ── Guards ──────────────────────────────────────────────────────
  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code} errorTitle={criticalError.title}
        errorMessage={criticalError.message} errorDetails={criticalError.details}
        showBackButton showHomeButton showRefreshButton onRetry={handleRetry}
      />
    );
  }

  if (loading || loadingPlans) {
    return (
      <AnimatedLoader isVisible={true} mode="steps" steps={loadingSteps}
        currentStep={loadingStep} loadingText="Loading your preparation plans…" showNavigation={true} />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
          <p className="text-sm text-slate-500 mb-6">Please sign in to access your preparation plans</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-indigo-600 to-purple-600 text-white
                       text-sm font-semibold hover:from-indigo-500 hover:to-purple-500
                       transition-all duration-150"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pt-4">

      {/* Page header */}
      <div className="glass-card p-5 animate-fade-in-up">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Interview Planner</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your preparation plans</p>
          </div>
          <Link
            href="/planner/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0
                       bg-gradient-to-r from-indigo-600 to-purple-600
                       hover:from-indigo-500 hover:to-purple-500
                       text-white text-sm font-semibold
                       shadow-[0_4px_14px_rgba(102,126,234,0.28)]
                       hover:shadow-[0_6px_18px_rgba(102,126,234,0.38)]
                       transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> New Plan
          </Link>
        </div>
      </div>

      {/* Plans error */}
      {plansError && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300 mb-3">{plansError}</p>
              <button
                onClick={() => { setPlansError(''); loadUserPlans(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-white/[0.05] border border-white/[0.08]
                           text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {!statsError && stats && plans.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <StatCard icon={Calendar}    value={stats.activePlans}      label="Active Plans"  accentClass="text-blue-400"    />
          <StatCard icon={Flame}       value={stats.currentStreak}    label="Day Streak"    accentClass="text-orange-400"  />
          <StatCard icon={CheckCircle2}value={stats.tasksCompleted}   label="Completed"     accentClass="text-emerald-400" />
          <StatCard icon={Clock}       value={`${stats.totalStudyHours}h`} label="Study Hours" accentClass="text-violet-400" />
        </div>
      )}

      {/* Stats error */}
      {statsError && plans.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">{statsError}</p>
            </div>
            <button
              onClick={() => { setStatsError(''); loadUserStats(); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap flex-shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Search + sort + filter tabs */}
      {plans.length > 0 && (
        <div className="glass-card p-4 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
          <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by role or company…"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm text-white
                           bg-white/[0.04] border border-white/[0.08] placeholder-slate-600
                           focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-500/40
                           transition-all duration-150"
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative sort-dropdown sm:min-w-[160px]">
              <button
                type="button"
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium
                            bg-white/[0.04] border transition-all w-full justify-between
                            ${showSortMenu ? 'border-indigo-500/40 text-slate-200' : 'border-white/[0.07] text-slate-400 hover:border-white/[0.12] hover:text-slate-200'}`}
              >
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" /> {sortLabel}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-2 w-full
                                bg-[#0d1526]/98 border border-white/[0.08]
                                rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)]
                                z-20 overflow-hidden">
                  {sortOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-colors
                                  ${sortBy === opt.value
                                    ? 'bg-indigo-500/15 text-indigo-300'
                                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {filterTabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all duration-150 ${
                  filter === tab.value
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-[0_2px_10px_rgba(102,126,234,0.3)]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                {tab.label} <span className={`ml-1 ${filter === tab.value ? 'opacity-70' : 'opacity-40'}`}>({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming interviews alert */}
      {stats && stats.upcomingInterviews > 0 && (
        <div className="glass-card p-4 border-amber-500/20" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Upcoming Interviews</p>
              <p className="text-xs text-amber-400/80 leading-relaxed">
                You have {stats.upcomingInterviews} interview{stats.upcomingInterviews > 1 ? 's' : ''} scheduled. Stay consistent with your preparation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plans grid / empty state */}
      {filteredPlans.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                          flex items-center justify-center mx-auto mb-4">
            {searchQuery
              ? <Search className="w-5 h-5 text-slate-600" />
              : <Calendar className="w-5 h-5 text-slate-600" />}
          </div>
          <h3 className="text-sm font-bold text-slate-400 mb-2">
            {searchQuery
              ? 'No matching plans'
              : filter === 'all'
                ? 'No plans yet'
                : `No ${filter} plans`}
          </h3>
          <p className="text-xs text-slate-600 mb-6 max-w-xs mx-auto leading-relaxed">
            {searchQuery
              ? 'Try adjusting your search criteria'
              : filter === 'all'
                ? 'Create your first preparation plan to get started'
                : `You have no ${filter} plans at the moment`}
          </p>
          {filter === 'all' && !searchQuery && (
            <Link
              href="/planner/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                         bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-500 hover:to-purple-500
                         text-white text-sm font-semibold transition-all duration-150"
            >
              <Plus className="w-4 h-4" /> Create Plan
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map(plan => (
            <PlanCard key={plan.id} plan={plan} onUpdate={loadUserPlans} />
          ))}
        </div>
      )}

      {/* Feature overview — only shown when no plans exist */}
      {plans.length === 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-white mb-5 text-center">What you can do with Interview Planner</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: Target,      title: 'Custom Plans',      desc: 'AI-generated study schedules tailored to your interview timeline'     },
              { icon: CheckCircle2,title: 'Track Progress',    desc: 'Monitor completion and maintain study streaks'                        },
              { icon: Clock,       title: 'Time Management',   desc: 'Optimise preparation with structured daily tasks'                     },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.07] rounded-xl
                               flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">{title}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}