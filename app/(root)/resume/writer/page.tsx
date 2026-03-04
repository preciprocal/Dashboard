// app/resume/writer/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import CustomEditorPanel from '@/components/resume/CustomEditorPanel';

import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import { ArrowLeft, FileText, AlertCircle, Sparkles, Eye, X } from 'lucide-react';
import Link from 'next/link';
import IntelligentAIPanel from '@/components/resume/IntelligentAIPanel';

interface ResumeData {
  fileName?: string;
  imagePath?: string;
  resumePath?: string;
  resumeHtml?: string;
  resumeText?: string;
  [key: string]: unknown;
}

// ─── Inner component that uses useSearchParams ───────────────────────────────
function ResumeWriterContent() {
  const [user, loading] = useAuthState(auth);
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');
  
  const [resumeContent, setResumeContent] = useState('');
  const [highlightedLineId, setHighlightedLineId] = useState<string | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const loadingSteps: LoadingStep[] = [
    { name: 'Authenticating user...', weight: 1 },
    { name: 'Fetching resume...', weight: 1 },
    { name: 'Loading resume data...', weight: 2 },
    { name: 'Analyzing format with AI...', weight: 3 },
    { name: 'Generating editable content...', weight: 2 },
    { name: 'Saving formatted resume...', weight: 1 },
    { name: 'Setting up editor...', weight: 1 }
  ];

  useEffect(() => {
    const loadResume = async () => {
      if (loading) return;

      if (!user) {
        setIsLoadingResume(false);
        setIsInitialLoad(false);
        return;
      }

      if (!resumeId) {
        setIsLoadingResume(false);
        setIsInitialLoad(false);
        return;
      }

      try {
        console.log('📄 Loading resume:', resumeId);
        
        setLoadingStep(0);
        setLoadingStep(1);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const resumeRef = doc(db, 'resumes', resumeId);
        const resumeSnap = await getDoc(resumeRef);
        
        setLoadingStep(2);
        
        if (!resumeSnap.exists()) {
          console.error('❌ Resume not found');
          setError('Resume not found');
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        const data = resumeSnap.data() as ResumeData;
        setResumeData(data);

        console.log('✅ Resume loaded');

        if (data.resumeHtml && data.resumeHtml.length > 100) {
          console.log('✅ Using cached HTML');
          setResumeContent(data.resumeHtml);
          setLoadingStep(6);
          await new Promise(resolve => setTimeout(resolve, 200));
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        if (data.imagePath && data.imagePath.startsWith('data:image/')) {
          console.log('🎨 Analyzing with AI Vision...');
          setLoadingStep(3);

          try {
            const response = await fetch('/api/resume/format-from-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeId,
                imageBase64: data.imagePath
              })
            });

            setLoadingStep(4);
            const resultText = await response.text();
            console.log('📥 API Response:', response.status);
            
            if (response.ok && resultText) {
              try {
                const result = JSON.parse(resultText);
                
                if (result && result.html && result.html.length > 100) {
                  console.log('✅ HTML generated');
                  setResumeContent(result.html);
                  setLoadingStep(5);
                  
                  await updateDoc(resumeRef, {
                    resumeText: result.text,
                    resumeHtml: result.html,
                    updatedAt: new Date().toISOString()
                  });
                  
                  console.log('💾 Saved');
                  setLoadingStep(6);
                  await new Promise(resolve => setTimeout(resolve, 200));
                  setIsLoadingResume(false);
                  setIsInitialLoad(false);
                  return;
                }
              } catch (parseError) {
                console.error('❌ Parse error:', parseError);
              }
            }
          } catch (visionError) {
            console.error('❌ Vision error:', visionError);
          }
        }

        if (data.resumeText && data.resumeText.length > 100) {
          console.log('✅ Converting text to HTML with preserved spacing');
          setLoadingStep(4);
          const html = convertTextToHtml(data.resumeText);
          setResumeContent(html);
          setLoadingStep(6);
          await new Promise(resolve => setTimeout(resolve, 200));
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        console.log('⚠️ Using template');
        setResumeContent(getTemplate());
        setError('Paste your resume content to get started');
        setLoadingStep(6);
        await new Promise(resolve => setTimeout(resolve, 200));
        setIsLoadingResume(false);
        setIsInitialLoad(false);

      } catch (err) {
        console.error('❌ Error:', err);
        setError('Failed to load resume');
        setResumeContent(getTemplate());
        setIsLoadingResume(false);
        setIsInitialLoad(false);
      }
    };

    loadResume();
  }, [user, loading, resumeId]);

  const convertTextToHtml = (text: string): string => {
    return `<div style="font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #000000; white-space: pre-wrap; line-height: 1.15;">${text}</div>`;
  };

  const getTemplate = () => `
<div style="font-family: Calibri, Arial, sans-serif; font-size: 10pt; line-height: 1.15; color: #000000;">
  <h1 style="text-align: center; font-size: 18pt; font-weight: 700; margin: 0 0 3pt 0;">YOUR NAME</h1>
  <p style="text-align: center; margin: 0 0 6pt 0;">email@example.com | (555) 123-4567 | City, State</p>
  
  <h2 style="font-size: 11pt; font-weight: 700; text-transform: uppercase; margin: 6pt 0 2pt 0; padding-bottom: 1pt; border-bottom: 1pt solid #000;">PROFESSIONAL SUMMARY</h2>
  <p style="margin: 0 0 1pt 0;">Your professional summary here...</p>
  
  <h2 style="font-size: 11pt; font-weight: 700; text-transform: uppercase; margin: 6pt 0 2pt 0; padding-bottom: 1pt; border-bottom: 1pt solid #000;">EXPERIENCE</h2>
  <p style="margin: 2pt 0 1pt 0;"><strong>Job Title | Company Name</strong></p>
  <p style="margin: 0 0 1pt 0;"><em>Month Year - Present</em></p>
  <ul style="margin: 1pt 0; padding-left: 18pt;">
    <li style="margin: 0; padding: 0;">Achievement with quantifiable results</li>
    <li style="margin: 0; padding: 0;">Another achievement with metrics</li>
  </ul>
  
  <h2 style="font-size: 11pt; font-weight: 700; text-transform: uppercase; margin: 6pt 0 2pt 0; padding-bottom: 1pt; border-bottom: 1pt solid #000;">EDUCATION</h2>
  <p style="margin: 2pt 0 1pt 0;"><strong>Degree | University</strong></p>
  <p style="margin: 0 0 1pt 0;"><em>Graduation Year</em></p>
  
  <h2 style="font-size: 11pt; font-weight: 700; text-transform: uppercase; margin: 6pt 0 2pt 0; padding-bottom: 1pt; border-bottom: 1pt solid #000;">SKILLS</h2>
  <p style="margin: 0;">List your relevant skills here...</p>
</div>`;

  const handleExit = () => {
    window.location.href = `/resume/${resumeId}`;
  };

  if (loading || (isLoadingResume && isInitialLoad)) {
    return (
      <AnimatedLoader
        isVisible={true}
        mode="steps"
        steps={loadingSteps}
        currentStep={loadingStep}
        loadingText="Setting up AI Resume Writer..."
        showNavigation={false}
      />
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 max-w-md">
          <div className="text-center p-12">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-slate-500 mb-6">Please sign in to continue</p>
            <Link 
              href="/sign-in"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 inline-flex items-center gap-2 px-6 py-3 rounded-lg text-white transition-all duration-300"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!resumeId) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 max-w-md">
          <div className="text-center p-12">
            <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">No Resume Selected</h2>
            <p className="text-slate-500 mb-6">Please select a resume to edit</p>
            <Link href="/resume">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-3 text-white rounded-lg font-medium transition-all duration-300">
                View Resumes
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoadingResume && !isInitialLoad && (error || !resumeData)) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 max-w-md">
          <div className="text-center p-12">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-3">Resume Not Found</h2>
            <p className="text-slate-500 mb-8">{error || 'Could not load resume'}</p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()} 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-3 text-white rounded-lg font-medium transition-all duration-300"
              >
                Try Again
              </button>
              <Link href="/resume">
                <button className="bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-xl px-6 py-3 text-white rounded-lg font-medium border border-slate-700 transition-all duration-300">
                  Back to Resumes
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleExit}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            
            <div>
              <h1 className="text-white font-medium text-base">
                AI Resume Writer
              </h1>
              <p className="text-slate-500 text-sm">
                {resumeData?.fileName || 'Intelligent optimization'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {resumeData?.imagePath && (
              <a href={resumeData.imagePath} target="_blank" rel="noopener noreferrer">
                <button className="px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-xl text-white rounded-lg flex items-center gap-2 text-sm border border-slate-700 transition-all duration-300">
                  <Eye className="w-4 h-4" />
                  <span className="hidden sm:inline">View Original</span>
                </button>
              </a>
            )}
            <Link href={`/resume/${resumeId}`}>
              <button className="px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 backdrop-blur-xl text-white rounded-lg flex items-center gap-2 text-sm border border-slate-700 transition-all duration-300">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Analysis</span>
              </button>
            </Link>
            <button
              onClick={handleExit}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <CustomEditorPanel
          initialContent={resumeContent}
          resumeId={resumeId}
          userId={user?.uid ?? ''}
          resumePath={resumeData?.resumePath as string | undefined}
          highlightedLineId={highlightedLineId}
          onContentChange={setResumeContent}
        />

        <IntelligentAIPanel
          resumeId={resumeId}
          userId={user?.uid ?? ''}
          resumeContent={resumeContent}
          onHighlightLine={setHighlightedLineId}
          onApplySuggestion={(oldText: string, newText: string) => {
            const updatedContent = resumeContent.replace(oldText, newText);
            setResumeContent(updatedContent);
          }}
        />
      </div>
    </div>
  );
}

// ─── Fallback shown while Suspense resolves useSearchParams ──────────────────
function ResumeWriterFallback() {
  return (
    <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center animate-pulse">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <p className="text-slate-400 text-sm">Loading editor...</p>
      </div>
    </div>
  );
}

// ─── Default export wraps content in Suspense (required for useSearchParams) ─
export default function ResumeWriterPage() {
  return (
    <Suspense fallback={<ResumeWriterFallback />}>
      <ResumeWriterContent />
    </Suspense>
  );
}