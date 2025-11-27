'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Sparkles, Download, Copy, Check, AlertCircle, 
  Building2, Briefcase, Wand2, Loader2, 
  Settings, CheckCircle2, XCircle, RefreshCw, ChevronDown,
  Save,
  History
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { toast } from 'sonner';

interface CoverLetterMetadata {
  usedResume: boolean;
  responseTime: number;
}

export default function CoverLetterGeneratorPage() {
  const router = useRouter();
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
  const [profileStatus, setProfileStatus] = useState({
    hasProfile: false,
    hasResume: false,
    loading: true,
    userName: '',
    resumeCount: 0
  });
  const [metadata, setMetadata] = useState<CoverLetterMetadata | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedLetterId, setSavedLetterId] = useState<string | null>(null);

  const checkProfileStatus = useCallback(async () => {
    if (!user) return;
    
    try {
      setProfileStatus(prev => ({ ...prev, loading: true }));
      
      const profileResponse = await fetch('/api/profile');
      const profileData = await profileResponse.json();
      
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      const { collection, query, where, getDocs, orderBy } = await import('firebase/firestore');
      const { db } = await import('@/firebase/client');
      
      const resumesQuery = query(
        collection(db, 'resumes'),
        where('userId', '==', user?.uid),
        orderBy('createdAt', 'desc')
      );
      
      const resumesSnapshot = await getDocs(resumesQuery);
      const resumes = resumesSnapshot.docs
        .map(doc => doc.data())
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

    setIsGenerating(true);
    setError('');
    setGeneratedLetter('');
    setMetadata(null);
    setIsSaved(false);
    setSavedLetterId(null);

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
      // Calculate word count
      const wordCount = generatedLetter.split(/\s+/).filter(word => word.length > 0).length;

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'coverLetters'), {
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
      setSavedLetterId(docRef.id);
      toast.success('Cover letter saved successfully!');
      
      console.log('Cover letter saved with ID:', docRef.id);
    } catch (err) {
      console.error('Error saving cover letter:', err);
      toast.error('Failed to save cover letter');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLetter);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy');
    }
  };

  const handleDownloadTxt = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedLetter], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setShowDownloadMenu(false);
    toast.success('Downloaded as TXT');
  };

  const handleDownloadWord = async () => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 11pt;
              line-height: 1.5;
              margin: 1in;
            }
            p {
              margin-bottom: 12pt;
            }
          </style>
        </head>
        <body>
          ${generatedLetter.split('\n\n').map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`).join('\n')}
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowDownloadMenu(false);
      toast.success('Downloaded as Word');
    } catch (err) {
      console.error('Failed to generate Word document:', err);
      toast.error('Failed to generate Word document');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      doc.setFont('helvetica');
      doc.setFontSize(11);
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const margins = 20;
      const maxLineWidth = pageWidth - (margins * 2);
      
      const lines = doc.splitTextToSize(generatedLetter, maxLineWidth);
      
      let y = 20;
      const lineHeight = 7;
      const pageHeight = doc.internal.pageSize.getHeight();
      
      lines.forEach((line: string) => {
        if (y + lineHeight > pageHeight - 20) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margins, y);
        y += lineHeight;
      });
      
      doc.save(`cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
      
      setShowDownloadMenu(false);
      toast.success('Downloaded as PDF');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Failed to generate PDF');
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
    setSavedLetterId(null);
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card hover-lift">
          <div className="text-center p-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-400 mb-6">Please log in to use the cover letter generator</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-3">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">AI-Powered</span>
              </div>
              <h1 className="text-2xl font-semibold text-white mb-1">
                Cover Letter Generator
              </h1>
              <p className="text-slate-400 text-sm">
                Generate personalized, professional cover letters
              </p>
            </div>
            
            <Link
              href="/cover-letter"
              className="glass-button hover-lift inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white"
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
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-amber-400 font-medium mb-3">Profile Setup Needed</h3>
                <div className="space-y-2 text-sm text-slate-300 mb-4">
                  {!profileStatus.hasProfile && (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>Complete your profile in Settings</span>
                    </div>
                  )}
                  {!profileStatus.hasResume && (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>Upload your resume for better results</span>
                    </div>
                  )}
                </div>
                <Link 
                  href="/profile"
                  className="glass-button hover-lift inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg"
                >
                  <Settings className="w-4 h-4" />
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
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 font-medium">Profile Ready</p>
                <p className="text-slate-400 text-sm">
                  Using data from {profileStatus.userName}&apos;s profile 
                  {profileStatus.resumeCount > 0 && ` and ${profileStatus.resumeCount} resume${profileStatus.resumeCount > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="glass-card hover-lift">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                </div>
                Job Details
              </h2>

              <div className="space-y-4">
                {/* Job Role */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Job Role <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-white placeholder-slate-500 text-sm"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Company Name <span className="text-slate-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g., Google"
                      className="glass-input w-full pl-10 pr-4 py-2.5 rounded-lg text-white placeholder-slate-500 text-sm"
                    />
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Job Description <span className="text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={6}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-white placeholder-slate-500 text-sm resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
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
                  <label className="block text-sm text-slate-400 mb-2">
                    Tone
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-white text-sm"
                  >
                    <option value="professional">Professional</option>
                    <option value="enthusiastic">Enthusiastic</option>
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                    <option value="confident">Confident</option>
                  </select>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 glass-card p-4 border border-red-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !jobRole.trim()}
                  className="flex-1 glass-button-primary hover-lift py-2.5 px-6 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Generate
                    </>
                  )}
                </button>

                {generatedLetter && (
                  <button
                    onClick={handleReset}
                    className="glass-button hover-lift px-6 py-2.5 text-white rounded-lg flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <div className="space-y-6">
          <div className="glass-card hover-lift" style={{ minHeight: '600px' }}>
            <div className="p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-400" />
                  </div>
                  Generated Letter
                </h2>

                {generatedLetter && (
                  <div className="flex gap-2">
                    {/* Save Button */}
                    {!isSaved ? (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="glass-button-primary hover-lift px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
                        title="Save"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="glass-button bg-emerald-500/10 border-emerald-500/20 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400">Saved</span>
                      </div>
                    )}

                    <button
                      onClick={handleCopy}
                      className="glass-button hover-lift p-2 rounded-lg"
                      title="Copy"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    
                    {/* Download Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                        className="glass-button hover-lift p-2 rounded-lg flex items-center gap-1"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-slate-300" />
                        <ChevronDown className="w-3 h-3 text-slate-300" />
                      </button>
                      
                      {showDownloadMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowDownloadMenu(false)}
                          />
                          <div className="absolute right-0 mt-2 w-44 glass-card rounded-lg z-20 overflow-hidden border border-white/10">
                            <button
                              onClick={handleDownloadTxt}
                              className="w-full px-4 py-2.5 text-left text-slate-300 hover:bg-white/5 flex items-center gap-2 text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              Text (.txt)
                            </button>
                            <button
                              onClick={handleDownloadWord}
                              className="w-full px-4 py-2.5 text-left text-slate-300 hover:bg-white/5 flex items-center gap-2 border-t border-white/5 text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              Word (.docx)
                            </button>
                            <button
                              onClick={handleDownloadPdf}
                              className="w-full px-4 py-2.5 text-left text-slate-300 hover:bg-white/5 flex items-center gap-2 border-t border-white/5 text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              PDF (.pdf)
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Loading State */}
              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  </div>
                  <p className="text-white font-medium mb-1">Crafting your cover letter...</p>
                  <p className="text-slate-400 text-sm">This may take 10-20 seconds</p>
                </div>
              )}

              {/* Empty State */}
              {!isGenerating && !generatedLetter && !error && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-white font-medium mb-1">Your letter will appear here</p>
                  <p className="text-slate-400 text-sm">Fill in the details and click Generate</p>
                </div>
              )}

              {/* Generated Letter */}
              {generatedLetter && (
                <div className="space-y-4">
                  <div className="glass-card p-5 border border-white/5 max-h-[500px] overflow-y-auto">
                    <div className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                      {generatedLetter}
                    </div>
                  </div>

                  {/* Metadata */}
                  {metadata && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="glass-card p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">Words</p>
                        <p className="text-lg font-semibold text-white">
                          {generatedLetter.split(/\s+/).length}
                        </p>
                      </div>
                      <div className="glass-card p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">Resume</p>
                        <p className="text-lg font-semibold text-white">
                          {metadata.usedResume ? '✓' : '✗'}
                        </p>
                      </div>
                      <div className="glass-card p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">Time</p>
                        <p className="text-lg font-semibold text-white">
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
        <div className="p-6">
          <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            Tips for Best Results
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
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
              <div key={index} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-slate-200 font-medium text-sm mb-1">{tip.title}</p>
                  <p className="text-slate-400 text-xs">{tip.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}