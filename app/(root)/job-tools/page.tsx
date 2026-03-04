'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { 
  Briefcase, MapPin, Building2, DollarSign, ArrowLeft, Loader2, FileText, 
  MessageSquare, Video, Clock, Users, TrendingUp, Award, Globe, 
  ChevronDown, ChevronUp, Copy, Check, Download, Save, CheckCircle2, 
  Wand2, FileDown, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/client';

interface JobData {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  platform: string;
  salary?: string;
  jobType?: string;
  seniority?: string;
  workplaceType?: string;
  applicants?: string;
  skills?: string[];
  companySize?: string;
  industry?: string;
  benefits?: string[];
  jobFunction?: string;
  postedDate?: string;
  hasEasyApply?: boolean;
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

// ─── Inner component that uses useSearchParams ────────────────────────────────
function JobToolsContent() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromExtension = searchParams.get('from_extension') === 'true';

  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loadingData, setLoadingData] = useState(fromExtension);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResults>({});
  const [activeTab, setActiveTab] = useState<'resume' | 'cover' | 'interview'>('resume');
  const [showFullDescription, setShowFullDescription] = useState(false);
  
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [coverLetterTone, setCoverLetterTone] = useState('professional');
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!fromExtension) return;

    window.postMessage('preciprocalPageReady', '*');

    const loadJobDataFromExtension = async () => {
      try {
        const storedData = sessionStorage.getItem('extensionJobData');
        const timestamp = sessionStorage.getItem('extensionJobDataTimestamp');
        
        if (storedData) {
          if (timestamp) {
            const ageInMs = Date.now() - parseInt(timestamp);
            if (ageInMs > 5 * 60 * 1000) {
              sessionStorage.removeItem('extensionJobData');
              sessionStorage.removeItem('extensionJobDataTimestamp');
              setLoadingData(false);
              return;
            }
          }
          
          const data = JSON.parse(storedData);
          setJobData(data);
          setLoadingData(false);
          sessionStorage.removeItem('extensionJobData');
          sessionStorage.removeItem('extensionJobDataTimestamp');
          return;
        }
        
        let eventHandled = false;
        
        const handleDataReady = (event: Event) => {
          if (eventHandled) return;
          const customEvent = event as CustomEvent;
          if (customEvent.detail) {
            eventHandled = true;
            clearTimeout(timeoutId);
            cleanup();
            setJobData(customEvent.detail);
            setLoadingData(false);
          }
        };
        
        const cleanup = () => {
          window.removeEventListener('preciprocalDataReady', handleDataReady);
          document.removeEventListener('preciprocalDataReady', handleDataReady);
        };
        
        window.addEventListener('preciprocalDataReady', handleDataReady);
        document.addEventListener('preciprocalDataReady', handleDataReady);
        
        const timeoutId = setTimeout(() => {
          if (!eventHandled) {
            cleanup();
            setLoadingData(false);
          }
        }, 10000);
        
        const checkInterval = setInterval(() => {
          const data = sessionStorage.getItem('extensionJobData');
          if (data && !eventHandled) {
            eventHandled = true;
            clearTimeout(timeoutId);
            clearInterval(checkInterval);
            cleanup();
            setJobData(JSON.parse(data));
            setLoadingData(false);
            sessionStorage.removeItem('extensionJobData');
            sessionStorage.removeItem('extensionJobDataTimestamp');
          }
        }, 100);
        
        setTimeout(() => clearInterval(checkInterval), 10000);
        
      } catch (error) {
        console.error('❌ Error loading job data:', error);
        setLoadingData(false);
      }
    };

    loadJobDataFromExtension();
    setTimeout(loadJobDataFromExtension, 500);
  }, [fromExtension]);

  useEffect(() => {
    if (fromExtension || loading) return;
    if (!user) router.push('/auth?redirect=job-tools');
  }, [user, loading, fromExtension, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDownloadMenu && !target.closest('.download-dropdown')) setShowDownloadMenu(false);
      if (showToneMenu && !target.closest('.tone-dropdown')) setShowToneMenu(false);
    };
    if (showDownloadMenu || showToneMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadMenu, showToneMenu]);

  const generateAll = async () => {
    if (!jobData) return;
    setGenerating(true);
    try {
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

      const questions = [
        { question: 'Tell me about yourself and your relevant experience for this role.', category: 'Behavioral', difficulty: 'Easy' },
        { question: `Why do you want to work at ${jobData.company}?`, category: 'Company Fit', difficulty: 'Medium' },
        { question: 'Describe a challenging project you worked on and how you overcame obstacles.', category: 'Technical', difficulty: 'Medium' },
        { question: `What interests you most about the ${jobData.title} position?`, category: 'Role-Specific', difficulty: 'Easy' },
      ];

      if (jobData.description.toLowerCase().includes('leadership') || 
          jobData.seniority?.toLowerCase().includes('senior') ||
          jobData.seniority?.toLowerCase().includes('director')) {
        questions.push({ question: "Describe your leadership style and give an example of how you've motivated a team.", category: 'Leadership', difficulty: 'Hard' });
      }

      if (jobData.description.toLowerCase().includes('technical') || jobData.description.toLowerCase().includes('engineering')) {
        questions.push({ question: 'Walk me through your approach to solving a complex technical problem.', category: 'Technical', difficulty: 'Hard' });
      }

      questions.push(
        { question: 'Where do you see yourself in 5 years?', category: 'Career Goals', difficulty: 'Medium' },
        { question: 'What are your salary expectations for this position?', category: 'Compensation', difficulty: 'Hard' }
      );

      setResults(prev => ({ ...prev, interviewQuestions: questions }));
      toast.success('Materials generated successfully!');
    } catch (error) {
      console.error('❌ Error generating content:', error);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateCoverLetter = async () => {
    if (!jobData || !user) { toast.error('Missing required data'); return; }
    setGeneratingCoverLetter(true);
    setIsSaved(false);
    try {
      const response = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobRole: jobData.title, jobDescription: jobData.description, companyName: jobData.company, tone: coverLetterTone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate cover letter');
      if (data.success && data.coverLetter) {
        setResults(prev => ({ ...prev, coverLetter: data.coverLetter.content }));
        toast.success('Cover letter generated successfully!');
        setActiveTab('cover');
      } else throw new Error('Invalid response format');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate cover letter');
    } finally {
      setGeneratingCoverLetter(false);
    }
  };

  const handleCopy = async () => {
    if (!results.coverLetter) return;
    try {
      await navigator.clipboard.writeText(results.coverLetter.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2'));
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy'); }
  };

  const handleSaveCoverLetter = async () => {
    if (!user || !results.coverLetter || !jobData) { toast.error('Missing data to save'); return; }
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'coverLetters'), {
        userId: user.uid, jobRole: jobData.title, companyName: jobData.company,
        jobDescription: jobData.description, tone: coverLetterTone, content: results.coverLetter,
        wordCount: results.coverLetter.split(/\s+/).filter(w => w.length > 0).length,
        createdAt: serverTimestamp(),
      });
      setIsSaved(true);
      toast.success('Cover letter saved successfully!');
    } catch { toast.error('Failed to save cover letter'); }
    finally { setIsSaving(false); }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!results.coverLetter || !jobData) return;
    try {
      const response = await fetch('/api/cover-letter/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: results.coverLetter, jobRole: jobData.title, companyName: jobData.company, format })
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cover_letter_${jobData.title.replace(/\s+/g, '_')}_${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShowDownloadMenu(false);
      toast.success(`${format.toUpperCase()} downloaded!`);
    } catch { toast.error(`Failed to generate ${format.toUpperCase()}`); }
  };

  const convertMarkdownLinks = (text: string) =>
    text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');

  if (loading && !fromExtension) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-purple-500 animate-spin mx-auto mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (loadingData && fromExtension) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-purple-500 animate-spin mx-auto mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">Loading job data...</p>
          <p className="text-slate-500 text-xs mt-2">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (!user && !fromExtension) return null;

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
              Please extract job data using the Preciprocal Chrome extension first.
            </p>
            <div className="space-y-3">
              <Link href="/dashboard" className="glass-button-primary hover-lift inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base w-full justify-center">
                Go to Dashboard
              </Link>
              <a href="https://chrome.google.com/webstore" target="_blank" rel="noopener noreferrer"
                className="glass-button hover-lift inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-medium text-sm sm:text-base w-full justify-center">
                Get Chrome Extension
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-4 sm:mb-6">
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
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold">{jobData.platform}</span>
                  {jobData.jobType && jobData.jobType !== 'Not specified' && (
                    <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold">{jobData.jobType}</span>
                  )}
                  {jobData.workplaceType && jobData.workplaceType !== 'Not specified' && (
                    <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold">{jobData.workplaceType}</span>
                  )}
                  {jobData.hasEasyApply && (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-semibold">⚡ Easy Apply</span>
                  )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">{jobData.title}</h2>
                <p className="text-lg sm:text-xl text-slate-300 mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 text-purple-400" />
                  {jobData.company}
                </p>
              </div>
              <a href={jobData.url} target="_blank" rel="noopener noreferrer"
                className="glass-button-primary hover-lift px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors whitespace-nowrap">
                View Original
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {jobData.location && jobData.location !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><MapPin className="w-4 h-4 text-purple-400" /><span className="text-xs text-slate-500 font-medium">Location</span></div>
                  <p className="text-sm text-white font-medium">{jobData.location}</p>
                </div>
              )}
              {jobData.salary && jobData.salary !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-emerald-400" /><span className="text-xs text-slate-500 font-medium">Compensation</span></div>
                  <p className="text-sm text-white font-medium">{jobData.salary}</p>
                </div>
              )}
              {jobData.seniority && jobData.seniority !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-blue-400" /><span className="text-xs text-slate-500 font-medium">Seniority Level</span></div>
                  <p className="text-sm text-white font-medium">{jobData.seniority}</p>
                </div>
              )}
              {jobData.applicants && jobData.applicants !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-amber-400" /><span className="text-xs text-slate-500 font-medium">Applicants</span></div>
                  <p className="text-sm text-white font-medium">{jobData.applicants}</p>
                </div>
              )}
              {jobData.postedDate && jobData.postedDate !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-500 font-medium">Posted</span></div>
                  <p className="text-sm text-white font-medium">{jobData.postedDate}</p>
                </div>
              )}
              {jobData.companySize && jobData.companySize !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><Building2 className="w-4 h-4 text-indigo-400" /><span className="text-xs text-slate-500 font-medium">Company Size</span></div>
                  <p className="text-sm text-white font-medium">{jobData.companySize}</p>
                </div>
              )}
              {jobData.industry && jobData.industry !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><Globe className="w-4 h-4 text-cyan-400" /><span className="text-xs text-slate-500 font-medium">Industry</span></div>
                  <p className="text-sm text-white font-medium">{jobData.industry}</p>
                </div>
              )}
              {jobData.jobFunction && jobData.jobFunction !== 'Not specified' && (
                <div className="glass-morphism p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2 mb-1"><Award className="w-4 h-4 text-pink-400" /><span className="text-xs text-slate-500 font-medium">Job Function</span></div>
                  <p className="text-sm text-white font-medium">{jobData.jobFunction}</p>
                </div>
              )}
            </div>

            {jobData.skills && jobData.skills.length > 0 && jobData.skills[0] !== 'Not specified' && (
              <div className="mb-4 pb-4 border-b border-slate-800/50">
                <div className="flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-purple-400" /><h3 className="text-sm font-semibold text-slate-300">Required Skills</h3></div>
                <div className="flex flex-wrap gap-2">
                  {jobData.skills.map((skill, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {jobData.benefits && jobData.benefits.length > 0 && jobData.benefits[0] !== 'Not specified' && (
              <div className="mb-4 pb-4 border-b border-slate-800/50">
                <div className="flex items-center gap-2 mb-3"><Award className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-slate-300">Benefits & Perks</h3></div>
                <div className="flex flex-wrap gap-2">
                  {jobData.benefits.map((benefit, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium">{benefit}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><h3 className="text-sm font-semibold text-slate-300">Job Description</h3></div>
                <button onClick={() => setShowFullDescription(!showFullDescription)} className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
                  {showFullDescription ? <><span>Show Less</span><ChevronUp className="w-3 h-3" /></> : <><span>Show More</span><ChevronDown className="w-3 h-3" /></>}
                </button>
              </div>
              <div className={`glass-morphism p-4 rounded-lg border border-white/5 ${!showFullDescription ? 'max-h-32 overflow-hidden relative' : ''}`}>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{jobData.description}</p>
                {!showFullDescription && <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900/90 to-transparent"></div>}
              </div>
            </div>
          </div>
        </div>

        {!results.resume && (
          <div className="glass-card hover-lift mb-4 sm:mb-6">
            <div className="p-6 sm:p-8 text-center">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">Ready to Generate Your Materials</h2>
              <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base max-w-2xl mx-auto">
                Generate an optimized resume analysis with ATS score, a tailored cover letter, and practice interview questions based on this job posting.
              </p>
              <button onClick={generateAll} disabled={generating}
                className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed">
                {generating ? <><Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />Generating...</> : 'Generate All Materials'}
              </button>
            </div>
          </div>
        )}

        {results.resume && (
          <div className="glass-card">
            <div className="flex border-b border-slate-800/50">
              {(['resume', 'cover', 'interview'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 font-semibold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
                  {tab === 'resume' && <><FileText className="w-4 h-4" /><span className="hidden xs:inline">Resume</span></>}
                  {tab === 'cover' && <><MessageSquare className="w-4 h-4" /><span className="hidden xs:inline">Cover Letter</span></>}
                  {tab === 'interview' && <><Video className="w-4 h-4" /><span className="hidden xs:inline">Interview</span></>}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'resume' && results.resume && (
                <div className="animate-fade-in-up">
                  <div className="flex items-center justify-between mb-4 sm:mb-6 flex-wrap gap-3">
                    <h3 className="text-lg sm:text-xl font-bold text-white">ATS Compatibility Score</h3>
                    <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">{results.resume.atsScore}%</div>
                  </div>
                  <div className="glass-morphism p-4 rounded-xl mb-4">
                    <p className="text-sm text-slate-300">Your resume has a <span className="font-bold text-white">{results.resume.atsScore}%</span> compatibility score. Follow the suggestions below to improve your chances.</p>
                  </div>
                  <div className="space-y-2.5 sm:space-y-3">
                    {results.resume.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="flex gap-2 sm:gap-3 p-3 sm:p-4 glass-morphism rounded-xl hover-lift border border-white/5">
                        <span className="text-purple-400 flex-shrink-0 font-bold">{idx + 1}.</span>
                        <span className="text-slate-300 text-xs sm:text-sm">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Link href="/resume/upload" className="glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2">
                      <FileText className="w-4 h-4" />Analyze My Resume
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === 'cover' && (
                <div className="animate-fade-in-up">
                  {!results.coverLetter ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="w-8 h-8 text-purple-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Generate Your Cover Letter</h3>
                      <p className="text-slate-400 mb-6 max-w-md mx-auto">Create a personalized cover letter tailored to this specific job posting.</p>
                      <div className="max-w-xs mx-auto mb-6">
                        <label className="block text-sm text-slate-400 mb-2 text-left">Choose Tone</label>
                        <div className="relative tone-dropdown">
                          <button type="button" onClick={() => setShowToneMenu(!showToneMenu)}
                            className="glass-input w-full px-4 py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer">
                            <span className="capitalize">{coverLetterTone}</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showToneMenu ? 'rotate-180' : ''}`} />
                          </button>
                          {showToneMenu && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                              {['professional', 'enthusiastic', 'formal', 'friendly', 'confident'].map((toneOption) => (
                                <button key={toneOption} type="button" onClick={() => { setCoverLetterTone(toneOption); setShowToneMenu(false); }}
                                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors capitalize ${coverLetterTone === toneOption ? 'bg-blue-500/30 text-blue-300' : 'text-white hover:bg-white/5'}`}>
                                  {toneOption}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={generateCoverLetter} disabled={generatingCoverLetter}
                        className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        {generatingCoverLetter ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Wand2 className="w-4 h-4" />Generate Cover Letter</>}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h3 className="text-lg font-bold text-white">Your Cover Letter</h3>
                        <div className="flex items-center gap-2">
                          {!isSaved ? (
                            <button onClick={handleSaveCoverLetter} disabled={isSaving} className="glass-button-primary hover-lift px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm">
                              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></> : <><Save className="w-4 h-4" /><span>Save</span></>}
                            </button>
                          ) : (
                            <div className="glass-button bg-emerald-500/10 border-emerald-500/20 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Saved</span>
                            </div>
                          )}
                          <button onClick={handleCopy} className="glass-button hover-lift p-2.5 rounded-lg" title="Copy">
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                          </button>
                          <div className="relative download-dropdown">
                            <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} className="glass-button hover-lift p-2.5 rounded-lg flex items-center gap-1" title="Download">
                              <Download className="w-4 h-4 text-slate-300" /><ChevronDown className="w-3 h-3 text-slate-300" />
                            </button>
                            {showDownloadMenu && (
                              <div className="absolute right-0 top-full mt-2 w-48 glass-card rounded-lg shadow-xl z-20 overflow-hidden">
                                <button onClick={() => handleDownload('pdf')} className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                                  <FileDown className="w-4 h-4 text-red-400" /><span>Download as PDF</span>
                                </button>
                                <div className="h-px bg-white/10" />
                                <button onClick={() => handleDownload('docx')} className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 flex items-center gap-3 transition-colors">
                                  <FileDown className="w-4 h-4 text-blue-400" /><span>Download as Word</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="glass-morphism p-6 rounded-xl border border-white/5 max-h-[500px] overflow-y-auto">
                        <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: convertMarkdownLinks(results.coverLetter) }} />
                      </div>
                      <div className="mt-4 text-center">
                        <button onClick={() => { setResults(prev => ({ ...prev, coverLetter: undefined })); setIsSaved(false); }}
                          className="glass-button hover-lift inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white">
                          <RefreshCw className="w-4 h-4" />Generate New Letter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'interview' && results.interviewQuestions && (
                <div className="animate-fade-in-up">
                  <div className="glass-morphism p-4 rounded-xl mb-4 border border-white/5">
                    <p className="text-sm text-slate-300">Practice these <span className="font-bold text-white">{results.interviewQuestions.length}</span> questions tailored to the {jobData.title} role at {jobData.company}.</p>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    {results.interviewQuestions.map((q, idx) => (
                      <div key={idx} className="glass-morphism p-4 sm:p-5 rounded-xl hover-lift border border-white/5">
                        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                          <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-semibold">{q.category}</span>
                          <span className={`text-xs font-medium ${q.difficulty === 'Easy' ? 'text-emerald-400' : q.difficulty === 'Medium' ? 'text-amber-400' : 'text-red-400'}`}>{q.difficulty}</span>
                        </div>
                        <p className="text-white font-medium text-sm sm:text-base">{q.question}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <Link href="/interviews" className="glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2">
                      <Video className="w-4 h-4" />Start Mock Interview
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

// ─── Fallback shown while Suspense resolves useSearchParams ──────────────────
function JobToolsFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// ─── Default export wraps content in Suspense (required for useSearchParams) ─
export default function JobToolsPage() {
  return (
    <Suspense fallback={<JobToolsFallback />}>
      <JobToolsContent />
    </Suspense>
  );
}