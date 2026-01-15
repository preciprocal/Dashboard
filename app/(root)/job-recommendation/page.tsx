// app/(dashboard)/job-recommendations/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Target, Briefcase, MapPin, DollarSign, Building2, ExternalLink, Loader2, AlertCircle, TrendingUp, Award, Search, Filter, Sparkles, Upload, FileText, ArrowLeft, RefreshCw, Calendar, X, Clock, GraduationCap, Zap, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  jobType: string;
  experience?: string;
  description: string;
  requirements: string[];
  matchScore: number;
  applyUrl: string;
  postedDate: string;
  source: string;
}

interface Resume {
  id: string;
  fileName: string;
  createdAt: string;
  updatedAt?: string;
  analyzedAt?: string;
  [key: string]: unknown;
}

interface Filters {
  jobType: string;
  minMatchScore: number;
  location: string;
}

interface ResumeListResponse {
  data?: Resume[];
}

interface ResumeAnalysis {
  jobTitles: string[];
  skills: string[];
  location: string;
  experience: string;
  education: string;
  industries: string[];
  careerLevel: string;
  certifications: string[];
  preferredJobTypes: string[];
}

interface JobRecommendationsResponse {
  jobs?: JobListing[];
  success?: boolean;
  analysis?: ResumeAnalysis;
  meta?: {
    timestamp: string;
    resumeTextLength: number;
    filtersApplied: boolean;
    matchScoreRange: string;
  };
}

interface ErrorResponse {
  error?: string;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

const JOB_SEARCH_FACTS = [
  "💼 Hidden job market represents 70-80% of all job openings",
  "🎯 Referrals account for 30-50% of all hires across industries",
  "⚡ Applying within the first 96 hours increases your chances by 8x",
  "📊 Only 25% of applicants get interviews - stand out with customization",
  "🚀 Job seekers who negotiate salary increase their offer by 7.4% on average",
  "💡 Companies with employee referral programs fill positions 55% faster",
  "🔍 75% of hiring managers use LinkedIn to research candidates",
  "📈 Personalized applications get 3x more responses than generic ones",
  "✨ Following up after applying increases callback rates by 30%",
  "🎨 Including relevant projects in your application boosts interest by 45%",
  "📞 Networking leads to job offers 85% of the time vs 15% from job boards",
  "💪 Skills-based hiring is growing 63% faster than traditional hiring",
  "🏆 Cultural fit questions are asked in 89% of modern interviews",
  "📧 Cold emails to hiring managers have 8-10% response rates",
  "🌟 Tuesday at 10 AM is statistically the best time to apply for jobs",
  "🎯 Customizing your resume for each role increases ATS pass rate by 60%",
  "💼 Remote job postings receive 2.5x more applications than on-site roles",
  "🚀 Tech roles are typically filled in 42 days on average",
  "📊 84% of companies use AI-powered recruitment tools",
  "⚡ Video introductions increase application engagement by 12x",
];

const JOB_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types', icon: Briefcase },
  { value: 'Full-time', label: 'Full-time', icon: Clock },
  { value: 'Part-time', label: 'Part-time', icon: Clock },
  { value: 'Contract', label: 'Contract', icon: FileText },
  { value: 'Internship', label: 'Internship', icon: GraduationCap }
];

interface LoadingStep {
  name: string;
  weight: number;
}

