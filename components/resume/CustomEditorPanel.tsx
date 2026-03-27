// components/resume/EditableResumePanel.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Eye, Download, FileText, ChevronLeft, ChevronRight,
  PenTool, Save, Check, Loader2, RefreshCw, FileEdit,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/client';
import { toast } from 'sonner';

// ─── PDF.js types ──────────────────────────────────────────────────────────────

interface PDFDocumentProxy {
  numPages: number;
  getPage: (n: number) => Promise<PDFPageProxy>;
}
interface PDFPageProxy {
  getViewport: (p: { scale: number }) => { width: number; height: number };
  render: (p: { canvasContext: CanvasRenderingContext2D; viewport: ReturnType<PDFPageProxy['getViewport']> }) => { promise: Promise<void> };
}
interface PDFJSStatic {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer } | string) => { promise: Promise<PDFDocumentProxy> };
  version: string;
}

let _pdfjsLib: PDFJSStatic | null = null;
async function getPdfjs(): Promise<PDFJSStatic> {
  if (_pdfjsLib) return _pdfjsLib;
  const lib = (await import('pdfjs-dist')) as unknown as PDFJSStatic;
  lib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`;
  _pdfjsLib = lib;
  return lib;
}
async function fetchPdfBytes(resumePath: string): Promise<ArrayBuffer> {
  if (!resumePath.startsWith('http')) {
    const base64 = resumePath.includes('base64,') ? resumePath.split('base64,')[1] : resumePath;
    const binary = atob(base64);
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buf;
  }
  const res = await fetch('/api/resume/proxy-pdf', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: resumePath }),
  });
  if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
  return res.arrayBuffer();
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface EditableResumePanelProps {
  resumeId:        string;
  userId:          string;
  resumePath:      string;
  resumeHtml?:     string;
  resumeText?:     string;
  imagePath?:      string;
  onViewPdf:       () => void;
  onDownloadPdf:   () => void;
  onContentChange: (html: string) => void;
}

// ─── PDF Viewer sub-component ──────────────────────────────────────────────────

function PdfViewer({ resumePath }: { resumePath: string }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef    = useRef<{ cancel: () => void } | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [page,   setPage]   = useState(1);
  const [total,  setTotal]  = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!resumePath) return;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        const [lib, bytes] = await Promise.all([getPdfjs(), fetchPdfBytes(resumePath)]);
        if (cancelled) return;
        const doc = await lib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPdfDoc(doc); setTotal(doc.numPages); setPage(1); setStatus('ready');
      } catch (err) {
        if (!cancelled) { setErrMsg(err instanceof Error ? err.message : 'Failed to load PDF'); setStatus('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [resumePath]);

  const renderPage = useCallback(async (doc: PDFDocumentProxy, pageNum: number) => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (renderRef.current) { renderRef.current.cancel(); renderRef.current = null; }
    try {
      const pdfPage    = await doc.getPage(pageNum);
      const containerW = container.clientWidth || 520;
      const viewport0  = pdfPage.getViewport({ scale: 1 });
      const scale      = containerW / viewport0.width;
      const viewport   = pdfPage.getViewport({ scale });
      const dpr        = window.devicePixelRatio ?? 1;
      canvas.width     = viewport.width  * dpr;
      canvas.height    = viewport.height * dpr;
      canvas.style.width  = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      const task = pdfPage.render({ canvasContext: ctx, viewport });
      renderRef.current = { cancel: () => {} };
      await task.promise;
    } catch {}
  }, []);

  useEffect(() => { if (pdfDoc) renderPage(pdfDoc, page); }, [pdfDoc, page, renderPage]);

  if (status === 'loading') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      <p className="text-slate-400 text-sm">Loading PDF…</p>
    </div>
  );
  if (status === 'error') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <FileText className="w-10 h-10 text-slate-600" />
      <p className="text-slate-400 text-sm">{errMsg || 'Could not load PDF'}</p>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Page nav */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-3 py-2 flex-shrink-0 border-b border-white/[0.06]">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400 tabular-nums">{page} / {total}</span>
          <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page >= total}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white disabled:opacity-40 transition-colors cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ background: '#1e2130', scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}>
        <div className="flex justify-center py-4 px-3">
          <canvas ref={canvasRef} className="rounded shadow-2xl max-w-full" />
        </div>
      </div>
    </div>
  );
}

// ─── Word Editor sub-component ─────────────────────────────────────────────────

function WordEditor({
  resumeId, initialHtml, onContentChange,
}: {
  resumeId: string; initialHtml: string; onContentChange: (html: string) => void;
}) {
  const editorRef                = useRef<HTMLDivElement>(null);
  const saveTimer                = useRef<NodeJS.Timeout | null>(null);
  const [isSaving,  setIsSaving]   = useState(false);
  const [saveStatus,setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [hasChanges,setHasChanges] = useState(false);

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialHtml;
    }
  }, [initialHtml]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    onContentChange(html);
    setHasChanges(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updateDoc(doc(db, 'resumes', resumeId), {
          resumeHtml: html,
          resumeText: editorRef.current?.innerText ?? '',
          updatedAt:  new Date().toISOString(),
        });
        setSaveStatus('saved');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { toast.error('Auto-save failed'); }
      finally { setIsSaving(false); }
    }, 3000);
  }, [resumeId, onContentChange]);

  const handleSaveNow = async () => {
    if (!editorRef.current) return;
    setIsSaving(true);
    try {
      const html = editorRef.current.innerHTML;
      await updateDoc(doc(db, 'resumes', resumeId), {
        resumeHtml: html, resumeText: editorRef.current.innerText,
        updatedAt: new Date().toISOString(),
      });
      setSaveStatus('saved');
      setHasChanges(false);
      toast.success('Saved', { duration: 1500 });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { toast.error('Save failed'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Save bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileEdit className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-medium text-slate-300">Word Mode — Editable</span>
        </div>
        <button onClick={handleSaveNow} disabled={isSaving || !hasChanges}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            saveStatus === 'saved'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : hasChanges
              ? 'bg-indigo-600/70 hover:bg-indigo-600 text-white cursor-pointer'
              : 'bg-slate-700/40 text-slate-600 cursor-not-allowed'
          }`}>
          {isSaving
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
            : saveStatus === 'saved'
            ? <><Check className="w-3 h-3" /> Saved</>
            : <><Save className="w-3 h-3" /> Save</>}
        </button>
      </div>
      {/* Editable page */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-5 px-4"
        style={{ background: '#1e2130', scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={e => {
            e.preventDefault();
            const html = e.clipboardData.getData('text/html');
            document.execCommand(html ? 'insertHTML' : 'insertText', false,
              html || e.clipboardData.getData('text/plain'));
          }}
          className="w-full rounded-lg shadow-2xl outline-none mx-auto"
          style={{
            fontFamily:      'Calibri, Arial, sans-serif',
            fontSize:        '10pt',
            lineHeight:      '1.4',
            color:           '#000',
            backgroundColor: '#fff',
            padding:         '0.75in 0.75in',
            minHeight:       '11in',
            maxWidth:        '8.5in',
            boxSizing:       'border-box',
            wordBreak:       'break-word',
            overflowWrap:    'break-word',
          }}
        />
      </div>
      {/* Status */}
      <div className="px-4 py-1.5 border-t border-white/[0.05] bg-slate-900/60 flex-shrink-0">
        <p className="text-[10px] text-slate-600">Auto-saves 3s after typing stops · Changes sync to AI panel</p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type ViewMode = 'pdf' | 'word';

export default function EditableResumePanel({
  resumeId, userId, resumePath, resumeHtml, resumeText, imagePath,
  onViewPdf, onDownloadPdf, onContentChange,
}: EditableResumePanelProps) {
  const [mode,          setMode]          = useState<ViewMode>('pdf');
  const [isConverting,  setIsConverting]  = useState(false);
  const [wordHtml,      setWordHtml]      = useState(resumeHtml || '');
  const [wordReady,     setWordReady]     = useState(!!(resumeHtml && resumeHtml.length > 100));

  const convertToWord = useCallback(async () => {
    // Already have html cached
    if (wordReady && wordHtml.length > 100) { setMode('word'); return; }

    setIsConverting(true);
    try {
      // 1. Try AI vision from image
      if (imagePath?.startsWith('data:image/')) {
        const res = await fetch('/api/resume/format-from-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId, imageBase64: imagePath }),
        });
        if (res.ok) {
          const result = await res.json() as { html?: string; text?: string };
          if (result.html && result.html.length > 100) {
            setWordHtml(result.html);
            setWordReady(true);
            await updateDoc(doc(db, 'resumes', resumeId), {
              resumeHtml: result.html, resumeText: result.text ?? '',
              updatedAt: new Date().toISOString(),
            });
            onContentChange(result.html);
            setMode('word');
            toast.success('Converted to editable Word format!');
            return;
          }
        }
      }
      // 2. Plain text fallback
      if (resumeText && resumeText.length > 100) {
        const html = `<div style="font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#000;white-space:pre-wrap;line-height:1.4;">${resumeText}</div>`;
        setWordHtml(html);
        setWordReady(true);
        onContentChange(html);
        setMode('word');
        toast.success('Converted using text content');
        return;
      }
      // 3. Give up gracefully
      const placeholder = '<p style="color:#6b7280;font-style:italic;">Paste your resume content here…</p>';
      setWordHtml(placeholder);
      setWordReady(true);
      onContentChange(placeholder);
      setMode('word');
      toast.info('No source content found — you can paste your resume manually');
    } catch {
      toast.error('Conversion failed — try again');
    } finally {
      setIsConverting(false);
    }
  }, [resumeId, imagePath, resumeText, wordHtml, wordReady, onContentChange]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top toolbar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0"
        style={{ background: 'rgba(15,18,30,0.8)' }}>

        {/* Mode toggle pills */}
        <div className="flex items-center gap-1 p-1 bg-slate-800/60 rounded-lg">
          <button onClick={() => setMode('pdf')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === 'pdf'
                ? 'bg-white/[0.10] text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            onClick={convertToWord}
            disabled={isConverting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              mode === 'word'
                ? 'bg-white/[0.10] text-white'
                : 'text-slate-500 hover:text-slate-300 disabled:opacity-50'
            }`}>
            {isConverting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Converting…</>
              : <><PenTool className="w-3.5 h-3.5" /> Word</>
            }
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {mode === 'word' && (
            <button onClick={() => { setWordReady(false); setWordHtml(''); convertToWord(); }}
              title="Re-convert from PDF"
              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onViewPdf} disabled={!resumePath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-40 transition-colors cursor-pointer">
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          <button onClick={onDownloadPdf} disabled={!resumePath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] disabled:opacity-40 transition-colors cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {mode === 'pdf' ? (
        <PdfViewer resumePath={resumePath} />
      ) : (
        <WordEditor
          resumeId={resumeId}
          initialHtml={wordHtml}
          onContentChange={html => { setWordHtml(html); onContentChange(html); }}
        />
      )}

    </div>
  );
}