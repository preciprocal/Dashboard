// components/resume/ResumeEditorPanel.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  Save, 
  Download, 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  List,
  ListOrdered,
  Check,
  Loader2,
  Type,
  Heading1,
  Heading2,
  Undo,
  Redo
} from 'lucide-react';

interface ResumeEditorPanelProps {
  content: string;
  onContentChange: (content: string) => void;
  onTextSelect: (text: string) => void;
  resumeId: string;
  userId: string;
}

export default function ResumeEditorPanel({
  content,
  onContentChange,
  onTextSelect,
  resumeId,
  userId
}: ResumeEditorPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [selectedTextContent, setSelectedTextContent] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Convert plain text to formatted HTML
  const textToHtml = (text: string): string => {
    if (!text || text.trim() === '') {
      return '<p style="color: #94a3b8; font-style: italic;">Start typing your resume here...</p>';
    }

    // Don't format if it's the placeholder
    if (text.includes('Start typing your resume here')) {
      return '<p style="color: #94a3b8; font-style: italic;">Start typing your resume here...</p>';
    }

    console.log('📝 Converting text to HTML, length:', text.length);
    console.log('📝 First 100 chars:', text.substring(0, 100));

    // Split by double line breaks for paragraphs
    const paragraphs = text.split(/\n\n+/);
    
    const html = paragraphs.map(para => {
      if (!para.trim()) return '';
      
      // Check if it's a heading (all caps or short line)
      const isHeading = para === para.toUpperCase() && para.length < 50 && para.length > 2;
      
      // Check if it's a bullet point
      if (para.trim().startsWith('•') || para.trim().startsWith('-') || para.trim().match(/^[\d]+\./)) {
        const lines = para.split('\n');
        const items = lines.map(line => {
          const cleaned = line.replace(/^[•\-\d\.]\s*/, '').trim();
          return cleaned ? `<li style="margin: 0.25em 0; color: #e2e8f0;">${cleaned}</li>` : '';
        }).filter(Boolean).join('');
        return `<ul style="margin: 0.5em 0; padding-left: 2em; list-style-type: disc; color: #e2e8f0;">${items}</ul>`;
      }
      
      // Format as heading or paragraph
      if (isHeading) {
        return `<h2 style="font-size: 14pt; font-weight: 700; margin: 1.2em 0 0.4em 0; color: #f1f5f9; text-transform: uppercase;">${para}</h2>`;
      }
      
      return `<p style="margin: 0.4em 0; line-height: 1.5; color: #e2e8f0;">${para.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('');

    console.log('✅ HTML generated, length:', html.length);
    console.log('✅ HTML preview:', html.substring(0, 200));
    
    return html || '<p style="color: #94a3b8; font-style: italic;">Start typing your resume here...</p>';
  };

  // Initialize editor with content
  useEffect(() => {
    if (!editorRef.current) {
      console.log('⚠️ Editor ref not ready');
      return;
    }

    if (isInitialized && content === editorRef.current.innerText) {
      console.log('⏭️ Content unchanged, skipping update');
      return;
    }

    console.log('🔄 Initializing editor with content');
    console.log('📄 Content length:', content.length);
    console.log('📄 Content preview:', content.substring(0, 100));

    const html = textToHtml(content);
    editorRef.current.innerHTML = html;
    setIsInitialized(true);

    console.log('✅ Editor initialized');
  }, [content]);

  // Handle text selection - NO AUTO ANALYSIS
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || '';
      
      if (selectedText && selectedText.length > 10) {
        setHasSelectedText(true);
        setSelectedTextContent(selectedText);
      } else {
        setHasSelectedText(false);
        setSelectedTextContent('');
      }
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);

    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('keyup', handleSelection);
    };
  }, []);

  // Manual analyze button handler
  const handleAnalyzeClick = () => {
    if (selectedTextContent) {
      console.log('🤖 Triggering AI analysis for:', selectedTextContent.substring(0, 50));
      onTextSelect(selectedTextContent);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (!editorRef.current || !isInitialized) return;

    const currentText = editorRef.current.innerText.trim();
    
    // Don't save placeholder text
    if (!currentText || currentText.includes('Start typing your resume here')) {
      return;
    }

    const autoSave = setTimeout(() => {
      if (resumeId && currentText.length > 10) {
        handleSave();
      }
    }, 3000);

    return () => clearTimeout(autoSave);
  }, [isInitialized, resumeId]);

  const handleSave = async () => {
    if (!resumeId || !userId || !editorRef.current) return;

    const plainText = editorRef.current.innerText.trim();
    
    // Don't save placeholder
    if (!plainText || plainText.includes('Start typing your resume here')) {
      return;
    }
    
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/firebase/client');
      
      const resumeRef = doc(db, 'resumes', resumeId);
      await updateDoc(resumeRef, {
        resumeText: plainText,
        resumeHtml: editorRef.current.innerHTML,
        updatedAt: new Date().toISOString()
      });

      console.log('💾 Saved to Firestore:', plainText.length, 'characters');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving resume:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const plainText = editorRef.current?.innerText || '';
    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume_${resumeId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText;
      onContentChange(text);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const text = e.clipboardData.getData('text/plain');
    const html = textToHtml(text);
    document.execCommand('insertHTML', false, html);
  };

  const insertHeading = (level: number) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString() || 'Heading';
      
      const heading = document.createElement(`h${level}`);
      heading.textContent = selectedText;
      heading.style.fontSize = level === 1 ? '16pt' : '14pt';
      heading.style.fontWeight = '700';
      heading.style.margin = '1.2em 0 0.4em 0';
      heading.style.color = '#f1f5f9';
      heading.style.textTransform = 'uppercase';
      
      range.deleteContents();
      range.insertNode(heading);
      
      range.setStartAfter(heading);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      handleInput();
    }
  };

  return (
    <div className="w-1/2 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Toolbar */}
      <div className="bg-slate-900 border-b border-slate-700 flex-shrink-0">
        <div className="px-4 py-2 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => document.execCommand('undo')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => document.execCommand('redo')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center space-x-1">
              <button
                onClick={() => applyFormat('bold')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => applyFormat('italic')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => applyFormat('underline')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center space-x-1">
              <button
                onClick={() => insertHeading(1)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => insertHeading(2)}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center space-x-1">
              <button
                onClick={() => applyFormat('justifyLeft')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Align Left"
              >
                <AlignLeft className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => applyFormat('justifyCenter')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Align Center"
              >
                <AlignCenter className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => applyFormat('justifyRight')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Align Right"
              >
                <AlignRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <div className="flex items-center space-x-1">
              <button
                onClick={() => applyFormat('insertUnorderedList')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Bullet List"
              >
                <List className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={() => applyFormat('insertOrderedList')}
                className="p-2 hover:bg-slate-800 rounded transition-colors"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {saveStatus === 'saving' && (
              <span className="text-xs text-slate-400 flex items-center">
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
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Save className="w-3 h-3 inline mr-1" />
              Save
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
            >
              <Download className="w-3 h-3 inline mr-1" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Word-like Document Editor */}
      <div className="flex-1 overflow-auto bg-slate-950 p-8">
        {/* A4 Paper-like container */}
        <div className="max-w-[8.5in] mx-auto">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onPaste={handlePaste}
            className="bg-slate-900 shadow-2xl outline-none min-h-[11in] p-[1in] border border-slate-800"
            style={{
              fontSize: '11pt',
              lineHeight: '1.5',
              fontFamily: "'Calibri', 'Arial', sans-serif",
              color: '#e2e8f0',
              wordWrap: 'break-word',
              overflowWrap: 'break-word'
            }}
          />
        </div>
      </div>

      {/* Status bar with Analyze button */}
      <div className="border-t border-slate-700 px-4 py-2 bg-slate-900 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
        <div className="flex items-center space-x-4">
          {hasSelectedText ? (
            <>
              <span className="flex items-center text-purple-400">
                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse"></span>
                {selectedTextContent.length} characters selected
              </span>
              <button
                onClick={handleAnalyzeClick}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors flex items-center space-x-1"
              >
                <span>✨</span>
                <span>Analyze with AI</span>
              </button>
            </>
          ) : (
            <>
              <span>💡 Select text for AI suggestions</span>
              <span>•</span>
              <span>Auto-saves every 3 seconds</span>
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Type className="w-3 h-3" />
          <span>{editorRef.current?.innerText?.length || 0} characters</span>
        </div>
      </div>
    </div>
  );
}