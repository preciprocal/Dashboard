'use client';

import Link from 'next/link';
import { Resume } from '@/types/resume';
import { 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle,
  FileText,
  Zap,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';

interface ResumeCardProps {
  resume: Resume;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export default function ResumeCard({ resume, viewMode = 'grid', className = '' }: ResumeCardProps) {
  const formatDate = (date: any) => {
    try {
      // Handle various date formats
      let dateObj: Date;
      
      if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date && typeof date === 'object' && 'seconds' in date) {
        // Firestore Timestamp
        dateObj = new Date(date.seconds * 1000);
      } else if (date && typeof date === 'object' && 'toDate' in date) {
        // Firestore Timestamp with toDate method
        dateObj = date.toDate();
      } else {
        return 'Recent';
      }
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Recent';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(dateObj);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Recent';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700';
    if (score >= 70) return 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700';
    return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-700';
  };

  // Safe function to get tips from a category
  const getTips = (category: any, type?: 'improve' | 'good') => {
    if (!category || !category.tips || !Array.isArray(category.tips)) {
      return [];
    }
    if (type) {
      return category.tips.filter((tip: any) => tip && tip.type === type);
    }
    return category.tips;
  };

  const getImprovementCount = () => {
    if (!resume.feedback) return 0;
    
    let count = 0;
    const categories = ['ATS', 'ats', 'content', 'structure', 'skills', 'toneAndStyle', 'impact', 'grammar'];
    
    categories.forEach(key => {
      const category = resume.feedback[key as keyof typeof resume.feedback];
      if (category && typeof category === 'object') {
        count += getTips(category, 'improve').length;
      }
    });
    
    return count;
  };

  const getStrengthCount = () => {
    if (!resume.feedback) return 0;
    
    let count = 0;
    const categories = ['ATS', 'ats', 'content', 'structure', 'skills', 'toneAndStyle', 'impact', 'grammar'];
    
    categories.forEach(key => {
      const category = resume.feedback[key as keyof typeof resume.feedback];
      if (category && typeof category === 'object') {
        count += getTips(category, 'good').length;
      }
    });
    
    return count;
  };

  // Safe function to get overall score
  const getOverallScore = () => {
    return resume.feedback?.overallScore || resume.score || 0;
  };

  // Safe function to get category score
  const getCategoryScore = (categoryName: string) => {
    if (!resume.feedback) return 0;
    const category = resume.feedback[categoryName as keyof typeof resume.feedback];
    if (category && typeof category === 'object' && 'score' in category) {
      return (category as any).score || 0;
    }
    return 0;
  };

  const overallScore = getOverallScore();
  const atsScore = getCategoryScore('ATS') || getCategoryScore('ats');
  const contentScore = getCategoryScore('content');

  if (viewMode === 'list') {
    return (
      <Link href={`/resume/${resume.id}`} className="block group">
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 ${className}`}>
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0">
                {resume.imagePath && (
                  <img
                    src={resume.imagePath}
                    alt="Resume preview"
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {resume.companyName || resume.jobTitle || 'Resume Analysis'}
                    </h3>
                    {resume.jobTitle && resume.companyName && (
                      <p className="text-gray-600 dark:text-gray-300 truncate mt-1">
                        {resume.jobTitle}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Created {formatDate(resume.createdAt)}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {overallScore}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Overall</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        {getStrengthCount()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Strengths</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                        {getImprovementCount()}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">To Fix</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/resume/${resume.id}`} className="block group">
      <div className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-700 ease-out overflow-hidden hover:-translate-y-2 ${className}`}>
        
        {/* Header Section */}
        <div className="p-5 pb-3 transition-all duration-500 ease-out">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-500 ease-out">
                {resume.companyName || resume.jobTitle || 'Resume Analysis'}
              </h3>
              {resume.jobTitle && resume.companyName && (
                <p className="text-gray-600 dark:text-gray-300 truncate text-sm mt-1 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors duration-500 ease-out">
                  {resume.jobTitle}
                </p>
              )}
            </div>
            
            {/* Score Badge */}
            <div className={`px-3 py-1.5 rounded-full border text-sm font-semibold transition-all duration-500 ease-out group-hover:scale-105 group-hover:shadow-md ${getScoreBadgeColor(overallScore)}`}>
              <span className={`${getScoreColor(overallScore)} transition-colors duration-500 ease-out`}>
                {overallScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Resume Preview */}
        <div className="px-5 pb-3">
          <div className="aspect-[3/4] bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group-hover:border-blue-200 dark:group-hover:border-blue-500 transition-all duration-700 ease-out relative">
            {resume.imagePath && (
              <img
                src={resume.imagePath}
                alt="Resume preview"
                className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />
            )}
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-600 ease-out">
              <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-4 group-hover:translate-y-0 transition-all duration-600 ease-out">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1 transform scale-95 group-hover:scale-100 transition-all duration-500 ease-out">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">{getStrengthCount()} strong</span>
                    </div>
                    <div className="flex items-center space-x-1 transform scale-95 group-hover:scale-100 transition-all duration-500 ease-out delay-75">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">{getImprovementCount()} to fix</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 transform -translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500 ease-out" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {/* ATS Score */}
            <div className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all duration-500 ease-out group-hover:scale-105">
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ease-out group-hover:scale-125 ${
                atsScore >= 80 ? 'bg-emerald-500' : 
                atsScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 dark:text-white transition-colors duration-500 ease-out group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  ATS {atsScore}%
                </div>
              </div>
            </div>

            {/* Content Score */}
            <div className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-all duration-500 ease-out delay-75 group-hover:scale-105">
              <div className={`w-2 h-2 rounded-full transition-all duration-500 ease-out group-hover:scale-125 ${
                contentScore >= 80 ? 'bg-emerald-500' : 
                contentScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
              }`}></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 dark:text-white transition-colors duration-500 ease-out group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Content {contentScore}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 transition-colors duration-500 ease-out group-hover:border-blue-100 dark:group-hover:border-blue-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1 transition-colors duration-500 ease-out group-hover:text-gray-700 dark:group-hover:text-gray-300">
              <Calendar className="w-3 h-3" />
              <span>Created {formatDate(resume.createdAt)}</span>
            </div>
            
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-600 ease-out transform translate-x-2 group-hover:translate-x-0 flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-medium">
              <BarChart3 className="w-3 h-3" />
              <span>View Analysis</span>
            </div>
          </div>
        </div>

        {/* Performance Indicator */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-600 ease-out transform translate-y-2 scale-90 group-hover:translate-y-0 group-hover:scale-100">
          <div className={`p-1.5 rounded-lg backdrop-blur-sm shadow-lg transition-all duration-500 ease-out ${
            overallScore >= 85 ? 'bg-emerald-500/90' :
            overallScore >= 70 ? 'bg-amber-500/90' :
            'bg-red-500/90'
          }`}>
            {overallScore >= 85 ? 
              <TrendingUp className="w-4 h-4 text-white" /> :
              overallScore >= 70 ? 
              <Zap className="w-4 h-4 text-white" /> :
              <AlertTriangle className="w-4 h-4 text-white" />
            }
          </div>
        </div>

        {/* Subtle glow effect on hover */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-800 ease-out pointer-events-none">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5"></div>
        </div>
      </div>
    </Link>
  );
}