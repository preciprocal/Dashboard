// app/resume/upload/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import FileUploader from '@/components/resume/FileUploader';
import { Resume, ResumeFeedback } from '@/types/resume';
import { 
  FileText, 
  Sparkles, 
  Shield, 
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Upload,
  ArrowRight
} from 'lucide-react';
import { compressPDF, validatePDF } from '@/lib/resume/pdf-compression';
import { convertPdfToImage } from '@/lib/resume/pdf2img';
import FeedbackSurveyModal, { FeedbackData } from '@/components/FeedbackSurveyModal';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { toast } from 'sonner';
import Link from 'next/link';

const PROCESSING_STEPS = [
  { step: 0, message: 'Compressing file...', progress: 10 },
  { step: 1, message: 'Converting PDF to image...', progress: 30 },
  { step: 2, message: 'Analyzing with AI...', progress: 60 },
  { step: 3, message: 'Saving results...', progress: 85 },
  { step: 4, message: 'Complete!', progress: 100 },
];

const RESUME_FACTS = [
  "💼 Recruiters spend an average of 6-7 seconds on initial resume screening",
  "📊 75% of resumes are rejected by ATS systems before reaching human eyes",
  "✨ Resumes with quantified achievements get 40% more interview callbacks",
  "🎯 Using keywords from the job description increases ATS match by 60%",
  "📝 One-page resumes are ideal for <10 years experience, two pages for more",
  "🚀 Action verbs at the start of bullet points increase readability by 35%",
  "💡 White space improves resume readability and reduces rejection rates",
  "🔍 90% of large companies use ATS to filter applications",
  "📈 Tailored resumes get 2x more interviews than generic ones",
  "⚡ PDF format is preferred by 83% of recruiters over Word documents",
  "🎨 Clean, professional fonts like Calibri or Arial score higher in ATS",
  "📞 Including LinkedIn URL increases profile views by 71%",
  "💪 Skills sections with 6-12 relevant skills perform best",
  "🏆 Resumes starting with a strong summary get 50% more attention",
  "📧 Professional email addresses increase callback rates by 24%",
];

interface FormData {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  analysisType: 'full' | 'quick' | 'ats-only';
}

