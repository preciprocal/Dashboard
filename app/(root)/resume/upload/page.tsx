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
  TrendingUp,
  Loader2
} from 'lucide-react';
import { compressPDF, validatePDF } from '@/lib/resume/pdf-compression';
import { convertPdfToImage } from '@/lib/resume/pdf2img';

const PROCESSING_STEPS = [
  { step: 0, message: 'Compressing file...', progress: 10 },
  { step: 1, message: 'Converting PDF to image...', progress: 30 },
  { step: 2, message: 'Analyzing with AI...', progress: 60 },
  { step: 3, message: 'Saving results...', progress: 85 },
  { step: 4, message: 'Complete!', progress: 100 },
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
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    jobTitle: '',
    jobDescription: '',
    analysisType: 'full',
  });

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

    setIsProcessing(true);
    setError('');
    
    let resumeId: string | null = null;

    try {
      resumeId = crypto.randomUUID();
      
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

      const apiFormData = new FormData();
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
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred';
      
      setError(errorMessage);
      setIsProcessing(false);
      setCurrentStep(0);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Processing Loader */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {PROCESSING_STEPS[currentStep]?.message}
              </h3>
              <p className="text-sm text-slate-400">
                Please wait, this may take 10-30 seconds...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-2 bg-slate-800/50 rounded-full overflow-hidden mb-6">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress || 0}%` }}
              />
            </div>

            {/* Percentage */}
            <div className="text-center mb-6">
              <span className="text-2xl font-semibold text-white">
                {PROCESSING_STEPS[currentStep]?.progress || 0}%
              </span>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {PROCESSING_STEPS.map((step, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center text-sm ${
                    idx < currentStep 
                      ? 'text-emerald-400' 
                      : idx === currentStep 
                      ? 'text-blue-400 font-medium' 
                      : 'text-slate-500'
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  ) : idx === currentStep ? (
                    <Loader2 className="w-4 h-4 mr-2 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 mr-2 border-2 border-slate-600 rounded-full flex-shrink-0" />
                  )}
                  <span>{step.message}</span>
                </div>
              ))}
            </div>

            {currentStep === 3 && (
              <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-xs text-amber-400 flex items-start">
                  <Info className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0" />
                  Saving to database... Please don't close this window.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-white mb-2">
            AI Resume Analyzer
          </h1>
          <p className="text-slate-400">
            Get instant AI-powered feedback with multi-agentic analysis
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card hover-lift">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-white text-sm">AI-Powered</h3>
                <p className="text-xs text-slate-400">Multi-agentic system</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-medium text-white text-sm">ATS Optimized</h3>
                <p className="text-xs text-slate-400">Beat tracking systems</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card hover-lift">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-white text-sm">Secure & Private</h3>
                <p className="text-xs text-slate-400">Data protected</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card border border-red-500/20">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-red-400 mb-1 text-sm">
                  Analysis Failed
                </h3>
                <p className="text-sm text-red-300 mb-3">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-sm text-red-300 hover:text-red-200 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="glass-card">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white mb-1">
            Resume Analysis Form
          </h2>
          <p className="text-sm text-slate-400">
            Fill in details for personalized feedback
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Analysis Type */}
          <div>
            <label className="block text-sm text-slate-400 mb-3">
              Analysis Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'full', label: 'Full Analysis', desc: 'Complete evaluation', time: '~30s' },
                { value: 'quick', label: 'Quick Scan', desc: 'Key insights', time: '~10s' },
                { value: 'ats-only', label: 'ATS Only', desc: 'Focus on ATS', time: '~15s' },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, analysisType: type.value as any })}
                  className={`p-4 rounded-lg border transition-all ${
                    formData.analysisType === type.value
                      ? 'border-blue-500/30 bg-blue-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-white text-sm">{type.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{type.desc}</div>
                    <div className="text-xs text-slate-500 mt-1">{type.time}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Name */}
            <div>
              <label htmlFor="company-name" className="block text-sm text-slate-400 mb-2">
                Company Name
                <span className="ml-2 text-xs text-slate-500">Optional</span>
              </label>
              <input
                type="text"
                id="company-name"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g., Google, Microsoft"
                className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
              />
            </div>

            {/* Job Title */}
            <div>
              <label htmlFor="job-title" className="block text-sm text-slate-400 mb-2">
                Job Title
                <span className="ml-2 text-xs text-slate-500">Optional</span>
              </label>
              <input
                type="text"
                id="job-title"
                value={formData.jobTitle}
                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
              />
            </div>

            {/* Job Description */}
            <div className="lg:col-span-2">
              <label htmlFor="job-description" className="block text-sm text-slate-400 mb-2">
                Job Description
                <span className="ml-2 text-xs text-slate-500">Optional</span>
              </label>
              <textarea
                id="job-description"
                rows={5}
                value={formData.jobDescription}
                onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                placeholder="Paste the job description for better keyword matching..."
                className="w-full px-4 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm resize-none"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-start">
                <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                Including the job description improves analysis accuracy
              </p>
            </div>

            {/* File Upload */}
            <div className="lg:col-span-2">
              <label className="block text-sm text-slate-400 mb-2">
                Upload Resume
                <span className="ml-2 text-xs text-red-400">Required</span>
              </label>
              <FileUploader onFileSelect={handleFileSelect} />
              
              {file && (
                <div className="mt-4 p-4 glass-card border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="font-medium text-white text-sm">{file.name}</p>
                        <p className="text-xs text-slate-400">
                          {(file.size / 1024).toFixed(2)} KB • PDF
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!file || isProcessing}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
              !file || isProcessing
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Sparkles className="w-5 h-5 mr-2" />
                Start AI Analysis
              </span>
            )}
          </button>

          {/* Security Notice */}
          <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
            <Shield className="w-4 h-4" />
            <span>Your resume is processed securely</span>
          </div>
        </form>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card">
          <div className="p-6">
            <h3 className="font-medium text-white mb-3 flex items-center text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
              What We Analyze
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                ATS compatibility and keywords
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                Content quality and metrics
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                Structure and formatting
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                Skills alignment
              </li>
            </ul>
          </div>
        </div>

        <div className="glass-card">
          <div className="p-6">
            <h3 className="font-medium text-white mb-3 flex items-center text-sm">
              <Info className="w-5 h-5 text-blue-400 mr-2" />
              File Requirements
            </h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                PDF format only
              </li>
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                Maximum size: 10MB
              </li>
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                Text-based PDF only
              </li>
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                Takes 10-30 seconds
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}