function JobRecommendationsPage() {
  const router = useRouter();
  const [currentUser, authLoading] = useAuthState(auth);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isLoadingResumes, setIsLoadingResumes] = useState(true);
  const [resumeLoadingStep, setResumeLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [filters, setFilters] = useState<Filters>({
    jobType: 'all',
    minMatchScore: 60,
    location: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

  const resumeLoadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Connecting to database...', weight: 2 },
    { name: 'Loading your resumes...', weight: 2 },
    { name: 'Preparing data...', weight: 1 }
  ];

  const jobSearchSteps: LoadingStep[] = [
    { name: 'Reading your resume deeply...', weight: 2 },
    { name: 'Identifying skills and expertise...', weight: 2 },
    { name: 'Understanding career level...', weight: 1 },
    { name: 'Searching thousands of jobs...', weight: 3 },
    { name: 'Calculating match scores...', weight: 2 },
    { name: 'Ranking best opportunities...', weight: 1 }
  ];

  // Rotate facts during loading
  useEffect(() => {
    if (!isLoading) return;

    const factInterval = setInterval(() => {
      setCurrentFactIndex(prev => (prev + 1) % JOB_SEARCH_FACTS.length);
    }, 4000);

    return () => clearInterval(factInterval);
  }, [isLoading]);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/sign-in');
    }
  }, [authLoading, currentUser, router]);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    if (!currentUser) return null;
    try {
      return await currentUser.getIdToken();
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, [currentUser]);

  const formatResumeDate = useCallback((dateValue: string): string => {
    try {
      const date = new Date(dateValue);
      
      if (isNaN(date.getTime())) {
        return 'Unknown date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error parsing date:', error);
      return 'Unknown date';
    }
  }, []);

  const fetchResumes = useCallback(async (): Promise<void> => {
    setIsLoadingResumes(true);
    setError(null);
    setCriticalError(null);
    setResumeLoadingStep(0);

    try {
      setResumeLoadingStep(0);
      const token = await getAuthToken();
      
      if (!token) {
        setCriticalError({
          code: '401',
          title: 'Authentication Required',
          message: 'Your session has expired. Please log in again.',
        });
        return;
      }

      setResumeLoadingStep(1);
      await new Promise(resolve => setTimeout(resolve, 300));

      setResumeLoadingStep(2);
      const response = await fetch('/api/resume', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setCriticalError({
            code: '401',
            title: 'Authentication Required',
            message: 'Your session has expired. Please log in again.',
          });
          return;
        }
        
        if (response.status === 403) {
          setCriticalError({
            code: '403',
            title: 'Access Denied',
            message: 'You do not have permission to access your resumes.',
          });
          return;
        }
        
        throw new Error('Failed to fetch resumes');
      }

      const data: ResumeListResponse = await response.json();

      setResumeLoadingStep(3);
      const resumeList = (data.data || []).filter(resume => resume.id);
      
      setResumes(resumeList);
      
      if (resumeList.length > 0 && !selectedResumeId) {
        setSelectedResumeId(resumeList[0].id);
      }

      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (err: unknown) {
      console.error('Error fetching resumes:', err);
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
      } else {
        setError('Failed to load your resumes. Please try again.');
      }
    } finally {
      setIsLoadingResumes(false);
    }
  }, [getAuthToken, selectedResumeId]);

  const fetchJobRecommendations = useCallback(async (): Promise<void> => {
    if (!selectedResumeId) {
      setError('Please select a resume first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCriticalError(null);
    setHasSearched(true);
    setLoadingStep(0);
    setCurrentFactIndex(Math.floor(Math.random() * JOB_SEARCH_FACTS.length));
    
    try {
      setLoadingStep(0);
      const token = await getAuthToken();
      
      if (!token) {
        setCriticalError({
          code: '401',
          title: 'Authentication Required',
          message: 'Your session has expired. Please log in again.',
        });
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      setLoadingStep(1);
      await new Promise(resolve => setTimeout(resolve, 400));

      setLoadingStep(2);
      await new Promise(resolve => setTimeout(resolve, 300));

      setLoadingStep(3);
      const response = await fetch('/api/resume/job-recommendations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          filters,
          searchQuery: searchQuery.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to fetch job recommendations';
        try {
          const errorData: ErrorResponse = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      setLoadingStep(4);
      const data: JobRecommendationsResponse = await response.json();
      await new Promise(resolve => setTimeout(resolve, 400));

      setLoadingStep(5);
      setJobs(data.jobs || []);
      setAnalysis(data.analysis || null);
      
      if (data.jobs && data.jobs.length === 0) {
        setError('No jobs found matching your criteria. Try adjusting your filters or search terms.');
      }

      await new Promise(resolve => setTimeout(resolve, 150));

    } catch (error: unknown) {
      console.error('Job recommendations error:', error);
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      if (err.message.includes('Firebase') || err.message.includes('firestore')) {
        setCriticalError({
          code: 'DATABASE',
          title: 'Database Connection Error',
          message: 'Unable to fetch job recommendations. Please check your internet connection.',
          details: err.message
        });
      } else if (err.message.includes('fetch') || err.message.includes('network')) {
        setCriticalError({
          code: 'NETWORK',
          title: 'Network Error',
          message: 'Unable to connect to the job search service.',
          details: err.message
        });
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedResumeId, getAuthToken, filters, searchQuery]);

  useEffect(() => {
    if (currentUser) {
      fetchResumes();
    }
  }, [currentUser, fetchResumes]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setError(null);
    if (resumes.length === 0) {
      fetchResumes();
    }
  };

  const getMatchScoreColor = (score: number): string => {
    if (score >= 85) return 'text-emerald-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-slate-400';
  };

  const getMatchScoreBgColor = (score: number): string => {
    if (score >= 85) return 'bg-emerald-500/10 border-emerald-500/30';
    if (score >= 70) return 'bg-blue-500/10 border-blue-500/30';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-slate-500/10 border-slate-500/30';
  };

  const getMatchScoreLabel = (score: number): string => {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Strong';
    if (score >= 60) return 'Good';
    return 'Fair';
  };

  const filteredJobs = jobs.filter(job => {
    if (filters.jobType !== 'all' && job.jobType !== filters.jobType) return false;
    if (job.matchScore < filters.minMatchScore) return false;
    if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (searchQuery && !job.title.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !job.company.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleResetFilters = useCallback(() => {
    setFilters({ jobType: 'all', minMatchScore: 60, location: '' });
    setSearchQuery('');
  }, []);

  const handleResumeChange = useCallback((newResumeId: string) => {
    setSelectedResumeId(newResumeId);
    setJobs([]);
    setError(null);
    setHasSearched(false);
    setAnalysis(null);
  }, []);

  const hasActiveFilters = filters.jobType !== 'all' || filters.minMatchScore !== 60 || filters.location !== '' || searchQuery !== '';

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

  if (authLoading || isLoadingResumes) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={resumeLoadingSteps}
        currentStep={resumeLoadingStep}
        loadingText="Loading your resumes..."
        showNavigation={true}
      />
    );
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Please log in to view job recommendations</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !isLoading && !isLoadingResumes) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <div className="glass-card hover-lift">
          <div className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-300 hover:text-white hover:bg-white/5 text-xs sm:text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">Job Recommendations</h1>
              <div className="w-16 sm:w-20"></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="glass-card hover-lift max-w-md w-full">
            <div className="text-center p-8 sm:p-12">
              <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Error Loading Jobs</h2>
              <p className="text-sm sm:text-base text-slate-400 mb-6">{error}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleRetryError}
                  className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg justify-center"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>
                {error.toLowerCase().includes('resume') && (
                  <button
                    onClick={() => router.push('/resume')}
                    className="glass-button hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg justify-center"
                  >
                    <Upload className="w-5 h-5" />
                    Upload Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white hover:bg-white/5 text-xs sm:text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Job Recommendations</h1>
            <button
              onClick={() => router.push('/resume')}
              className="glass-button hover-lift p-2 rounded-lg"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Select Resume
            </label>
            {resumes.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedResumeId || ''}
                  onChange={(e) => handleResumeChange(e.target.value)}
                  className="w-full px-4 py-3 glass-input border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none pr-10"
                >
                  <option value="" className="bg-slate-900 text-slate-400">Select resume...</option>
                  {resumes.map((resume, index) => (
                    <option 
                      key={resume.id ? `resume-${resume.id}` : `resume-index-${index}`} 
                      value={resume.id}
                      className="bg-slate-900 text-white"
                    >
                      {resume.fileName} • {formatResumeDate(resume.createdAt)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="glass-input rounded-xl p-4 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-300 mb-2">No resumes found</p>
                    <button
                      onClick={() => router.push('/resume')}
                      className="glass-button-primary hover-lift px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      Upload Resume
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by job title or company..."
              className="w-full pl-11 pr-4 py-3 glass-input border border-white/10 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedResumeId) {
                  fetchJobRecommendations();
                }
              }}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                showFilters 
                  ? 'glass-button-primary' 
                  : 'glass-button hover-lift'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              )}
            </button>
            <button
              onClick={fetchJobRecommendations}
              disabled={!selectedResumeId || isLoading}
              className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${
                !selectedResumeId || isLoading
                  ? 'glass-button opacity-50 cursor-not-allowed'
                  : 'glass-button-primary hover-lift'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Find Perfect Jobs
                </>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300">Job Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {JOB_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = filters.jobType === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => setFilters({ ...filters, jobType: option.value })}
                        className={`p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'glass-button-primary border-blue-500/50'
                            : 'glass-button border-white/10 hover:border-white/20'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                        <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Minimum Match Score</label>
                  <div className="relative">
                    <select
                      value={filters.minMatchScore}
                      onChange={(e) => setFilters({ ...filters, minMatchScore: Number(e.target.value) })}
                      className="w-full px-3 py-2 glass-input border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none pr-8"
                    >
                      <option value={50} className="bg-slate-900 text-white">50%+ (Show All)</option>
                      <option value={60} className="bg-slate-900 text-white">60%+ (Good Match)</option>
                      <option value={70} className="bg-slate-900 text-white">70%+ (Strong Match)</option>
                      <option value={80} className="bg-slate-900 text-white">80%+ (Very Strong)</option>
                      <option value={85} className="bg-slate-900 text-white">85%+ (Excellent Match)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Location Filter</label>
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                    placeholder="e.g., New York, Remote"
                    className="w-full px-3 py-2 glass-input border border-white/10 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="w-full px-4 py-2 glass-button hover-lift rounded-lg text-sm text-slate-300 flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading State with Facts */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-4">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white animate-pulse" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-white mb-2 sm:mb-3">
                {jobSearchSteps[loadingStep]?.name}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {JOB_SEARCH_FACTS[currentFactIndex]}
              </p>
            </div>

            <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4 sm:mb-6">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                style={{ 
                  width: `${
                    jobSearchSteps
                      .slice(0, loadingStep + 1)
                      .reduce((acc, step) => acc + step.weight, 0) /
                    jobSearchSteps.reduce((acc, step) => acc + step.weight, 0) * 100
                  }%` 
                }}
              />
            </div>

            <div className="space-y-2 sm:space-y-3">
              {jobSearchSteps.map((step, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center text-xs sm:text-sm ${
                    idx < loadingStep 
                      ? 'text-emerald-400' 
                      : idx === loadingStep 
                      ? 'text-blue-400' 
                      : 'text-slate-600'
                  }`}
                >
                  {idx < loadingStep ? (
                    <CheckCircle2 className="w-4 h-4 mr-3 flex-shrink-0" />
                  ) : idx === loadingStep ? (
                    <Loader2 className="w-4 h-4 mr-3 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 mr-3 border border-slate-700 rounded-full flex-shrink-0" />
                  )}
                  <span>{step.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && hasSearched && analysis && (
        <div className="glass-card hover-lift">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Resume Analysis</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Target Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.jobTitles.slice(0, 3).map((title, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-blue-500/10 text-blue-300 rounded-md text-xs border border-blue-500/20">
                      {title}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Top Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.skills.slice(0, 5).map((skill, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-purple-500/10 text-purple-300 rounded-md text-xs border border-purple-500/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-400">Career Details</p>
                <div className="space-y-1">
                  <p className="text-sm text-white">{analysis.careerLevel} • {analysis.experience}</p>
                  <p className="text-xs text-slate-400">{analysis.education}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isLoading && hasSearched && filteredJobs.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">{filteredJobs.length}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">Total Matches</p>
            </div>
          </div>

          <div className="glass-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {filteredJobs.filter(j => j.matchScore >= 85).length}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">Excellent</p>
            </div>
          </div>

          <div className="glass-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {filteredJobs.filter(j => j.matchScore >= 70 && j.matchScore < 85).length}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">Strong</p>
            </div>
          </div>

          <div className="glass-card">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                </div>
                <span className="text-xl sm:text-2xl font-semibold text-white">
                  {Math.round(filteredJobs.reduce((acc, j) => acc + j.matchScore, 0) / filteredJobs.length)}%
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">Avg Score</p>
            </div>
          </div>
        </div>
      )}

      {!isLoading && hasSearched && filteredJobs.length > 0 && (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="glass-card hover-lift">
              <div className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 break-words">{job.title}</h3>
                    <div className="flex items-center gap-2 text-slate-300 mb-3">
                      <Building2 className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{job.company}</span>
                    </div>
                  </div>
                  <div className={`flex flex-col items-center gap-1 flex-shrink-0 px-4 py-2 rounded-xl border ${getMatchScoreBgColor(job.matchScore)}`}>
                    <div className={`text-2xl sm:text-3xl font-bold ${getMatchScoreColor(job.matchScore)}`}>
                      {job.matchScore}%
                    </div>
                    <span className={`text-xs font-semibold ${getMatchScoreColor(job.matchScore)}`}>
                      {getMatchScoreLabel(job.matchScore)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mb-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span>{job.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Briefcase className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium text-blue-300">{job.jobType}</span>
                  </div>
                  {job.salary && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <DollarSign className="w-4 h-4 flex-shrink-0" />
                      <span>{job.salary}</span>
                    </div>
                  )}
                  {job.experience && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Award className="w-4 h-4 flex-shrink-0" />
                      <span>{job.experience}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-slate-300 leading-relaxed mb-4 break-words">
                  {job.description}
                </p>

                {job.requirements.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-400 mb-2">Key Requirements:</p>
                    <div className="flex flex-wrap gap-2">
                      {job.requirements.slice(0, 6).map((req, idx) => (
                        <span
                          key={`req-${job.id}-${idx}`}
                          className="px-3 py-1 bg-blue-500/10 text-blue-300 rounded-lg text-xs border border-blue-500/20 font-medium"
                        >
                          {req}
                        </span>
                      ))}
                      {job.requirements.length > 6 && (
                        <span className="px-3 py-1 text-slate-500 text-xs">
                          +{job.requirements.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{job.postedDate}</span>
                    <span>•</span>
                    <span className="truncate">{job.source}</span>
                  </div>
                  <a 
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-button-primary hover-lift px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap"
                  >
                    Apply Now
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && hasSearched && !error && filteredJobs.length === 0 && jobs.length > 0 && (
        <div className="glass-card hover-lift">
          <div className="p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">No Jobs Match Your Filters</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Try adjusting your job type, match score, or location filters to see more opportunities
            </p>
            <button
              onClick={handleResetFilters}
              className="glass-button-primary hover-lift px-6 py-3 rounded-xl font-semibold text-sm"
            >
              Reset All Filters
            </button>
          </div>
        </div>
      )}

      {!isLoading && hasSearched && !error && jobs.length === 0 && selectedResumeId && (
        <div className="glass-card hover-lift">
          <div className="p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">No Recommendations Found</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              We could not find jobs matching your resume. This may be due to API limitations or try different search terms.
            </p>
            <button
              onClick={fetchJobRecommendations}
              className="glass-button-primary hover-lift px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      )}

      {!isLoading && !hasSearched && !error && selectedResumeId && (
        <div className="glass-card hover-lift">
          <div className="p-8 sm:p-12 text-center">
            <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Target className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Ready to Find Your Dream Job?</h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Our AI will analyze your resume and match you with the best job opportunities tailored to your skills and experience
            </p>
            <button
              onClick={fetchJobRecommendations}
              disabled={isLoading}
              className="glass-button-primary hover-lift px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto"
            >
              <Zap className="w-4 h-4" />
              Find Perfect Jobs Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobRecommendationsPage;