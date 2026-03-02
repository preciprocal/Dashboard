// components/resume/CustomEditorPanel.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Save, 
  Download, 
  Check, 
  Loader2, 
  FileText,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo,
  Redo,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/client';

interface CustomEditorPanelProps {
  initialContent: string;
  resumeId: string;
  userId: string;
  resumePath?: string;
  highlightedLineId: string | null;
  onContentChange: (content: string) => void;
}

export default function CustomEditorPanel({
  initialContent,
  resumeId,
  userId,
  highlightedLineId,
  onContentChange
}: CustomEditorPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const editorRef = useRef<HTMLDivElement>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDownloadMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.download-dropdown-menu') && !target.closest('.download-button')) {
          setShowDownloadMenu(false);
        }
      }
    };

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDownloadMenu]);

  const handleSave = useCallback(async () => {
    if (!resumeId || !userId || !editorRef.current) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const htmlContent = editorRef.current.innerHTML;
      const plainText = editorRef.current.innerText;
      
      const resumeRef = doc(db, 'resumes', resumeId);
      await updateDoc(resumeRef, {
        resumeText: plainText,
        resumeHtml: htmlContent,
        updatedAt: new Date().toISOString()
      });

      setSaveStatus('saved');
      toast.success('Resume saved', { duration: 2000 });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [resumeId, userId]);

  useEffect(() => {
    if (editorRef.current && !isEditorReady) {
      editorRef.current.innerHTML = initialContent;
      addLineIdentifiers();
      setIsEditorReady(true);
    }
  }, [initialContent, isEditorReady]);

  useEffect(() => {
    if (editorRef.current && initialContent !== content) {
      editorRef.current.innerHTML = initialContent;
      addLineIdentifiers();
      setContent(initialContent);
    }
  }, [initialContent]);

  // Add unique IDs to lines for highlighting
  const addLineIdentifiers = () => {
    if (!editorRef.current) return;
    
    const allElements = editorRef.current.querySelectorAll('p, li');
    allElements.forEach((el, index) => {
      if (!el.id) {
        el.id = `line-${index}`;
      }
    });
  };

  // Apply highlighting to specific line
  useEffect(() => {
    if (!editorRef.current) return;

    // Remove all previous highlights
    const allElements = editorRef.current.querySelectorAll('p, li');
    allElements.forEach((el) => {
      el.classList.remove('highlighted-line');
    });

    // Add highlight to target line
    if (highlightedLineId) {
      const targetElement = editorRef.current.querySelector(`#${highlightedLineId}`);
      if (targetElement) {
        targetElement.classList.add('highlighted-line');
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedLineId]);

  useEffect(() => {
    const autoSave = setTimeout(() => {
      if (content && content.length > 50 && !content.includes('Paste your resume')) {
        handleSave();
      }
    }, 3000);

    return () => clearTimeout(autoSave);
  }, [content, handleSave]);

  useEffect(() => {
    if (editorRef.current) {
      setCharacterCount(editorRef.current.innerText.length);
    }
  }, [content]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      setContent(newContent);
      onContentChange(newContent);
    }
  };

  const handleDownloadPDF = async () => {
    if (!editorRef.current) return;
    
    try {
      toast.loading('Generating PDF...', { id: 'pdf' });
      
      const htmlContent = editorRef.current.innerHTML;
      
      const response = await fetch('/api/resume/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: htmlContent,
          resumeId: resumeId,
          format: 'pdf'
        })
      });

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded', { id: 'pdf' });
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF', { id: 'pdf' });
    }
  };

  const handleDownloadWord = async () => {
    if (!editorRef.current) return;
    
    try {
      toast.loading('Generating Word document...', { id: 'word' });
      
      const htmlContent = editorRef.current.innerHTML;
      
      const response = await fetch('/api/resume/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: htmlContent,
          resumeId: resumeId,
          format: 'docx'
        })
      });

      if (!response.ok) {
        throw new Error('Word document generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume_${Date.now()}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Word document downloaded', { id: 'word' });
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Word generation error:', error);
      toast.error('Failed to generate Word document', { id: 'word' });
    }
  };

  const setHeading = (level: string) => {
    execCommand('formatBlock', level);
  };

  return (
    <div className="w-1/2 bg-slate-900 flex flex-col h-screen overflow-hidden border-r border-slate-800/50">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Resume Editor</span>
          <div className="h-3 w-px bg-slate-700 mx-1" />
          {saveStatus === 'saving' && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white rounded-md text-xs font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3 h-3" />
            Save
          </button>
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDownloadMenu(!showDownloadMenu);
              }}
              className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium transition-all flex items-center gap-1.5 download-button"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            
            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-[101] overflow-hidden download-dropdown-menu">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPDF();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-3 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-red-400" />
                  <span>PDF Format</span>
                </button>
                <div className="h-px bg-slate-700" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadWord();
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-3 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <span>Word Format</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-800/30 border-b border-slate-700/50 px-3 py-2 flex items-center gap-1 overflow-x-auto flex-shrink-0">
        <div className="flex items-center gap-0.5 pr-2 border-r border-slate-700/50">
          <button
            onClick={() => execCommand('undo')}
            className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
            title="Undo"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => execCommand('redo')}
            className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
            title="Redo"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>
        </div>

        <select
          onChange={(e) => execCommand('fontSize', e.target.value)}
          className="px-2 py-1 bg-slate-700/50 text-slate-200 rounded text-xs border border-slate-600/50 focus:ring-1 focus:ring-purple-500 focus:border-transparent outline-none"
          defaultValue="3"
        >
          <option value="2">10pt</option>
          <option value="3">11pt</option>
          <option value="4">12pt</option>
          <option value="5">14pt</option>
        </select>

        <select
          onChange={(e) => setHeading(e.target.value)}
          className="px-2 py-1 bg-slate-700/50 text-slate-200 rounded text-xs border border-slate-600/50 focus:ring-1 focus:ring-purple-500 focus:border-transparent outline-none ml-1"
          defaultValue="p"
        >
          <option value="p">Normal</option>
          <option value="h1">Title</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
        </select>

        <div className="h-4 w-px bg-slate-700/50 mx-1" />

        <button
          onClick={() => execCommand('bold')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('italic')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('underline')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Underline"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-700/50 mx-1" />

        <button
          onClick={() => execCommand('justifyLeft')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('justifyCenter')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('justifyRight')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-700/50 mx-1" />

        <button
          onClick={() => execCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Bullet List"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => execCommand('insertOrderedList')}
          className="p-1.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-white transition-colors"
          title="Numbered List"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-px bg-slate-700/50 mx-1" />

        <input
          type="color"
          onChange={(e) => execCommand('foreColor', e.target.value)}
          defaultValue="#000000"
          className="w-6 h-6 rounded cursor-pointer border border-slate-600/50"
          title="Text Color"
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto bg-slate-900 py-6 px-4">
        <div className="w-full max-w-5xl mx-auto pb-8">
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
              const newContent = e.currentTarget.innerHTML;
              setContent(newContent);
              onContentChange(newContent);
              addLineIdentifiers();
            }}
            onPaste={(e) => {
              e.preventDefault();
              const html = e.clipboardData.getData('text/html');
              if (html) {
                document.execCommand('insertHTML', false, html);
              } else {
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }
            }}
            className="w-full rounded-lg shadow-2xl outline-none"
            style={{
              fontFamily: 'Calibri, Arial, sans-serif',
              fontSize: '10pt',
              lineHeight: '1.3',
              color: '#000000',
              backgroundColor: '#ffffff',
              padding: '0.5in 0.6in',
              minHeight: 'calc(100vh - 200px)'
            }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800/50 border-t border-slate-700/50 px-4 py-2 text-xs text-slate-400 flex items-center justify-between flex-shrink-0">
        <span>Auto-saves every 3 seconds</span>
        <span>{characterCount.toLocaleString()} characters</span>
      </div>

      {/* Styles */}
      <style jsx global>{`
        [contenteditable] {
          background: #ffffff !important;
        }
        
        [contenteditable] * {
          margin: 0 !important;
          padding: 0 !important;
          color: #000000 !important;
          transition: background-color 0.3s ease;
        }
        
        [contenteditable] .highlighted-line {
          background-color: #fef3c7 !important;
          border-left: 3px solid #f59e0b !important;
          padding-left: 8pt !important;
          margin-left: -8pt !important;
          animation: pulse-highlight 2s ease-in-out infinite;
        }
        
        @keyframes pulse-highlight {
          0%, 100% {
            background-color: #fef3c7;
          }
          50% {
            background-color: #fde68a;
          }
        }
        
        [contenteditable] h1 {
          font-size: 18pt !important;
          font-weight: 700 !important;
          margin-bottom: 4pt !important;
          line-height: 1.2 !important;
        }
        
        [contenteditable] h2 {
          font-size: 11pt !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          margin-top: 8pt !important;
          margin-bottom: 4pt !important;
          padding-bottom: 2pt !important;
          border-bottom: 1.5pt solid #000000 !important;
          line-height: 1.2 !important;
        }
        
        [contenteditable] h3 {
          font-size: 10pt !important;
          font-weight: 600 !important;
          margin-top: 4pt !important;
          margin-bottom: 2pt !important;
          line-height: 1.2 !important;
        }
        
        [contenteditable] p {
          margin: 2pt 0 !important;
          line-height: 1.3 !important;
        }
        
        [contenteditable] ul,
        [contenteditable] ol {
          margin: 2pt 0 !important;
          padding-left: 18pt !important;
          line-height: 1.3 !important;
        }
        
        [contenteditable] li {
          margin: 1pt 0 !important;
          padding-left: 2pt !important;
          line-height: 1.3 !important;
        }
        
        [contenteditable] strong,
        [contenteditable] b {
          font-weight: 700 !important;
        }
        
        [contenteditable] em,
        [contenteditable] i {
          font-style: italic !important;
        }
        
        [contenteditable] u {
          text-decoration: underline !important;
        }
        
        [contenteditable]:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}