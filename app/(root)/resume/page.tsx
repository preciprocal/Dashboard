'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { doc, deleteDoc } from 'firebase/firestore';
import { FirebaseService } from '@/lib/services/firebase-service';
import ResumeCard from '@/components/resume/ResumeCard';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { Resume } from '@/types/resume';
import { toast } from 'sonner';

import {
  FileText, Upload, Zap, LayoutGrid, List, Filter, CheckCircle,
  AlertCircle, RefreshCw, ChevronDown,
} from 'lucide-react';
import { SeeExampleButton } from '@/components/ServiceModal';


type SortOption = 'all' | 'high-scores' | 'needs-improvement' | 'recent';
type ViewMode = 'grid' | 'list';

interface ResumeStats {
  averageScore: number;
  totalResumes: number;
  improvementTips: number;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

export default function ResumeDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sortFilter, setSortFilter] = useState<SortOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [stats, setStats] = useState<ResumeStats>({
    averageScore: 0,
    totalResumes: 0,
    improvementTips: 0,
  });
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [resumesError,  setResumesError]  = useState<string>('');
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...',    weight: 1 },
    { name: 'Loading resume files...',   weight: 3 },
    { name: 'Analyzing feedback data...', weight: 2 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Organizing resumes...',     weight: 1 },
    { name: 'Finalizing dashboard...',   weight: 1 },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showFilterMenu && !target.closest('.filter-dropdown')) {
        setShowFilterMenu(false);
      }
    };
    if (showFilterMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  const recalcStats = (list: Resume[]) => {
    const withFeedback = list.filter(r => r.feedback);
    if (withFeedback.length > 0) {
      const avgScore = withFeedback.reduce((s, r) =>
        s + (r.feedback?.overallScore || 0), 0) / withFeedback.length;

      const totalTips = withFeedback.reduce((s, r) => {
        if (!r.feedback) return s;
        const fd = r.feedback as unknown as Record<string, { tips?: Array<{ type: string }> }>;
        const tips = [
          ...(fd['ATS']?.tips         ?? fd['ats']?.tips         ?? []),
          ...(fd['content']?.tips     ?? []),
          ...(fd['structure']?.tips   ?? []),
          ...(fd['skills']?.tips      ?? []),
          ...(fd['toneAndStyle']?.tips ?? []),
        ];
        return s + tips.filter(t => t.type !== 'good').length;
      }, 0);

      setStats({ averageScore: Math.round(avgScore), totalResumes: list.length, improvementTips: totalTips });
    } else {
      setStats({ averageScore: 0, totalResumes: list.length, improvementTips: 0 });
    }
  };

  const loadResumes = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      setLoadingResumes(true);
      setResumesError('');
      setLoadingStep(0);

      setLoadingStep(1);
      const userResumes = await FirebaseService.getUserResumes(user.uid);
      setResumes(userResumes);

      setLoadingStep(2);
      await new Promise(resolve => setTimeout(resolve, 200));

      setLoadingStep(3);
      if (userResumes.length > 0) recalcStats(userResumes);

      setLoadingStep(4);
      await new Promise(resolve => setTimeout(resolve, 150));
      setLoadingStep(5);
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (err: unknown) {
      console.error('Error loading resumes:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (error.message.includes('Firebase') || error.message.includes('firestore')) {
        setCriticalError({ code: 'DATABASE', title: 'Database Connection Error', message: 'Unable to load your resumes. Please check your internet connection.', details: error.message });
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Unable to connect to the server. Please check your internet connection.', details: error.message });
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        setResumesError('You do not have permission to view resumes. Please contact support.');
      } else {
        setResumesError('Failed to load resumes. Please try again.');
      }
    } finally {
      setLoadingResumes(false);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) loadResumes();
  }, [user, loadResumes]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setResumesError('');
    if (user) loadResumes();
  };

  const handleDelete = useCallback(async (resumeId: string): Promise<void> => {
    setDeletingId(resumeId);
    try {
      await deleteDoc(doc(db, 'resumes', resumeId));
    } catch (err) {
      setDeletingId(null);
      toast.error('Failed to delete resume');
      throw err;
    }
    setTimeout(() => {
      setDeletingId(null);
      setResumes(prev => {
        const updated = prev.filter(r => r.id !== resumeId);
        recalcStats(updated);
        return updated;
      });
      toast.success('Resume deleted');
    }, 300);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredResumes = useMemo(() => {
    let filtered = [...resumes];
    switch (sortFilter) {
      case 'high-scores':
        filtered = filtered
          .filter(r => r.feedback && r.feedback.overallScore >= 90)
          .sort((a, b) => (b.feedback?.overallScore || 0) - (a.feedback?.overallScore || 0));
        break;
      case 'needs-improvement':
        filtered = filtered.filter(r => r.feedback && r.feedback.overallScore < 70);
        break;
      case 'recent':
      case 'all':
      default:
        filtered = filtered.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return filtered;
  }, [resumes, sortFilter]);

  const getFilterCount = (option: SortOption): number => {
    switch (option) {
      case 'high-scores':       return resumes.filter(r => r.feedback && r.feedback.overallScore >= 90).length;
      case 'needs-improvement': return resumes.filter(r => r.feedback && r.feedback.overallScore < 70).length;
      default:                  return resumes.length;
    }
  };

  const getFilterLabel = (option: SortOption): string => {
    switch (option) {
      case 'all':               return `All (${getFilterCount('all')})`;
      case 'high-scores':       return `High Scores (${getFilterCount('high-scores')})`;
      case 'needs-improvement': return `Needs Work (${getFilterCount('needs-improvement')})`;
      case 'recent':            return `Recent (${getFilterCount('recent')})`;
      default:                  return 'All';
    }
  };

  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        showBackButton={true}
        showHomeButton={true}
        showRefreshButton={true}
        onRetry={handleRetryError}
      />
    );
  }

  if (loading || loadingResumes) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your resumes..."
        showNavigation={true}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card p-10 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
          <p className="text-sm text-slate-500 mb-6">Please sign in to view your resumes</p>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold hover:from-indigo-400 hover:to-purple-400 transition-all duration-150"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">

      {/* Header */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Resume Analysis</h1>
            <p className="text-xs text-slate-500 mt-0.5">AI-powered resume optimization</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SeeExampleButton
              serviceId="resume"
              className="!px-4 !py-2.5 !text-sm !font-semibold"
            />
            <Link
              href="/resume/upload"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(139,92,246,0.35)] hover:shadow-[0_6px_18px_rgba(139,92,246,0.45)] transition-all duration-200"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Resume</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {resumesError && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 mb-3">{resumesError}</p>
              <button
                onClick={() => { setResumesError(''); loadResumes(); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {resumes.length > 0 ? (
        <div className="space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-2xl font-bold text-white tabular-nums">{stats.totalResumes}</span>
              </div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Total Resumes</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-2xl font-bold text-white tabular-nums">{stats.averageScore}%</span>
              </div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Average Score</p>
            </div>
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-2xl font-bold text-white tabular-nums">{stats.improvementTips}</span>
              </div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">Improvements</p>
            </div>
          </div>

          {/* Filter / view bar */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white">Your Resumes</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {filteredResumes.length} of {resumes.length} resumes
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative filter-dropdown">
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu(!showFilterMenu)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border transition-all min-w-[180px] justify-between ${showFilterMenu ? 'border-indigo-500/40 text-slate-200' : 'border-white/[0.07] text-slate-400 hover:border-white/[0.12] hover:text-slate-200'} text-xs font-medium`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5" />
                      {getFilterLabel(sortFilter)}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showFilterMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showFilterMenu && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[#0d1526]/98 border border-white/[0.08] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-20 overflow-hidden">
                      {(['all', 'high-scores', 'needs-improvement', 'recent'] as SortOption[]).map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => { setSortFilter(option); setShowFilterMenu(false); }}
                          className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                            sortFilter === option
                              ? 'bg-indigo-500/15 text-indigo-300'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                          }`}
                        >
                          {getFilterLabel(option)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-0.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-lg">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-all duration-150 ${viewMode === 'grid' ? 'bg-white/[0.10] text-white' : 'text-slate-600 hover:text-slate-300'}`}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-all duration-150 ${viewMode === 'list' ? 'bg-white/[0.10] text-white' : 'text-slate-600 hover:text-slate-300'}`}
                    aria-label="List view"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resume cards */}
          {filteredResumes.length > 0 ? (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
                : 'space-y-3'
            }>
              {filteredResumes.map((resume, index) => (
                <div
                  key={resume.id}
                  className="opacity-0 animate-fadeIn"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: 'forwards',
                    ...(deletingId === resume.id ? {
                      opacity: 0,
                      transform: 'scale(0.95)',
                      transition: 'opacity 300ms ease, transform 300ms ease',
                      pointerEvents: 'none',
                    } : {}),
                  }}
                >
                  <ResumeCard
                    resume={resume}
                    viewMode={viewMode}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-400 mb-2">No resumes match this filter</h3>
              <p className="text-xs text-slate-600 mb-5">Try adjusting your filter or upload a new resume</p>
              <button
                onClick={() => setSortFilter('all')}
                className="text-xs text-slate-400 hover:text-white underline transition-colors"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      ) : !resumesError ? (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-7 h-7 text-slate-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Welcome to Resume Analysis</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
            Get AI-powered insights, ATS optimization, and personalized recommendations to improve your resume
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 max-w-3xl mx-auto">
            {[
              { icon: CheckCircle, color: 'blue',    label: 'ATS Score' },
              { icon: Zap,         color: 'purple',  label: 'AI Analysis' },
              { icon: CheckCircle, color: 'emerald', label: 'Track Progress' },
              { icon: Zap,         color: 'amber',   label: 'Instant Feedback' },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="text-center">
                <div className={`w-10 h-10 bg-${color}-500/10 rounded-lg flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-5 h-5 text-${color}-400`} />
                </div>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/resume/upload"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-sm font-semibold shadow-[0_4px_14px_rgba(139,92,246,0.35)] hover:shadow-[0_6px_18px_rgba(139,92,246,0.45)] transition-all duration-200"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Resume</span>
            </Link>
            <SeeExampleButton
              serviceId="resume"
              className="!px-5 !py-2.5 !text-sm !font-semibold"
            />
          </div>
          <p className="text-xs text-slate-600 mt-4">Supports PDF, DOC, and DOCX formats</p>
        </div>
      ) : null}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      ` }} />
    </div>
  );
}