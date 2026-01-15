'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Sparkles, Download, Copy, Check, AlertCircle, 
  Briefcase, Wand2, Loader2, 
  Settings, CheckCircle2, XCircle, RefreshCw, ChevronDown,
  Save,
  History,
  FileDown,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { toast } from 'sonner';
import FeedbackSurveyModal, { FeedbackData } from '@/components/FeedbackSurveyModal';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';

interface CoverLetterMetadata {
  usedResume: boolean;
  responseTime: number;
}

interface ProfileStatus {
  hasProfile: boolean;
  hasResume: boolean;
  loading: boolean;
  userName: string;
  resumeCount: number;
}

export default function CoverLetterGeneratorPage() {
  const [user, loading] = useAuthState(auth);
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tone, setTone] = useState('professional');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({
    hasProfile: false,
    hasResume: false,
    loading: true,
    userName: '',
    resumeCount: 0
  });
  const [metadata, setMetadata] = useState<CoverLetterMetadata | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [showToneMenu, setShowToneMenu] = useState(false);

  // Usage tracking states
  const [showSurvey, setShowSurvey] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // Usage tracking hook
  const {
    canUseFeature,
    getRemainingCount,
    getLimit,
    incrementUsage,
    checkAndShowSurvey,
    loading: usageLoading,
  } = useUsageTracking();

  // Fun facts about cover letters
  const coverLetterFacts = [
    "🎯 Recruiters spend just 7.4 seconds on your cover letter - start with a bang, not 'I am writing to apply...'",
    "🔥 The magic formula: Problem they have → Your solution → Proof it worked. That's it!",
    "💰 Mentioning '$500K revenue increase' beats saying 'increased revenue' - numbers = credibility!",
    "🎪 Fun fact: Cover letters with a brief personal story get 60% more callbacks than generic ones!",
    "🚀 'Achieved, Led, Created, Increased' >> 'Responsible for, Worked on, Helped with' - own your wins!",
    "📱 80% of cover letters are now read on mobile first - keep paragraphs SHORT and punchy!",
    "🎭 Mirror their vibe: Startup? Be conversational. Corporate? Polish it up. Tech? Show your GitHub!",
    "⚡ The 3-paragraph power play: 1) Why you're excited 2) Why you're qualified 3) What's next",
    "🔍 Research hack: Check their 'About' page, latest blog post, or recent LinkedIn updates for insider intel!",
    "🎨 White space is your friend - dense text = instant skip. Break it up, make it breathable!",
    "💡 End with confidence: 'I look forward to discussing...' NOT 'I hope to hear from you...'",
    "🌟 Your LinkedIn/GitHub at the top isn't just decoration - it's proof you're the real deal!",
    "🎯 Tailor-made > Template. Spending 20 mins customizing beats sending 50 generic letters!",
    "📊 Data point: Candidates who address hiring managers by name get 2x more responses!",
    "✨ Show don't tell: 'Built an app used by 10K users' >> 'I'm a skilled developer'",
  ];

  // Rotate facts every 4 seconds during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setCurrentFactIndex((prev) => (prev + 1) % coverLetterFacts.length);
      }, 4000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating, coverLetterFacts.length]);

  // Helper function to convert markdown links to HTML
  const convertMarkdownLinks = (text: string): string => {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (showDownloadMenu && !target.closest('.download-dropdown')) {
        setShowDownloadMenu(false);
      }
      
      if (showToneMenu && !target.closest('.tone-dropdown')) {
        setShowToneMenu(false);
      }
    };

    if (showDownloadMenu || showToneMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu, showToneMenu]);

  const checkProfileStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      setProfileStatus(prev => ({ ...prev, loading: true }));
      
      const profileResponse = await fetch('/api/profile');
      const profileData = await profileResponse.json();
      
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const { collection: firestoreCollection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const { db: firebaseDb } = await import('@/firebase/client');
      
      const resumesQuery = query(
        firestoreCollection(firebaseDb, 'resumes'),
        where('userId', '==', user?.uid),
        orderBy('createdAt', 'desc')
      );
      
      const resumesSnapshot = await getDocs(resumesQuery);
      interface ResumeData {
        deleted?: boolean;
        [key: string]: unknown;
      }
      const resumes = resumesSnapshot.docs
        .map(doc => doc.data() as ResumeData)
        .filter(resume => !resume.deleted);

      setProfileStatus({
        hasProfile: !!profileData.user,
        hasResume: resumes.length > 0,
        loading: false,
        userName: profileData.user?.name || '',
        resumeCount: resumes.length
      });
    } catch (err) {
      console.error('Error checking profile:', err);
      setProfileStatus({
        hasProfile: false,
        hasResume: false,
        loading: false,
        userName: '',
        resumeCount: 0
      });
    }
  }, [user]);

  useEffect(() => {
    checkProfileStatus();
  }, [checkProfileStatus]);

  const handleGenerate = async () => {
    if (!jobRole.trim()) {
      setError('Please enter a job role');
      return;
    }

    if (!profileStatus.hasProfile && !profileStatus.hasResume) {
      setError('Please complete your profile or upload a resume in Settings first');
      return;
    }

    // Check usage limit FIRST
    if (!canUseFeature('coverLetters')) {
      if (checkAndShowSurvey('coverLetters')) {
        setShowSurvey(true);
      } else {
        setShowUpgradePrompt(true);
      }
      return;
    }

    setIsGenerating(true);
    setError('');
    setGeneratedLetter('');
    setMetadata(null);
    setIsSaved(false);

    try {
      const response = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobRole: jobRole.trim(),
          jobDescription: jobDescription.trim(),
          companyName: companyName.trim(),
          tone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate cover letter');
      }

      if (data.success && data.coverLetter) {
        setGeneratedLetter(data.coverLetter.content);
        setMetadata(data.metadata || null);
        
        // Increment usage count after successful generation
        await incrementUsage('coverLetters');
        
        toast.success('Cover letter generated successfully!');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Generation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate cover letter. Please try again.';
      setError(errorMessage);
      toast.error('Failed to generate cover letter');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!user || !generatedLetter) {
      toast.error('Please generate a cover letter first');
      return;
    }

    setIsSaving(true);

    try {
      const wordCount = generatedLetter.split(/\s+/).filter(word => word.length > 0).length;

      await addDoc(collection(db, 'coverLetters'), {
        userId: user.uid,
        jobRole: jobRole.trim(),
        companyName: companyName.trim() || null,
        jobDescription: jobDescription.trim() || null,
        tone,
        content: generatedLetter,
        wordCount,
        usedResume: metadata?.usedResume || false,
        createdAt: serverTimestamp(),
      });

      setIsSaved(true);
      toast.success('Cover letter saved successfully!');
    } catch (err) {
      console.error('Error saving cover letter:', err);
      toast.error('Failed to save cover letter');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      const plainText = generatedLetter.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch('/api/cover-letter/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: generatedLetter,
          jobRole: jobRole,
          companyName: companyName,
          format: 'pdf'
        })
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowDownloadMenu(false);
      toast.success('PDF downloaded!');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleDownloadWord = async () => {
    try {
      const response = await fetch('/api/cover-letter/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: generatedLetter,
          jobRole: jobRole,
          companyName: companyName,
          format: 'docx'
        })
      });

      if (!response.ok) {
        throw new Error('Word document generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowDownloadMenu(false);
      toast.success('Word document downloaded!');
    } catch (error) {
      console.error('Failed to generate Word document:', error);
      toast.error('Failed to generate Word document');
    }
  };

  const handleReset = () => {
    setJobRole('');
    setJobDescription('');
    setCompanyName('');
    setTone('professional');
    setGeneratedLetter('');
    setError('');
    setMetadata(null);
    setIsSaved(false);
  };

  const handleFeedbackSubmit = async (feedback: FeedbackData) => {
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedback),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setShowSurvey(false);
      setShowUpgradePrompt(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  };

  if (loading || profileStatus.loading) {
    return (
      <AnimatedLoader 
        isVisible={true}
        loadingText="Loading cover letter generator..."
        onHide={() => console.log('Cover letter page loaded')}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift w-full max-w-md">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">Please log in to use the cover letter generator</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const remainingCount = getRemainingCount('coverLetters');
  const limit = getLimit('coverLetters');

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 mb-2 sm:mb-3">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                <span className="text-blue-400 text-xs sm:text-sm font-medium">AI-Powered</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
                Cover Letter Generator
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-slate-400 text-xs sm:text-sm">
                  Generate personalized, professional cover letters
                </p>
                {!usageLoading && user && (
                  <div className="text-xs text-slate-400">
                    {remainingCount === -1 ? (
                      <span className="text-emerald-400 font-medium">✨ Unlimited</span>
                    ) : (
                      <span>
                        <span className="font-medium text-white">{remainingCount}</span> of {limit} remaining
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <Link
              href="/cover-letter"
              className="glass-button hover-lift inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white text-sm w-full sm:w-auto justify-center"
            >
              <History className="w-4 h-4" />
              <span>View History</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Status Alert */}
      {(!profileStatus.hasProfile || !profileStatus.hasResume) && (
        <div className="glass-card hover-lift">
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-amber-400 font-medium mb-2 sm:mb-3 text-sm sm:text-base">Profile Setup Needed</h3>
                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-slate-300 mb-3 sm:mb-4">
                  {!profileStatus.hasProfile && (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
                      <span>Complete your profile in Settings</span>
                    </div>
                  )}
                  {!profileStatus.hasResume && (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
                      <span>Upload your resume for better results</span>
                    </div>
                  )}
                </div>
                <Link 
                  href="/profile"
                  className="glass-button hover-lift inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-white text-xs sm:text-sm font-medium rounded-lg"
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Go to Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Indicators */}
      {profileStatus.hasProfile && profileStatus.hasResume && (
        <div className="glass-card hover-lift">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-emerald-400 font-medium text-sm sm:text-base">Profile Ready</p>
                <p className="text-slate-400 text-xs sm:text-sm truncate">
                  Using data from {profileStatus.userName}&apos;s profile 
                  {profileStatus.resumeCount > 0 && ` and ${profileStatus.resumeCount} resume${profileStatus.resumeCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Input Section */}
        <div className="space-y-4 sm:space-y-6">
          <div className="glass-card hover-lift">
            <div className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-5 flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                </div>
                Job Details
              </h2>

              <div className="space-y-3 sm:space-y-4">
                {/* Job Role */}
                <div>
                  <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2">
                    Job Role <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                    className="glass-input w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 text-sm"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2">
                    Company Name <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Google"
                    className="glass-input w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 text-sm"
                  />
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2">
                    Job Description <span className="text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={6}
                    className="glass-input w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white placeholder-slate-500 text-sm resize-none"
                  />
                  <div className="flex items-center justify-between mt-1.5 sm:mt-2">
                    <p className="text-xs text-slate-500">
                      {jobDescription.length} characters
                    </p>
                    {jobDescription.length > 0 && (
                      <button
                        onClick={() => setJobDescription('')}
                        className="text-xs text-slate-500 hover:text-slate-400"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Tone Selection */}
                <div>
                  <label className="block text-xs sm:text-sm text-slate-400 mb-1.5 sm:mb-2">
                    Tone
                  </label>
                  <div className="relative tone-dropdown">
                    <button
                      type="button"
                      onClick={() => setShowToneMenu(!showToneMenu)}
                      className="glass-input w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                    >
                      <span className="capitalize">{tone}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showToneMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showToneMenu && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                        {['professional', 'enthusiastic', 'formal', 'friendly', 'confident'].map((toneOption) => (
                          <button
                            key={toneOption}
                            type="button"
                            onClick={() => {
                              setTone(toneOption);
                              setShowToneMenu(false);
                            }}
                            className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-left text-sm transition-colors capitalize ${
                              tone === toneOption 
                                ? 'bg-blue-500/30 text-blue-300' 
                                : 'text-white hover:bg-white/5'
                            }`}
                          >
                            {toneOption}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-3 sm:mt-4 glass-card p-3 sm:p-4 border border-red-500/20">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-xs sm:text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !jobRole.trim()}
                  className="flex-1 glass-button-primary hover-lift py-2 sm:py-2.5 px-4 sm:px-6 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs sm:text-sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="hidden xs:inline">Generating...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      <span>Generate</span>
                    </>
                  )}
                </button>

                {generatedLetter && (
                  <button
                    onClick={handleReset}
                    className="glass-button hover-lift px-4 sm:px-6 py-2 sm:py-2.5 text-white rounded-lg flex items-center gap-2 text-xs sm:text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
              </div>

              {/* What Makes a Great Cover Letter */}
              {generatedLetter && (
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/5">
                  <h3 className="text-xs sm:text-sm font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                    What Makes a Great Cover Letter
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3.5 border border-white/5">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 bg-blue-500/10 rounded-lg flex items-center justify-center mb-1.5 sm:mb-2.5">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                      </div>
                      <p className="text-xs font-medium text-white mb-0.5 sm:mb-1">Concise & Clear</p>
                      <p className="text-xs text-slate-400 leading-relaxed">Keep it 250-400 words</p>
                    </div>
                    
                    <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3.5 border border-white/5">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-1.5 sm:mb-2.5">
                        <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                      </div>
                      <p className="text-xs font-medium text-white mb-0.5 sm:mb-1">Highly Relevant</p>
                      <p className="text-xs text-slate-400 leading-relaxed">Match job requirements</p>
                    </div>
                    
                    <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3.5 border border-white/5">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 bg-amber-500/10 rounded-lg flex items-center justify-center mb-1.5 sm:mb-2.5">
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                      </div>
                      <p className="text-xs font-medium text-white mb-0.5 sm:mb-1">Authentic Voice</p>
                      <p className="text-xs text-slate-400 leading-relaxed">Show genuine interest</p>
                    </div>
                    
                    <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3.5 border border-white/5">
                      <div className="w-7 h-7 sm:w-9 sm:h-9 bg-purple-500/10 rounded-lg flex items-center justify-center mb-1.5 sm:mb-2.5">
                        <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400" />
                      </div>
                      <p className="text-xs font-medium text-white mb-0.5 sm:mb-1">Results-Driven</p>
                      <p className="text-xs text-slate-400 leading-relaxed">Use concrete examples</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-4 sm:space-y-6">
          <div className="glass-card hover-lift h-full">
            <div className="p-4 sm:p-6 flex flex-col h-full">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between mb-4 sm:mb-5 gap-3">
                <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                  </div>
                  Generated Letter
                </h2>

                {generatedLetter && (
                  <div className="flex items-center gap-2 w-full xs:w-auto">
                    {!isSaved ? (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="glass-button-primary hover-lift px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-2 text-xs sm:text-sm flex-1 xs:flex-initial justify-center"
                        title="Save"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="glass-button bg-emerald-500/10 border-emerald-500/20 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-2 text-xs sm:text-sm flex-1 xs:flex-initial justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                        <span className="text-emerald-400">Saved</span>
                      </div>
                    )}

                    <button
                      onClick={handleCopy}
                      className="glass-button hover-lift p-2 sm:p-2.5 rounded-lg"
                      title="Copy"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    
                    <div className="relative download-dropdown">
                      <button
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                        className="glass-button hover-lift p-2 sm:p-2.5 rounded-lg flex items-center gap-1"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-slate-300" />
                        <ChevronDown className="w-3 h-3 text-slate-300" />
                      </button>
                      
                      {showDownloadMenu && (
                        <div className="absolute right-0 top-full mt-2 w-44 sm:w-48 glass-card rounded-lg shadow-xl z-20 overflow-hidden">
                          <button
                            onClick={handleDownloadPDF}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-white hover:bg-white/5 flex items-center gap-2 sm:gap-3 transition-colors"
                          >
                            <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                            <span>Download as PDF</span>
                          </button>
                          <div className="h-px bg-white/10" />
                          <button
                            onClick={handleDownloadWord}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-white hover:bg-white/5 flex items-center gap-2 sm:gap-3 transition-colors"
                          >
                            <FileDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                            <span>Download as Word</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Loading State */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center flex-1 py-8">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 animate-spin" />
                  </div>
                  <p className="text-white font-medium mb-2 sm:mb-3 text-sm sm:text-base">Crafting your cover letter...</p>
                  <div className="max-w-md mx-auto text-center min-h-[60px] flex items-center justify-center px-4">
                    <p className="text-slate-400 text-xs sm:text-sm animate-fade-in">
                      {coverLetterFacts[currentFactIndex]}
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!isGenerating && !generatedLetter && !error && (
                <div className="flex flex-col items-center justify-center flex-1 py-8">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-800/50 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                    <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
                  </div>
                  <p className="text-white font-medium mb-1 text-sm sm:text-base">Your letter will appear here</p>
                  <p className="text-slate-400 text-xs sm:text-sm">Fill in the details and click Generate</p>
                </div>
              )}

              {/* Generated Letter */}
              {generatedLetter && (
                <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
                  <div className="glass-card p-4 sm:p-5 border border-white/5 flex-1 overflow-y-auto max-h-[400px] sm:max-h-[500px]">
                    <div 
                      className="text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: convertMarkdownLinks(generatedLetter) }}
                    />
                  </div>

                  {/* Metadata */}
                  {metadata && (
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="glass-card p-2.5 sm:p-3 text-center">
                        <p className="text-xs text-slate-500 mb-0.5 sm:mb-1">Words</p>
                        <p className="text-base sm:text-lg font-semibold text-white">
                          {generatedLetter.split(/\s+/).length}
                        </p>
                      </div>
                      <div className="glass-card p-2.5 sm:p-3 text-center">
                        <p className="text-xs text-slate-500 mb-0.5 sm:mb-1">Resume</p>
                        <p className="text-base sm:text-lg font-semibold text-white">
                          {metadata.usedResume ? '✓' : '✗'}
                        </p>
                      </div>
                      <div className="glass-card p-2.5 sm:p-3 text-center">
                        <p className="text-xs text-slate-500 mb-0.5 sm:mb-1">Time</p>
                        <p className="text-base sm:text-lg font-semibold text-white">
                          {(metadata.responseTime / 1000).toFixed(1)}s
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-4 sm:mb-5 flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            Tips for Best Results
          </h3>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {[
              {
                title: "Provide Job Description",
                description: "Paste the full job posting for targeted results"
              },
              {
                title: "Complete Your Profile",
                description: "Add experience and skills for personalization"
              },
              {
                title: "Upload Resume",
                description: "Resume data creates more authentic letters"
              },
              {
                title: "Save Your Letters",
                description: "Click Save to access them later from History"
              }
            ].map((tip, index) => (
              <div key={index} className="flex items-start gap-2 sm:gap-3">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-slate-200 font-medium text-xs sm:text-sm mb-0.5 sm:mb-1">{tip.title}</p>
                  <p className="text-slate-400 text-xs">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Survey Modal */}
      {user && (
        <FeedbackSurveyModal
          isOpen={showSurvey}
          onClose={() => {
            setShowSurvey(false);
            setShowUpgradePrompt(true);
          }}
          onSubmit={handleFeedbackSubmit}
          featureType="coverLetters"
          userId={user.uid}
        />
      )}

      {/* Upgrade Prompt Modal */}
      {showUpgradePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Limit Reached
              </h2>
              <p className="text-slate-400">
                You&apos;ve used all {limit} of your free cover letters this month
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">Unlimited Access</p>
                    <p className="text-sm text-slate-400">Generate unlimited cover letters</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">All Premium Features</p>
                    <p className="text-sm text-slate-400">Resume analysis, interviews, and more</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">Priority Support</p>
                    <p className="text-sm text-slate-400">Get help when you need it</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/subscription"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-medium transition-all"
              >
                Upgrade Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowUpgradePrompt(false)}
                className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}