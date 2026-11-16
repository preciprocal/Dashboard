'use client';
import PageHeader from '@/components/PageHeader';
import { Video as HeaderIcon } from 'lucide-react';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import ErrorPage from '@/components/Error';
import InterviewLibrary from '@/components/interview/InterviewLibrary';
import { SeeExampleButton } from '@/components/ServiceModal';
import { Target, AlertCircle, RefreshCw, Plus, Mic, BarChart3, RotateCcw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────


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

function EmptyDashboard() {
  const points = [
    { icon: Mic, title: 'A voice interview panel', body: 'Questions for your role and level, asked out loud. You answer the way you would in the real one.' },
    { icon: BarChart3, title: 'Scored feedback', body: 'An overall score, a score per area, and an annotated transcript of what you said.' },
    { icon: RotateCcw, title: 'Retake and compare', body: 'Run the same interview again to see if your weakest area moved.' },
  ];
  return (
    <div className="glass-card p-6 sm:p-8">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 items-center">
        <div>
          <span className="w-11 h-11 rounded-xl bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] flex items-center justify-center"><Target className="w-5 h-5 text-[var(--text-2)]" /></span>
          <h3 className="font-display text-[20px] font-semibold tracking-[-0.02em] text-white mt-5">Practise before the real one</h3>
          <p className="text-[13.5px] text-[var(--text-3)] mt-2 leading-relaxed max-w-md">Pick a role, a level and an interview type. You get a mock interview with feedback you can act on.</p>
          <div className="flex flex-wrap items-center gap-2.5 mt-6">
            <Link href="/interview/create" className="btn-primary"><Plus className="w-4 h-4" /> Start your first interview</Link>
            <SeeExampleButton serviceId="interview" />
          </div>
        </div>
        <ul className="grid sm:grid-cols-3 gap-3">
          {points.map(p => (
            <li key={p.title} className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
              <p.icon className="w-4 h-4 text-[var(--text-3)]" />
              <p className="text-[13.5px] font-medium text-white mt-3">{p.title}</p>
              <p className="text-[12.5px] text-[var(--text-4)] mt-1 leading-relaxed">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading your interviews">
      <div className="glass-card grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 overflow-hidden">
        {[0, 1, 2, 3].map(i => <div key={i} className="px-5 py-4 space-y-2.5"><span className="block h-3 w-24 rounded prc-skeleton" /><span className="block h-7 w-16 rounded prc-skeleton" /><span className="block h-3 w-32 rounded prc-skeleton" /></div>)}
      </div>
      <div className="glass-card divide-y divide-white/[0.06]">
        {[0, 1, 2, 3].map(i => <div key={i} className="flex items-center gap-3.5 px-5 py-3.5"><span className="w-[42px] h-[42px] rounded-full prc-skeleton" /><span className="flex-1 space-y-2"><span className="block h-3.5 w-48 max-w-full rounded prc-skeleton" /><span className="block h-3 w-28 rounded prc-skeleton" /></span></div>)}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewsDashboard() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();

  const [interviews,        setInterviews]        = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [,                  setLoadingStep]       = useState(0);
  const [criticalError,  setCriticalError]  = useState<CriticalError | null>(null);
  const [interviewsError,setInterviewsError]= useState('');

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
        body: JSON.stringify({ interviews: withDates, userId: user.id }),
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
      setLoadingStep(5);
      setLoadingStep(6);

    } catch (err: unknown) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('fetch') || msg.includes('network')) {
        setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Check your internet connection and try again.', details: msg });
      } else {
        setInterviewsError('Failed to load interviews. Please try again.');
      }
    } finally {
      setLoadingInterviews(false);
    }
  }, [user]);

  useEffect(() => { if (user) loadInterviews(); }, [user, loadInterviews]);

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

  if (!loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-[17px] font-bold text-white mb-2">Sign in required</h2>
          <p className="text-[13px] text-slate-400 mb-6">Please sign in to view your interviews</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-[var(--primary)] text-[var(--on-primary)]
                       text-[13px] font-semibold hover:bg-[var(--primary-hover)]
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

      <PageHeader
        title="Interview Practice" description="Mock interviews with feedback, and what to practise next" icon={HeaderIcon}
        actions={<>
          <SeeExampleButton serviceId="interview" />
          <Link href="/interview/create" className="btn-primary"><Plus /> New Interview</Link>
        </>}
      />

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

      {loading || loadingInterviews ? (
        <LibrarySkeleton />
      ) : interviews.length > 0 ? (
        <InterviewLibrary interviews={interviews} />
      ) : !interviewsError ? (
        <EmptyDashboard />
      ) : null}
    </div>
  );
}