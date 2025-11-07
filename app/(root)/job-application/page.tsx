// app/job-application/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { 
  FileText, Briefcase, Building2, Sparkles, Download, 
  Upload, CheckCircle2, Loader2, AlertCircle, ArrowRight,
  Wand2, Copy, Check, RefreshCw, Eye, ArrowLeft, MessageSquare,
  Send, Bot, User as UserIcon, Lightbulb, Zap
} from 'lucide-react';

export default function JobApplicationPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  
  // Job Description Input
  const [jobDescription, setJobDescription] = useState('');
  const [extractedData, setExtractedData] = useState({
    jobTitle: '',
    companyName: '',
    companyType: '',
    techStack: [],
    requiredSkills: [],
    location: '',
    experienceLevel: '',
    keyResponsibilities: [],
    companyInfo: ''
  });
  
  // Resume State
  const [selectedResume, setSelectedResume] = useState<any>(null);
  const [availableResumes, setAvailableResumes] = useState([]);
  const [tailoredResume, setTailoredResume] = useState('');
  const [resumeChanges, setResumeChanges] = useState([]);
  
  // Cover Letter State
  const [coverLetter, setCoverLetter] = useState('');
  const [tone, setTone] = useState('professional');
  
  // Copy states
  const [copiedResume, setCopiedResume] = useState(false);
  const [copiedCoverLetter, setCopiedCoverLetter] = useState(false);
  
  // Progress tracking
  const [progress, setProgress] = useState({
    extraction: false,
    resumeTailoring: false,
    coverLetterGeneration: false
  });

  // AI Customization State
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [customizingDocument, setCustomizingDocument] = useState<'resume' | 'coverLetter' | null>(null);
  const [customizationPrompt, setCustomizationPrompt] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customizationHistory, setCustomizationHistory] = useState<Array<{
    type: 'user' | 'ai';
    message: string;
    timestamp: Date;
  }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load user's resumes on mount
  useEffect(() => {
    if (user) {
      loadUserResumes();
    }
  }, [user]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [customizationHistory]);

  const loadUserResumes = async () => {
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch('/api/resume', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        const validResumes = data.data.filter((r: any) => 
          !r.deleted && r.status === 'complete' && r.score
        );
        setAvailableResumes(validResumes);
      }
    } catch (err) {
      console.error('Error loading resumes:', err);
    }
  };

  const extractJobDetails = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description');
      return;
    }

    if (jobDescription.trim().length < 50) {
      setError('Job description is too short. Please provide more details.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setProgress({ extraction: false, resumeTailoring: false, coverLetterGeneration: false });

    try {
      const response = await fetch('/api/job-application/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Extraction failed');

      setExtractedData(data.extracted);
      setProgress(prev => ({ ...prev, extraction: true }));
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to extract job details');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateApplicationDocuments = async () => {
    if (!selectedResume) {
      setError('Please select a resume to tailor');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Step 1: Tailor Resume
      setProgress(prev => ({ ...prev, resumeTailoring: false }));
      
      const resumeResponse = await fetch('/api/job-application/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: selectedResume.id,
          jobDescription,
          extractedData
        })
      });

      const resumeData = await resumeResponse.json();
      if (!resumeResponse.ok) throw new Error(resumeData.error || 'Resume tailoring failed');

      setTailoredResume(resumeData.tailoredResume);
      setResumeChanges(resumeData.changes || []);
      setProgress(prev => ({ ...prev, resumeTailoring: true }));

      // Step 2: Generate Cover Letter
      setProgress(prev => ({ ...prev, coverLetterGeneration: false }));
      
      const coverLetterResponse = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobRole: extractedData.jobTitle,
          companyName: extractedData.companyName,
          jobDescription,
          tone
        })
      });

      const coverLetterData = await coverLetterResponse.json();
      if (!coverLetterResponse.ok) throw new Error(coverLetterData.error || 'Cover letter generation failed');

      setCoverLetter(coverLetterData.coverLetter.content);
      setProgress(prev => ({ ...prev, coverLetterGeneration: true }));
      
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to generate application documents');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCustomize = async () => {
    if (!customizationPrompt.trim() || !customizingDocument) return;

    const currentContent = customizingDocument === 'resume' ? tailoredResume : coverLetter;

    // Add user message to history
    setCustomizationHistory(prev => [...prev, {
      type: 'user',
      message: customizationPrompt,
      timestamp: new Date()
    }]);

    setIsCustomizing(true);
    const userPromptCopy = customizationPrompt;
    setCustomizationPrompt('');

    try {
      const response = await fetch('/api/job-application/customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: customizingDocument,
          currentContent,
          userPrompt: userPromptCopy,
          context: extractedData
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Customization failed');

      // Update the document
      if (customizingDocument === 'resume') {
        setTailoredResume(data.customizedContent);
      } else {
        setCoverLetter(data.customizedContent);
      }

      // Add AI response to history
      setCustomizationHistory(prev => [...prev, {
        type: 'ai',
        message: data.changeExplanation || 'Changes applied successfully!',
        timestamp: new Date()
      }]);

    } catch (err: any) {
      setCustomizationHistory(prev => [...prev, {
        type: 'ai',
        message: `Error: ${err.message || 'Failed to apply changes'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsCustomizing(false);
    }
  };

  const openCustomizer = (docType: 'resume' | 'coverLetter') => {
    setCustomizingDocument(docType);
    setShowCustomizer(true);
    setCustomizationHistory([{
      type: 'ai',
      message: `Hi! I'm here to help you customize your ${docType}. Tell me what changes you'd like to make. For example:\n\n• "Make the tone more enthusiastic"\n• "Add more quantifiable metrics"\n• "Emphasize my leadership experience"\n• "Shorten the introduction"\n• "Add specific mention of AWS and Kubernetes"`,
      timestamp: new Date()
    }]);
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'resume') {
        setCopiedResume(true);
        setTimeout(() => setCopiedResume(false), 2000);
      } else {
        setCopiedCoverLetter(true);
        setTimeout(() => setCopiedCoverLetter(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadDocument = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetApplication = () => {
    setStep(1);
    setJobDescription('');
    setExtractedData({
      jobTitle: '',
      companyName: '',
      companyType: '',
      techStack: [],
      requiredSkills: [],
      location: '',
      experienceLevel: '',
      keyResponsibilities: [],
      companyInfo: ''
    });
    setTailoredResume('');
    setCoverLetter('');
    setSelectedResume(null);
    setResumeChanges([]);
    setError('');
    setProgress({
      extraction: false,
      resumeTailoring: false,
      coverLetterGeneration: false
    });
    setShowCustomizer(false);
    setCustomizationHistory([]);
  };

  // Quick prompt suggestions
  const quickPrompts = [
    { icon: Zap, text: 'Make it more concise', category: 'Style' },
    { icon: Sparkles, text: 'Add more specific metrics', category: 'Content' },
    { icon: Lightbulb, text: 'Emphasize leadership skills', category: 'Focus' },
    { icon: Wand2, text: 'Make tone more enthusiastic', category: 'Tone' }
  ];

  if (loading) {
    return <AnimatedLoader />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              onClick={() => router.push('/')}
              className="absolute left-6 top-6 p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
              <Sparkles className="w-4 h-4" />
              AI-Powered Application Generator
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            Generate Complete Job Application
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Upload job description → Get tailored resume + cover letter → Customize with AI
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { num: 1, label: 'Job Details', icon: Briefcase },
            { num: 2, label: 'Select Resume', icon: FileText },
            { num: 3, label: 'Review & Download', icon: Download }
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                step === s.num 
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-105' 
                  : step > s.num
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                <s.icon className="w-5 h-5" />
                <span className="font-semibold hidden md:inline">{s.label}</span>
              </div>
              {i < 2 && (
                <ArrowRight className={`w-5 h-5 ${
                  step > s.num ? 'text-green-500' : 'text-slate-400'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Step 1: Job Description Input */}
        {step === 1 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl">
                <Upload className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Paste Job Description
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  AI will extract key details and requirements
                </p>
              </div>
            </div>

            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the complete job description here including:
• Job title and company name
• Required skills and technologies  
• Responsibilities and qualifications
• Company information (optional)

Example:
Software Engineer at TechCorp
We're looking for a skilled software engineer...
Required: React, Node.js, Python, AWS..."
              rows={16}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-slate-900 dark:text-white placeholder-slate-400"
            />
            
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                {jobDescription.length} characters {jobDescription.length < 50 && jobDescription.length > 0 && '(minimum 50 required)'}
              </p>
              <button
                onClick={extractJobDetails}
                disabled={isProcessing || !jobDescription.trim() || jobDescription.length < 50}
                className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  isProcessing || !jobDescription.trim() || jobDescription.length < 50
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Extract Details
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Resume Selection & Generation */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Extracted Job Details */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Extracted Job Details
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Role</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {extractedData.jobTitle || 'Not specified'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Company</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {extractedData.companyName || 'Not specified'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Industry</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {extractedData.companyType || 'General'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tech Stack</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {extractedData.techStack?.length || 0} technologies
                  </p>
                </div>
              </div>

              {extractedData.techStack?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Required Technologies:</p>
                  <div className="flex flex-wrap gap-2">
                    {extractedData.techStack.map((tech: string, i: number) => (
                      <span key={i} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {extractedData.experienceLevel && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <span className="font-semibold">Experience Level:</span> {extractedData.experienceLevel}
                  </p>
                </div>
              )}
            </div>

            {/* Resume Selection */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Select Resume to Tailor
              </h3>
              
              {availableResumes.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    No resumes found. Please upload a resume first.
                  </p>
                  <button 
                    onClick={() => router.push('/resume/upload')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Resume
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {availableResumes.map((resume: any) => (
                    <button
                      key={resume.id}
                      onClick={() => setSelectedResume(resume)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedResume?.id === resume.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-4 h-4 text-slate-500" />
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {resume.jobTitle} at {resume.companyName}
                            </p>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Score: {resume.score}/100 • Uploaded {new Date(resume.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {selectedResume?.id === resume.id && (
                          <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tone Selection */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Cover Letter Tone
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'professional', label: 'Professional', emoji: '💼' },
                  { value: 'enthusiastic', label: 'Enthusiastic', emoji: '🚀' },
                  { value: 'technical', label: 'Technical', emoji: '⚙️' },
                  { value: 'creative', label: 'Creative', emoji: '🎨' }
                ].map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={`p-3 rounded-xl border-2 transition-all ${
                      tone === t.value
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{t.emoji}</div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">
                      {t.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              
              <button
                onClick={generateApplicationDocuments}
                disabled={isProcessing || !selectedResume}
                className={`px-8 py-4 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                  isProcessing || !selectedResume
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Application...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Generate Application
                  </>
                )}
              </button>
            </div>

            {/* Progress Indicators */}
            {isProcessing && (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  {progress.resumeTailoring ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
                  )}
                  <span className="text-slate-700 dark:text-slate-300">
                    Tailoring resume to job requirements...
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {progress.coverLetterGeneration ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Loader2 className={`w-5 h-5 ${progress.resumeTailoring ? 'text-purple-500 animate-spin' : 'text-slate-400'}`} />
                  )}
                  <span className={progress.resumeTailoring ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                    Generating personalized cover letter...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Download with AI Customization */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Documents */}
            <div className={`space-y-6 ${showCustomizer ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
              {/* Success Message */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h3 className="text-xl font-bold text-green-900 dark:text-green-100">
                    Application Package Ready!
                  </h3>
                </div>
                <p className="text-green-700 dark:text-green-300">
                  Your tailored resume and cover letter have been generated. Review, customize with AI, and download below.
                </p>
              </div>

              {/* Tailored Resume */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-white" />
                      <div>
                        <h3 className="text-lg font-bold text-white">Tailored Resume</h3>
                        <p className="text-purple-100 text-sm">
                          Optimized for {extractedData.jobTitle || 'this role'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCustomizer('resume')}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Customize</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(tailoredResume, 'resume')}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {copiedResume ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span className="hidden sm:inline">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span className="hidden sm:inline">Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => downloadDocument(
                          tailoredResume, 
                          `Resume_${extractedData.companyName || 'Tailored'}_${extractedData.jobTitle?.replace(/\s+/g, '_') || 'Position'}.txt`
                        )}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {resumeChanges.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        Key Changes Made:
                      </p>
                      <ul className="space-y-1">
                        {resumeChanges.slice(0, 5).map((change: string, i: number) => (
                          <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap font-mono">
                      {tailoredResume}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-6 h-6 text-white" />
                      <div>
                        <h3 className="text-lg font-bold text-white">Cover Letter</h3>
                        <p className="text-indigo-100 text-sm">
                          {tone.charAt(0).toUpperCase() + tone.slice(1)} tone
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCustomizer('coverLetter')}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Wand2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Customize</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(coverLetter, 'cover')}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {copiedCoverLetter ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span className="hidden sm:inline">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span className="hidden sm:inline">Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => downloadDocument(
                          coverLetter, 
                          `CoverLetter_${extractedData.companyName || 'Tailored'}_${extractedData.jobTitle?.replace(/\s+/g, '_') || 'Position'}.txt`
                        )}
                        className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 max-h-96 overflow-y-auto">
                    <pre className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap font-sans leading-relaxed">
                      {coverLetter}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <button
                  onClick={resetApplication}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Start New Application
                </button>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      downloadDocument(
                        tailoredResume, 
                        `Resume_${extractedData.companyName || 'Tailored'}.txt`
                      );
                      downloadDocument(
                        coverLetter, 
                        `CoverLetter_${extractedData.companyName || 'Tailored'}.txt`
                      );
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download Both
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: AI Customizer */}
            {showCustomizer && (
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden sticky top-6">
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-white" />
                        <h3 className="font-bold text-white">AI Customizer</h3>
                      </div>
                      <button
                        onClick={() => setShowCustomizer(false)}
                        className="text-white/80 hover:text-white transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-purple-100 text-xs mt-1">
                      Customizing: {customizingDocument === 'resume' ? 'Resume' : 'Cover Letter'}
                    </p>
                  </div>

                  {/* Chat History */}
                  <div className="h-96 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900">
                    {customizationHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.type === 'ai' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-xl px-3 py-2 ${
                            msg.type === 'user'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                        {msg.type === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isCustomizing && (
                      <div className="flex gap-2 justify-start">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Applying changes...
                          </p>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Quick Prompts */}
                  <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Quick prompts:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickPrompts.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => setCustomizationPrompt(prompt.text)}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-xs text-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <prompt.icon className="w-3 h-3" />
                          {prompt.text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input Box */}
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customizationPrompt}
                        onChange={(e) => setCustomizationPrompt(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isCustomizing && handleCustomize()}
                        placeholder="Tell me what to change..."
                        disabled={isCustomizing}
                        className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                      />
                      <button
                        onClick={handleCustomize}
                        disabled={!customizationPrompt.trim() || isCustomizing}
                        className={`p-2 rounded-lg transition-colors ${
                          !customizationPrompt.trim() || isCustomizing
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                        }`}
                      >
                        {isCustomizing ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}