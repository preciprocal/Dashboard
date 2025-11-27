// app/resume/writer/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/client';
import TinyMCEEditorPanel from '@/components/resume/TinyMCEEditorPanel';
import AIAssistantPanel from '@/components/resume/AIAssitantPanel';
import { Loader2, ArrowLeft, FileText, AlertCircle, Sparkles, Eye } from 'lucide-react';
import Link from 'next/link';

interface ResumeData {
  fileName?: string;
  imagePath?: string;
  resumePath?: string;
  resumeHtml?: string;
  resumeText?: string;
  [key: string]: unknown;
}

export default function ResumeWriterPage() {
  const [user, loading] = useAuthState(auth);
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('id');
  
  const [resumeContent, setResumeContent] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [isLoadingResume, setIsLoadingResume] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading resume...');
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [error, setError] = useState('');
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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
        
        setLoadingMessage('Fetching resume...');
        setExtractionProgress(10);
        
        const resumeRef = doc(db, 'resumes', resumeId);
        const resumeSnap = await getDoc(resumeRef);
        
        setExtractionProgress(30);
        
        if (!resumeSnap.exists()) {
          console.error('❌ Resume not found');
          setError('Resume not found');
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        const data = resumeSnap.data() as ResumeData;
        setResumeData(data);
        setExtractionProgress(40);

        console.log('✅ Resume loaded');

        // Use cached HTML
        if (data.resumeHtml && data.resumeHtml.length > 100) {
          console.log('✅ Using cached HTML');
          setResumeContent(data.resumeHtml);
          setLoadingMessage('Resume loaded!');
          setExtractionProgress(100);
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        // Use Gemini Vision
        if (data.imagePath && data.imagePath.startsWith('data:image/')) {
          console.log('🎨 Analyzing with AI Vision...');
          setLoadingMessage('Analyzing format with AI...');
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
            console.log('📥 API Response:', response.status);
            
            if (response.ok && resultText) {
              try {
                const result = JSON.parse(resultText);
                
                if (result && result.html && result.html.length > 100) {
                  console.log('✅ HTML generated');
                  setResumeContent(result.html);
                  
                  setExtractionProgress(95);
                  
                  await updateDoc(resumeRef, {
                    resumeText: result.text,
                    resumeHtml: result.html,
                    updatedAt: new Date().toISOString()
                  });
                  
                  console.log('💾 Saved');
                  setLoadingMessage('Complete!');
                  setExtractionProgress(100);
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

        // Use text with formatting
        if (data.resumeText && data.resumeText.length > 100) {
          console.log('✅ Converting text to HTML');
          const html = convertTextToHtml(data.resumeText);
          setResumeContent(html);
          setExtractionProgress(100);
          setIsLoadingResume(false);
          setIsInitialLoad(false);
          return;
        }

        // Template
        console.log('⚠️ Using template');
        setResumeContent(getTemplate());
        setError('Paste your resume content to get started');
        setExtractionProgress(100);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-lg px-6">
          <div className="relative mb-6">
            <Loader2 className="w-16 h-16 animate-spin text-purple-500 mx-auto" />
          </div>
          <p className="text-slate-300 text-lg font-medium mb-2">{loadingMessage}</p>
          <p className="text-slate-500 text-sm mb-6">Setting up workspace...</p>
          
          {extractionProgress > 0 && (
            <div className="w-full max-w-md mx-auto">
              <div className="w-full bg-slate-800 rounded-full h-2 mb-2">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${extractionProgress}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs">{extractionProgress}%</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 text-lg mb-4">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  if (!resumeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <p className="text-slate-300 text-lg mb-4">No resume selected</p>
          <Link href="/resume">
            <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">
              View Resumes
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!isLoadingResume && !isInitialLoad && (error || !resumeData)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-3">Resume Not Found</h2>
          <p className="text-slate-400 mb-8">{error || 'Could not load resume'}</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()} 
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              Try Again
            </button>
            <Link href="/resume">
              <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">
                Back
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="glass-card border-b border-white/5 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/resume/${resumeId}`}>
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Resume AI Writer</h1>
              <p className="text-sm text-slate-400">
                {resumeData?.fileName || 'AI-powered editor'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {resumeData?.imagePath && (
            <a href={resumeData.imagePath} target="_blank" rel="noopener noreferrer">
              <button className="px-4 py-2 glass-button hover-lift text-white rounded-lg flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4" />
                View Original
              </button>
            </a>
          )}
          <Link href={`/resume/${resumeId}`}>
            <button className="px-4 py-2 glass-button hover-lift text-white rounded-lg flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4" />
              Analysis
            </button>
          </Link>
        </div>
      </div>

      {/* Info Banner */}
      <div className="glass-card border-b border-emerald-500/20 px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <p className="text-sm text-emerald-300">
          Edit your resume with Word-like features • Copy text to AI panel for improvements
        </p>
      </div>

      {/* Editor Panels */}
      <div className="flex-1 flex overflow-hidden">
        <TinyMCEEditorPanel
          initialContent={resumeContent}
          resumeId={resumeId}
          userId={user?.uid ?? ''}
          resumePath={resumeData?.resumePath as string | undefined}
          onTextSelect={setSelectedText}
        />

        <AIAssistantPanel
          selectedText={selectedText}
          resumeId={resumeId}
          userId={user?.uid ?? ''}
          onSuggestionCopy={() => {
            console.log('✅ Copied to clipboard');
          }}
        />
      </div>
    </div>
  );
}