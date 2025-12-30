'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import ProfileInterviewCard from '@/components/ProfileInterviewCard';
import { 
  Target, 
  TrendingUp, 
  Zap, 
  LayoutGrid, 
  List, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Award,
  Clock,
  Brain,
  Plus
} from 'lucide-react';

type SortOption = 'all' | 'high-scores' | 'needs-improvement' | 'recent' | 'technical' | 'behavioral';
type ViewMode = 'grid' | 'list';

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

interface InterviewQuestion {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

interface Interview {
  id: string;
  userId: string;
  role: string;
  type: "technical" | "behavioral" | "system-design" | "coding";
  techstack: string[];
  company: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  score?: number;
  status: "completed" | "in-progress" | "scheduled";
  feedback?: InterviewFeedback;
  questions?: InterviewQuestion[];
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

export default function InterviewsDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState<boolean>(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [sortFilter, setSortFilter] = useState<SortOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stats, setStats] = useState<InterviewStats>({
    averageScore: 0,
    totalInterviews: 0,
    totalHours: 0,
    completionRate: 0
  });

  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [interviewsError, setInterviewsError] = useState<string>('');

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Loading interview history...', weight: 2 },
    { name: 'Converting data formats...', weight: 1 },
    { name: 'Fetching feedback data...', weight: 3 },
    { name: 'Calculating performance metrics...', weight: 2 },
    { name: 'Organizing interviews...', weight: 1 },
    { name: 'Finalizing dashboard...', weight: 1 }
  ];

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [loading, user, router]);

  const loadInterviews = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoadingInterviews(true);
      setInterviewsError('');
      setLoadingStep(0);
      
      setLoadingStep(1);
      const { getInterviewsByUserId, getFeedbackByInterviewId } = await import('@/lib/actions/general.action');
      
      const userInterviews = await getInterviewsByUserId(user.uid);
      
      if (!userInterviews || userInterviews.length === 0) {
        setInterviews([]);
        setLoadingStep(6);
        await new Promise(resolve => setTimeout(resolve, 200));
        setLoadingInterviews(false);
        return;
      }

      setLoadingStep(2);
      const interviewsWithDates: Interview[] = userInterviews.map((interview) => {
        let createdAt: Date;
        let updatedAt: Date;

        if (interview.createdAt instanceof Date) {
          createdAt = interview.createdAt;
        } else if (typeof interview.createdAt === 'string') {
          createdAt = new Date(interview.createdAt);
        } else if (interview.createdAt && typeof interview.createdAt === 'object' && 'toDate' in interview.createdAt) {
          createdAt = (interview.createdAt as { toDate: () => Date }).toDate();
        } else {
          createdAt = new Date();
        }

        if (interview.updatedAt instanceof Date) {
          updatedAt = interview.updatedAt;
        } else if (typeof interview.updatedAt === 'string') {
          updatedAt = new Date(interview.updatedAt);
        } else if (interview.updatedAt && typeof interview.updatedAt === 'object' && 'toDate' in interview.updatedAt) {
          updatedAt = (interview.updatedAt as { toDate: () => Date }).toDate();
        } else {
          updatedAt = createdAt;
        }

        return {
          id: interview.id,
          userId: interview.userId,
          role: interview.role,
          type: interview.type,
          techstack: interview.techstack,
          company: interview.company,
          position: interview.position,
          createdAt,
          updatedAt,
          duration: interview.duration,
          score: interview.score,
          status: interview.status,
        };
      });

      setLoadingStep(3);
      const interviewsWithFeedback: Interview[] = await Promise.all(
        interviewsWithDates.map(async (interview) => {
          try {
            const feedback = await getFeedbackByInterviewId({
              interviewId: interview.id,
              userId: user.uid,
            });

            if (feedback) {
              return {
                ...interview,
                feedback: {
                  strengths: feedback.strengths || [],
                  weaknesses: feedback.areasForImprovement || [],
                  overallRating: feedback.totalScore || 0,
                  technicalAccuracy: feedback.technicalAccuracy || 0,
                  communication: feedback.communication || 0,
                  problemSolving: feedback.problemSolving || 0,
                  confidence: feedback.confidence || 0,
                  totalScore: feedback.totalScore,
                  finalAssessment: feedback.finalAssessment,
                  categoryScores: feedback.categoryScores,
                  areasForImprovement: feedback.areasForImprovement || [],
                },
                score: feedback.totalScore || 0,
              };
            }
            return interview;
          } catch (error) {
            console.error('Error fetching feedback for interview:', interview.id, error);
            return interview;
          }
        })
      );

      setInterviews(interviewsWithFeedback);
      
      setLoadingStep(4);
      if (interviewsWithFeedback.length > 0) {
        const completedInterviews = interviewsWithFeedback.filter(
          (i) => i.feedback && i.score && i.score > 0
        );
        
        const avgScore = completedInterviews.length > 0
          ? Math.round(
              completedInterviews.reduce((sum, i) => sum + (i.score || 0), 0) /
              completedInterviews.length
            )
          : 0;
        
        const totalHours = Math.round(interviewsWithFeedback.length * 0.75);
        const completionRate = Math.round((completedInterviews.length / interviewsWithFeedback.length) * 100);
        
        setStats({
          averageScore: avgScore,
          totalInterviews: interviewsWithFeedback.length,
          totalHours,
          completionRate
        });
      }

      setLoadingStep(5);
      await new Promise(resolve => setTimeout(resolve, 150));

      setLoadingStep(6);
      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (err: unknown) {
      console.error('Error loading interviews:', err);
      const error = err as Error;
      
      if (error.message.includes('Firebase') || error.message.includes('firestore')) {
        setCriticalError({
          code: 'DATABASE',
          title: 'Database Connection Error',
          message: 'Unable to load your interviews. Please check your internet connection.',
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
        setInterviewsError('You do not have permission to view interviews. Please contact support.');
      } else {
        setInterviewsError('Failed to load interviews. Please try again.');
      }
    } finally {
      setLoadingInterviews(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadInterviews();
    }
  }, [user, loadInterviews]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setInterviewsError('');
    if (user) {
      loadInterviews();
    }
  };

  const filteredInterviews = useMemo(() => {
    let filtered = [...interviews];

    switch (sortFilter) {
      case 'high-scores':
        filtered = filtered
          .filter(interview => (interview.score || 0) >= 80)
          .sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case 'needs-improvement':
        filtered = filtered.filter(interview => (interview.score || 0) < 70);
        break;
      case 'technical':
        filtered = filtered.filter(interview => 
          interview.type === 'technical' || interview.type === 'coding' || interview.type === 'system-design'
        );
        break;
      case 'behavioral':
        filtered = filtered.filter(interview => interview.type === 'behavioral');
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
  }, [interviews, sortFilter]);

  const getFilterCount = (filterOption: SortOption): number => {
    switch (filterOption) {
      case 'high-scores':
        return interviews.filter(interview => (interview.score || 0) >= 80).length;
      case 'needs-improvement':
        return interviews.filter(interview => (interview.score || 0) < 70).length;
      case 'technical':
        return interviews.filter(interview => 
          interview.type === 'technical' || interview.type === 'coding' || interview.type === 'system-design'
        ).length;
      case 'behavioral':
        return interviews.filter(interview => interview.type === 'behavioral').length;
      case 'recent':
      case 'all':
      default:
        return interviews.length;
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

  if (loading || loadingInterviews) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Loading your interviews..."
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
            <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">Please log in to view your interviews</p>
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
      {/* Clean Header - Responsive */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Interview Practice
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm">
                AI-powered interview preparation
              </p>
            </div>
            
            <Link
              href="/interview/create"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>New Interview</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Interviews Error Message */}
      {interviewsError && (
        <div className="glass-card-gradient hover-lift animate-fade-in-up">
          <div className="glass-card-gradient-inner p-4 sm:p-5">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-400 text-xs sm:text-sm mb-2">{interviewsError}</p>
                <button
                  onClick={() => {
                    setInterviewsError('');
                    loadInterviews();
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

      {/* Main Content */}
      {interviews.length > 0 ? (
        <div className="space-y-4 sm:space-y-6">
          
          {/* Stats Cards - Responsive */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.totalInterviews}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Total Interviews</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.averageScore}%</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Average Score</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.totalHours}h</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Practice Time</p>
              </div>
            </div>

            <div className="glass-card hover-lift">
              <div className="p-3.5 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                  </div>
                  <span className="text-xl sm:text-2xl font-semibold text-white">{stats.completionRate}%</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Completion Rate</p>
              </div>
            </div>
          </div>

          {/* Controls Bar - Responsive */}
          <div className="glass-card">
            <div className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white">Your Interviews</h2>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    {filteredInterviews.length} of {interviews.length} interviews
                  </p>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Filter Dropdown - Responsive */}
                  <div className="relative flex-1 sm:flex-initial">
                    <Filter className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 pointer-events-none" />
                    <select 
                      value={sortFilter} 
                      onChange={(e) => setSortFilter(e.target.value as SortOption)}
                      className="glass-input pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 rounded-lg text-white text-xs sm:text-sm appearance-none cursor-pointer w-full sm:min-w-[200px]"
                    >
                      <option value="all">All ({getFilterCount('all')})</option>
                      <option value="high-scores">High Scores ({getFilterCount('high-scores')})</option>
                      <option value="needs-improvement">Needs Work ({getFilterCount('needs-improvement')})</option>
                      <option value="technical">Technical ({getFilterCount('technical')})</option>
                      <option value="behavioral">Behavioral ({getFilterCount('behavioral')})</option>
                      <option value="recent">Recent ({getFilterCount('recent')})</option>
                    </select>
                  </div>
                  
                  {/* View Toggle */}
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
          
          {/* Interview Grid/List - Responsive */}
          {filteredInterviews.length > 0 ? (
            <div className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6" 
                : "space-y-3 sm:space-y-4"
            }>
              {filteredInterviews.map((interview, index) => (
                <div
                  key={`interview-${interview.id}-${index}`}
                  className="opacity-0 animate-fadeIn"
                  style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <ProfileInterviewCard interview={interview} />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card">
              <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Target className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  No interviews match this filter
                </h3>
                <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">
                  Try adjusting your filter or start a new interview
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
      ) : !interviewsError ? (
        <div className="glass-card">
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-6 sm:mb-8">
              <Target className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 sm:mb-3">
              Welcome to Interview Practice
            </h3>
            <p className="text-slate-400 mb-8 sm:mb-10 max-w-xl mx-auto text-sm sm:text-base">
              Get AI-powered mock interviews, personalized feedback, and track your progress to ace your next interview
            </p>

            {/* Feature Grid - Responsive */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">AI Feedback</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Award className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Performance Score</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Track Progress</p>
              </div>
              
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-500/10 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                </div>
                <p className="text-xs sm:text-sm text-slate-400">Real-time Practice</p>
              </div>
            </div>

            <Link
              href="/createinterview"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Start First Interview</span>
            </Link>
            
            <p className="text-xs text-slate-500 mt-4 sm:mt-6">
              Choose from Technical, Behavioral, or System Design interviews
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