// app/planner/page.tsx
'use client';
import PageHeader from '@/components/PageHeader';
import { Calendar as HeaderIcon } from 'lucide-react';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { PlannerService } from '@/lib/services/planner-services';
import { InterviewPlan, PlanStats } from '@/types/planner';
import Link from 'next/link';
import { Plus, Calendar, Target, Clock, CheckCircle2, AlertCircle, RefreshCw, Search, Filter, ChevronDown } from 'lucide-react';
import PlanCard from '@/components/planner/PlanCard';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { SeeExampleButton } from '@/components/ServiceModal';
import InfoTip from '@/components/ui/info-tip';

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

export default function PlannerPage() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();

  const [plans, setPlans] = useState<InterviewPlan[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'name'>('date');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [plansError, setPlansError] = useState('');
  const [statsError, setStatsError] = useState('');

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating…', weight: 1 },
    { name: 'Loading preparation plans…', weight: 3 },
    { name: 'Calculating statistics…', weight: 2 },
    { name: 'Organising data…', weight: 1 },
    { name: 'Ready!', weight: 1 },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showSortMenu && !(e.target as HTMLElement).closest('.sort-dropdown'))
        setShowSortMenu(false);
    };
    if (showSortMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  // Returns the list so stats can be computed from it without fetching it a
  // second time.
  const loadUserPlans = useCallback(async (): Promise<InterviewPlan[] | undefined> => {
    if (!user) return;
    try {
      setLoadingPlans(true); setPlansError(''); setLoadingStep(1);
      const userPlans = await PlannerService.getUserPlans(user.id);
      setPlans(userPlans);
      setLoadingStep(3);
      return userPlans;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('fetch') || msg.includes('network')) {
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

  const loadUserStats = useCallback(async (plansAlreadyFetched?: InterviewPlan[]) => {
    if (!user) return;
    try {
      setStatsError(''); setLoadingStep(2);
      const userStats = await PlannerService.getUserPlanStats(user.id, plansAlreadyFetched);
      setStats(userStats);
    } catch {
      setStatsError('Failed to load statistics');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) { router.push('/sign-in'); return; }
    if (user) {
      (async () => {
        const fetched = await loadUserPlans();
        await loadUserStats(fetched);
        setLoadingStep(4);
      })();
    }
  }, [user, loading, router, loadUserPlans, loadUserStats]);

  const handleRetry = () => {
    setCriticalError(null); setPlansError(''); setStatsError('');
    if (user) loadUserPlans().then(fetched => loadUserStats(fetched));
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
      if (sortBy === 'name') return a.role.localeCompare(b.role);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const sortLabel = { date: 'Latest First', progress: 'By Progress', name: 'Alphabetical' }[sortBy];
  const sortOptions: { value: typeof sortBy; label: string }[] = [
    { value: 'date', label: 'Latest First' },
    { value: 'progress', label: 'By Progress' },
    { value: 'name', label: 'Alphabetical' },
  ];
  const filterTabs: { value: typeof filter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: plans.length },
    { value: 'active', label: 'Active', count: plans.filter(p => p.status === 'active').length },
    { value: 'completed', label: 'Completed', count: plans.filter(p => p.status === 'completed').length },
  ];

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
          <p className="text-sm text-slate-400 mb-6">Please sign in to access your preparation plans</p>
          <Link href="/sign-in"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-150">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  // Figures from the plans themselves.
  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const allTasks = plans.flatMap(p => [...p.dailyPlans.flatMap(d => d.tasks ?? []), ...(p.customTasks ?? [])]);
  const doneThisWeek = allTasks.filter(t => t.status === 'done' && t.completedAt && Date.parse(t.completedAt) >= weekAgo).length;
  const nextInterview = plans
    .filter(p => p.status === 'active' && Date.parse(p.interviewDate) > now)
    .sort((a, b) => Date.parse(a.interviewDate) - Date.parse(b.interviewDate))[0];
  const nextDays = nextInterview ? Math.ceil((Date.parse(nextInterview.interviewDate) - now) / 86_400_000) : null;

  return (
    <div className="space-y-5 pt-4">

      <PageHeader
        title="Preparation Planner" description="Day-by-day study plans for your interviews" icon={HeaderIcon}
        actions={<>
          <SeeExampleButton serviceId="planner" />
          <Link href="/planner/create" className="btn-primary"><Plus /> New plan</Link>
        </>}
      />

      {/* Plans error */}
      {plansError && (
        <div className="glass-card p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-[13px] text-rose-200 mb-3">{plansError}</p>
            <button onClick={() => { setPlansError(''); loadUserPlans(); }} className="btn-secondary !h-8 !text-[12.5px]"><RefreshCw className="w-3.5 h-3.5" /> Try again</button>
          </div>
        </div>
      )}

      {/* KPIs */}
      {plans.length > 0 && (
        <div className="glass-card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
          <Kpi i={0} label="Next interview" tip="The earliest interview date among your active plans that is still ahead."
            value={nextDays === null ? '-' : nextDays === 0 ? 'Today' : nextDays === 1 ? 'Tomorrow' : <>{nextDays}<span className="text-[14px] text-[var(--text-4)] font-normal"> days</span></>}
            sub={nextInterview ? `${nextInterview.role}${nextInterview.company ? ` at ${nextInterview.company}` : ''}` : 'No upcoming interview in an active plan'}
            href={nextInterview ? `/planner/${nextInterview.id}` : undefined} tone={nextDays !== null && nextDays <= 3 ? 'text-amber-300' : undefined} />
          <Kpi i={1} label="Done this week" tip="Tasks you marked done in the last 7 days, across all your plans."
            value={doneThisWeek} sub={`${stats?.tasksCompleted ?? allTasks.filter(t => t.status === 'done').length} done in total`} />
          <Kpi i={2} label="Day streak" tip="Consecutive days with at least one task done, from your most recently active plan. It resets after a day without activity."
            value={statsError ? '-' : stats?.currentStreak ?? 0} sub={stats?.longestStreak ? `Best ${stats.longestStreak} days` : 'Finish a task today to start one'} tone={stats?.currentStreak ? 'text-orange-300' : undefined} />
          <Kpi i={3} label="Active plans" tip="Plans you have not completed or archived."
            value={stats?.activePlans ?? plans.filter(p => p.status === 'active').length} sub={`${plans.filter(p => p.status === 'completed').length} completed`} />
        </div>
      )}

      {/* Stats error */}
      {statsError && plans.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-1 text-[12.5px]">
          <span className="flex items-center gap-2 text-amber-300"><AlertCircle className="w-4 h-4" />{statsError}</span>
          <button onClick={() => { setStatsError(''); loadUserStats(); }} className="text-[var(--text-3)] hover:text-white">Retry</button>
        </div>
      )}

      {/* Search, filter, sort */}
      {plans.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-4)] pointer-events-none" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by role or company" className="field !pl-10" />
          </div>
          <div role="radiogroup" aria-label="Status" className="flex p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06] self-start md:self-auto">
            {filterTabs.map(tab => (
              <button key={tab.value} role="radio" aria-checked={filter === tab.value} onClick={() => setFilter(tab.value)}
                className={`h-8 px-3.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-colors ${filter === tab.value ? 'bg-white/[0.1] text-white' : 'text-[var(--text-3)] hover:text-white'}`}>
                {tab.label} <span className="tabular-nums opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="relative sort-dropdown">
            <button type="button" onClick={() => setShowSortMenu(!showSortMenu)} aria-expanded={showSortMenu} className="btn-secondary !h-9 !text-[12.5px] w-full md:w-auto justify-between">
              <span className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> {sortLabel}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-44 z-20 rounded-xl bg-[var(--bg-raised)] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75)]">
                {sortOptions.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                    className={`w-full px-3 h-9 rounded-lg text-left text-[12.5px] transition-colors ${sortBy === opt.value ? 'bg-white/[0.06] text-white' : 'text-[var(--text-2)] hover:bg-white/[0.05] hover:text-white'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plans */}
      {filteredPlans.length === 0 ? (
        plans.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.1] p-10 text-center">
            <Search className="w-5 h-5 text-[var(--text-5)] mx-auto" />
            <p className="text-[14px] text-white mt-3">{searchQuery ? 'No matching plans' : `No ${filter} plans`}</p>
            <p className="text-[12.5px] text-[var(--text-3)] mt-1">{searchQuery ? 'Try a different role or company.' : 'Change the filter to see your other plans.'}</p>
          </div>
        ) : (
          <div className="glass-card p-8 sm:p-10">
            <div className="max-w-xl">
              <span className="w-11 h-11 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center"><Calendar className="w-5 h-5 text-[var(--accent)]" /></span>
              <h3 className="text-[18px] font-semibold text-white mt-4">Plan your prep, day by day</h3>
              <p className="text-[13.5px] text-[var(--text-3)] mt-1.5 leading-relaxed">Tell us the role, company and interview date. You get a schedule of topics, practice tasks and behavioral questions for each day, and you tick tasks off as you go.</p>
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-3">
                {[
                  { icon: Target, text: 'A plan sized to your timeline' },
                  { icon: CheckCircle2, text: 'Progress and a daily streak' },
                  { icon: Clock, text: 'Tasks with time estimates' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2.5 rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.05] px-3 py-2.5 text-[12.5px] text-[var(--text-2)]"><Icon className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />{text}</li>
                ))}
              </ul>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/planner/create" className="btn-primary"><Plus className="w-4 h-4" /> Create a plan</Link>
                <SeeExampleButton serviceId="planner" />
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="glass-card overflow-hidden divide-y divide-white/[0.06]">
          <div className="hidden md:grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_150px_40px] gap-5 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">
            <span>Plan</span><span>Progress</span><span>Interview</span><span />
          </div>
          {filteredPlans.map(plan => (
            <PlanCard key={plan.id} plan={plan} onUpdate={loadUserPlans} />
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ i, label, tip, value, sub, href, tone }: { i: number; label: string; tip: string; value: React.ReactNode; sub: string; href?: string; tone?: string }) {
  const edge = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-l border-t lg:border-t-0'][i];
  const inner = (
    <>
      <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">{label}<InfoTip title={label} body={tip} /></p>
      <p className={`font-display text-[26px] font-semibold tracking-[-0.02em] tabular-nums mt-1.5 ${tone ?? 'text-white'}`}>{value}</p>
      <p className="text-[12px] text-[var(--text-4)] mt-0.5 truncate">{sub}</p>
    </>
  );
  const cls = `block px-5 py-4 border-[var(--border)] ${edge}`;
  return href ? <Link href={href} className={`${cls} hover:bg-white/[0.02] transition-colors`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
