// components/resume/TinyMCEEditorPanel.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Save, Download, Check, Loader2, FileText, Eye, ExternalLink } from 'lucide-react';

interface TinyMCEEditorPanelProps {
  initialContent: string;
  resumeId: string;
  userId: string;
  resumePath?: string;
  onTextSelect: (text: string) => void;
}

export default function TinyMCEEditorPanel({
  initialContent,
  resumeId,
  userId,
  resumePath,
  onTextSelect
}: TinyMCEEditorPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const editorRef = useRef<any>(null);

  // Auto-save every 3 seconds
  useEffect(() => {
    const autoSave = setTimeout(() => {
      if (content && content.length > 50 && !content.includes('Paste your resume')) {
        handleSave();
      }
    }, 3000);

    return () => clearTimeout(autoSave);
  }, [content]);

  // Handle text selection for AI
  useEffect(() => {
    const handleSelection = () => {
      if (editorRef.current) {
        const editor = editorRef.current;
        const selectedText = editor.selection?.getContent({ format: 'text' }) || '';
        
        if (selectedText.trim().length > 10) {
          onTextSelect(selectedText.trim());
        }
      }
    };

    // Poll for selection changes
    const interval = setInterval(handleSelection, 1000);
    return () => clearInterval(interval);
  }, [onTextSelect]);

  const handleSave = async () => {
    if (!resumeId || !userId || !editorRef.current) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/firebase/client');
      
      // Get both HTML and plain text
      const editor = editorRef.current;
      const htmlContent = editor.getContent();
      const plainText = editor.getContent({ format: 'text' });
      
      const resumeRef = doc(db, 'resumes', resumeId);
      await updateDoc(resumeRef, {
        resumeText: plainText,
        resumeHtml: htmlContent,
        updatedAt: new Date().toISOString()
      });

      console.log('💾 Saved:', plainText.length, 'characters');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!editorRef.current) return;
    
    try {
      // Get the HTML content from TinyMCE
      const htmlContent = editorRef.current.getContent();
      
      // Create a properly formatted HTML document for PDF
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 1in;
    }
    body {
      font-family: 'Calibri', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1e293b;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 0;
    }
    h1 {
      font-size: 24pt;
      font-weight: 700;
      margin: 0.5em 0;
      color: #1e293b;
    }
    h2 {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      margin: 1.2em 0 0.4em 0;
      color: #1e293b;
    }
    h3 {
      font-size: 12pt;
      font-weight: 600;
      margin: 1em 0 0.3em 0;
    }
    p {
      margin: 0.4em 0;
    }
    ul, ol {
      margin: 0.5em 0;
      padding-left: 2em;
    }
    li {
      margin: 0.25em 0;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

      // Convert HTML to PDF using browser's print functionality
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        
        // Wait for content to load then trigger print dialog
        printWindow.onload = () => {
          printWindow.focus();
          printWindow.print();
        };
      } else {
        // Fallback: download as HTML if popup blocked
        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume_${resumeId}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('💡 Tip: Open the downloaded HTML file and use your browser\'s "Print to PDF" feature to save as PDF.');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download. Please try again.');
    }
  };

  return (
    <div className="w-1/2 bg-slate-100 dark:bg-slate-900 border-r border-slate-700 flex flex-col">
      {/* Custom Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Resume Editor</span>
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
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center space-x-1"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
          
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>

          {resumePath && (
            <a 
              href={resumePath} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors flex items-center space-x-1"
            >
              <Eye className="w-3 h-3" />
              <span>View PDF</span>
            </a>
          )}
        </div>
      </div>

      {/* Editor Container */}
      <div className="flex-1 overflow-hidden bg-slate-950 p-8">
        <div className="h-full max-w-[8.5in] mx-auto">
          <style>{`
            .tox .tox-editor-container {
              background: white;
            }
            .tox .tox-edit-area {
              background: white;
            }
            .tox-tinymce {
              border: 1px solid #334155 !important;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.3);
            }
            .tox .tox-toolbar,
            .tox .tox-toolbar__overflow,
            .tox .tox-toolbar__primary {
              background: #f8fafc !important;
              border-bottom: 1px solid #e2e8f0 !important;
            }
            .tox .tox-tbtn {
              color: #334155;
            }
            .tox .tox-tbtn:hover {
              background: #e2e8f0;
            }
            .tox .tox-statusbar {
              background: #f8fafc !important;
              border-top: 1px solid #e2e8f0 !important;
            }
          `}</style>
          
          <Editor
            apiKey="7ukp4qecoz96y5ywhz6gbio9woyul7w3kl529pnmbp1jaci8"
            onInit={(evt, editor) => {
              editorRef.current = editor;
              console.log('✅ TinyMCE Editor initialized');
            }}
            value={content}
            init={{
              height: '100%',
              menubar: 'file edit view insert format tools',
              plugins: [
                'advlist', 'autolink', 'lists', 'link', 'charmap', 'preview',
                'searchreplace', 'visualblocks', 'code', 'fullscreen',
                'insertdatetime', 'table', 'wordcount', 'help'
              ],
              toolbar: 'undo redo | styles | bold italic underline strikethrough | ' +
                'alignleft aligncenter alignright alignjustify | ' +
                'bullist numlist outdent indent | ' +
                'forecolor backcolor | removeformat | help',
              toolbar_mode: 'sliding',
              content_style: `
                body { 
                  font-family: Calibri, Arial, sans-serif; 
                  font-size: 11pt; 
                  line-height: 1.5;
                  color: #1e293b;
                  padding: 1in;
                  background: white;
                  max-width: 8.5in;
                  margin: 0 auto;
                }
                h1 { 
                  font-size: 18pt;
                  font-weight: 700; 
                  text-transform: uppercase; 
                  margin: 1.5em 0 0.5em 0;
                  color: #1e293b;
                }
                h2 { 
                  font-size: 14pt;
                  font-weight: 700; 
                  text-transform: uppercase; 
                  margin: 1.2em 0 0.4em 0;
                  color: #1e293b;
                }
                h3 {
                  font-size: 12pt;
                  font-weight: 600;
                  margin: 1em 0 0.3em 0;
                  color: #334155;
                }
                p {
                  margin: 0.4em 0;
                }
                ul, ol { 
                  margin: 0.5em 0; 
                  padding-left: 2em; 
                }
                li {
                  margin: 0.25em 0;
                }
                strong {
                  font-weight: 700;
                }
              `,
              branding: false,
              resize: false,
              statusbar: true,
              elementpath: false,
              paste_as_text: false,
              smart_paste: true,
              contextmenu: 'copy paste | link',
              quickbars_selection_toolbar: 'bold italic | quicklink h2 h3 blockquote',
              automatic_uploads: false,
            }}
            onEditorChange={(newContent, editor) => {
              setContent(newContent);
            }}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-slate-900 border-t border-slate-700 px-4 py-2 text-xs text-slate-400 flex items-center justify-between flex-shrink-0">
        <span>✏️ Microsoft Word-like editor • Auto-saves every 3 seconds</span>
        <span>{editorRef.current?.plugins.wordcount?.body.getCharacterCount() || 0} characters</span>
      </div>
    </div>
  );
}