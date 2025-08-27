'use client';

// app/resume/[id]/page.tsx
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service'; // ✅ Updated path
import ScoreCircle from '@/components/resume/ScoreCircle'; // ✅ Updated path
import { Resume, ResumeTip } from '@/types/resume';

function TipCard({ tip, index }: { tip: ResumeTip; index: number }) {
  const isGood = tip.type === 'good';
  
  return (
    <div 
      className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-sm animate-fadeIn ${
        isGood 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400 hover:bg-green-100 dark:hover:bg-green-900/30' 
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 dark:border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          {isGood ? (
            <div className="w-5 h-5 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-green-600 dark:text-green-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 bg-amber-100 dark:bg-amber-800 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-amber-600 dark:text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
        <div className="ml-3 flex-1">
          <h4 className={`text-sm font-semibold ${
            isGood ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'
          }`}>
            {tip.tip}
          </h4>
          {tip.explanation && (
            <p className={`mt-2 text-sm leading-relaxed ${
              isGood ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'
            }`}>
              {tip.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreSection({ 
  title, 
  description, 
  score, 
  tips, 
  icon 
}: { 
  title: string;
  description: string;
  score: number;
  tips: ResumeTip[];
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            {icon}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{description}</p>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <ScoreCircle score={score} size="medium" />
          <span className={`mt-1 text-xs font-medium ${
            score >= 80 ? 'text-green-600 dark:text-green-400' :
            score >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {score >= 90 ? 'Excellent' :
             score >= 80 ? 'Very Good' :
             score >= 70 ? 'Good' :
             score >= 60 ? 'Fair' : 'Needs Work'}
          </span>
        </div>
      </div>
      
      <div className="space-y-3">
        {tips.map((tip, index) => (
          <TipCard key={index} tip={tip} index={index} />
        ))}
      </div>
    </div>
  );
}

export default function ResumeDetails() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [resumeUrl, setResumeUrl] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    const loadResume = async () => {
      if (!params.id || typeof params.id !== 'string') return;
      
      try {
        const resumeData = await FirebaseService.getResume(params.id);
        if (resumeData && (!user || resumeData.userId === user.uid)) {
          setResume(resumeData);
          
          // Handle base64 data URLs or legacy URLs
          if (resumeData.resumePath) {
            if (resumeData.resumePath.startsWith('data:')) {
              // It's a base64 data URL, use directly for preview but create blob for download
              setResumeUrl(resumeData.resumePath);
            } else {
              // Legacy URL (if you have old data)
              setResumeUrl(resumeData.resumePath);
            }
          }

          if (resumeData.imagePath) {
            if (resumeData.imagePath.startsWith('data:')) {
              // It's a base64 data URL, use directly
              setImageUrl(resumeData.imagePath);
            } else {
              // Legacy URL (if you have old data)
              setImageUrl(resumeData.imagePath);
            }
          }
        } else {
          setResume(null);
        }
      } catch (error) {
        console.error('Error loading resume:', error);
        setResume(null);
      } finally {
        setLoadingResume(false);
      }
    };

    if (user) {
      loadResume();
    } else if (!loading) {
      setLoadingResume(false);
    }
  }, [params.id, user, loading]);

  const handleDownloadPdf = () => {
    if (!resume) return;

    if (resume.resumePath && resume.resumePath.startsWith('data:')) {
      // Create blob URL for download
      const downloadUrl = FirebaseService.createDownloadableUrl(
        resume.resumePath, 
        `${resume.companyName || 'resume'}_${resume.jobTitle || 'analysis'}.pdf`
      );
      
      // Create download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${resume.companyName || 'resume'}_${resume.jobTitle || 'analysis'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } else if (resume.resumePath) {
      // Legacy URL - open in new tab
      window.open(resume.resumePath, '_blank');
    }
  };

  const handleViewPdf = () => {
    if (!resume) return;

    if (resume.resumePath && resume.resumePath.startsWith('data:')) {
      // Create blob URL for viewing
      const viewUrl = FirebaseService.createDownloadableUrl(
        resume.resumePath, 
        `${resume.companyName || 'resume'}.pdf`
      );
      window.open(viewUrl, '_blank');
    } else if (resume.resumePath) {
      // Legacy URL
      window.open(resume.resumePath, '_blank');
    }
  };

  if (loading || loadingResume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your resume analysis...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return <div>Redirecting to login...</div>;
  }

  if (!resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Resume not found</h1>
          <p className="text-gray-600 mb-6">
            This resume analysis doesn't exist or you don't have permission to view it.
          </p>
          <Link 
            href="/resume" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/resume" className="flex items-center text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleViewPdf}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View PDF
              </button>
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-col xl:flex-row">
        {/* Resume Preview - Sticky Sidebar */}
        <div className="xl:w-1/3 xl:sticky xl:top-16 xl:h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
          <div className="p-6 h-full flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-w-md">
                {imageUrl ? (
                  <div className="group cursor-pointer" onClick={handleViewPdf}>
                    <img
                      src={imageUrl}
                      alt="Resume preview"
                      className="w-full rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-200 border border-gray-200 dark:border-gray-600"
                    />
                    <div className="mt-3 text-center">
                      <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        Click to view full PDF
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full aspect-[3/4] bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400">Resume preview not available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="xl:w-2/3 p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resume Analysis</h1>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Analyzed on</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(resume.createdAt)}</p>
                </div>
              </div>
              
              {(resume.companyName || resume.jobTitle) && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {resume.companyName && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {resume.companyName}
                    </span>
                  )}
                  {resume.jobTitle && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 8v10a2 2 0 002 2h4a2 2 0 002-2V8" />
                      </svg>
                      {resume.jobTitle}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Overall Score Card */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-8 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-white">Overall Score</h2>
                  <p className="text-blue-100 text-lg">
                    Your resume's comprehensive performance rating
                  </p>
                  <div className="mt-4">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="text-blue-100">Grade: </span>
                        <span className="font-bold text-xl text-white">
                          {resume.feedback.overallScore >= 90 ? 'A+' :
                           resume.feedback.overallScore >= 80 ? 'A' :
                           resume.feedback.overallScore >= 70 ? 'B' :
                           resume.feedback.overallScore >= 60 ? 'C' : 'D'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="rgba(255,255,255,0.3)"
                          strokeWidth="8"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="white"
                          strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 - (resume.feedback.overallScore / 100) * 2 * Math.PI * 40}`}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">
                          {resume.feedback.overallScore}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-6">
              {/* ATS Compatibility */}
              <ScoreSection
                title="ATS Compatibility"
                description="How well your resume works with applicant tracking systems"
                score={resume.feedback.ATS.score}
                tips={resume.feedback.ATS.tips}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                }
              />

              {/* Content Quality */}
              <ScoreSection
                title="Content Quality"
                description="The relevance, depth, and impact of your resume content"
                score={resume.feedback.content.score}
                tips={resume.feedback.content.tips}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />

              {/* Structure & Format */}
              <ScoreSection
                title="Structure & Format"
                description="The organization, layout, and visual appeal of your resume"
                score={resume.feedback.structure.score}
                tips={resume.feedback.structure.tips}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                }
              />

              {/* Skills & Keywords */}
              <ScoreSection
                title="Skills & Keywords"
                description="Relevance and presentation of your technical and soft skills"
                score={resume.feedback.skills.score}
                tips={resume.feedback.skills.tips}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
              />

              {/* Tone & Style */}
              <ScoreSection
                title="Tone & Style"
                description="The professional writing style and communication effectiveness"
                score={resume.feedback.toneAndStyle.score}
                tips={resume.feedback.toneAndStyle.tips}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                }
              />
            </div>

            {/* Action Items Summary */}
            <div className="mt-10 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📝 Action Items Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                  <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Strengths to Maintain
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {[
                      ...resume.feedback.ATS.tips.filter(t => t.type === 'good'),
                      ...resume.feedback.content.tips.filter(t => t.type === 'good'),
                      ...resume.feedback.structure.tips.filter(t => t.type === 'good'),
                      ...resume.feedback.skills.tips.filter(t => t.type === 'good'),
                      ...resume.feedback.toneAndStyle.tips.filter(t => t.type === 'good')
                    ].length} areas where you're excelling
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-600">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Areas for Improvement
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {[
                      ...resume.feedback.ATS.tips.filter(t => t.type === 'improve'),
                      ...resume.feedback.content.tips.filter(t => t.type === 'improve'),
                      ...resume.feedback.structure.tips.filter(t => t.type === 'improve'),
                      ...resume.feedback.skills.tips.filter(t => t.type === 'improve'),
                      ...resume.feedback.toneAndStyle.tips.filter(t => t.type === 'improve')
                    ].length} recommendations to enhance your resume
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="mt-8 text-center">
              <div className="inline-flex items-center space-x-4">
                <Link
                  href="/resume/upload"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Analyze Another Resume
                </Link>
                <Link
                  href="/resume"
                  className="inline-flex items-center px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  View All Analyses
                </Link>
              </div>
            </div>
          </div>
        </div>
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