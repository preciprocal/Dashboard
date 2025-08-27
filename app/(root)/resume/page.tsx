'use client';

// app/resume/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client'
import { FirebaseService } from '@/lib/services/firebase-service';
import ResumeCard from '@/components/resume/ResumeCard';
import { Resume } from '@/types/resume';

export default function ResumeDashboard() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
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

  if (loading || loadingResumes) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div>Redirecting to login...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Resume Dashboard</h1>
              <p className="mt-1 text-gray-600">
                Track your applications and improve your resume with AI-powered feedback
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Link
                href="/resume/upload"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Analysis
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {resumes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageScore}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Analyses</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalResumes}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Improvement Tips</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.improvementTips}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {resumes.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Resume Analyses</h2>
              <p className="text-sm text-gray-600">
                {resumes.length} {resumes.length === 1 ? 'analysis' : 'analyses'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {resumes.map((resume, index) => (
                <div
                  key={resume.id}
                  className="animate-fadeIn"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <ResumeCard resume={resume} />
                </div>
              ))}
            </div>

            {/* Load More Button (if needed in future) */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Showing all your resume analyses
              </p>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                No resume analyses yet
              </h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Get started by uploading your first resume for AI-powered analysis. 
                Discover what's working well and get specific tips to improve your chances of landing interviews.
              </p>

              <div className="space-y-4">
                <Link
                  href="/resume/upload"
                  className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105"
                >
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Your First Resume
                </Link>
                
                <div className="text-sm text-gray-500">
                  <p>✨ Get instant feedback on ATS compatibility</p>
                  <p>📊 Receive detailed scores and improvement tips</p>
                  <p>🎯 Optimize for your target job and company</p>
                </div>
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