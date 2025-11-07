'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileText, Sparkles, Download, Copy, Check, AlertCircle, 
  User, Building2, Briefcase, Wand2, Loader2, Upload, 
  Settings, CheckCircle2, XCircle, RefreshCw, ArrowLeft, ChevronDown 
} from 'lucide-react';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader from '@/components/loader/AnimatedLoader';

export default function CoverLetterPage() {
  const [user, loading] = useAuthState(auth);
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [tone, setTone] = useState('professional');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [profileStatus, setProfileStatus] = useState({
    hasProfile: false,
    hasResume: false,
    loading: true,
    userName: '',
    resumeCount: 0
  });
  const [metadata, setMetadata] = useState<any>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Check user profile and resume status on mount
  useEffect(() => {
    if (user) {
      checkProfileStatus();
    }
  }, [user]);

  const checkProfileStatus = async () => {
    try {
      setProfileStatus(prev => ({ ...prev, loading: true }));
      
      // Check profile
      const profileResponse = await fetch('/api/profile');
      const profileData = await profileResponse.json();
      
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }

      // Check resumes - using Firebase client-side
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
  };

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
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate cover letter. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
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
  };

  const handleDownloadWord = async () => {
    try {
      // Create a simple HTML document for Word
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
      
      // Create blob with proper MIME type for Word
      const blob = new Blob([htmlContent], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      // Download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowDownloadMenu(false);
    } catch (err) {
      console.error('Failed to generate Word document:', err);
      alert('Failed to generate Word document. Please try downloading as text instead.');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      
      // Set font
      doc.setFont('helvetica');
      doc.setFontSize(11);
      
      // Split text into lines that fit the page width
      const pageWidth = doc.internal.pageSize.getWidth();
      const margins = 20;
      const maxLineWidth = pageWidth - (margins * 2);
      
      const lines = doc.splitTextToSize(generatedLetter, maxLineWidth);
      
      // Add text to PDF
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
      
      // Save PDF
      doc.save(`cover_letter_${jobRole.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
      
      setShowDownloadMenu(false);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF. Please try downloading as text instead.');
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
  };

  // Loading state
  if (loading || profileStatus.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <AnimatedLoader />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-slate-400 mb-6">Please log in to use the cover letter generator</p>
          <Link 
            href="/login"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-all"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Link 
            href="/dashboard"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-full px-6 py-3 mb-6">
            <Sparkles className="w-5 h-5 text-blue-400" />
            <span className="text-blue-400 font-medium">AI-Powered Cover Letter Generator</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Create Your Perfect Cover Letter
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Generate personalized, professional cover letters tailored to any job role using your profile and resume
          </p>
        </div>

        {/* Profile Status Alert */}
        {(!profileStatus.hasProfile || !profileStatus.hasResume) && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-yellow-400 font-semibold mb-2">Profile Setup Needed</h3>
                  <div className="space-y-2 text-sm text-slate-300">
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
                    className="inline-flex items-center gap-2 mt-3 text-yellow-400 hover:text-yellow-300 text-sm font-medium"
                  >
                    <Settings className="w-4 h-4" />
                    Go to Profile Settings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Indicators */}
        {profileStatus.hasProfile && profileStatus.hasResume && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-green-400 font-medium">Profile Ready</p>
                  <p className="text-slate-400 text-sm">
                    Using data from <span className="text-white">{profileStatus.userName}</span>'s profile 
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
            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-400" />
                Job Details
              </h2>

              <div className="space-y-4">
                {/* Job Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Job Role <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    placeholder="e.g., Senior Software Engineer"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Company Name <span className="text-slate-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g., Google"
                      className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Job Description <span className="text-slate-500">(optional, but recommended)</span>
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here for better personalization..."
                    rows={8}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                  />
                  <div className="flex items-center justify-between mt-1">
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
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tone
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  >
                    <option value="professional">Professional</option>
                    <option value="enthusiastic">Enthusiastic</option>
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                    <option value="confident">Confident</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose the tone that best matches the company culture
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !jobRole.trim()}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      Generate Letter
                    </>
                  )}
                </button>

                {generatedLetter && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all flex items-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6 min-h-[600px]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  Generated Cover Letter
                </h2>

                {generatedLetter && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    
                    {/* Download Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all flex items-center gap-1"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      
                      {showDownloadMenu && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowDownloadMenu(false)}
                          />
                          <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                            <button
                              onClick={handleDownloadTxt}
                              className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              Download as .txt
                            </button>
                            <button
                              onClick={handleDownloadWord}
                              className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2 border-t border-slate-700"
                            >
                              <FileText className="w-4 h-4" />
                              Download as .docx
                            </button>
                            <button
                              onClick={handleDownloadPdf}
                              className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2 border-t border-slate-700"
                            >
                              <FileText className="w-4 h-4" />
                              Download as .pdf
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
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-slate-400 font-medium mb-2">Crafting your perfect cover letter...</p>
                  <p className="text-slate-500 text-sm">This may take 10-20 seconds</p>
                </div>
              )}

              {/* Empty State */}
              {!isGenerating && !generatedLetter && !error && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-slate-600" />
                  </div>
                  <p className="text-slate-400 font-medium mb-2">Your cover letter will appear here</p>
                  <p className="text-slate-500 text-sm">Fill in the job details and click Generate</p>
                </div>
              )}

              {/* Generated Letter */}
              {generatedLetter && (
                <div className="space-y-4">
                  <div className="bg-white/5 border border-slate-700 rounded-lg p-6">
                    <div className="prose prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-slate-200 leading-relaxed">
                        {generatedLetter}
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  {metadata && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">Word Count</p>
                        <p className="text-lg font-semibold text-white">
                          {generatedLetter.split(/\s+/).length}
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">Used Resume</p>
                        <p className="text-lg font-semibold text-white">
                          {metadata.usedResume ? '✓' : '✗'}
                        </p>
                      </div>
                      <div className="bg-slate-800/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-slate-500 mb-1">Generation Time</p>
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

        {/* Tips Section */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              Tips for Best Results
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-sm mb-1">Provide Job Description</p>
                  <p className="text-slate-500 text-xs">Paste the full job posting for highly targeted results</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-sm mb-1">Complete Your Profile</p>
                  <p className="text-slate-500 text-xs">Add your experience and skills for better personalization</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-sm mb-1">Upload Resume</p>
                  <p className="text-slate-500 text-xs">Your resume data helps create authentic, detailed letters</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-300 font-medium text-sm mb-1">Review & Edit</p>
                  <p className="text-slate-500 text-xs">Always personalize the output before sending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}