'use client';

// app/resume/upload/page.tsx
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import Link from 'next/link';
import { auth } from '@/firebase/client';
import { FirebaseService } from '@/lib/services/firebase-service'; // ✅ Updated path
import { convertPdfToImage } from '@/lib/resume/pdf2img'; // ✅ Updated path
import FileUploader from '@/components/resume/FileUploader'; // ✅ Updated path
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
      // Generate unique ID
      const resumeId = crypto.randomUUID();

      // Step 1: Convert PDF to image
      updateProgress(0);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX

      updateProgress(1, 'Converting PDF to image...');
      console.log('🔄 Starting PDF conversion...');
      const imageResult = await convertPdfToImage(file);
      if (!imageResult.file || imageResult.error) {
        throw new Error(imageResult.error || 'Failed to convert PDF to image');
      }
      console.log('✅ PDF converted to image successfully');

      // Step 2: Analyze with AI
      updateProgress(2, 'Analyzing resume with AI...');
      console.log('🤖 Starting AI analysis...');
      
      const formData = new FormData();
      formData.append('file', imageResult.file);
      formData.append('jobTitle', jobTitle);
      formData.append('jobDescription', jobDescription);

      const response = await fetch('/api/analyze-resume', {  // ✅ Corrected back to original path
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

      // Step 3: Save everything to Firestore
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

      // Save resume with embedded files (no external storage)
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

    // Check file size (1MB limit due to Firestore constraints)
    const maxSize = 1 * 1024 * 1024; // 1MB
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

  // Redirect if not authenticated
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return <div>Redirecting to login...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/resume" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Smart Resume Analysis
          </h1>
          {isProcessing ? (
            <div className="space-y-4">
              <p className="text-xl text-gray-600">{statusText}</p>
              
              {/* Progress bar */}
              <div className="w-full max-w-md mx-auto">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>Step {currentStep + 1} of {PROCESSING_STEPS.length}</span>
                  <span>{Math.round(((currentStep + 1) / PROCESSING_STEPS.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${((currentStep + 1) / PROCESSING_STEPS.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Animated icon */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Processing tips */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 <strong>Did you know?</strong> Our AI analyzes over 50 different aspects of your resume, 
                  from ATS compatibility to writing style and keyword optimization.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xl text-gray-600">
              Upload your resume for AI-powered analysis and improvement tips
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Analysis Failed</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {!isProcessing && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Company Name */}
              <div>
                <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  name="company-name"
                  id="company-name"
                  placeholder="e.g. Google, Microsoft, Apple"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Help us provide targeted feedback for this specific company
                </p>
              </div>

              {/* Job Title */}
              <div>
                <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 mb-2">
                  Job Title <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  name="job-title"
                  id="job-title"
                  placeholder="e.g. Senior Software Engineer, Product Manager"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">
                  We'll analyze your resume against this role's requirements
                </p>
              </div>

              {/* Job Description */}
              <div>
                <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Job Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={4}
                  name="job-description"
                  id="job-description"
                  placeholder="Paste the full job description here for the most accurate analysis and keyword matching..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Including the job description significantly improves analysis accuracy
                </p>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Resume <span className="text-red-500">*</span>
                </label>
                <FileUploader onFileSelect={handleFileSelect} />
                <p className="text-xs text-gray-500 mt-2">
                  📄 <strong>File Requirements:</strong> PDF format, max 1MB for optimal processing
                </p>
              </div>

              {/* File size warning if file is selected */}
              {file && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-medium text-yellow-800">File Size Notice</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        File size: {(file.size / (1024 * 1024)).toFixed(2)}MB. 
                        {file.size > 1024 * 1024 ? (
                          <span className="text-red-600 font-medium"> File too large! Please compress to under 1MB.</span>
                        ) : (
                          <span className="text-green-600"> Perfect size for processing!</span>
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
                className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
                  !file || isProcessing || (file && file.size > 1024 * 1024)
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] transform'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Analyzing Resume...
                  </span>
                ) : file && file.size > 1024 * 1024 ? (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    File Too Large - Please Compress
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Start AI Analysis
                  </span>
                )}
              </button>

              {/* Help Text */}
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  🔒 Your resume is processed securely and never shared with third parties
                </p>
              </div>
            </form>
          </div>
        )}

        {/* Feature highlights */}
        {!isProcessing && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">ATS Compatible</h3>
              <p className="text-sm text-gray-600">Check if your resume passes applicant tracking systems</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">AI-Powered</h3>
              <p className="text-sm text-gray-600">Advanced AI analyzes content, structure, and keywords</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900">Instant Results</h3>
              <p className="text-sm text-gray-600">Get detailed feedback and improvement tips in seconds</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}