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
  Loader2,
  
  Award,
  Activity,
  PenTool,
  ChevronDown,
  AlertTriangle,
  Zap,
  Clock
} from 'lucide-react';
import ScoreCircle from '@/components/resume/ScoreCircle';
import JobMatcher from '@/components/resume/JobMatcher';
import RecruiterEyeSimulation from '@/components/resume/RecruiterEyeSimulation';
import Image from 'next/image';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Work';
}

function OverallScoreHero({ score }: { score: number }) {
  const improvementPotential = Math.min(95 - score, 95);

  return (
    <div className="glass-card-gradient hover-lift">
      <div className="glass-card-gradient-inner">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glass">
                <Award className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Overall Score</h2>
                <p className="text-slate-400 text-sm">Comprehensive rating</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-white">{score}%</div>
              <div className={`text-xl font-semibold ${getScoreColor(score)}`}>
                {getScoreLabel(score)}
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0 ml-6">
            <ScoreCircle score={score} size="large" />
          </div>
        </div>

        {score < 90 && improvementPotential > 0 && (
          <div className="mt-5 glass-morphism p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-medium text-sm">Growth Potential</span>
              </div>
              <div className="text-white font-bold">+{improvementPotential} points</div>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full gradient-success transition-all duration-1000"
                style={{ width: `${(score / 95) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface Tip {
  tip?: string;
  message?: string;
  type?: string;
  explanation?: string;
  priority?: 'high' | 'medium' | 'low';
}

function DetailedAnalysisSection({ 
  title, 
  description, 
  score, 
  tips, 
  icon
}: { 
  title: string;
  description: string;
  score: number;
  tips: Tip[];
  icon: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const goodTips = tips.filter((tip: Tip) => tip.type === 'good');
  const improveTips = tips.filter((tip: Tip) => tip.type !== 'good');

  return (
    <div className="glass-card-gradient hover-lift">
      <div className="glass-card-gradient-inner">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-accent rounded-lg flex items-center justify-center shadow-glass">
              {icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-slate-400 text-xs">{description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <ScoreCircle score={score} size="medium" />
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{score}%</div>
              <div className={`text-xs font-medium ${getScoreColor(score)}`}>
                {getScoreLabel(score)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass-morphism rounded-lg p-3 text-center border border-white/5">
            <div className="text-base font-bold text-white">{tips.length}</div>
            <div className="text-xs text-slate-400">Tips</div>
          </div>
          <div className="glass-morphism rounded-lg p-3 text-center border border-white/5">
            <div className="text-base font-bold text-emerald-400">{goodTips.length}</div>
            <div className="text-xs text-slate-400">Strengths</div>
          </div>
          <div className="glass-morphism rounded-lg p-3 text-center border border-white/5">
            <div className="text-base font-bold text-amber-400">{improveTips.length}</div>
            <div className="text-xs text-slate-400">To Improve</div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full glass-button hover-lift px-4 py-2.5 rounded-lg text-white font-medium text-sm flex items-center justify-center gap-2"
        >
          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
          <ChevronDown className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="mt-5 space-y-3">
            {tips.map((tip: Tip, index: number) => {
              const tipText = tip.tip || tip.message || '';
              const isGood = tip.type === 'good';
              
              return (
                <div
                  key={index}
                  className={`glass-morphism p-4 rounded-xl border transition-all ${
                    isGood ? 'border-emerald-500/30' : 'border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isGood ? 'bg-emerald-500/20' : 'bg-amber-500/20'
                    }`}>
                      {isGood ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <p className={`text-sm font-medium mb-1 ${
                        isGood ? 'text-emerald-300' : 'text-amber-300'
                      }`}>
                        {tipText}
                      </p>
                      
                      {tip.explanation && (
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {tip.explanation}
                        </p>
                      )}
                    </div>
                    
                    {!isGood && tip.priority && (
                      <div className={`priority-badge text-xs ${
                        tip.priority === 'high' ? 'priority-badge-high' :
                        tip.priority === 'medium' ? 'priority-badge-medium' :
                        'priority-badge-low'
                      }`}>
                        {tip.priority}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface RoadmapItem {
  action: string;
  timeToComplete: string;
  impact: 'high' | 'medium' | 'low';
}

interface ImprovementRoadmapData {
  quickWins?: RoadmapItem[];
  mediumTermGoals?: RoadmapItem[];
  mediumTerm?: RoadmapItem[];
  longTermStrategies?: RoadmapItem[];
  longTerm?: RoadmapItem[];
}

function ImprovementRoadmap({ roadmap }: { roadmap: ImprovementRoadmapData }) {
  const [activeTab, setActiveTab] = useState<'quick' | 'medium' | 'long'>('quick');

  if (!roadmap) return null;

  const tabs = [
    { key: 'quick' as const, label: 'Quick Wins', data: roadmap?.quickWins || [], icon: <Zap className="w-4 h-4" /> },
    { key: 'medium' as const, label: 'Medium Term', data: roadmap?.mediumTermGoals || roadmap?.mediumTerm || [], icon: <Clock className="w-4 h-4" /> },
    { key: 'long' as const, label: 'Long Term', data: roadmap?.longTermStrategies || roadmap?.longTerm || [], icon: <TrendingUp className="w-4 h-4" /> }
  ];

  const activeTabData = tabs.find(tab => tab.key === activeTab);

  return (
    <div className="glass-card-gradient hover-lift">
      <div className="glass-card-gradient-inner">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center shadow-glass">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Improvement Roadmap</h3>
            <p className="text-slate-400 text-xs">Strategic action plan</p>
          </div>
        </div>

        <div className="glass-morphism rounded-xl p-1.5 mb-4">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white/10 text-white shadow-glass'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="text-xs font-bold">{tab.data.length}</span>
              </button>
            ))}
          </div>
        </div>

        {activeTabData && activeTabData.data.length > 0 ? (
          <div className="space-y-3">
            {activeTabData.data.map((item: RoadmapItem, index: number) => (
              <div key={index} className="glass-morphism rounded-lg p-4 border border-white/5 hover-lift">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                    item.impact === 'high' ? 'bg-red-500' :
                    item.impact === 'medium' ? 'bg-amber-500' :
                    'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white mb-2 text-sm">{item.action}</h4>
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      <div className="flex items-center text-slate-400">
                        <Clock className="w-3 h-3 mr-1" />
                        {item.timeToComplete}
                      </div>
                      <span className={`priority-badge text-xs ${
                        item.impact === 'high' ? 'priority-badge-high' :
                        item.impact === 'medium' ? 'priority-badge-medium' :
                        'priority-badge-low'
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
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm">No items in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
        const resumeData = await FirebaseService.getResume(params.id);
        
        if (!resumeData) {
          setError('Resume not found');
          setResume(null);
        } else if (user && resumeData.userId !== user.uid) {
          setError('Access denied');
          setResume(null);
        } else {
          setResume(resumeData);
          if (resumeData.imagePath) {
            setImageUrl(resumeData.imagePath);
          }
        }
      } catch (err) {
        console.error('Error loading resume:', err);
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
        const downloadUrl = FirebaseService.createDownloadableUrl(resume.resumePath);
        
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
    } catch (err) {
      console.error('Download failed:', err);
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
        const viewUrl = FirebaseService.createDownloadableUrl(resume.resumePath);
        window.open(viewUrl, '_blank');
      } else {
        window.open(resume.resumePath, '_blank');
      }
    } catch (err) {
      console.error('View failed:', err);
      alert('Failed to view PDF');
    }
  };

  if (loading || loadingResume) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading analysis...</p>
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="glass-card-gradient hover-lift max-w-md">
          <div className="glass-card-gradient-inner text-center p-8">
            <div className="w-16 h-16 gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glass">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{error || 'Resume Not Found'}</h1>
            <p className="text-slate-400 mb-6 text-sm">
              {error === 'Access denied' ? 'This resume belongs to another user.' : 'This analysis does not exist.'}
            </p>
            <Link 
              href="/resume" 
              className="glass-button-primary hover-lift inline-flex items-center px-6 py-3 rounded-xl font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Resumes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const feedback = resume.feedback;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Panel: Resume Preview - FIXED */}
      <div className="w-2/5 flex-shrink-0 flex flex-col h-full">
        <div className="glass-card h-full flex flex-col m-4 mr-2">
          <div className="p-5 flex-1 flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="mb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Resume Preview</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-slate-400">Live</span>
                </div>
              </div>
            </div>

            {/* Scrollable Image */}
            <div className="flex-1 overflow-y-auto glass-scrollbar mb-4">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Resume preview"
                  width={800}
                  height={1000}
                  className="w-full rounded-xl shadow-glass border border-white/10 object-contain"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling;
                    if (fallback) {
                      (fallback as HTMLElement).classList.remove('hidden');
                    }
                  }}
                />
              ) : null}
              <div className={imageUrl ? 'hidden' : 'w-full aspect-[3/4] glass-morphism rounded-xl flex items-center justify-center border border-dashed border-white/20'}>
                <div className="text-center p-4">
                  <FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Preview unavailable</p>
                </div>
              </div>
            </div>
            
            {/* Fixed Buttons at Bottom */}
            <div className="space-y-2 flex-shrink-0">
              <Link href={`/resume/writer?id=${resume.id}`}>
                <button className="w-full glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                  <PenTool className="w-4 h-4" />
                  AI Writer
                </button>
              </Link>
              
              <button 
                onClick={handleViewPdf}
                disabled={!resume.resumePath}
                className="w-full glass-button hover-lift text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Eye className="w-4 h-4" />
                View Document
              </button>
              
              <button 
                onClick={handleDownloadPdf}
                disabled={!resume.resumePath}
                className="w-full glass-button hover-lift text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Analysis Content - SCROLLABLE */}
      <div className="w-3/5 flex-shrink-0 h-full overflow-y-auto glass-scrollbar">
        <div className="p-6 lg:p-8 space-y-6">
          
          {/* Header */}
          <div className="glass-card animate-fade-in-up">
            <div className="p-6">
              <Link 
                href="/resume" 
                className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                All Resumes
              </Link>
              
              <h1 className="text-2xl font-bold text-white mb-1">Resume Analysis</h1>
              <p className="text-sm text-slate-400">AI-powered evaluation with Preciprocal AI</p>

              {(resume.companyName || resume.jobTitle) && (
                <div className="flex items-center gap-2 mt-4">
                  {resume.jobTitle && (
                    <div className="priority-badge priority-badge-low text-xs">
                      <Briefcase className="w-3 h-3 mr-1 inline" />
                      {resume.jobTitle}
                    </div>
                  )}
                  {resume.companyName && (
                    <div className="priority-badge priority-badge-success text-xs">
                      <Building2 className="w-3 h-3 mr-1 inline" />
                      {resume.companyName}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="glass-morphism rounded-xl p-2 animate-fade-in-up">
            <div className="flex gap-2">
              {[
                { id: 'analysis', label: 'Analysis', icon: Shield },
                { id: 'jobmatch', label: 'Job Match', icon: Target },
                { id: 'recruiter', label: 'Recruiter', icon: Eye },
                
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'analysis' | 'jobmatch' | 'recruiter' | 'rewriter')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-glass'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Overall Score */}
          <div className="animate-fade-in-up">
            <OverallScoreHero score={feedback?.overallScore || 0} />
          </div>

          {/* Tab Content */}
          {activeTab === 'analysis' && feedback && (
            <div className="space-y-5 animate-fade-in-up">
              <DetailedAnalysisSection
                title="ATS Compatibility"
                description="Applicant tracking system optimization"
                score={feedback.ats?.score || 0}
                tips={feedback.ats?.tips || []}
                icon={<Shield className="w-5 h-5 text-white" />}
              />

              <DetailedAnalysisSection
                title="Content Quality"
                description="Relevance and impact of content"
                score={feedback.content?.score || 0}
                tips={feedback.content?.tips || []}
                icon={<FileText className="w-5 h-5 text-white" />}
              />

              <DetailedAnalysisSection
                title="Structure & Format"
                description="Organization and visual appeal"
                score={feedback.structure?.score || 0}
                tips={feedback.structure?.tips || []}
                icon={<Edit3 className="w-5 h-5 text-white" />}
              />

              <DetailedAnalysisSection
                title="Skills & Keywords"
                description="Technical and soft skills presentation"
                score={feedback.skills?.score || 0}
                tips={feedback.skills?.tips || []}
                icon={<Star className="w-5 h-5 text-white" />}
              />

              {feedback.roadmap && (
                <ImprovementRoadmap roadmap={feedback.roadmap} />
              )}
            </div>
          )}

          {activeTab === 'jobmatch' && (
            <div className="animate-fade-in-up">
              <JobMatcher 
                resumeId={resume.id}
                
              />
            </div>
          )}

          {activeTab === 'recruiter' && (
            <div className="animate-fade-in-up">
              <RecruiterEyeSimulation 
                resumeId={resume.id}
                imageUrl={imageUrl}
                
              />
            </div>
          )}

          

          {/* Action Buttons */}
          <div className="flex gap-3 pb-8 animate-fade-in-up">
            <Link
              href="/resume/upload"
              className="flex-1 glass-button-primary hover-lift px-6 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              New Analysis
            </Link>
            
            <Link
              href="/resume"
              className="flex-1 glass-button hover-lift text-white px-6 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              All Resumes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}