'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { Briefcase, MapPin, Building2, DollarSign, ArrowLeft, Loader2, FileText, MessageSquare, Video } from 'lucide-react';
import Link from 'next/link';

// Declare Chrome extension types
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          message: { action: string; [key: string]: unknown }, 
          callback?: (response: { jobData?: JobData; [key: string]: unknown }) => void
        ) => void;
        lastError?: { message: string };
      };
    };
  }
}

interface JobData {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: string;
  salary?: string;
  jobType?: string;
  extractedAt: string;
}

interface GenerationResults {
  resume?: {
    atsScore: number;
    suggestions: string[];
    optimizedResume: string;
  };
  coverLetter?: string;
  interviewQuestions?: Array<{
    question: string;
    category: string;
    difficulty: string;
  }>;
}

export default function JobToolsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromExtension = searchParams.get('from_extension') === 'true';

  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResults>({});
  const [activeTab, setActiveTab] = useState<'resume' | 'cover' | 'interview'>('resume');

  useEffect(() => {
    if (!user && !loading) {
      router.push('/auth?redirect=job-tools');
      return;
    }

    if (user && fromExtension) {
      loadJobDataFromExtension();
    } else if (user) {
      setLoadingData(false);
    }
  }, [user, loading, fromExtension, router]);

  const loadJobDataFromExtension = async () => {
    console.log('🔍 Loading job data from extension...');
    
    try {
      // Check if chrome.runtime is available (means we're in a page opened by extension)
      if (typeof window !== 'undefined' && window.chrome?.runtime?.sendMessage) {
        console.log('📡 Requesting job data from extension...');
        
        // Request job data from extension background script
        window.chrome.runtime.sendMessage(
          { action: 'getJobData' },
          (response: { jobData?: JobData }) => {
            if (window.chrome?.runtime?.lastError) {
              console.error('❌ Extension error:', window.chrome.runtime.lastError);
              setLoadingData(false);
              return;
            }
            
            if (response && response.jobData) {
              console.log('✅ Job data received:', response.jobData);
              setJobData(response.jobData);
            } else {
              console.log('⚠️ No job data in response');
            }
            setLoadingData(false);
          }
        );
      } else {
        console.log('⚠️ Extension API not available');
        setLoadingData(false);
      }
    } catch (error) {
      console.error('❌ Error loading job data:', error);
      setLoadingData(false);
    }
  };

  const generateAll = async () => {
    if (!jobData || !user) return;

    setGenerating(true);

    try {
      // Generate resume analysis
      const resumeResult = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'analyzeForJob',
          jobData,
          userId: user.uid,
          userTier: 'free'
        })
      });

      if (resumeResult.ok) {
        const resumeData = await resumeResult.json();
        setResults(prev => ({ ...prev, resume: {
          atsScore: resumeData.atsScore || 75,
          suggestions: resumeData.suggestions || ['Add relevant keywords from job description', 'Quantify your achievements', 'Tailor your experience section'],
          optimizedResume: resumeData.optimizedResume || ''
        }}));
      } else {
        // Fallback mock data if API fails
        setResults(prev => ({ ...prev, resume: {
          atsScore: 72,
          suggestions: [
            'Add more keywords from the job description to improve ATS matching',
            'Include quantifiable achievements with specific metrics',
            'Highlight relevant skills mentioned in the job posting',
            'Tailor your professional summary to align with the role'
          ],
          optimizedResume: ''
        }}));
      }

      // TODO: Implement cover letter and interview endpoints
      // For now, mock data
      setResults(prev => ({ 
        ...prev, 
        coverLetter: `Dear Hiring Manager,

I am writing to express my strong interest in the ${jobData.title} position at ${jobData.company}. With my background and skills, I am confident I would be a valuable addition to your team.

[This is a placeholder. Full cover letter generation coming soon with AI-powered personalization based on your resume and the job description.]

Thank you for considering my application. I look forward to discussing how I can contribute to ${jobData.company}'s success.

Best regards,
[Your Name]`,
        interviewQuestions: [
          { 
            question: 'Tell me about yourself and your relevant experience for this role.', 
            category: 'Behavioral', 
            difficulty: 'Easy' 
          },
          { 
            question: `Why do you want to work at ${jobData.company}?`, 
            category: 'Company Fit', 
            difficulty: 'Medium' 
          },
          { 
            question: 'Describe a challenging project you worked on and how you overcame obstacles.', 
            category: 'Technical', 
            difficulty: 'Medium' 
          },
          { 
            question: 'Where do you see yourself in 5 years?', 
            category: 'Career Goals', 
            difficulty: 'Easy' 
          },
          { 
            question: 'What are your salary expectations for this position?', 
            category: 'Compensation', 
            difficulty: 'Hard' 
          }
        ]
      }));

    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-purple-500 animate-spin mx-auto mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">Loading job data...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!jobData) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="glass-card-gradient hover-lift max-w-md w-full">
          <div className="glass-card-gradient-inner text-center p-6 sm:p-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 gradient-secondary rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-glass">
              <Briefcase className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white mb-2">No Job Data Found</h1>
            <p className="text-slate-400 mb-4 sm:mb-6 text-xs sm:text-sm">
              Please extract job data using the Preciprocal extension first.
            </p>
            <Link 
              href="/dashboard" 
              className="glass-button-primary hover-lift inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4 sm:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="glass-card hover-lift mb-4 sm:mb-6">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 gradient-primary rounded-xl flex items-center justify-center shadow-glass">
                <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Job Application Assistant</h1>
                <p className="text-xs sm:text-sm text-slate-400">AI-powered materials for your application</p>
              </div>
            </div>
          </div>
        </div>

        {/* Job Info Card */}
        <div className="glass-card hover-lift mb-4 sm:mb-6">
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold">
                    {jobData.platform}
                  </span>
                  {jobData.jobType && (
                    <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-400 text-xs">
                      {jobData.jobType}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{jobData.title}</h2>
                <p className="text-base sm:text-lg text-slate-300 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  {jobData.company}
                </p>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    {jobData.location}
                  </span>
                  {jobData.salary && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      {jobData.salary}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={jobData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-button hover-lift px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap"
              >
                View Original
              </a>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        {!results.resume && (
          <div className="glass-card hover-lift mb-4 sm:mb-6">
            <div className="p-6 sm:p-8 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">Ready to Generate Your Materials</h2>
              <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base max-w-2xl mx-auto">
                Generate an optimized resume analysis with ATS score, a tailored cover letter, and practice interview questions based on this job posting.
              </p>
              <button
                onClick={generateAll}
                disabled={generating}
                className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate All Materials'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {results.resume && (
          <div className="glass-card">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-800/50">
              <button
                onClick={() => setActiveTab('resume')}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'resume'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span className="hidden xs:inline">Resume</span>
              </button>
              <button
                onClick={() => setActiveTab('cover')}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'cover'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden xs:inline">Cover Letter</span>
              </button>
              <button
                onClick={() => setActiveTab('interview')}
                className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 ${
                  activeTab === 'interview'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="hidden xs:inline">Interview</span>
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 sm:p-6">
              {activeTab === 'resume' && results.resume && (
                <div className="animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-white">ATS Compatibility Score</h3>
                    <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                      {results.resume.atsScore}%
                    </div>
                  </div>
                  
                  <div className="glass-morphism p-4 rounded-xl mb-4">
                    <p className="text-sm text-slate-300">
                      Your resume has a <span className="font-bold text-white">{results.resume.atsScore}%</span> compatibility score with this job posting. 
                      Follow the suggestions below to improve your chances.
                    </p>
                  </div>

                  <div className="space-y-2.5 sm:space-y-3">
                    {results.resume.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-2 sm:gap-3 p-3 sm:p-4 glass-morphism rounded-xl hover-lift border border-white/5">
                        <span className="text-purple-400 flex-shrink-0 font-bold">{idx + 1}.</span>
                        <span className="text-slate-300 text-xs sm:text-sm">{suggestion}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link href="/resume/upload" className="flex-1 glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" />
                      Analyze My Resume
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === 'cover' && results.coverLetter && (
                <div className="animate-fade-in-up">
                  <div className="glass-morphism p-4 sm:p-6 rounded-xl border border-white/5">
                    <div className="prose prose-invert prose-sm sm:prose max-w-none">
                      <div className="whitespace-pre-wrap text-slate-300 leading-relaxed text-sm sm:text-base">
                        {results.coverLetter}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link href="/cover-letter" className="flex-1 glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Generate Custom Letter
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === 'interview' && results.interviewQuestions && (
                <div className="animate-fade-in-up">
                  <div className="glass-morphism p-4 rounded-xl mb-4 border border-white/5">
                    <p className="text-sm text-slate-300">
                      Practice these <span className="font-bold text-white">{results.interviewQuestions.length}</span> questions 
                      tailored to the {jobData.title} role at {jobData.company}.
                    </p>
                  </div>

                  <div className="space-y-3 sm:space-y-4">
                    {results.interviewQuestions.map((q, idx) => (
                      <div key={idx} className="glass-morphism p-4 sm:p-5 rounded-xl hover-lift border border-white/5">
                        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                          <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold">
                            {q.category}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${
                              q.difficulty === 'Easy' ? 'text-emerald-400' :
                              q.difficulty === 'Medium' ? 'text-amber-400' :
                              'text-red-400'
                            }`}>
                              {q.difficulty}
                            </span>
                          </div>
                        </div>
                        <p className="text-white font-medium text-sm sm:text-base">{q.question}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Link href="/interviews" className="flex-1 glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                      <Video className="w-4 h-4" />
                      Start Mock Interview
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}