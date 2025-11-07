// app/resume/writer/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/client';
import TinyMCEEditorPanel from '@/components/resume/TinyMCEEditorPanel';
import AIAssistantPanel from '@/components/resume/AIAssitantPanel';
import { Loader2, ArrowLeft, FileText, AlertCircle, Sparkles, Eye } from 'lucide-react';
import Link from 'next/link';

export default function ResumeWriterPage() {
  const [user, loading] = useAuthState(auth);
  const searchParams = useSearchParams();
  const router = useRouter();
  const resumeId = searchParams.get('id');
  
  const [resumeContent, setResumeContent] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading resume...');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [error, setError] = useState('');
  const [resumeData, setResumeData] = useState<any>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const loadResume = async () => {
      // Wait for auth to complete
      if (loading) {
        return;
      }

      // Check auth after loading completes
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
        
        setLoadingMessage('Fetching resume from database...');
        setExtractionProgress(10);
        
        const resumeRef = doc(db, 'resumes', resumeId);
        const resumeSnap = await getDoc(resumeRef);
        
        setExtractionProgress(30);
        
        if (!resumeSnap.exists()) {
          console.error('❌ Resume document not found in Firestore');
          setError('Resume not found in database');
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        const data = resumeSnap.data();
        setResumeData(data);
        setExtractionProgress(40);

        console.log('✅ Resume data loaded:', {
          id: data.id,
          hasResumeHtml: !!data.resumeHtml,
          resumeHtmlLength: data.resumeHtml?.length || 0,
          hasResumeText: !!data.resumeText,
          resumeTextLength: data.resumeText?.length || 0,
          hasImagePath: !!data.imagePath,
          imagePathPreview: data.imagePath?.substring(0, 50)
        });

        // Strategy 1: Use cached HTML
        if (data.resumeHtml && data.resumeHtml.length > 100) {
          console.log('✅ Using cached resumeHtml');
          setResumeContent(data.resumeHtml);
          setLoadingMessage('Resume loaded!');
          setExtractionProgress(100);
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        // Strategy 2: Use Gemini Vision to format from image
        if (data.imagePath && data.imagePath.startsWith('data:image/')) {
          console.log('🎨 Using Gemini Vision to analyze resume format...');
          setLoadingMessage('Analyzing resume format with AI Vision...');
          setExtractionProgress(50);

          try {
            const response = await fetch('/api/resume/format-from-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeId,
                imageBase64: data.imagePath
              })
            });

            setExtractionProgress(80);

            const resultText = await response.text();
            console.log('📥 API Response status:', response.status);
            console.log('📥 API Response text:', resultText.substring(0, 300));
            
            if (response.ok && resultText) {
              try {
                const result = JSON.parse(resultText);
                
                if (result && result.html && result.html.length > 100) {
                  console.log('✅ Vision generated HTML:', result.html.length, 'chars');
                  setResumeContent(result.html);
                  
                  setExtractionProgress(95);
                  
                  // Save to Firestore
                  await updateDoc(resumeRef, {
                    resumeText: result.text,
                    resumeHtml: result.html,
                    updatedAt: new Date().toISOString()
                  });
                  
                  console.log('💾 Saved formatted HTML');
                  setLoadingMessage('Resume formatted successfully!');
                  setExtractionProgress(100);
                  setIsLoadingResume(false);
                  setIsInitialLoad(false);
                  return;
                }
              } catch (parseError) {
                console.error('❌ JSON parse error:', parseError);
                console.error('Response text was:', resultText);
              }
            } else {
              console.warn('❌ Vision API failed with status:', response.status);
              console.warn('Response:', resultText);
            }
          } catch (visionError) {
            console.error('❌ Vision API error:', visionError);
          }
        }

        // Strategy 3: Use resumeText with basic formatting
        if (data.resumeText && data.resumeText.length > 100 && !data.resumeText.match(/^[v]+olleh/)) {
          console.log('✅ Using resumeText, converting to HTML');
          const html = convertTextToHtml(data.resumeText);
          setResumeContent(html);
          setExtractionProgress(100);
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        // Strategy 4: Template
        console.log('⚠️ No content available, using template');
        setResumeContent(getTemplate());
        setError('Paste your resume content to get started');
        setExtractionProgress(100);
        setIsLoadingResume(false);
        setIsInitialLoad(false);

      } catch (error) {
        console.error('❌ Fatal error:', error);
        setError('Failed to load resume');
        setResumeContent(getTemplate());
        setIsLoadingResume(false);
        setIsInitialLoad(false);
      }
    };

    loadResume();
  }, [user, loading, resumeId]);

  const convertTextToHtml = (text: string): string => {
    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map(para => {
      if (!para.trim()) return '';
      const isHeading = para === para.toUpperCase() && para.length < 50 && para.length > 2;
      if (para.trim().match(/^[•\-]/)) {
        const items = para.split('\n').map(line => {
          const cleaned = line.replace(/^[•\-]\s*/, '').trim();
          return cleaned ? `<li>${cleaned}</li>` : '';
        }).filter(Boolean).join('');
        return `<ul>${items}</ul>`;
      }
      if (isHeading) return `<h2>${para}</h2>`;
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    }).join('');
  };

  const getTemplate = () => `<h1 style="text-align: center; font-size: 24pt; margin-bottom: 0.2em;">YOUR NAME</h1>
<p style="text-align: center; margin: 0.2em 0 1.5em 0;">email@example.com | (555) 123-4567 | City, State</p>
<h2 style="font-size: 14pt; text-transform: uppercase; margin: 1.5em 0 0.5em 0;">PROFESSIONAL SUMMARY</h2>
<p>Your professional summary here...</p>
<h2 style="font-size: 14pt; text-transform: uppercase; margin: 1.5em 0 0.5em 0;">EXPERIENCE</h2>
<p><strong>Job Title | Company Name</strong></p>
<p style="margin-left: 1.5em;"><em>Month Year - Present</em></p>
<ul>
<li>Achievement with quantifiable results</li>
<li>Another achievement with metrics</li>
</ul>
<h2 style="font-size: 14pt; text-transform: uppercase; margin: 1.5em 0 0.5em 0;">EDUCATION</h2>
<p><strong>Degree | University</strong></p>
<p style="margin-left: 1.5em;"><em>Graduation Year</em></p>
<h2 style="font-size: 14pt; text-transform: uppercase; margin: 1.5em 0 0.5em 0;">SKILLS</h2>
<p>List your relevant skills here...</p>`;

  // Loading state
  if (loading || (isLoadingResume && isInitialLoad)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-purple-500/20 rounded-full"></div>
            </div>
            <Loader2 className="w-20 h-20 animate-spin text-purple-500 mx-auto" />
          </div>
          <p className="text-slate-300 text-xl font-semibold mb-2">{loadingMessage}</p>
          <p className="text-slate-500 text-sm mb-6">Setting up your workspace...</p>
          
          {extractionProgress > 0 && (
            <div className="w-full max-w-md mx-auto">
              <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs">{extractionProgress}% complete</p>
            </div>
          )}
          
          <div className="mt-8 flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 text-lg mb-4">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  if (!resumeId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <p className="text-slate-300 text-lg mb-4">No resume selected</p>
          <Link href="/resume">
            <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
              View My Resumes
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Only show error AFTER loading completes
  if (!isLoadingResume && !isInitialLoad && (error || !resumeData)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-3">Resume Not Found</h2>
          <p className="text-slate-400 mb-8">{error || 'Could not load resume'}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold">
              Try Again
            </button>
            <Link href="/resume">
              <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold">
                Back to Resumes
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <Link href={`/resume/${resumeId}`}>
            <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
          </Link>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-600/20 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Resume AI Writer</h1>
              <p className="text-sm text-slate-400 mt-1">
                {resumeData?.fileName || resumeData?.originalFileName || 'AI-powered resume editor'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {resumeData?.imagePath && (
            <a href={resumeData.imagePath} target="_blank" rel="noopener noreferrer">
              <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors flex items-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>View Original</span>
              </button>
            </a>
          )}
          <Link href={`/resume/${resumeId}`}>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Analysis</span>
            </button>
          </Link>
        </div>
      </div>

      <div className="bg-gradient-to-r from-emerald-900/30 to-blue-900/30 border-b border-emerald-800/30 px-6 py-3 flex items-center space-x-3 flex-shrink-0">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <p className="text-sm text-emerald-200">
          ✏️ <strong>Edit your resume</strong> with Word-like features • <strong>Copy text</strong> to AI panel for improvements
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <TinyMCEEditorPanel
          initialContent={resumeContent}
          resumeId={resumeId}
          userId={user.uid}
          resumePath={resumeData?.resumePath}
          onTextSelect={setSelectedText}
        />

        <AIAssistantPanel
          selectedText={selectedText}
          resumeId={resumeId}
          userId={user.uid}
          onSuggestionCopy={(text) => {
            console.log('✅ Copied to clipboard');
          }}
        />
      </div>
    </div>
  );
}