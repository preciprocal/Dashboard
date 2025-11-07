// app/resume/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import { Resume } from '@/types/resume';
import { 
  ArrowLeft, 
  Download, 
  Eye, 
  FileText, 
  Building2, 
  Briefcase,
  Target,
  CheckCircle2,
  Shield,
  Edit3,
  Star,
  TrendingUp,
  Calendar,
  Loader2,
  Wand2,
  Award,
  Activity,
  PenTool
} from 'lucide-react';
import { AlertTriangle, Zap, Clock } from 'lucide-react';
import ScoreCircle from '@/components/resume/ScoreCircle';
import JobMatcher from '@/components/resume/JobMatcher';
import RecruiterEyeSimulation from '@/components/resume/RecruiterEyeSimulation';
import ResumeRewriter from '@/components/resume/ResumeRewriter';

// Helper function to get score color
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

// Helper function to get score label
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Improvement';
}

// Helper function to get grade
function getGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  return 'C';
}

// Overall Score Hero Component
function OverallScoreHero({ score }: { score: number }) {
  const improvementPotential = Math.min(95 - score, 95);

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-8 text-white mb-8 shadow-xl relative overflow-hidden">
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
            <div className="text-6xl font-bold text-white">{score}</div>
            <div>
              <div className="text-2xl font-semibold text-white mb-1">
                Grade: {getGrade(score)}
              </div>
              <div className="text-blue-100 text-lg">{getScoreLabel(score)}</div>
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 ml-8">
          <ScoreCircle score={score} size="large" />
        </div>
      </div>

      {score < 90 && improvementPotential > 0 && (
        <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-white" />
              <span className="text-white font-medium">Improvement Potential</span>
            </div>
            <div className="text-white font-bold text-lg">
              +{improvementPotential} points available
            </div>
          </div>
          <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-1000"
              style={{ width: `${(score / 95) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

// Detailed Analysis Section Component
function DetailedAnalysisSection({ 
  title, 
  description, 
  score, 
  tips, 
  icon, 
  sectionData 
}: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const goodTips = tips.filter((tip: any) => tip.type === 'good');
  const improveTips = tips.filter((tip: any) => tip.type !== 'good');

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

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{tips.length}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Recommendations</div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{goodTips.length}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Strengths</div>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{improveTips.length}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400">To Improve</div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </span>
          <svg 
            className={`w-5 h-5 text-slate-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="px-6 pb-6">
            {sectionData?.specificIssues && sectionData.specificIssues.length > 0 && (
              <div className="mt-6 p-5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <h4 className="font-semibold text-red-900 dark:text-red-200">Critical Issues</h4>
                </div>
                <div className="space-y-3">
                  {sectionData.specificIssues.map((issue: any, index: number) => (
                    <div key={index} className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20">
                      <p className="font-medium text-red-900 dark:text-red-200 mb-2">
                        {issue.issue || issue.word || issue.phrase}
                      </p>
                      {issue.fix && (
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-md p-3 border border-emerald-200 dark:border-emerald-800/30">
                          <div className="flex items-start">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{issue.fix}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
              {tips.map((tip: any, index: number) => {
                const tipText = tip.tip || tip.message || '';
                const isGood = tip.type === 'good';
                
                return (
                  <div
                    key={index}
                    className={`p-5 rounded-xl border transition-all duration-200 hover:shadow-md ${
                      isGood
                        ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 border-emerald-200 dark:border-emerald-800/30'
                        : 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border-amber-200 dark:border-amber-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isGood ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
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
                            {tipText}
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
                      
                      {!isGood && tip.priority && (
                        <div className="ml-3">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                            tip.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            tip.priority === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {tip.priority}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Improvement Roadmap Component
function ImprovementRoadmap({ roadmap }: any) {
  const [activeTab, setActiveTab] = useState<'quick' | 'medium' | 'long'>('quick');

  if (!roadmap) return null;

  const tabs = [
    { 
      key: 'quick' as const, 
      label: 'Quick Wins', 
      data: roadmap?.quickWins || [],
      icon: <Zap className="w-4 h-4" />
    },
    { 
      key: 'medium' as const, 
      label: 'Medium Term', 
      data: roadmap?.mediumTermGoals || roadmap?.mediumTerm || [],
      icon: <Clock className="w-4 h-4" />
    },
    { 
      key: 'long' as const, 
      label: 'Long Term', 
      data: roadmap?.longTermStrategies || roadmap?.longTerm || [],
      icon: <TrendingUp className="w-4 h-4" />
    }
  ];

  const activeTabData = tabs.find(tab => tab.key === activeTab);

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
              <p className="text-slate-600 dark:text-slate-400 text-sm">Strategic action plan for optimization</p>
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
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.key 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}>
                {tab.data.length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        {activeTabData && activeTabData.data.length > 0 ? (
          <div className="space-y-4">
            {activeTabData.data.map((item: any, index: number) => (
              <div key={index} className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                    item.impact === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    item.impact === 'medium' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                    'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}>
                    {item.priority || index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">{item.action}</h4>
                    <div className="flex items-center gap-4 flex-wrap">
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
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-600 dark:text-slate-400">No items in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Component
export default function ResumeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  
  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [error, setError] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'analysis' | 'jobmatch' | 'recruiter' | 'rewriter'>('analysis');

  useEffect(() => {
    const loadResume = async () => {
      if (!params.id || typeof params.id !== 'string') {
        setError('Invalid resume ID');
        setLoadingResume(false);
        return;
      }
      
      try {
        console.log('🔍 Loading resume:', params.id);
        const resumeData = await FirebaseService.getResume(params.id);
        
        if (!resumeData) {
          setError('Resume not found');
          setResume(null);
        } else if (user && resumeData.userId !== user.uid) {
          setError('Access denied');
          setResume(null);
        } else {
          console.log('✅ Resume loaded successfully');
          console.log('📊 Resume data:', {
            id: resumeData.id,
            hasImagePath: !!resumeData.imagePath,
            imagePathType: resumeData.imagePath ? 
              (resumeData.imagePath.startsWith('data:') ? 'base64' : 'url') : 'none',
            imagePathLength: resumeData.imagePath?.length,
            hasResumePath: !!resumeData.resumePath
          });
          
          setResume(resumeData);
          
          if (resumeData.imagePath) {
            console.log('🖼️ Setting image URL:', resumeData.imagePath.substring(0, 50) + '...');
            setImageUrl(resumeData.imagePath);
          } else {
            console.warn('⚠️ No imagePath found in resume data');
          }
        }
      } catch (error) {
        console.error('❌ Error loading resume:', error);
        setError('Failed to load resume');
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
    if (!resume?.resumePath) {
      alert('PDF not available');
      return;
    }

    try {
      if (resume.resumePath.startsWith('data:')) {
        const downloadUrl = FirebaseService.createDownloadableUrl(
          resume.resumePath, 
          resume.originalFileName || `resume_${resume.id}.pdf`
        );
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = resume.originalFileName || `resume_${resume.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);
      } else {
        window.open(resume.resumePath, '_blank');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download PDF');
    }
  };

  const handleViewPdf = () => {
    if (!resume?.resumePath) {
      alert('PDF not available');
      return;
    }

    try {
      if (resume.resumePath.startsWith('data:')) {
        const viewUrl = FirebaseService.createDownloadableUrl(
          resume.resumePath, 
          resume.originalFileName || `resume_${resume.id}.pdf`
        );
        window.open(viewUrl, '_blank');
      } else {
        window.open(resume.resumePath, '_blank');
      }
    } catch (error) {
      console.error('View failed:', error);
      alert('Failed to view PDF');
    }
  };

  if (loading || loadingResume) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading comprehensive analysis...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  if (error || !resume) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{error || 'Resume Not Found'}</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            {error === 'Access denied' ? 'This resume belongs to another user.' : 'This analysis doesn\'t exist or has been deleted.'}
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
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Resume Preview Panel */}
      <div className="w-2/5 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 h-full flex flex-col">
        <div className="p-6 flex-1 flex flex-col min-h-0">
          <div className="mb-6 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resume Preview</h2>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600 dark:text-slate-400">Live</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center items-center min-h-0 overflow-y-auto">
            <div className="w-full max-w-md px-2 py-4">
              {imageUrl ? (
                <div className="mb-4">
                  <img
                    src={imageUrl}
                    alt="Resume preview"
                    className="w-full rounded-2xl shadow-xl border border-slate-200 dark:border-slate-600 object-contain"
                    onError={(e) => {
                      console.error('Image failed to load:', imageUrl?.substring(0, 100));
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) {
                        fallback.classList.remove('hidden');
                      }
                    }}
                  />
                  <div className="hidden w-full aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                    <div className="text-center px-4">
                      <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-slate-500 dark:text-slate-400 font-medium">Preview Failed to Load</p>
                      <p className="text-xs text-slate-400 mt-2">Use View/Download buttons below</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-[3/4] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 mb-4">
                  <div className="text-center px-4">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Preview Not Available</p>
                    <p className="text-xs text-slate-400 mt-2">Use View/Download buttons below</p>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col space-y-2 w-full flex-shrink-0">
                {/* NEW: AI Writer Button - PROMINENT PLACEMENT */}
                <Link href={`/resume/writer?id=${resume.id}`}>
                  <button className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                    <PenTool className="w-5 h-5 mr-2" />
                    Open AI Writer
                  </button>
                </Link>

                <button 
                  onClick={handleViewPdf}
                  disabled={!resume.resumePath}
                  className="w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  View Full Document
                </button>
                <button 
                  onClick={handleDownloadPdf}
                  disabled={!resume.resumePath}
                  className="w-full flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-3/5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-y-auto h-screen">
        <div className="min-h-full">
          <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-6">
                  <Link 
                    href="/resume" 
                    className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Link>
                  
                  <div className="h-8 border-l border-slate-300 dark:border-slate-600"></div>
                  
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">Comprehensive Analysis</h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">AI-powered evaluation with Gemini 2.0</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-semibold text-sm">Complete</span>
                </div>
              </div>
              
              {/* Target Info */}
              {(resume.companyName || resume.jobTitle) && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 mb-6 shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
                      <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Application Target</h3>
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

            {/* Tab Navigation */}
            <div className="flex space-x-2 bg-slate-200 dark:bg-slate-700 rounded-xl p-1.5 mb-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('analysis')}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'analysis'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="whitespace-nowrap">Detailed Analysis</span>
              </button>
              <button
                onClick={() => setActiveTab('jobmatch')}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'jobmatch'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Target className="w-4 h-4" />
                <span className="whitespace-nowrap">Job Match</span>
              </button>
              <button
                onClick={() => setActiveTab('recruiter')}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'recruiter'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="whitespace-nowrap">Recruiter View</span>
              </button>
              <button
                onClick={() => setActiveTab('rewriter')}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'rewriter'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Wand2 className="w-4 h-4" />
                <span className="whitespace-nowrap">AI Rewriter</span>
              </button>
            </div>

            {/* Overall Score Hero */}
            <OverallScoreHero score={feedback?.overallScore || 0} />

            {/* Tab Content */}
            {activeTab === 'analysis' && feedback && (
              <div className="space-y-6 mb-8 mt-8">
                <DetailedAnalysisSection
                  title="ATS Compatibility"
                  description="How well your resume works with applicant tracking systems"
                  score={feedback.ATS?.score || feedback.ats?.score || 0}
                  tips={feedback.ATS?.tips || feedback.ats?.tips || []}
                  sectionData={feedback.ATS || feedback.ats}
                  icon={<Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                />

                <DetailedAnalysisSection
                  title="Content Quality"
                  description="The relevance, depth, and impact of your resume content"
                  score={feedback.content?.score || 0}
                  tips={feedback.content?.tips || []}
                  sectionData={feedback.content}
                  icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                />

                <DetailedAnalysisSection
                  title="Structure & Format"
                  description="The organization, layout, and visual appeal of your resume"
                  score={feedback.structure?.score || 0}
                  tips={feedback.structure?.tips || []}
                  sectionData={feedback.structure}
                  icon={<Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                />

                <DetailedAnalysisSection
                  title="Skills & Keywords"
                  description="Relevance and presentation of your technical and soft skills"
                  score={feedback.skills?.score || 0}
                  tips={feedback.skills?.tips || []}
                  sectionData={feedback.skills}
                  icon={<Star className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                />

                {feedback.toneAndStyle && (
                  <DetailedAnalysisSection
                    title="Tone & Style"
                    description="Professional writing style and communication effectiveness"
                    score={feedback.toneAndStyle.score}
                    tips={feedback.toneAndStyle.tips}
                    sectionData={feedback.toneAndStyle}
                    icon={<Edit3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                  />
                )}

                {feedback.impact && (
                  <DetailedAnalysisSection
                    title="Impact & Metrics"
                    description="Use of quantifiable achievements and business impact"
                    score={feedback.impact.score}
                    tips={feedback.impact.tips}
                    sectionData={feedback.impact}
                    icon={<TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                  />
                )}

                {feedback.dates && (
                  <DetailedAnalysisSection
                    title="Date Analysis"
                    description="Employment dates, consistency, and gap analysis"
                    score={feedback.dates.score}
                    tips={feedback.dates.tips}
                    sectionData={feedback.dates}
                    icon={<Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                  />
                )}

                {feedback.improvementRoadmap && (
                  <ImprovementRoadmap roadmap={feedback.improvementRoadmap} />
                )}
              </div>
            )}

            {activeTab === 'jobmatch' && (
              <div className="mt-8">
                <JobMatcher 
                  resumeId={resume.id}
                  resumeText={feedback?.resumeText}
                  preloadedMatch={feedback?.jobMatch}
                />
              </div>
            )}

            {activeTab === 'recruiter' && (
              <div className="mt-8">
                <RecruiterEyeSimulation 
                  resumeId={resume.id}
                  imageUrl={imageUrl}
                  preloadedData={feedback?.recruiterSimulation}
                />
              </div>
            )}

            {activeTab === 'rewriter' && (
              <div className="mt-8">
                <ResumeRewriter 
                  resumeId={resume.id}
                  userId={user.uid}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="text-center pb-8 mt-8">
              <div className="inline-flex flex-col sm:flex-row items-center gap-4">
                <Link
                  href="/resume/upload"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Analyze Another Resume
                </Link>
                
                <Link
                  href="/resume"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
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