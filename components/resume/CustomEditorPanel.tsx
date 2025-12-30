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
  AlignJustify,
  List,
  ListOrdered,
  Undo,
  Redo,
  FileDown
} from 'lucide-react';
import { toast } from 'sonner';

interface CustomEditorPanelProps {
  initialContent: string;
  resumeId: string;
  userId: string;
  resumePath?: string;
  onTextSelect: (text: string) => void;
}

export default function CustomEditorPanel({
  initialContent,
  resumeId,
  userId,
  onTextSelect
}: CustomEditorPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const editorRef = useRef<HTMLDivElement>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Handle click outside to close download dropdown
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
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/firebase/client');
      
      const htmlContent = editorRef.current.innerHTML;
      const plainText = editorRef.current.innerText;
      
      const resumeRef = doc(db, 'resumes', resumeId);
      await updateDoc(resumeRef, {
        resumeText: plainText,
        resumeHtml: htmlContent,
        updatedAt: new Date().toISOString()
      });

      console.log('💾 Saved:', plainText.length, 'characters');
      setSaveStatus('saved');
      toast.success('Resume saved successfully');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [resumeId, userId]);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !isEditorReady) {
      editorRef.current.innerHTML = initialContent;
      setIsEditorReady(true);
    }
  }, [initialContent, isEditorReady]);

  // Auto-save functionality
  useEffect(() => {
    const autoSave = setTimeout(() => {
      if (content && content.length > 50 && !content.includes('Paste your resume')) {
        handleSave();
      }
    }, 3000);

    return () => clearTimeout(autoSave);
  }, [content, handleSave]);

  // Handle text selection for AI assistant
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString() || '';
      
      if (selectedText.trim().length > 10) {
        onTextSelect(selectedText.trim());
      }
    };

    const interval = setInterval(handleSelection, 1000);
    return () => clearInterval(interval);
  }, [onTextSelect]);

  // Update character count
  useEffect(() => {
    if (editorRef.current) {
      setCharacterCount(editorRef.current.innerText.length);
    }
  }, [content]);

  // Format text commands
  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  const handleDownloadPDF = async () => {
    if (!editorRef.current) return;
    
    try {
      toast.loading('Generating PDF...');
      
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
      
      toast.dismiss();
      toast.success('PDF downloaded!');
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.dismiss();
      toast.error('Failed to generate PDF');
    }
  };

  const handleDownloadWord = async () => {
    if (!editorRef.current) return;
    
    try {
      toast.loading('Generating Word document...');
      
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
      
      toast.dismiss();
      toast.success('Word document downloaded!');
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Failed to generate Word document:', error);
      toast.dismiss();
      toast.error('Failed to generate Word document');
    }
  };

  const setHeading = (level: string) => {
    execCommand('formatBlock', level);
  };

  return (
    <div className="w-1/2 bg-slate-900 flex flex-col h-screen overflow-hidden">
      {/* Custom Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-slate-300" />
          <span className="text-sm font-medium text-slate-200">Resume Editor</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {saveStatus === 'saving' && (
            <span className="text-xs text-slate-300 flex items-center">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-400 flex items-center">
              <Check className="w-3 h-3 mr-1" />
              Saved
            </span>
          )}
          
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center space-x-1"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
          
          {/* Download Dropdown Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDownloadMenu(!showDownloadMenu);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1 download-button"
              title="Download"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </button>
            
            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[101] overflow-hidden download-dropdown-menu">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadPDF();
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-3 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-red-400" />
                  <span>Download as PDF</span>
                </button>
                <div className="h-px bg-slate-700" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadWord();
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-3 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <span>Download as Word</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center space-x-1 overflow-x-auto flex-shrink-0">
        {/* Undo/Redo */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <button
            onClick={() => execCommand('undo')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('redo')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Font Size */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <select
            onChange={(e) => execCommand('fontSize', e.target.value)}
            className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs border border-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            defaultValue="3"
          >
            <option value="1">8pt</option>
            <option value="2">10pt</option>
            <option value="3">11pt</option>
            <option value="4">12pt</option>
            <option value="5">14pt</option>
            <option value="6">18pt</option>
            <option value="7">24pt</option>
          </select>
        </div>

        {/* Headings */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <select
            onChange={(e) => setHeading(e.target.value)}
            className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs border border-slate-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            defaultValue="p"
          >
            <option value="p">Normal Text</option>
            <option value="h1">Title (H1)</option>
            <option value="h2">Section (H2)</option>
            <option value="h3">Subsection (H3)</option>
          </select>
        </div>

        {/* Text Formatting */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <button
            onClick={() => execCommand('bold')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('italic')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('underline')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </button>
        </div>

        {/* Text Color */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <input
            type="color"
            onChange={(e) => execCommand('foreColor', e.target.value)}
            defaultValue="#000000"
            className="w-7 h-7 rounded cursor-pointer border border-slate-600"
            title="Text Color"
          />
        </div>

        {/* Alignment */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <button
            onClick={() => execCommand('justifyLeft')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('justifyCenter')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('justifyRight')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('justifyFull')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center space-x-1 pr-2 border-r border-slate-700">
          <button
            onClick={() => execCommand('insertUnorderedList')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => execCommand('insertOrderedList')}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        {/* Link */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => {
              const url = prompt('Enter URL:');
              if (url) {
                execCommand('createLink', url);
              }
            }}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            title="Insert Link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 overflow-y-auto bg-slate-900 py-6 px-4">
        <div className="w-full max-w-5xl mx-auto pb-8">
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => {
              setContent(e.currentTarget.innerHTML);
            }}
            onPaste={(e) => {
              e.preventDefault();
              // Try to get HTML first to preserve links and formatting
              const html = e.clipboardData.getData('text/html');
              if (html) {
                document.execCommand('insertHTML', false, html);
              } else {
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
              }
            }}
            className="w-full rounded-lg shadow-2xl"
            style={{
              fontFamily: 'Calibri, Arial, sans-serif',
              fontSize: '10pt',
              lineHeight: '1.3',
              color: '#000000',
              backgroundColor: '#ffffff',
              padding: '0.5in 0.6in',
              minHeight: 'calc(100vh - 200px)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-2 text-xs text-slate-300 flex items-center justify-between flex-shrink-0">
        <span>✏️ Professional resume editor • Auto-saves every 3 seconds</span>
        <span>{characterCount} characters</span>
      </div>

      {/* Custom Editor Styles - TIGHT SPACING */}
      <style jsx global>{`
        [contenteditable] {
          background: #ffffff !important;
        }
        
        /* Remove ALL default margins and padding */
        [contenteditable] * {
          margin: 0 !important;
          padding: 0 !important;
          color: #000000 !important;
        }
        
        /* Tight heading styles */
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
        
        /* Minimal paragraph spacing */
        [contenteditable] p {
          margin: 2pt 0 !important;
          line-height: 1.3 !important;
        }
        
        /* Tight list spacing */
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
        
        /* Text formatting */
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
        
        /* Hyperlink styles */
        [contenteditable] a {
          color: #0066cc !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }
        
        [contenteditable] a:hover {
          color: #0052a3 !important;
          text-decoration: underline !important;
        }
        
        [contenteditable]:focus {
          outline: none;
        }
        
        /* Remove spacing between consecutive elements */
        [contenteditable] * + * {
          margin-top: 0 !important;
        }
        
        /* Divs should have no spacing */
        [contenteditable] div {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Ensure black text everywhere - except links */
        [contenteditable],
        [contenteditable] *:not(a) {
          color: #000000 !important;
        }
      `}</style>
    </div>
  );
}