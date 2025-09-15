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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Professional Header */}
        <div className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <div className="flex items-center space-x-4 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resume Intelligence Center</h1>
                  <p className="text-gray-600 dark:text-gray-300">
                    AI-powered resume optimization and career advancement platform
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <Link
                href="/resume/upload"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Resume
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {resumes.length > 0 ? (
          <div>
            {/* Section Header with Enhanced Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Resume Portfolio</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {filteredResumes.length} of {resumes.length} {filteredResumes.length === 1 ? 'resume' : 'resumes'} • Last updated {new Date().toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Enhanced Filter Dropdown */}
                <div className="relative">
                  <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <select 
                      value={sortFilter} 
                      onChange={(e) => setSortFilter(e.target.value as SortOption)}
                      className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:outline-none min-w-0"
                    >
                      <option value="all" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">All Resumes ({getFilterCount('all')})</option>
                      <option value="high-scores" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">High Scores 90+ ({getFilterCount('high-scores')})</option>
                      <option value="needs-improvement" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">Needs Improvement &lt;70 ({getFilterCount('needs-improvement')})</option>
                      <option value="recent" className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200">Most Recent ({getFilterCount('recent')})</option>
                    </select>
                  </div>
                </div>
                
                {/* View Mode Toggle */}
                <div className="flex bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-all duration-200 ${
                      viewMode === 'grid' 
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-all duration-200 ${
                      viewMode === 'list' 
                        ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Status Indicator */}
            {sortFilter !== 'all' && (
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="text-sm font-medium">
                    Filtered by: {getSortLabel(sortFilter)} ({filteredResumes.length} results)
                  </span>
                  <button 
                    onClick={() => setSortFilter('all')}
                    className="ml-2 p-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded transition-colors"
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
                    className="animate-fadeIn"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <ResumeCard resume={resume} viewMode={viewMode} />
                  </div>
                ))}
              </div>
            ) : (
              /* No Results State */
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No resumes match this filter
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Try adjusting your filter or upload a new resume to get started.
                </p>
                <button
                  onClick={() => setSortFilter('all')}
                  className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Clear Filters
                </button>
              </div>
            )}

            {/* Performance Summary */}
            <div className="mt-12 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-xl p-8 border-0 shadow-sm dark:shadow-none">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Performance Summary</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">Your resume optimization journey at a glance</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Average Improvement</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">+18%</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Issues Resolved</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.improvementTips}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Time Saved</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">12h</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Professional Empty State */
          <div className="text-center py-16">
            <div className="max-w-lg mx-auto">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <svg className="w-16 h-16 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to Resume Intelligence
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed mb-8">
                Transform your job search with AI-powered resume analysis. Get detailed insights, 
                ATS compatibility scores, and actionable recommendations to land more interviews.
              </p>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 text-left">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border-0 shadow-sm dark:shadow-none">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">ATS Optimization</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Ensure your resume passes applicant tracking systems with confidence</p>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border-0 shadow-sm dark:shadow-none">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Smart Recommendations</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Get personalized tips based on industry best practices and job requirements</p>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border-0 shadow-sm dark:shadow-none">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Performance Tracking</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Monitor your progress and see improvements over time</p>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 border-0 shadow-sm dark:shadow-none">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Instant Analysis</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Upload and receive comprehensive feedback in seconds</p>
                </div>
              </div>

              {/* Call to Action */}
              <div className="mt-10">
                <Link
                  href="/resume/upload"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-lg rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Start Your First Analysis
                </Link>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  Supports PDF, DOC, and DOCX formats • Free analysis included
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}