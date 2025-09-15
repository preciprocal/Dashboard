'use client';

// app/resume/upload/page.tsx
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import Link from 'next/link';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service';
import { convertPdfToImage } from '@/lib/resume/pdf2img';
import FileUploader from '@/components/resume/FileUploader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { Resume, Feedback } from '@/types/resume';

const PROCESSING_STEPS = [
  'Preparing your file...',
  'Converting PDF to image...',
  'Analyzing resume with AI...',
  'Saving your results...',
  'Almost done...',
];

export default function UploadResume() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileSelect = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError('');
  };

  const updateProgress = (step: number, customMessage?: string) => {
    setCurrentStep(step);
    setStatusText(customMessage || PROCESSING_STEPS[step] || 'Processing...');
  };

  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    if (!user) return;

    setIsProcessing(true);
    setError('');

    try {
      const resumeId = crypto.randomUUID();

      updateProgress(0);
      await new Promise(resolve => setTimeout(resolve, 500));

      updateProgress(1, 'Converting PDF to image...');
      console.log('🔄 Starting PDF conversion...');
      const imageResult = await convertPdfToImage(file);
      if (!imageResult.file || imageResult.error) {
        throw new Error(imageResult.error || 'Failed to convert PDF to image');
      }
      console.log('✅ PDF converted to image successfully');

      updateProgress(2, 'Analyzing resume with AI...');
      console.log('🤖 Starting AI analysis...');
      
      const formData = new FormData();
      formData.append('file', imageResult.file);
      formData.append('jobTitle', jobTitle);
      formData.append('jobDescription', jobDescription);

      const response = await fetch('/api/analyze-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze resume');
      }

      const { feedback } = await response.json();
      console.log('✅ AI analysis completed');

      if (!feedback || !feedback.overallScore) {
        throw new Error('Invalid response from AI service');
      }

      updateProgress(3, 'Saving your results...');
      console.log('💾 Saving resume to database...');
      
      const resume: Omit<Resume, 'imagePath' | 'resumePath'> = {
        id: resumeId,
        companyName: companyName.trim(),
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription.trim(),
        feedback: feedback as Feedback,
        createdAt: new Date(),
        userId: user.uid,
      };

      await FirebaseService.saveResumeWithFiles(resume, file, imageResult.file);
      console.log('✅ Resume saved successfully');

      updateProgress(4, 'Analysis complete! Redirecting...');
      setTimeout(() => {
        router.push(`/resume/${resumeId}`);
      }, 1000);

    } catch (error) {
      console.error('❌ Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File size must be less than 1MB for optimal processing. Please compress your PDF.');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const companyName = (formData.get('company-name') as string) || '';
    const jobTitle = (formData.get('job-title') as string) || '';
    const jobDescription = (formData.get('job-description') as string) || '';

    await handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  if (loading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading..."
        onHide={() => console.log('Loading complete')}
      />
    );
  }

  if (!user) {
    router.push('/auth');
    return <div>Redirecting to login...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* AnimatedLoader for Processing */}
      <AnimatedLoader
        isVisible={isProcessing}
        loadingText={statusText}
        onHide={() => console.log('Processing complete')}
      />

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 mb-6 mx-4 p-6 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-2xl shadow-sm">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">Analysis Failed</h3>
              <p className="text-red-800 dark:text-red-300 mb-4 leading-relaxed">{error}</p>
              <button
                onClick={() => setError('')}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form - Scrollable Container with Margin */}
      {!isProcessing && (
        <div className="flex-1 min-h-0 mx-4">
          <div className="h-full overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Form Header */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Resume Analysis Form</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Fill out the details below to get personalized feedback on your resume</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                {/* 2x2 Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Company Name */}
                  <div className="space-y-3">
                    <label htmlFor="company-name" className="block text-sm font-semibold text-gray-900 dark:text-white">
                      Company Name
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Optional</span>
                    </label>
                    <input
                      type="text"
                      name="company-name"
                      id="company-name"
                      placeholder="e.g. Google, Microsoft, Apple"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Help us provide targeted feedback specific to this company's culture and requirements
                    </p>
                  </div>

                  {/* Job Title */}
                  <div className="space-y-3">
                    <label htmlFor="job-title" className="block text-sm font-semibold text-gray-900 dark:text-white">
                      Job Title
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Optional</span>
                    </label>
                    <input
                      type="text"
                      name="job-title"
                      id="job-title"
                      placeholder="e.g. Senior Software Engineer, Product Manager"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      We'll analyze your resume against this specific role's requirements and expectations
                    </p>
                  </div>

                  {/* Job Description */}
                  <div className="space-y-3">
                    <label htmlFor="job-description" className="block text-sm font-semibold text-gray-900 dark:text-white">
                      Job Description
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">Optional</span>
                    </label>
                    <textarea
                      rows={6}
                      name="job-description"
                      id="job-description"
                      placeholder="Paste the complete job description here for the most accurate analysis and keyword matching..."
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-200 resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Including the full job description significantly improves analysis accuracy and keyword optimization
                    </p>
                  </div>

                  {/* File Upload */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white">
                      Upload Resume
                      <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full">Required</span>
                    </label>
                    <div className="[&>div]:border-0 [&>div>div]:border-2 [&>div>div]:border-dashed [&>div>div]:border-gray-300 [&>div>div]:dark:border-gray-600 [&>div>div]:hover:border-blue-400 [&>div>div]:dark:hover:border-blue-500 [&>div>div]:bg-transparent [&>div>div]:dark:bg-transparent [&>div>div]:rounded-xl [&>div>div]:transition-colors [&>div>div]:min-h-[120px] [&>div>div]:flex [&>div>div]:items-center [&>div>div]:justify-center">
                      <FileUploader onFileSelect={handleFileSelect} />
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                      <p className="text-xs text-blue-800 dark:text-blue-200 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <strong>Requirements:</strong> PDF format only, maximum file size 1MB for optimal processing
                      </p>
                    </div>
                  </div>
                </div>

                {/* File size warning */}
                {file && (
                  <div className={`mb-4 p-4 rounded-xl border-2 ${
                    file.size > 1024 * 1024 
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        file.size > 1024 * 1024 
                          ? 'bg-red-100 dark:bg-red-800' 
                          : 'bg-green-100 dark:bg-green-800'
                      }`}>
                        <svg className={`w-4 h-4 ${
                          file.size > 1024 * 1024 
                            ? 'text-red-600 dark:text-red-400' 
                            : 'text-green-600 dark:text-green-400'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d={file.size > 1024 * 1024 
                                  ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  : "M5 13l4 4L19 7"} />
                        </svg>
                      </div>
                      <div>
                        <h3 className={`text-sm font-semibold ${
                          file.size > 1024 * 1024 
                            ? 'text-red-900 dark:text-red-200' 
                            : 'text-green-900 dark:text-green-200'
                        }`}>
                          File Size: {(file.size / (1024 * 1024)).toFixed(2)}MB
                        </h3>
                        <p className={`text-sm mt-1 ${
                          file.size > 1024 * 1024 
                            ? 'text-red-800 dark:text-red-300' 
                            : 'text-green-800 dark:text-green-300'
                        }`}>
                          {file.size > 1024 * 1024 ? (
                            <>File is too large. Please compress your PDF to under 1MB for optimal processing.</>
                          ) : (
                            <>Perfect! Your file size is optimal for fast processing.</>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!file || isProcessing || (file && file.size > 1024 * 1024)}
                  className={`w-full py-3.5 px-6 rounded-xl font-semibold text-base transition-all duration-200 transform ${
                    !file || isProcessing || (file && file.size > 1024 * 1024)
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] shadow-md'
                  }`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Analyzing Resume...
                    </span>
                  ) : file && file.size > 1024 * 1024 ? (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      File Too Large - Please Compress
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Start AI Analysis
                    </span>
                  )}
                </button>

                {/* Security Notice */}
                <div className="text-center mt-4">
                  <div className="inline-flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="font-medium">Secure Processing</span>
                    <span className="text-gray-500 dark:text-gray-400">•</span>
                    <span>Your resume is processed securely and never shared</span>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}