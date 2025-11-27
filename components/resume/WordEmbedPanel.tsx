// components/resume/WordEmbedPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, ExternalLink, FileText, Download } from 'lucide-react';
import Image from 'next/image';

interface WordEmbedPanelProps {
  resumePath: string;
  resumeId: string;
}

export default function WordEmbedPanel({
  resumePath,
  resumeId,
}: WordEmbedPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (resumePath) {
      console.log('📄 Resume path loaded');
      console.log('📄 Type:', resumePath.startsWith('data:application/pdf') ? 'PDF Base64' : 
                           resumePath.startsWith('data:image') ? 'Image' : 'URL');
      setIsLoading(false);
    } else {
      setError('No resume file available');
      setIsLoading(false);
    }
  }, [resumePath]);

  const handleDownload = () => {
    if (!resumePath) return;

    if (resumePath.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = resumePath;
      link.download = `resume_${resumeId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(resumePath, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="w-1/2 bg-slate-900 border-r border-slate-700 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-slate-300">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !resumePath) {
    return (
      <div className="w-1/2 bg-slate-900 border-r border-slate-700 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-slate-300 mb-4">{error || 'No resume file found'}</p>
          <p className="text-slate-500 text-sm">
            Please upload a resume to view it here.
          </p>
        </div>
      </div>
    );
  }

  const isPDF = resumePath.includes('application/pdf');
  const isImage = resumePath.includes('data:image/');

  return (
    <div className="w-1/2 bg-slate-900 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-sm text-slate-300 font-medium">Resume Preview</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>
          <a 
            href={resumePath} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Full</span>
          </a>
        </div>
      </div>

      {/* Document Display */}
      <div className="flex-1 overflow-auto bg-slate-950 p-6">
        {isPDF ? (
          <div className="h-full w-full max-w-4xl mx-auto">
            <embed
              src={resumePath}
              type="application/pdf"
              className="w-full h-full rounded-lg shadow-2xl border border-slate-800"
              style={{ minHeight: '800px' }}
            />
          </div>
        ) : isImage ? (
          <div className="max-w-4xl mx-auto relative">
            <Image
              src={resumePath}
              alt="Resume preview"
              width={800}
              height={1100}
              className="w-full h-auto border border-slate-800 rounded-lg shadow-2xl"
              style={{ maxWidth: '100%', height: 'auto' }}
              unoptimized
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 mb-4">Unable to preview this format</p>
              <a 
                href={resumePath} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Document</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Info Bar */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 text-xs text-slate-400 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span>📄 View your resume above</span>
          <span className="text-purple-400">→ Copy text and paste in AI panel for suggestions</span>
        </div>
      </div>
    </div>
  );
}