export default function UploadResume() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    jobTitle: '',
    jobDescription: '',
    analysisType: 'full',
  });

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

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError('');
  };

  const updateProgress = (step: number) => {
    console.log(`📊 Progress: Step ${step} - ${PROCESSING_STEPS[step]?.message}`);
    setCurrentStep(step);
  };

  const handleAnalyze = async () => {
    if (!user || !file) {
      setError('User or file is missing');
      return;
    }

    // Check usage limit FIRST
    if (!canUseFeature('resumes')) {
      if (checkAndShowSurvey('resumes')) {
        setShowSurvey(true);
      } else {
        setShowUpgradePrompt(true);
      }
      return;
    }

    setIsProcessing(true);
    setError('');
    setCurrentFactIndex(Math.floor(Math.random() * RESUME_FACTS.length));
    
    const factInterval = setInterval(() => {
      setCurrentFactIndex(prev => (prev + 1) % RESUME_FACTS.length);
    }, 4000);
    
    const resumeId: string = crypto.randomUUID();

    try {
      console.log('🚀 Starting resume analysis');
      console.log('Resume ID:', resumeId);
      console.log('File:', file.name, '-', (file.size / 1024).toFixed(2), 'KB');

      // Step 0: Compress
      updateProgress(0);
      let fileToUpload = file;
      const compressionThreshold = 2 * 1024 * 1024;
      
      if (file.size > compressionThreshold) {
        console.log('Compressing file...');
        try {
          fileToUpload = await compressPDF(file);
          console.log('Compressed:', (fileToUpload.size / 1024).toFixed(2), 'KB');
        } catch (compressionError) {
          console.warn('Compression failed, using original:', compressionError);
          fileToUpload = file;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 1: Convert to image
      updateProgress(1);
      console.log('Converting PDF to image...');
      
      const imageResult = await convertPdfToImage(fileToUpload);
      if (!imageResult.file || imageResult.error) {
        throw new Error(imageResult.error || 'Failed to convert PDF');
      }
      console.log('Converted successfully');

      // Step 2: Analyze
      updateProgress(2);
      console.log('Calling API...');

      const apiFormData = new window.FormData();
      apiFormData.append('file', imageResult.file);
      apiFormData.append('jobTitle', formData.jobTitle);
      apiFormData.append('jobDescription', formData.jobDescription);

      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        body: apiFormData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
      }

      const responseData = await response.json();
      const { feedback } = responseData;
      
      console.log('Analysis complete. Score:', feedback?.overallScore);

      if (!feedback || typeof feedback.overallScore !== 'number') {
        throw new Error('Invalid response from AI service');
      }

      // Step 3: Save
      updateProgress(3);
      console.log('Saving to Firebase...');

      const resumeToSave: Omit<Resume, 'imagePath' | 'resumePath'> = {
        id: resumeId,
        userId: user.uid,
        fileName: fileToUpload.name,
        originalFileName: file.name,
        fileSize: fileToUpload.size,
        companyName: formData.companyName.trim(),
        jobTitle: formData.jobTitle.trim(),
        jobDescription: formData.jobDescription.trim(),
        status: 'complete' as const,
        score: feedback.overallScore,
        feedback: feedback as ResumeFeedback,
        createdAt: new Date(),
        updatedAt: new Date(),
        analyzedAt: new Date(),
      };

      await FirebaseService.saveResumeWithFiles(
        resumeToSave,
        fileToUpload,
        imageResult.file
      );

      console.log('Saved successfully');

      // Increment usage count after successful analysis
      await incrementUsage('resumes');

      // Step 4: Complete
      updateProgress(4);
      console.log('🎉 Complete! Redirecting...');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      router.push(`/resume/${resumeId}`);
      
      setTimeout(() => {
        if (window.location.pathname.includes('upload')) {
          window.location.href = `/resume/${resumeId}`;
        }
      }, 2000);
      
    } catch (err) {
      console.error('❌ Analysis failed:', err);
      
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'An unexpected error occurred';
      
      setError(errorMessage);
      setIsProcessing(false);
      setCurrentStep(0);
      toast.error('Failed to analyze resume');
    } finally {
      clearInterval(factInterval);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a PDF file to upload');
      return;
    }

    const validation = validatePDF(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    setError('');
    await handleAnalyze();
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  const remainingCount = getRemainingCount('resumes');
  const limit = getLimit('resumes');
  const hasAnalysesRemaining = remainingCount === -1 || remainingCount > 0;

  return (
    <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
      {/* Processing Loader */}
      {isProcessing && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl max-w-md w-full p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-4">
                <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-white mb-2 sm:mb-3">
                {PROCESSING_STEPS[currentStep]?.message}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                {RESUME_FACTS[currentFactIndex]}
              </p>
            </div>

            <div className="relative w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4 sm:mb-6">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress || 0}%` }}
              />
            </div>

            <div className="space-y-2 sm:space-y-3">
              {PROCESSING_STEPS.map((step, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center text-xs sm:text-sm ${
                    idx < currentStep 
                      ? 'text-emerald-400' 
                      : idx === currentStep 
                      ? 'text-blue-400' 
                      : 'text-slate-600'
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="w-4 h-4 mr-3 flex-shrink-0" />
                  ) : idx === currentStep ? (
                    <Loader2 className="w-4 h-4 mr-3 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 mr-3 border border-slate-700 rounded-full flex-shrink-0" />
                  )}
                  <span>{step.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {hasAnalysesRemaining ? (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1.5 mb-3">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
                  <span className="text-blue-400 text-xs sm:text-sm font-medium">AI-Powered</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">
                  Resume Analyzer
                </h1>
                <p className="text-slate-400 text-sm">
                  Get instant AI-powered feedback and detailed insights to optimize your resume
                </p>
              </div>
              <div className={`px-4 py-2 rounded-lg border ${
                remainingCount === -1
                  ? 'bg-purple-500/5 border-purple-500/20 text-purple-400'
                  : 'bg-slate-500/5 border-slate-500/20 text-slate-400'
              } flex-shrink-0`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Shield className="w-4 h-4" />
                  {!usageLoading && (
                    <span>
                      {remainingCount === -1 ? 'Unlimited' : `${remainingCount} of ${limit} left`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Form Container */}
            <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-red-400 mb-0.5 text-sm">Analysis Failed</h3>
                      <p className="text-xs text-red-300 break-words">{error}</p>
                    </div>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 text-lg leading-none flex-shrink-0">×</button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Analysis Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Analysis Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'full', label: 'Full', fullLabel: 'Full Analysis', time: '~30s' },
                      { value: 'quick', label: 'Quick', fullLabel: 'Quick Scan', time: '~10s' },
                      { value: 'ats-only', label: 'ATS', fullLabel: 'ATS Check', time: '~15s' },
                    ].map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, analysisType: type.value as 'full' | 'quick' | 'ats-only' })}
                        className={`p-2.5 rounded-lg border transition-all text-center ${
                          formData.analysisType === type.value
                            ? 'border-blue-500 bg-blue-500/10 text-white'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div className="font-medium text-xs sm:text-sm mb-0.5">
                          <span className="hidden sm:inline">{type.fullLabel}</span>
                          <span className="sm:hidden">{type.label}</span>
                        </div>
                        <div className="text-xs opacity-70">{type.time}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Company & Job Title */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="company-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Company <span className="text-slate-500 text-xs">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      id="company-name"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g., Google"
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="job-title" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Job Title <span className="text-slate-500 text-xs">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      id="job-title"
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      placeholder="e.g., Software Engineer"
                      className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <label htmlFor="job-description" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Job Description <span className="text-slate-500 text-xs">(Optional)</span>
                  </label>
                  <textarea
                    id="job-description"
                    rows={2}
                    value={formData.jobDescription}
                    onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                    placeholder="Paste job description for better keyword matching..."
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Upload Resume <span className="text-red-400">*</span>
                  </label>
                  <FileUploader onFileSelect={handleFileSelect} />
                  
                  {file && (
                    <div className="mt-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white text-xs truncate">{file.name}</p>
                            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="space-y-3 pt-2">
                  <button
                    type="submit"
                    disabled={!file || isProcessing}
                    className={`w-full py-2.5 sm:py-3 px-6 rounded-xl font-medium transition-all text-sm sm:text-base ${
                      !file || isProcessing
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-blue-500/25'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        Analyzing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                        Analyze Resume
                      </span>
                    )}
                  </button>

                  <div className="text-center">
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      <span>PDF only • Max 10MB • 10-30 seconds</span>
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="max-w-lg mx-auto">
            {/* Icon */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-800/50 border border-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500" />
            </div>
            
            {/* Content */}
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-white mb-3">
                Analysis Limit Reached
              </h2>
              <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
                You&apos;ve used all {limit} of your free resume analyses this month. Upgrade your plan for unlimited access.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3 mb-8">
              <Link
                href="/subscription"
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-xl text-sm sm:text-base"
              >
                Upgrade to Pro
                <ArrowRight className="w-4 h-4" />
              </Link>
              
              <Link
                href="/profile"
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800/50 hover:bg-slate-800/70 text-slate-300 border border-slate-700/50 rounded-xl font-medium transition-all text-sm sm:text-base"
              >
                View Progress
              </Link>
            </div>

            {/* Benefits Preview */}
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">
                ✨ Pro Plan Benefits
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Unlimited resume analyses</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Unlimited interview sessions</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Unlimited cover letters & study plans</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>Priority support</span>
                </div>
              </div>
            </div>
          </div>
        )}
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
          featureType="resumes"
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
                You&apos;ve used all {limit} of your free resume analyses this month
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">Unlimited Analyses</p>
                    <p className="text-sm text-slate-400">Analyze unlimited resumes</p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium mb-1">All Premium Features</p>
                    <p className="text-sm text-slate-400">Interviews, cover letters, and more</p>
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