'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import ScoreCircle from '@/components/resume/ScoreCircle';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import AdvancedResumeFixer from '@/components/resume/ResumeFixer';
import { Resume, ResumeTip } from '@/types/resume';

interface SpecificIssuesSectionProps {
  issues: any[];
  title: string;
}

function SpecificIssuesSection({ issues, title }: SpecificIssuesSectionProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
      <h4 className="font-medium text-red-800 dark:text-red-300 mb-3 flex items-center">
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {title} ({issues.length} issues found)
      </h4>
      <div className="space-y-3">
        {issues.map((issue, index) => (
          <div key={index} className="border-l-4 border-red-400 pl-4 py-2">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {issue.issue || issue.word || issue.phrase || issue.section || issue.pronoun || issue.problem}
                </p>
                {issue.location && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Location: {issue.location}
                  </p>
                )}
                {issue.example && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Example: "{issue.example}"
                  </p>
                )}
                {issue.fix && (
                  <p className="text-xs font-medium text-green-700 dark:text-green-300 mt-2 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                    Fix: {issue.fix}
                  </p>
                )}
              </div>
              {issue.severity && (
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  issue.severity === 'critical' ? 'bg-red-500 text-white' :
                  issue.severity === 'major' ? 'bg-orange-500 text-white' :
                  'bg-yellow-500 text-black'
                }`}>
                  {issue.severity}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TipCardProps {
  tip: ResumeTip & { priority?: string };
  index: number;
}

function TipCard({ tip, index }: TipCardProps) {
  const isGood = tip.type === 'good';
  const priority = tip.priority || 'medium';
  
  const priorityColors = {
    high: 'border-l-red-500 dark:border-l-red-400',
    medium: 'border-l-yellow-500 dark:border-l-yellow-400',
    low: 'border-l-blue-500 dark:border-l-blue-400'
  };

  return (
    <div 
      className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-sm ${
        isGood 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-400 hover:bg-green-100 dark:hover:bg-green-900/30' 
          : `bg-amber-50 dark:bg-amber-900/20 ${priorityColors[priority as keyof typeof priorityColors]} hover:bg-amber-100 dark:hover:bg-amber-900/30`
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1">
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
        {!isGood && priority && (
          <div className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
            priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
            priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>
            {priority}
          </div>
        )}
      </div>
    </div>
  );
}

interface DetailedAnalysisSectionProps {
  title: string;
  description: string;
  score: number;
  tips: any[];
  icon: React.ReactNode;
  sectionData?: any;
}

function DetailedAnalysisSection({ 
  title, 
  description, 
  score, 
  tips, 
  icon, 
  sectionData 
}: DetailedAnalysisSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-200 mb-6">
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

      {sectionData?.specificIssues && (
        <SpecificIssuesSection 
          issues={sectionData.specificIssues} 
          title="Specific Issues Found"
        />
      )}

      {sectionData?.missingSkills && sectionData.missingSkills.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">Missing Critical Skills:</h4>
          <div className="space-y-2">
            {sectionData.missingSkills.map((skill: any, index: number) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-amber-700 dark:text-amber-300">{skill.skill || skill}</span>
                {skill.importance && (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    skill.importance === 'critical' ? 'bg-red-500 text-white' :
                    skill.importance === 'important' ? 'bg-orange-500 text-white' :
                    'bg-blue-500 text-white'
                  }`}>
                    {skill.importance}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {tips.map((tip, index) => (
          <TipCard key={index} tip={tip} index={index} />
        ))}
      </div>
    </div>
  );
}

interface ImprovementRoadmapProps {
  roadmap: any;
}

