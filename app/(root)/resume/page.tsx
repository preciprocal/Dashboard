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
import { FileText, Upload, Zap, LayoutGrid, List, Filter, CheckCircle, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react';

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
    improvementTips: 0
  });

  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [resumesError, setResumesError] = useState<string>('');

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading resume files...', weight: 3 },
    { name: 'Analyzing feedback data...', weight: 2 },
    { name: 'Calculating statistics...', weight: 2 },
    { name: 'Organizing resumes...', weight: 1 },
    { name: 'Finalizing dashboard...', weight: 1 }
  ];

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (showFilterMenu && !target.closest('.filter-dropdown')) {
        setShowFilterMenu(false);
      }
    };

    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterMenu]);

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
      if (userResumes.length > 0) {
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

      setLoadingStep(4);
      await new Promise(resolve => setTimeout(resolve, 150));

      setLoadingStep(5);
      await new Promise(resolve => setTimeout(resolve, 150));
      
    } catch (err: unknown) {
      console.error('Error loading resumes:', err);
      const error = err instanceof Error ? err : new Error('Unknown error');
      
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

  const getFilterLabel = (option: SortOption): string => {
    switch (option) {
      case 'all':
        return `All (${getFilterCount('all')})`;
      case 'high-scores':
        return `High Scores (${getFilterCount('high-scores')})`;
      case 'needs-improvement':
        return `Needs Work (${getFilterCount('needs-improvement')})`;
      case 'recent':
        return `Recent (${getFilterCount('recent')})`;
      default:
        return 'All';
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
        <div className="glass-card-gradient hover-lift w-full max-w-md">
          <div className="glass-card-gradient-inner text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">Please log in to view your resumes</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Resume Analysis
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                AI-powered resume optimization
              </p>
            </div>
            
            <Link
              href="/resume/upload"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto justify-center"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Resume</span>
            </Link>
          </div>
        </div>
      </div>

      {resumesError && (
        <div className="glass-card-gradient hover-lift animate-fade-in-up">
          <div className="glass-card-gradient-inner p-4 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-400 text-xs sm:text-sm mb-2">{resumesError}</p>
                <button
                  onClick={() => {
                    setResumesError('');
                    loadResumes();
                  }}
                  className="glass-button hover-lift inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-white text-xs sm:text-sm font-medium rounded-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resumes.length > 0 ? (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="glass-card hover-lift">
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.totalResumes}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Total Resumes</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.averageScore}%</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Average Score</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.improvementTips}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Improvements</p>
              </div>
            </div>
          </div>

          <div className="glass-card">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Your Resumes</h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    {filteredResumes.length} of {resumes.length} resumes
                  </p>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="relative filter-dropdown flex-1 sm:flex-initial sm:min-w-[200px]">
                    <button
                      type="button"
                      onClick={() => setShowFilterMenu(!showFilterMenu)}
                      className="glass-input w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                        <span>{getFilterLabel(sortFilter)}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showFilterMenu && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('all');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'all' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          All ({getFilterCount('all')})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('high-scores');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'high-scores' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          High Scores ({getFilterCount('high-scores')})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('needs-improvement');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'needs-improvement' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          Needs Work ({getFilterCount('needs-improvement')})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSortFilter('recent');
                            setShowFilterMenu(false);
                          }}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors ${
                            sortFilter === 'recent' 
                              ? 'bg-blue-500/30 text-blue-300' 
                              : 'text-white hover:bg-white/5'
                          }`}
                        >
                          Recent ({getFilterCount('recent')})
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex bg-slate-900/50 rounded-lg p-1">
                    <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 sm:p-2 rounded transition-all ${
                        viewMode === 'grid' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button 
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 sm:p-2 rounded transition-all ${
                        viewMode === 'list' 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                      aria-label="List view"
                    >
                      <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {filteredResumes.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6" 
                : "space-y-3 sm:space-y-4"
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
            <div className="glass-card">
              <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  No resumes match this filter
                </h3>
                <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">
                  Try adjusting your filter or upload a new resume
                </p>
                <button
                  onClick={() => setSortFilter('all')}
                  className="text-xs sm:text-sm text-slate-300 hover:text-white underline"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !resumesError ? (
        <div className="glass-card">
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-6 sm:mb-8">
              <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 sm:mb-3">
              Welcome to Resume Analysis
            </h3>
            <p className="text-slate-400 mb-8 sm:mb-10 max-w-xl mx-auto text-sm sm:text-base">
              Get AI-powered insights, ATS optimization, and personalized recommendations to improve your resume
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">ATS Score</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">AI Analysis</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Track Progress</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Instant Feedback</p>
              </div>
            </div>

            <Link
              href="/resume/upload"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base"
            >
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Upload Resume</span>
            </Link>
            
            <p className="text-xs text-slate-500 mt-4 sm:mt-6">
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