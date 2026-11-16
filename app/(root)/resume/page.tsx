'use client';
import PageHeader from '@/components/PageHeader';
import FeatureEmpty from '@/components/ui/feature-empty';
import { FileText as HeaderIcon, Sparkles } from 'lucide-react';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { ResumeService } from '@/lib/services/resume-service';
import ResumeLibrary from '@/components/resume/ResumeLibrary';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { Resume } from '@/types/resume';
import { toast } from 'sonner';

import { FileText, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { SeeExampleButton } from '@/components/ServiceModal';

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

export default function ResumeDashboard() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [resumesError, setResumesError] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Prevent re-fetching on every render cycle
  const hasFetched = useRef(false);

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading resume files...', weight: 3 },
    { name: 'Analyzing feedback data...', weight: 2 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Organizing resumes...', weight: 1 },
    { name: 'Finalizing dashboard...', weight: 1 },
  ];

  const loadResumes = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!user) return;
    if (hasFetched.current && !forceRefresh) return;

    try {
      setLoadingResumes(true);
      setResumesError('');
      setLoadingStep(0);

      setLoadingStep(1);
      const userResumes = await ResumeService.getUserResumes(user.id);
      setResumes(userResumes);

      setLoadingStep(2);

      setLoadingStep(3);

      setLoadingStep(4);
      setLoadingStep(5);

      hasFetched.current = true;
    } catch (err: unknown) {
      console.error('Error loading resumes:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (error.message.includes('fetch') || error.message.includes('network')) {
        setCriticalError({ code: 'NETWORK', title: 'Network Error', message: 'Unable to connect to the server. Please check your internet connection.', details: error.message });
      } else if (error.message.includes('permission') || error.message.includes('denied')) {
        setResumesError('You do not have permission to view resumes. Please contact support.');
      } else {
        setResumesError('Failed to load resumes. Please try again.');
      }
    } finally {
      setLoadingResumes(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [loading, user, router]);

  // Load once when user is available
  useEffect(() => {
    if (user && !hasFetched.current) loadResumes();
  }, [user, loadResumes]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setResumesError('');
    hasFetched.current = false;
    loadResumes(true);
  };

  const handleDelete = useCallback(async (resumeId: string): Promise<void> => {
    setDeletingId(resumeId);
    try {
      const res = await fetch('/api/resume/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ resumeId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(err.error || `Delete failed (${res.status})`);
      }
    } catch (err) {
      setDeletingId(null);
      toast.error(err instanceof Error ? err.message : 'Failed to delete resume');
      throw err;
    }

    // Animate out, then update local state only - no refetch
    setTimeout(() => {
      setDeletingId(null);
      setResumes(prev => prev.filter(r => r.id !== resumeId));
      toast.success('Resume deleted');
    }, 300);
  }, []);

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
          <p className="text-sm text-slate-400 mb-6">Please sign in to view your resumes</p>
          <Link href="/sign-in" className="inline-flex items-center justify-center gap-2 w-full px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-sm font-semibold hover:bg-[var(--primary-hover)] transition-all duration-150">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">

      <PageHeader
        title="Resumes" description="Every resume you uploaded, how it scores, and which one gets interviews" icon={HeaderIcon}
        actions={<>
          <SeeExampleButton serviceId="resume" />
          <Link href="/resume/upload" className="btn-primary"><Upload /> Upload Resume</Link>
        </>}
      />

      {/* Error banner */}
      {resumesError && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-red-300 mb-3">{resumesError}</p>
              <button onClick={handleRetryError} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-medium text-slate-300 hover:text-white transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {resumes.length > 0 ? (
        <div className="space-y-4">

          <ResumeLibrary resumes={resumes} onDelete={handleDelete} deletingId={deletingId} />
        </div>
      ) : !resumesError ? (
        <FeatureEmpty icon={FileText} title="See how your resume reads"
          body="Upload your resume to get an ATS score, line by line fixes and a check against the jobs you want."
          primary={{ href: '/resume/upload', label: 'Upload resume', icon: Upload }}
          secondary={<SeeExampleButton serviceId="resume" />}
          note="PDF, DOC or DOCX."
          steps={[
            { icon: Upload, title: 'Upload it', text: 'Your file stays private to your account.' },
            { icon: FileText, title: 'Read the analysis', text: 'An ATS score with the fixes that matter most.' },
            { icon: Sparkles, title: 'Improve it', text: 'Rewrite lines in the Writer and compare against a job description.' },
          ]} />
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