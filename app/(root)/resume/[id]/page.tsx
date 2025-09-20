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
import { 
  ArrowLeft, 
  Download, 
  Eye, 
  FileText, 
  Building2, 
  Briefcase, 
  Calendar,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Target,
  Shield,
  Edit3,
  Zap,
  Clock,
  Star,
  Award,
  Activity
} from 'lucide-react';

interface SpecificIssuesSectionProps {
  issues: any[];
  title: string;
}

function SpecificIssuesSection({ issues, title }: SpecificIssuesSectionProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="mt-6 p-5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h4 className="font-semibold text-red-900 dark:text-red-200">{title}</h4>
          <p className="text-sm text-red-700 dark:text-red-300">{issues.length} critical issues identified</p>
        </div>
      </div>
      
      <div className="space-y-3">
        {issues.map((issue, index) => (
          <div key={index} className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-red-900 dark:text-red-200 mb-2">
                  {issue.issue || issue.word || issue.phrase || issue.section || issue.pronoun || issue.problem}
                </p>
                
                {issue.location && (
                  <div className="flex items-center mb-2">
                    <Target className="w-3 h-3 text-red-500 mr-1" />
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {issue.location}
                    </span>
                  </div>
                )}
                
                {issue.example && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-2 mb-2">
                    <p className="text-xs font-mono text-red-700 dark:text-red-300">
                      "{issue.example}"
                    </p>
                  </div>
                )}
                
                {issue.fix && (
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-md p-3 border border-emerald-200 dark:border-emerald-800/30">
                    <div className="flex items-start">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        {issue.fix}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {issue.severity && (
                <span className={`ml-3 px-2 py-1 rounded-full text-xs font-semibold ${
                  issue.severity === 'critical' ? 'bg-red-500 text-white' :
                  issue.severity === 'major' ? 'bg-orange-500 text-white' :
                  'bg-amber-500 text-white'
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
  
  const cardStyles = isGood
    ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 border-emerald-200 dark:border-emerald-800/30'
    : 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border-amber-200 dark:border-amber-800/30';

  return (
    <div className={`p-5 rounded-xl border transition-all duration-200 hover:shadow-md ${cardStyles}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1">
          <div className="flex-shrink-0 mt-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isGood 
                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              {isGood ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
            </div>
          </div>
          
          <div className="ml-4 flex-1">
            <h4 className={`text-base font-semibold mb-2 ${
              isGood ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'
            }`}>
              {tip.tip}
            </h4>
            
            {tip.explanation && (
              <p className={`text-sm leading-relaxed ${
                isGood ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
              }`}>
                {tip.explanation}
              </p>
            )}
          </div>
        </div>
        
        {!isGood && priority && (
          <div className="ml-3">
            <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
              priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
              priority === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
              'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            }`}>
              {priority} priority
            </span>
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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
              {icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-3 mb-2">
              <ScoreCircle score={score} size="medium" />
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{score}</div>
                <div className={`text-xs font-medium ${getScoreColor(score)}`}>
                  {getScoreLabel(score)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{tips.length}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Recommendations</div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {tips.filter(tip => tip.type === 'good').length}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Strengths</div>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {tips.filter(tip => tip.type !== 'good').length}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">Areas to Improve</div>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <div className="border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </span>
          <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isExpanded && (
          <div className="px-6 pb-6">
            {sectionData?.specificIssues && (
              <SpecificIssuesSection 
                issues={sectionData.specificIssues} 
                title="Critical Issues"
              />
            )}

            {sectionData?.missingSkills && sectionData.missingSkills.length > 0 && (
              <div className="mt-6 p-5 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 rounded-xl border border-orange-200 dark:border-orange-800/30">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mr-3">
                    <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-orange-900 dark:text-orange-200">Missing Critical Skills</h4>
                </div>
                <div className="space-y-3">
                  {sectionData.missingSkills.map((skill: any, index: number) => (
                    <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-orange-100 dark:border-orange-800/20">
                      <span className="font-medium text-orange-800 dark:text-orange-200">
                        {skill.skill || skill}
                      </span>
                      {skill.importance && (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
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
            
            <div className="mt-6 space-y-4">
              {tips.map((tip, index) => (
                <TipCard key={index} tip={tip} index={index} />
              ))}
            </div>
          </div>
        )}
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
    { 
      key: 'quick' as const, 
      label: 'Quick Wins', 
      data: roadmap?.quickWins || [],
      icon: <Zap className="w-4 h-4" />,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
    },
    { 
      key: 'medium' as const, 
      label: 'Medium Term', 
      data: roadmap?.mediumTermGoals || [],
      icon: <Clock className="w-4 h-4" />,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30'
    },
    { 
      key: 'long' as const, 
      label: 'Long Term', 
      data: roadmap?.longTermStrategies || [],
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
    }
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl">
              <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Improvement Roadmap</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">Strategic action plan for resume optimization</p>
            </div>
          </div>
        </div>

        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-700 rounded-xl p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="space-y-4">
          {tabs.find(tab => tab.key === activeTab)?.data.map((item: any, index: number) => (
            <div key={index} className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                  item.impact === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                  item.impact === 'medium' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  'bg-gradient-to-r from-blue-500 to-indigo-500'
                }`}>
                  {item.impact === 'high' ? 'H' : item.impact === 'medium' ? 'M' : 'L'}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{item.action}</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 mr-1" />
                      {item.timeToComplete}
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      item.impact === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      item.impact === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {item.impact} impact
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Resume Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            This resume analysis doesn't exist or you don't have permission to view it.
          </p>
          <Link 
            href="/resume" 
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const feedback = resume.feedback;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Resume Preview Panel - Sticky and Non-scrollable */}
      <div className="w-2/5 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 sticky top-0 h-screen overflow-hidden">
        <div className="p-6 h-full flex flex-col">
          {/* Preview Header - Fixed */}
          <div className="mb-6 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resume Preview</h2>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Live Preview</span>
              </div>
            </div>
          </div>

          {/* Preview Content - Centered */}
          <div className="flex-1 flex flex-col justify-center min-h-0">
            <div className="w-full max-w-md mx-auto">
              {imageUrl ? (
                <div className="mb-4">
                  <img
                    src={imageUrl}
                    alt="Resume preview"
                    className="w-full rounded-2xl shadow-xl transition-all duration-200 border border-slate-200 dark:border-slate-600 max-h-[calc(100vh-200px)] object-contain"
                  />
                </div>
              ) : (
                <div className="w-full aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 mb-4 max-h-[calc(100vh-200px)]">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Preview Not Available</p>
                    <p className="text-sm text-slate-400">Upload a new resume for preview</p>
                  </div>
                </div>
              )}
              
              {/* Action Buttons - Fixed at bottom */}
              <div className="flex flex-col space-y-2 w-full">
                <button 
                  onClick={handleViewPdf}
                  className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Document
                </button>
                <button 
                  onClick={handleDownloadPdf}
                  className="w-full flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analysis Content - Scrollable */}
      <div className="w-3/5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-y-auto">
        <div className="min-h-full">
          <div className="p-6 lg:p-8">
            {/* Header Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-6">
                  <Link 
                    href="/resume" 
                    className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Link>
                  
                  <div className="h-8 border-l border-slate-300 dark:border-slate-600"></div>
                  
                  <div className="flex-1">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">Resume Analysis Report</h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400">Comprehensive AI-powered performance evaluation</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="font-semibold">Analysis Complete</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Generated on {new Date().toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
              
              {/* Application Target Card */}
              {(resume.companyName || resume.jobTitle) && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
                      <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                        Application Target
                      </h3>
                      <div className="flex flex-wrap items-center gap-3">
                        {resume.jobTitle && (
                          <div className="inline-flex items-center px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30">
                            <Briefcase className="w-4 h-4 mr-2" />
                            {resume.jobTitle}
                          </div>
                        )}
                        {resume.companyName && (
                          <div className="inline-flex items-center px-4 py-2 rounded-xl font-medium bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/30 dark:to-green-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
                            <Building2 className="w-4 h-4 mr-2" />
                            {resume.companyName}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Overall Score Hero Section */}
            <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-8 text-white mb-8 shadow-xl relative overflow-hidden">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full"></div>
              </div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-white/20 rounded-xl">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Overall Score</h2>
                      <p className="text-blue-100">Your resume's comprehensive performance rating</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-5xl font-bold text-white">
                      {feedback?.overallScore || 0}
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-white mb-1">
                        Grade: {(feedback?.overallScore || 0) >= 90 ? 'A+' :
                               (feedback?.overallScore || 0) >= 80 ? 'A' :
                               (feedback?.overallScore || 0) >= 70 ? 'B' :
                               (feedback?.overallScore || 0) >= 60 ? 'C' : 'D'}
                      </div>
                      <div className="text-blue-100">
                        {(feedback?.overallScore || 0) >= 90 ? 'Outstanding' :
                         (feedback?.overallScore || 0) >= 80 ? 'Excellent' :
                         (feedback?.overallScore || 0) >= 70 ? 'Good' :
                         (feedback?.overallScore || 0) >= 60 ? 'Fair' : 'Needs Work'}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 ml-8">
                  <div className="relative">
                    <ScoreCircle score={feedback?.overallScore || 0} size="large" />
                  </div>
                </div>
              </div>

              {/* Improvement Potential */}
              {(feedback?.overallScore || 0) < 90 && (
                <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-white" />
                      <span className="text-white font-medium">Improvement Potential</span>
                    </div>
                    <div className="text-white font-bold">
                      +{95 - (feedback?.overallScore || 0)} points available
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Sections */}
            <div className="space-y-6 mb-8">
              <DetailedAnalysisSection
                title="ATS Compatibility"
                description="How well your resume works with applicant tracking systems"
                score={feedback?.ATS?.score || 0}
                tips={feedback?.ATS?.tips || []}
                sectionData={feedback?.ATS}
                icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              />

              <DetailedAnalysisSection
                title="Content Quality"
                description="The relevance, depth, and impact of your resume content"
                score={feedback?.content?.score || 0}
                tips={feedback?.content?.tips || []}
                sectionData={feedback?.content}
                icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              />

              <DetailedAnalysisSection
                title="Structure & Format"
                description="The organization, layout, and visual appeal of your resume"
                score={feedback?.structure?.score || 0}
                tips={feedback?.structure?.tips || []}
                sectionData={feedback?.structure}
                icon={<Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              />

              <DetailedAnalysisSection
                title="Skills & Keywords"
                description="Relevance and presentation of your technical and soft skills"
                score={feedback?.skills?.score || 0}
                tips={feedback?.skills?.tips || []}
                sectionData={feedback?.skills}
                icon={<Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              />

              <DetailedAnalysisSection
                title="Tone & Style"
                description="The professional writing style and communication effectiveness"
                score={feedback?.toneAndStyle?.score || 0}
                tips={feedback?.toneAndStyle?.tips || []}
                sectionData={feedback?.toneAndStyle}
                icon={<Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
              />

              {feedback?.dates && (
                <DetailedAnalysisSection
                  title="Date Analysis"
                  description="Employment dates, consistency, and gap analysis"
                  score={feedback.dates.score}
                  tips={feedback.dates.tips}
                  sectionData={feedback.dates}
                  icon={<Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                />
              )}
            </div>

            {feedback?.improvementRoadmap && (
              <div className="mb-8">
                <ImprovementRoadmap roadmap={feedback.improvementRoadmap} />
              </div>
            )}

            {/* Next Steps */}
            <div className="text-center">
              <div className="inline-flex items-center gap-4">
                <Link
                  href="/resume/upload"
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Analyze Another Resume
                </Link>
                <Link
                  href="/resume"
                  className="inline-flex items-center px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
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