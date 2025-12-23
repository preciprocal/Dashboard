'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import ResumeCard from '@/components/resume/ResumeCard';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { Resume } from '@/types/resume';
import { FileText, Upload, Zap, LayoutGrid, List, Filter, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

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
  const [stats, setStats] = useState<ResumeStats>({
    averageScore: 0,
    totalResumes: 0,
    improvementTips: 0
  });

  // Error states
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [resumesError, setResumesError] = useState<string>('');

  // Define loading steps
  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading resume files...', weight: 3 },
    { name: 'Analyzing feedback data...', weight: 2 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Organizing resumes...', weight: 1 },
    { name: 'Finalizing dashboard...', weight: 1 }
  ];

  const loadResumes = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoadingResumes(true);
      setResumesError('');
      setLoadingStep(0); // Authenticating
      
      // Step 1: Loading resume files
      setLoadingStep(1);
      const userResumes = await FirebaseService.getUserResumes(user.uid);
      setResumes(userResumes);
      
      // Step 2: Analyzing feedback data
      setLoadingStep(2);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Step 3: Calculating statistics
      setLoadingStep(3);
      if (userResumes.length > 0) {
        // Filter resumes that have feedback
        const resumesWithFeedback = userResumes.filter(resume => resume.feedback);
        
        if (resumesWithFeedback.length > 0) {
          const avgScore = resumesWithFeedback.reduce((sum, resume) => {
            return sum + (resume.feedback?.overallScore || 0);
          }, 0) / resumesWithFeedback.length;
          
          const totalTips = resumesWithFeedback.reduce((sum, resume) => {
            if (!resume.feedback) return sum;
            
            const tips = [
              ...(resume.feedback.ats?.tips || []),
              ...(resume.feedback.content?.tips || []),
              ...(resume.feedback.structure?.tips || []),
              ...(resume.feedback.skills?.tips || []),
            ];
            
            return sum + tips.filter(tip => tip.type !== 'good').length;
          }, 0);
          
          setStats({
            averageScore: Math.round(avgScore),
            totalResumes: userResumes.length,
            improvementTips: totalTips
          });
        } else {
          setStats({
            averageScore: 0,
            totalResumes: userResumes.length,
            improvementTips: 0
          });
        }
      }

      // Step 4: Organizing resumes
      setLoadingStep(4);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Step 5: Finalizing
      setLoadingStep(5);
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (err: unknown) {
      console.error('Error loading resumes:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      
      // Check for critical errors
      if (error.message.includes('Firebase') || error.message.includes('firestore')) {
        setCriticalError({
          code: 'DATABASE',
          title: 'Database Connection Error',
          message: 'Unable to load your resumes. Please check your internet connection.',
          details: error.message
        });
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        setCriticalError({
          code: 'NETWORK',
          title: 'Network Error',
          message: 'Unable to connect to the server. Please check your internet connection.',
          details: error.message
        });
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
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      loadResumes();
    }
  }, [user, loadResumes]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setResumesError('');
    if (user) {
      loadResumes();
    }
  };

  const filteredResumes = useMemo(() => {
    let filtered = [...resumes];

    switch (sortFilter) {
      case 'high-scores':
        filtered = filtered
          .filter(resume => resume.feedback && resume.feedback.overallScore >= 90)
          .sort((a, b) => (b.feedback?.overallScore || 0) - (a.feedback?.overallScore || 0));
        break;
      case 'needs-improvement':
        filtered = filtered.filter(resume => resume.feedback && resume.feedback.overallScore < 70);
        break;
      case 'recent':
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'all':
      default:
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return filtered;
  }, [resumes, sortFilter]);

  const getFilterCount = (option: SortOption): number => {
    switch (option) {
      case 'high-scores':
        return resumes.filter(resume => resume.feedback && resume.feedback.overallScore >= 90).length;
      case 'needs-improvement':
        return resumes.filter(resume => resume.feedback && resume.feedback.overallScore < 70).length;
      case 'recent':
      case 'all':
      default:
        return resumes.length;
    }
  };

  // Show critical error page
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

  // Show loader during initial auth check or resume loading
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

  // Show auth required message
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner text-center p-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-6">Please log in to view your resumes</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-xl"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Clean Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-1">
                Resume Analysis
              </h1>
              <p className="text-slate-400 text-sm">
                AI-powered resume optimization
              </p>
            </div>
            
            <Link
              href="/resume/upload"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-4 py-2.5 rounded-lg"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Resume</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Resumes Error Message */}
      {resumesError && (
        <div className="glass-card-gradient hover-lift animate-fade-in-up">
          <div className="glass-card-gradient-inner">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-400 text-sm mb-2">{resumesError}</p>
                <button
                  onClick={() => {
                    setResumesError('');
                    loadResumes();
                  }}
                  className="glass-button hover-lift inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {resumes.length > 0 ? (
        <div className="space-y-6">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.totalResumes}</span>
                </div>
                <p className="text-sm text-slate-400">Total Resumes</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.averageScore}%</span>
                </div>
                <p className="text-sm text-slate-400">Average Score</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="text-2xl font-semibold text-white">{stats.improvementTips}</span>
                </div>
                <p className="text-sm text-slate-400">Improvements</p>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="glass-card">
            <div className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Your Resumes</h2>
                  <p className="text-slate-400 text-sm mt-0.5">
                    {filteredResumes.length} of {resumes.length} resumes
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Filter Dropdown */}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <select 
                      value={sortFilter} 
                      onChange={(e) => setSortFilter(e.target.value as SortOption)}
                      className="glass-input pl-10 pr-4 py-2.5 rounded-lg text-white text-sm appearance-none cursor-pointer min-w-[200px]"
                    >
                      <option value="all">All ({getFilterCount('all')})</option>
                      <option value="high-scores">High Scores ({getFilterCount('high-scores')})</option>
                      <option value="needs-improvement">Needs Work ({getFilterCount('needs-improvement')})</option>
                      <option value="recent">Recent ({getFilterCount('recent')})</option>
                    </select>
                  </div>
                  
                  {/* View Toggle */}
                  <div className="flex bg-slate-900/50 rounded-lg p-1">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded transition-all ${
                        viewMode === 'list' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="List view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Resume Grid/List */}
          {filteredResumes.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
                : "space-y-4"
            }>
              {filteredResumes.map((resume, index) => (
                <div
                  key={`resume-${resume.id}-${index}`}
                  className="opacity-0 animate-fadeIn"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <ResumeCard resume={resume} viewMode={viewMode} />
                </div>
              ))}
            </div>
          ) : (
            /* No Results State */
            <div className="glass-card">
              <div className="text-center py-16 px-6">
                <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No resumes match this filter
                </h3>
                <p className="text-slate-400 mb-6">
                  Try adjusting your filter or upload a new resume
                </p>
                <button
                  onClick={() => setSortFilter('all')}
                  className="text-sm text-slate-300 hover:text-white underline"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !resumesError ? (
        /* Empty State */
        <div className="glass-card">
          <div className="text-center py-16 px-6">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-8">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            
            <h3 className="text-2xl font-semibold text-white mb-3">
              Welcome to Resume Analysis
            </h3>
            <p className="text-slate-400 mb-10 max-w-xl mx-auto">
              Get AI-powered insights, ATS optimization, and personalized recommendations to improve your resume
            </p>

            {/* Feature Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm text-slate-400">ATS Score</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-sm text-slate-400">AI Analysis</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm text-slate-400">Track Progress</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-amber-400" />
                </div>
                <p className="text-sm text-slate-400">Instant Feedback</p>
              </div>
            </div>

            <Link
              href="/resume/upload"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Resume</span>
            </Link>
            
            <p className="text-xs text-slate-500 mt-6">
              Supports PDF, DOC, and DOCX formats
            </p>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}