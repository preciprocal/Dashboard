'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';


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
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromExtension = searchParams.get('from_extension') === 'true';

  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResults>({});
  const [activeTab, setActiveTab] = useState<'resume' | 'cover' | 'interview'>('resume');

  useEffect(() => {
    if (!user) {
      router.push('/login?redirect=job-tools');
      return;
    }

    loadJobData();
  }, [user]);

  const loadJobData = async () => {
    try {
      if (fromExtension) {
        // Load from extension storage via window message
        window.addEventListener('message', handleExtensionMessage);
        
        // Request data from extension
        window.postMessage({ type: 'GET_JOB_DATA' }, '*');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading job data:', error);
      setLoading(false);
    }
  };

  const handleExtensionMessage = (event: MessageEvent) => {
    if (event.data.type === 'JOB_DATA_RESPONSE') {
      setJobData(event.data.jobData);
      window.removeEventListener('message', handleExtensionMessage);
    }
  };

  const generateAll = async () => {
    if (!jobData || !user) return;

    setGenerating(true);

    try {
      // Generate resume analysis using existing endpoint
      const resumeResult = await fetch('/api/analyze-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'analyzeForJob',
          jobData,
          userId: user.uid,
          userTier: 'free' // Default to free, or fetch from Firestore
        })
      });

      if (resumeResult.ok) {
        const resumeData = await resumeResult.json();
        setResults(prev => ({ ...prev, resume: {
          atsScore: resumeData.atsScore,
          suggestions: resumeData.suggestions,
          optimizedResume: resumeData.optimizedResume || ''
        }}));
      }

      // Generate cover letter
      const coverResult = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobData,
          userId: user.uid 
        })
      });

      if (coverResult.ok) {
        const coverData = await coverResult.json();
        setResults(prev => ({ ...prev, coverLetter: coverData.coverLetter }));
      }

      // Generate interview questions
      const interviewResult = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobData,
          userId: user.uid 
        })
      });

      if (interviewResult.ok) {
        const interviewData = await interviewResult.json();
        setResults(prev => ({ ...prev, interviewQuestions: interviewData.questions }));
      }

    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading job data...</p>
        </div>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Job Data Found</h2>
          <p className="text-slate-400 mb-6">
            Please extract job data using the Preciprocal extension first.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Job Info Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold">
                  {jobData.platform}
                </span>
                {jobData.jobType && (
                  <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-400 text-xs">
                    {jobData.jobType}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{jobData.title}</h1>
              <p className="text-lg text-slate-300 mb-2">{jobData.company}</p>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {jobData.location}
                </span>
                {jobData.salary && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {jobData.salary}
                  </span>
                )}
              </div>
            </div>
            <a
              href={jobData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-semibold text-white transition-colors"
            >
              View Original
            </a>
          </div>
        </div>

        {/* Generate Button */}
        {!results.resume && !results.coverLetter && !results.interviewQuestions && (
          <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-8 text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-3">Ready to Generate Your Materials</h2>
            <p className="text-slate-400 mb-6 max-w-2xl mx-auto">
              Click below to generate an optimized resume with ATS score, a tailored cover letter, and practice interview questions based on this job posting.
            </p>
            <button
              onClick={generateAll}
              disabled={generating}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                'Generate All Materials'
              )}
            </button>
          </div>
        )}

        {/* Results Tabs */}
        {(results.resume || results.coverLetter || results.interviewQuestions) && (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setActiveTab('resume')}
                className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'resume'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Resume Analysis
              </button>
              <button
                onClick={() => setActiveTab('cover')}
                className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'cover'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Cover Letter
              </button>
              <button
                onClick={() => setActiveTab('interview')}
                className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'interview'
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Interview Prep
              </button>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'resume' && results.resume && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">ATS Compatibility Score</h3>
                    <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                      {results.resume.atsScore}%
                    </div>
                  </div>
                  <div className="space-y-3">
                    {results.resume.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-3 p-4 bg-slate-800/50 rounded-xl">
                        <span className="text-purple-400">•</span>
                        <span className="text-slate-300">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'cover' && results.coverLetter && (
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-slate-300 leading-relaxed">
                    {results.coverLetter}
                  </div>
                </div>
              )}

              {activeTab === 'interview' && results.interviewQuestions && (
                <div className="space-y-4">
                  {results.interviewQuestions.map((q, idx) => (
                    <div key={idx} className="p-5 bg-slate-800/50 rounded-xl">
                      <div className="flex items-start justify-between mb-3">
                        <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold">
                          {q.category}
                        </span>
                        <span className="text-xs text-slate-500">{q.difficulty}</span>
                      </div>
                      <p className="text-white font-medium">{q.question}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}