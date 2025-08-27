'use client';

// components/ResumeCard.tsx
import Link from 'next/link';
import { Resume } from '@/types/resume';
import ScoreCircle from './ScoreCircle';

interface ResumeCardProps {
  resume: Resume;
}

export default function ResumeCard({ resume }: ResumeCardProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  return (
    <Link href={`/resume/${resume.id}`} className="block group">
      <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 group-hover:border-gray-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              {resume.companyName && (
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
                  {resume.companyName}
                </h3>
              )}
              {resume.jobTitle && (
                <p className="text-gray-600 truncate">
                  {resume.jobTitle}
                </p>
              )}
              {!resume.companyName && !resume.jobTitle && (
                <h3 className="text-lg font-bold text-gray-900">Resume Analysis</h3>
              )}
            </div>
            <div className="flex-shrink-0">
              <ScoreCircle score={resume.feedback.overallScore} size="medium" />
            </div>
          </div>
        </div>

        {/* Resume Preview */}
        <div className="px-6 pb-4">
          <div className="aspect-[3/4] bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-100 group-hover:border-blue-200 transition-colors duration-200">
            <img
              src={resume.imagePath}
              alt="Resume preview"
              className="w-full h-full object-cover object-top group-hover:scale-102 transition-transform duration-200"
              loading="lazy"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Created {formatDate(resume.createdAt)}</span>
            <div className="flex items-center gap-4">
              {/* Quick stats */}
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${
                    resume.feedback.ATS.score >= 80 ? 'bg-green-500' : 
                    resume.feedback.ATS.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="ml-1 text-xs">ATS</span>
                </div>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full ${
                    resume.feedback.content.score >= 80 ? 'bg-green-500' : 
                    resume.feedback.content.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="ml-1 text-xs">Content</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hover Effect Arrow */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-blue-600 text-white p-1.5 rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}