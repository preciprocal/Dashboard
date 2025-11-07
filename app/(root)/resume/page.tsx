'use client';

// app/resume/page.tsx
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client'
import { FirebaseService } from '@/lib/services/firebase-service';
import ResumeCard from '@/components/resume/ResumeCard';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { Resume } from '@/types/resume';

type SortOption = 'all' | 'high-scores' | 'needs-improvement' | 'recent';
type ViewMode = 'grid' | 'list';

export default function ResumeDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [sortFilter, setSortFilter] = useState<SortOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stats, setStats] = useState({
    averageScore: 0,
    totalResumes: 0,
    improvementTips: 0
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [loading, user, router]);

  useEffect(() => {
    const loadResumes = async () => {
      if (!user) return;

      try {
        const userResumes = await FirebaseService.getUserResumes(user.uid);
        setResumes(userResumes);
        
        // Calculate stats
        if (userResumes.length > 0) {
          const avgScore = userResumes.reduce((sum, resume) => sum + resume.feedback.overallScore, 0) / userResumes.length;
          const totalTips = userResumes.reduce((sum, resume) => {
            return sum + [
              ...resume.feedback.ATS.tips,
              ...resume.feedback.content.tips,
              ...resume.feedback.structure.tips,
              ...resume.feedback.skills.tips,
              ...resume.feedback.toneAndStyle.tips
            ].filter(tip => tip.type === 'improve').length;
          }, 0);
          
          setStats({
            averageScore: Math.round(avgScore),
            totalResumes: userResumes.length,
            improvementTips: totalTips
          });
        }
      } catch (error) {
        console.error('Error loading resumes:', error);
      } finally {
        setLoadingResumes(false);
      }
    };

    if (user) {
      loadResumes();
    }
  }, [user]);

  // Filter and sort resumes based on selected filter
  const filteredResumes = useMemo(() => {
    let filtered = [...resumes];

    switch (sortFilter) {
      case 'high-scores':
        filtered = filtered
          .filter(resume => resume.feedback.overallScore >= 90)
          .sort((a, b) => b.feedback.overallScore - a.feedback.overallScore);
        break;
      case 'needs-improvement':
        filtered = filtered.filter(resume => resume.feedback.overallScore < 70);
        break;
      case 'recent':
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'all':
      default:
        // Sort by creation date by default
        filtered = filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    return filtered;
  }, [resumes, sortFilter]);

  const getSortLabel = (option: SortOption) => {
    const labels: Record<SortOption, string> = {
      'all': 'All Resumes',
      'high-scores': 'High Scores (90+)',
      'needs-improvement': 'Needs Improvement (<70)',
      'recent': 'Most Recent'
    };
    return labels[option];
  };

  const getFilterCount = (option: SortOption) => {
    switch (option) {
      case 'high-scores':
        return resumes.filter(resume => resume.feedback.overallScore >= 90).length;
      case 'needs-improvement':
        return resumes.filter(resume => resume.feedback.overallScore < 70).length;
      case 'recent':
      case 'all':
      default:
        return resumes.length;
    }
  };

  if (loading || loadingResumes) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading your dashboard..."
        onHide={() => console.log('Resume dashboard loaded')}
      />
    );
  }

  if (!user) {
    return <div>Redirecting to login...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Clean Header */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white dark:text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Resume Intelligence</h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                AI-powered resume analysis and optimization platform
              </p>
            </div>
            
            <Link
              href="/resume/upload"
              className="inline-flex items-center px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Resume
            </Link>
          </div>
        </div>

        {/* Main Content */}
        {resumes.length > 0 ? (
          <div className="space-y-8">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Total Resumes</p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{stats.totalResumes}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Average Score</p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{stats.averageScore}%</p>
                  </div>
                  <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Improvements</p>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white mt-1">{stats.improvementTips}</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Your Resumes</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                  {filteredResumes.length} of {resumes.length} resumes
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Filter */}
                <div className="relative">
                  <select 
                    value={sortFilter} 
                    onChange={(e) => setSortFilter(e.target.value as SortOption)}
                    className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:border-transparent"
                  >
                    <option value="all">All Resumes ({getFilterCount('all')})</option>
                    <option value="high-scores">High Scores ({getFilterCount('high-scores')})</option>
                    <option value="needs-improvement">Needs Work ({getFilterCount('needs-improvement')})</option>
                    <option value="recent">Recent ({getFilterCount('recent')})</option>
                  </select>
                  <svg className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {/* View Toggle */}
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'grid' 
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filter Indicator */}
            {sortFilter !== 'all' && (
              <div className="flex items-center space-x-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {getSortLabel(sortFilter)} ({filteredResumes.length})
                  <button 
                    onClick={() => setSortFilter('all')}
                    className="ml-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded p-0.5"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {/* Resume Grid/List */}
            {filteredResumes.length > 0 ? (
              <div className={
                viewMode === 'grid' 
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" 
                  : "space-y-4"
              }>
                {filteredResumes.map((resume, index) => (
                  <div
                    key={resume.id}
                    className="opacity-0 animate-fadeIn"
                    style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
                  >
                    <ResumeCard resume={resume} viewMode={viewMode} />
                  </div>
                ))}
              </div>
            ) : (
              /* No Results State */
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  No resumes match this filter
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Try adjusting your filter or upload a new resume to get started.
                </p>
                <button
                  onClick={() => setSortFilter('all')}
                  className="inline-flex items-center px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Clear Filter
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
                Welcome to Resume Intelligence
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                Get AI-powered insights, ATS optimization, and personalized recommendations to improve your resume and land more interviews.
              </p>

              {/* Feature List */}
              <div className="grid grid-cols-2 gap-4 mb-10 text-left">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">ATS Score</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Optimize for applicant tracking systems</p>
                </div>
                
                <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">AI Analysis</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Get intelligent recommendations</p>
                </div>
                
                <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Track Progress</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Monitor improvement over time</p>
                </div>
                
                <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Instant Feedback</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Get results in seconds</p>
                </div>
              </div>

              <Link
                href="/resume/upload"
                className="inline-flex items-center px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Start Analysis
              </Link>
              
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
                Supports PDF, DOC, and DOCX formats
              </p>
            </div>
          </div>
        )}
      </div>

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