function ImprovementRoadmap({ roadmap }: ImprovementRoadmapProps) {
  const [activeTab, setActiveTab] = useState<'quick' | 'medium' | 'long'>('quick');

  if (!roadmap) return null;

  const tabs = [
    { key: 'quick' as const, label: 'Quick Wins', data: roadmap?.quickWins || [] },
    { key: 'medium' as const, label: 'Medium Term', data: roadmap?.mediumTermGoals || [] },
    { key: 'long' as const, label: 'Long Term', data: roadmap?.longTermStrategies || [] }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Improvement Roadmap
        </h3>
      </div>

      <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {tabs.find(tab => tab.key === activeTab)?.data.map((item: any, index: number) => (
          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              item.impact === 'high' ? 'bg-red-500' :
              item.impact === 'medium' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}>
              {item.impact === 'high' ? 'H' : item.impact === 'medium' ? 'M' : 'L'}
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 dark:text-white">{item.action}</h4>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Time: {item.timeToComplete}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  item.impact === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                  item.impact === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }`}>
                  {item.impact} impact
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EnhancedResumeDetails() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [highlightedFixes, setHighlightedFixes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadResume = async () => {
      if (!params.id || typeof params.id !== 'string') return;
      
      try {
        const resumeData = await FirebaseService.getResume(params.id);
        if (resumeData && (!user || resumeData.userId === user.uid)) {
          setResume(resumeData);
          
          if (resumeData.imagePath) {
            setImageUrl(resumeData.imagePath);
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
    if (!resume?.resumePath) return;

    if (resume.resumePath.startsWith('data:')) {
      const downloadUrl = FirebaseService.createDownloadableUrl(
        resume.resumePath, 
        `${resume.companyName || 'resume'}_${resume.jobTitle || 'analysis'}.pdf`
      );
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${resume.companyName || 'resume'}_${resume.jobTitle || 'analysis'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
    } else {
      window.open(resume.resumePath, '_blank');
    }
  };

  const handleViewPdf = () => {
    if (!resume?.resumePath) return;

    if (resume.resumePath.startsWith('data:')) {
      const viewUrl = FirebaseService.createDownloadableUrl(resume.resumePath, `${resume.companyName || 'resume'}.pdf`);
      window.open(viewUrl, '_blank');
    } else {
      window.open(resume.resumePath, '_blank');
    }
  };

  if (loading || loadingResume) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading comprehensive analysis..."
        onHide={() => console.log('Resume analysis loaded')}
      />
    );
  }

  if (!user) {
    router.push('/auth');
    return <div>Redirecting to login...</div>;
  }

  if (!resume) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Resume not found</h1>
          <p className="text-gray-600 mb-6">This resume analysis doesn't exist or you don't have permission to view it.</p>
          <Link href="/resume" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const feedback = resume.feedback;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Resume Preview - 40% width */}
      <div className="w-2/5 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="p-6 h-full flex flex-col">
          <div className="flex-1 flex flex-col justify-center min-h-0">
            <div className="w-full max-w-md mx-auto">
              {imageUrl ? (
                <div className="mb-4">
                  <img
                    src={imageUrl}
                    alt="Resume preview"
                    className="w-full rounded-xl shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-600 max-h-[calc(100vh-200px)] object-contain"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[3/4] bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 mb-4">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">Resume preview not available</p>
                  </div>
                </div>
              )}
              
              {/* PDF Action Buttons */}
              <div className="flex flex-col space-y-2 w-full">
                <button 
                  onClick={handleViewPdf}
                  className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  View Full PDF
                </button>
                <button 
                  onClick={handleDownloadPdf}
                  className="w-full flex items-center justify-center px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 60% width */}
      <div className="w-3/5 bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">
            {/* Professional Header Section */}
            <div className="mb-8">
              {/* Navigation and Title */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <Link 
                    href="/resume" 
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                  </Link>
                  <div className="h-6 border-l border-gray-300 dark:border-gray-600"></div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Resume Analysis</h1>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Comprehensive Report</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Generated {new Date().toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              
              {/* Job Application Details */}
              {(resume.companyName || resume.jobTitle) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H10a2 2 0 00-2-2V6m8 0h2a2 2 0 012 2v6.5" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                        Application Target
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        {resume.jobTitle && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 00-2 2H10a2 2 0 00-2-2V6m8 0h2a2 2 0 012 2v6.5" />
                            </svg>
                            {resume.jobTitle}
                          </span>
                        )}
                        {resume.companyName && (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0V9a1 1 0 011-1h4a1 1 0 011 1v11" />
                            </svg>
                            {resume.companyName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Overall Score Card */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-8 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-white">Overall Score</h2>
                  <p className="text-blue-100 text-lg">Your resume's comprehensive performance rating</p>
                  <div className="mt-4">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm">
                        <span className="text-blue-100">Grade: </span>
                        <span className="font-bold text-xl text-white">
                          {(feedback?.overallScore || 0) >= 90 ? 'A+' :
                           (feedback?.overallScore || 0) >= 80 ? 'A' :
                           (feedback?.overallScore || 0) >= 70 ? 'B' :
                           (feedback?.overallScore || 0) >= 60 ? 'C' : 'D'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="w-24 h-24">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.3)" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="40" fill="transparent" stroke="white" strokeWidth="8"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 - ((feedback?.overallScore || 0) / 100) * 2 * Math.PI * 40}`}
                          strokeLinecap="round" 
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-white">{feedback?.overallScore || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Improvement Potential Banner */}
              {(feedback?.overallScore || 0) < 85 && (
                <div className="absolute -bottom-2 -right-2 bg-green-500 text-white px-4 py-2 rounded-tl-xl rounded-br-xl">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-sm font-medium">
                      +{95 - (feedback?.overallScore || 0)} points possible
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Core Analysis Sections */}
            <DetailedAnalysisSection
              title="ATS Compatibility"
              description="How well your resume works with applicant tracking systems"
              score={feedback?.ATS?.score || 0}
              tips={feedback?.ATS?.tips || []}
              sectionData={feedback?.ATS}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              }
            />

            <DetailedAnalysisSection
              title="Content Quality"
              description="The relevance, depth, and impact of your resume content"
              score={feedback?.content?.score || 0}
              tips={feedback?.content?.tips || []}
              sectionData={feedback?.content}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />

            <DetailedAnalysisSection
              title="Structure & Format"
              description="The organization, layout, and visual appeal of your resume"
              score={feedback?.structure?.score || 0}
              tips={feedback?.structure?.tips || []}
              sectionData={feedback?.structure}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              }
            />

            <DetailedAnalysisSection
              title="Skills & Keywords"
              description="Relevance and presentation of your technical and soft skills"
              score={feedback?.skills?.score || 0}
              tips={feedback?.skills?.tips || []}
              sectionData={feedback?.skills}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
            />

            <DetailedAnalysisSection
              title="Tone & Style"
              description="The professional writing style and communication effectiveness"
              score={feedback?.toneAndStyle?.score || 0}
              tips={feedback?.toneAndStyle?.tips || []}
              sectionData={feedback?.toneAndStyle}
              icon={
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
            />

            {/* Enhanced Analysis Sections */}
            {feedback?.dates && (
              <DetailedAnalysisSection
                title="Date Analysis"
                description="Employment dates, consistency, and gap analysis"
                score={feedback.dates.score}
                tips={feedback.dates.tips}
                sectionData={feedback.dates}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
            )}

            {feedback?.skillsSection && (
              <DetailedAnalysisSection
                title="Skills Section Deep Dive"
                description="Comprehensive analysis of your skills presentation and relevance"
                score={feedback.skillsSection.score}
                tips={feedback.skillsSection.tips}
                sectionData={feedback.skillsSection}
                icon={
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
              />
            )}

            {feedback?.improvementRoadmap && <ImprovementRoadmap roadmap={feedback.improvementRoadmap} />}

            {/* AI Resume Fixer Section - Conditional rendering based on resume data */}
            {resume && resume.imagePath && (
              <AdvancedResumeFixer 
                resume={resume} 
                jobDescription={resume.jobTitle}
                onHighlightChange={setHighlightedFixes}
              />
            )}

            {/* Fallback message if no resume image available */}
            {(!resume.imagePath) && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">AI Resume Fixer Unavailable</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Resume image is required for AI-powered fixes. Please re-upload your resume to enable this feature.
                  </p>
                  <Link
                    href="/resume/upload"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload New Resume
                  </Link>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="text-center mt-8">
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
    </div>
  );
}