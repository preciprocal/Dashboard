'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import ResumeCard from '@/components/resume/ResumeCard';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { Resume } from '@/types/resume';
import { FileText, Upload, Filter, LayoutGrid, List, X } from 'lucide-react';

type SortOption = 'all' | 'high-scores' | 'needs-improvement' | 'recent';
type ViewMode = 'grid' | 'list';

interface ResumeTip {
  type: 'good' | 'improve';
  message: string;
}

interface ResumeStats {
  averageScore: number;
  totalResumes: number;
  improvementTips: number;
}

export default function Resumes() {
  const [user, userLoading] = useAuthState(auth);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [sortFilter, setSortFilter] = useState<SortOption>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [stats, setStats] = useState<ResumeStats>({
    averageScore: 0,
    totalResumes: 0,
    improvementTips: 0
  });

  useEffect(() => {
    const loadResumes = async () => {
      if (!user) return;

      try {
        const userResumes = await FirebaseService.getUserResumes(user.uid);
        setResumes(userResumes);
        
        if (userResumes.length > 0) {
          const avgScore = userResumes.reduce((sum, resume) => sum + (resume.feedback?.overallScore || 0), 0) / userResumes.length;
          
          const totalTips = userResumes.reduce((sum, resume) => {
            if (!resume.feedback) return sum;
            
            const allTips: ResumeTip[] = [
              ...(resume.feedback.ATS?.tips || []),
              ...(resume.feedback.content?.tips || []),
              ...(resume.feedback.structure?.tips || []),
              ...(resume.feedback.skills?.tips || []),
              ...(resume.feedback.toneAndStyle?.tips || [])
            ];
            
            return sum + allTips.filter(tip => tip?.type === 'improve').length;
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

  const filteredResumes = useMemo(() => {
    let filtered = [...resumes];

    switch (sortFilter) {
      case 'high-scores':
        filtered = filtered
          .filter(resume => (resume.feedback?.overallScore || 0) >= 90)
          .sort((a, b) => (b.feedback?.overallScore || 0) - (a.feedback?.overallScore || 0));
        break;
      case 'needs-improvement':
        filtered = filtered.filter(resume => (resume.feedback?.overallScore || 0) < 70);
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

  const getSortLabel = (option: SortOption): string => {
    const labels: Record<SortOption, string> = {
      'all': 'All Resumes',
      'high-scores': 'High Scores (90+)',
      'needs-improvement': 'Needs Improvement (<70)',
      'recent': 'Most Recent'
    };
    return labels[option];
  };

  const getFilterCount = (option: SortOption): number => {
    switch (option) {
      case 'high-scores':
        return resumes.filter(resume => (resume.feedback?.overallScore || 0) >= 90).length;
      case 'needs-improvement':
        return resumes.filter(resume => (resume.feedback?.overallScore || 0) < 70).length;
      case 'recent':
      case 'all':
      default:
        return resumes.length;
    }
  };

  if (!user) {
    return (
      <div className="text-center py-16">
        <div className="text-slate-400">
          Please log in to view your resumes.
        </div>
      </div>
    );
  }

  if (loadingResumes || userLoading) {
    return <AnimatedLoader />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-1">
                  Resume Intelligence
                </h2>
                <p className="text-slate-400 text-sm">
                  AI-powered resume optimization
                </p>
              </div>
            </div>
            
            <Link
              href="/resume/upload"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              <Upload className="w-5 h-5" />
              Upload Resume
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {resumes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card hover-lift">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-2xl font-semibold text-white">
                  {stats.totalResumes}
                </span>
              </div>
              <p className="text-sm text-slate-400">Total Resumes</p>
            </div>
          </div>

          <div className="glass-card hover-lift">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-2xl font-semibold text-white">
                  {stats.averageScore}%
                </span>
              </div>
              <p className="text-sm text-slate-400">Average Score</p>
            </div>
          </div>

          <div className="glass-card hover-lift">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <span className="text-2xl font-semibold text-white">
                  {stats.improvementTips}
                </span>
              </div>
              <p className="text-sm text-slate-400">Improvement Tips</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {resumes.length > 0 ? (
        <div className="space-y-6">
          {/* Controls */}
          <div className="glass-card">
            <div className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Your Resumes</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {filteredResumes.length} of {resumes.length} resumes
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Filter */}
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

          {/* Filter Status */}
          {sortFilter !== 'all' && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 text-sm">
                <Filter className="w-4 h-4" />
                <span>{getSortLabel(sortFilter)} ({filteredResumes.length})</span>
                <button 
                  onClick={() => setSortFilter('all')}
                  className="ml-1 hover:bg-blue-500/20 rounded p-0.5"
                  aria-label="Clear filter"
                >
                  <X className="w-3 h-3" />
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
                  key={`resume-${resume.id}-${index}`}
                  className="animate-fadeIn"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ResumeCard resume={resume} viewMode={viewMode} />
                </div>
              ))}
            </div>
          ) : (
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
      ) : (
        /* Empty State */
        <div className="glass-card">
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-3">
              No resumes yet
            </h3>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Upload your first resume to get AI-powered feedback on ATS compatibility and content quality
            </p>
            <Link
              href="/resume/upload"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-8 py-4 rounded-lg"
            >
              <Upload className="w-5 h-5" />
              Upload Your First Resume
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}