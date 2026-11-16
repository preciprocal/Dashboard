'use client';
import PageHeader from '@/components/PageHeader';
import { Video as HeaderIcon } from 'lucide-react';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import InterviewLibrary from '@/components/interview/InterviewLibrary';
import { SeeExampleButton } from '@/components/ServiceModal';
import { Target, AlertCircle, RefreshCw, Plus } from 'lucide-react';

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
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.07] rounded-2xl
                      flex items-center justify-center mx-auto mb-6">
        <Target className="w-7 h-7 text-slate-500" />
      </div>
      <h3 className="text-[17px] font-bold text-white mb-2">Welcome to Interview Practice</h3>
      <p className="text-[13px] text-slate-400 max-w-md mx-auto mb-8 leading-relaxed">
        Get AI-powered mock interviews, personalised feedback, and track your progress to ace your next interview.
      </p>


      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/interview/create"
          className="btn-primary"
        >
          <Plus className="w-4 h-4" /> Start First Interview
        </Link>
        <SeeExampleButton
          serviceId="interview"
        />
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Choose from Technical, Behavioral, or System Design interviews
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterviewsDashboard() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();

  const [interviews,        setInterviews]        = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [loadingStep,       setLoadingStep]       = useState(0);
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

      {interviews.length > 0 ? (
        <InterviewLibrary interviews={interviews} />
      ) : !interviewsError ? (
        <EmptyDashboard />
      ) : null}
    </div>
  );
}