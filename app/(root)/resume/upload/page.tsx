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

// Processing steps for better UX
const PROCESSING_STEPS = [
  { step: 0, message: 'Compressing file if needed...', progress: 10 },
  { step: 1, message: 'Converting PDF to image...', progress: 30 },
  { step: 2, message: 'Analyzing with Gemini AI...', progress: 60 },
  { step: 3, message: 'Saving your results...', progress: 85 },
  { step: 4, message: 'Complete! Redirecting...', progress: 100 },
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
  
  // State management
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

  // Handlers
  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError('');
  };

  const updateProgress = (step: number) => {
    console.log(`📊 Progress Update: Step ${step} - ${PROCESSING_STEPS[step]?.message}`);
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
      // Generate unique ID
      resumeId = crypto.randomUUID();
      
      console.log('═══════════════════════════════════════════════════');
      console.log('🚀 STARTING RESUME ANALYSIS PROCESS');
      console.log('═══════════════════════════════════════════════════');
      console.log('📋 Details:');
      console.log('   Resume ID:', resumeId);
      console.log('   User ID:', user.uid);
      console.log('   File Name:', file.name);
      console.log('   File Size:', (file.size / 1024).toFixed(2), 'KB');
      console.log('   Company:', formData.companyName || 'N/A');
      console.log('   Job Title:', formData.jobTitle || 'N/A');
      console.log('   Analysis Type:', formData.analysisType);
      console.log('═══════════════════════════════════════════════════');

      // Step 0: Compress file if needed
      updateProgress(0);
      console.log('\n🗜️ STEP 0: File Compression Check');
      
      let fileToUpload = file;
      const compressionThreshold = 2 * 1024 * 1024; // 2MB
      
      if (file.size > compressionThreshold) {
        console.log(`   File size (${(file.size / 1024).toFixed(2)}KB) exceeds threshold`);
        console.log('   Starting compression...');
        
        try {
          const compressionStart = Date.now();
          fileToUpload = await compressPDF(file);
          const compressionTime = Date.now() - compressionStart;
          
          const savings = file.size - fileToUpload.size;
          const savingsPercent = ((savings / file.size) * 100).toFixed(1);
          
          console.log('   ✅ Compression complete!');
          console.log(`   Original: ${(file.size / 1024).toFixed(2)}KB`);
          console.log(`   Compressed: ${(fileToUpload.size / 1024).toFixed(2)}KB`);
          console.log(`   Saved: ${(savings / 1024).toFixed(2)}KB (${savingsPercent}%)`);
          console.log(`   Time: ${compressionTime}ms`);
        } catch (compressionError) {
          console.warn('   ⚠️ Compression failed, using original file:', compressionError);
          fileToUpload = file;
        }
      } else {
        console.log(`   File size (${(file.size / 1024).toFixed(2)}KB) is acceptable`);
        console.log('   ✅ No compression needed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 1: Convert PDF to image
      updateProgress(1);
      console.log('\n🖼️ STEP 1: Converting PDF to Image');
      
      const imageResult = await convertPdfToImage(fileToUpload);
      if (!imageResult.file || imageResult.error) {
        throw new Error(imageResult.error || 'Failed to convert PDF to image');
      }
      console.log('   ✅ PDF converted to image successfully');

      // Step 2: Call API for analysis
      updateProgress(2);
      console.log('\n📤 STEP 2: Calling Analysis API');
      console.log('   Endpoint: /api/analyze-resume');
      console.log('   Method: POST');

      const apiFormData = new FormData();
      apiFormData.append('file', imageResult.file);
      apiFormData.append('jobTitle', formData.jobTitle);
      apiFormData.append('jobDescription', formData.jobDescription);

      const apiStartTime = Date.now();
      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        body: apiFormData,
      });
      const apiDuration = Date.now() - apiStartTime;

      console.log('   Response Status:', response.status);
      console.log('   Response Time:', apiDuration, 'ms');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ API Error:', errorData);
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
      }

      const responseData = await response.json();
      const { feedback } = responseData;
      
      console.log('\n✅ STEP 2: Analysis Complete');
      console.log('   Overall Score:', feedback?.overallScore);

      if (!feedback || typeof feedback.overallScore !== 'number') {
        throw new Error('Invalid response from AI service - missing feedback or score');
      }

      // Step 3: Save to Firebase WITH embedded base64 files (FIXED!)
      updateProgress(3);
      console.log('\n💾 STEP 3: Saving to Firebase');

      try {
        const saveStartTime = Date.now();
        
        // Prepare resume object WITHOUT imagePath and resumePath
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

        console.log('   Resume data prepared');
        console.log('   Score:', resumeToSave.score);
        console.log('   Saving with embedded files...');

        // Use FirebaseService.saveResumeWithFiles to save with base64 data
        await FirebaseService.saveResumeWithFiles(
          resumeToSave,
          fileToUpload,      // PDF file
          imageResult.file   // Image file
        );

        const saveDuration = Date.now() - saveStartTime;
        console.log('   ✅ Save Complete (with embedded files)');
        console.log('   Duration:', saveDuration, 'ms');
        
      } catch (saveError) {
        console.error('   ❌ Save error:', saveError);
        throw new Error(`Failed to save: ${saveError instanceof Error ? saveError.message : 'Unknown error'}`);
      }

      // Step 4: Complete and redirect
      updateProgress(4);
      console.log('\n═══════════════════════════════════════════════════');
      console.log('🎉 ALL STEPS COMPLETE - TOTAL SUCCESS');
      console.log('═══════════════════════════════════════════════════');
      console.log('   Total Time:', Date.now() - apiStartTime, 'ms');
      console.log('   Redirecting to:', `/resume/${resumeId}`);
      console.log('═══════════════════════════════════════════════════\n');
      
      // Show completion message briefly
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Primary redirect method
      console.log('🔄 Executing router.push...');
      router.push(`/resume/${resumeId}`);
      
      // Backup redirect after 2 seconds
      setTimeout(() => {
        console.log('🔄 Backup redirect executing...');
        if (window.location.pathname.includes('upload')) {
          window.location.href = `/resume/${resumeId}`;
        }
      }, 2000);
      
    } catch (error) {
      console.error('\n═══════════════════════════════════════════════════');
      console.error('❌ ANALYSIS PROCESS FAILED');
      console.error('═══════════════════════════════════════════════════');
      console.error('Error:', error);
      console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Error Message:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error('Stack Trace:', error.stack);
      }
      console.error('═══════════════════════════════════════════════════\n');
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred during analysis';
      
      setError(errorMessage);
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    console.log('📝 Form submitted');
    
    // Validation
    if (!file) {
      setError('Please select a PDF file to upload');
      return;
    }

    // Use validation utility
    const validation = validatePDF(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    // Clear any previous errors
    setError('');

    // Start analysis
    await handleAnalyze();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth check
  if (!user) {
    router.push('/auth');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Processing Loader */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {PROCESSING_STEPS[currentStep]?.message}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please wait, this may take 10-30 seconds...
              </p>
            </div>

            {/* Progress Bar */}
            <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${PROCESSING_STEPS[currentStep]?.progress || 0}%` }}
              />
            </div>

            {/* Percentage */}
            <div className="text-center mb-6">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {PROCESSING_STEPS[currentStep]?.progress || 0}%
              </span>
            </div>

            {/* Step indicators */}
            <div className="space-y-2">
              {PROCESSING_STEPS.map((step, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center text-sm transition-all duration-300 ${
                    idx < currentStep 
                      ? 'text-green-600 dark:text-green-400' 
                      : idx === currentStep 
                      ? 'text-blue-600 dark:text-blue-400 font-medium' 
                      : 'text-gray-400 dark:text-gray-600'
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                  ) : idx === currentStep ? (
                    <div className="w-4 h-4 mr-2 flex-shrink-0">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 mr-2 border-2 border-gray-300 dark:border-gray-600 rounded-full flex-shrink-0" />
                  )}
                  <span className="flex-1">{step.message}</span>
                </div>
              ))}
            </div>

            {/* Warning message for saving */}
            {currentStep === 3 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-200 flex items-start">
                  <Info className="w-3 h-3 mr-2 mt-0.5 flex-shrink-0" />
                  Saving to database... This step may take a moment. Please don't close this window.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            AI Resume Analyzer
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Get instant, AI-powered feedback powered by Gemini 2.0 Flash
          </p>
        </div>

        {/* Features Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">AI-Powered</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Gemini 2.0 Flash analysis</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">ATS Optimized</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Beat applicant tracking systems</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Secure & Private</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your data stays protected</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg animate-shake">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Analysis Failed
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 mb-3 whitespace-pre-wrap">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-sm font-medium text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors underline"
                >
                  Dismiss and try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/20 px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Resume Analysis Form
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Fill in the details for personalized AI feedback
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Analysis Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Analysis Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { value: 'full', label: 'Full Analysis', desc: 'Complete evaluation', time: '~30s' },
                  { value: 'quick', label: 'Quick Scan', desc: 'Key insights only', time: '~10s' },
                  { value: 'ats-only', label: 'ATS Only', desc: 'Focus on ATS score', time: '~15s' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, analysisType: type.value as any })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formData.analysisType === type.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm">{type.label}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{type.desc}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{type.time}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Layout for Form Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Company Name */}
              <div>
                <label htmlFor="company-name" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Company Name
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </label>
                <input
                  type="text"
                  id="company-name"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="e.g., Google, Microsoft, Apple"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              {/* Job Title */}
              <div>
                <label htmlFor="job-title" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Job Title
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </label>
                <input
                  type="text"
                  id="job-title"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder="e.g., Senior Software Engineer"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              {/* Job Description */}
              <div className="lg:col-span-2">
                <label htmlFor="job-description" className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Job Description
                  <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </label>
                <textarea
                  id="job-description"
                  rows={5}
                  value={formData.jobDescription}
                  onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                  placeholder="Paste the complete job description for better keyword matching..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none text-gray-900 dark:text-white placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-start">
                  <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                  Including the job description significantly improves analysis accuracy and keyword optimization
                </p>
              </div>

              {/* File Upload */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Upload Resume
                  <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                    Required
                  </span>
                </label>
                <FileUploader onFileSelect={handleFileSelect} />
                
                {/* File Info */}
                {file && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(2)} KB • PDF Document
                          </p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!file || isProcessing}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-base transition-all duration-200 ${
                !file || isProcessing
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:scale-[0.98]'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin mr-3" />
                  Analyzing with Gemini AI...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start AI Analysis
                </span>
              )}
            </button>

            {/* Security Notice */}
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <Shield className="w-4 h-4" />
              <span>Your resume is processed securely and never shared</span>
            </div>
          </form>
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
              What We Analyze
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                ATS compatibility and keyword optimization
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                Content quality and achievement metrics
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                Structure, formatting, and readability
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                Skills alignment and gap analysis
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <Info className="w-5 h-5 text-blue-600 mr-2" />
              File Requirements
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                PDF format only (no images or Word docs)
              </li>
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                Maximum file size: 10MB
              </li>
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                Text-based PDF (not scanned images)
              </li>
              <li className="flex items-start">
                <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                Analysis typically takes 10-30 seconds
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}