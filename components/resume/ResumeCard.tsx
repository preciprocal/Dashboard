'use client';

// components/ResumeCard.tsx
import Link from 'next/link';
import { Resume } from '@/types/resume';
import ScoreCircle from './ScoreCircle';

interface ResumeCardProps {
  resume: Resume;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export default function ResumeCard({ resume, viewMode = 'grid', className = '' }: ResumeCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  return (
    <Link href={`/resume/${resume.id}`} className="block group">
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-lg hover:scale-[1.02] transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group-hover:bg-gray-50 dark:group-hover:bg-gray-700 group-hover:border-gray-300 dark:group-hover:border-gray-600 ${className}`}>
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              {resume.companyName && (
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 truncate">
                  {resume.companyName}
                </h3>
              )}
              {resume.jobTitle && (
                <p className="text-gray-600 dark:text-gray-300 truncate">
                  {resume.jobTitle}
                </p>
              )}
              {!resume.companyName && !resume.jobTitle && (
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Resume Analysis</h3>
              )}
            </div>
            <div className="flex-shrink-0">
              <ScoreCircle score={resume.feedback.overallScore} size="medium" />
            </div>
          </div>
        </div>

        {/* Resume Preview */}
        <div className="px-6 pb-4">
          <div className="aspect-[3/4] bg-white dark:bg-gray-700 rounded-lg overflow-hidden border-0 shadow-inner dark:shadow-none group-hover:shadow-sm transition-all duration-300 relative">
            <img
              src={resume.imagePath}
              alt="Resume preview"
              className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
              loading="lazy"
            />
            {/* Professional overlay gradient on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
            <span className="group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors duration-300">
              Created {formatDate(resume.createdAt)}
            </span>
            <div className="flex items-center gap-4">
              {/* Quick stats with enhanced styling */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:scale-110 ${
                    resume.feedback.ATS.score >= 80 ? 'bg-green-500 group-hover:bg-green-600' : 
                    resume.feedback.ATS.score >= 60 ? 'bg-yellow-500 group-hover:bg-yellow-600' : 'bg-red-500 group-hover:bg-red-600'
                  }`}></div>
                  <span className="text-xs font-medium">ATS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:scale-110 ${
                    resume.feedback.content.score >= 80 ? 'bg-green-500 group-hover:bg-green-600' : 
                    resume.feedback.content.score >= 60 ? 'bg-yellow-500 group-hover:bg-yellow-600' : 'bg-red-500 group-hover:bg-red-600'
                  }`}></div>
                  <span className="text-xs font-medium">Content</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Status Indicator */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <div className="bg-blue-600/90 dark:bg-blue-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-md shadow-lg">
            <span className="text-xs font-medium">View Details</span>
          </div>
        </div>

        {/* Subtle border accent that appears on hover */}
        <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-blue-200/50 dark:group-hover:border-blue-400/30 transition-all duration-300 pointer-events-none"></div>
      </div>
    </Link>
  );
}