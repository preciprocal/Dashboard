'use client';
import { Breadcrumbs } from '@/components/PageHeader';

import { isSupabaseStoragePath } from '@/lib/resume/resolve-pdf-url';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { ResumeService } from '@/lib/services/resume-service';
import { openResumePdf } from '@/lib/resume/resolve-pdf-url';
import { Resume } from '@/types/resume';
import {
  ArrowLeft, Download, Eye, FileText, Building2, Briefcase, Star, Activity, PenTool, BarChart3, Users, Loader2, Save, Check, FileDown,
  ChevronDown,
} from 'lucide-react';
import RecruiterEyeSimulation  from '@/components/resume/RecruiterEyeSimulation';
import InterviewIntelligence   from '@/components/resume/InterviewIntelligence';
import CandidateBenchmarking   from '@/components/resume/CandidateBenchmarking';
import ResumePreview           from '@/components/resume/ResumePreview';
import IntelligentAIPanel      from '@/components/resume/IntelligentAIPanel';
import AnalysisPanel, { ScoreChip, type AnalysisData } from '@/components/resume/AnalysisPanel';
import type { OverallAnalysis, TailorResult } from '@/components/resume/IntelligentAIPanel';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import { SeeExampleButton } from '@/components/ServiceModal';
import type { ResumeInitialTab } from '@/components/ServiceModal/types';
import ServiceFeedback, { recordServiceUse } from '@/components/ServiceFeedback';
import { toast } from 'sonner';
import Image from 'next/image';

async function saveResumeContent(resumeId: string, patch: { resumeHtml?: string; resumeText?: string }): Promise<void> {
  const res = await fetch(`/api/resume/${resumeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to save resume content');
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function getScoreBg(s: number) { return s >= 80 ? 'bg-emerald-500/10 border-emerald-500/20' : s >= 60 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'; }

// ─── ToolBtn ──────────────────────────────────────────────────────────────────

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button title={title} onMouseDown={e => { e.preventDefault(); onClick(); }} className="flex items-center justify-center w-6 h-6 rounded text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer flex-shrink-0">{children}</button>;
}

// ─── InlineResumeEditor ───────────────────────────────────────────────────────

function InlineResumeEditor({ resumeId, initialHtml, onContentChange, highlightText }: { resumeId: string; initialHtml: string; onContentChange: (html: string) => void; highlightText?: string | null }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevHighlightedEl = useRef<HTMLElement | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const [scale, setScale] = useState(1);
  const [editorHeight, setEditorHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [isDownloading, setIsDownloading] = useState<'pdf' | 'docx' | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const h = (e: MouseEvent) => { if (downloadBtnRef.current && !downloadBtnRef.current.contains(e.target as Node)) setShowDownloadMenu(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const externalChangeRef = useRef(false);

  useEffect(() => {
    const editor = editorRef.current; if (!editor) return;
    if (prevHighlightedEl.current) { prevHighlightedEl.current.style.background = ''; prevHighlightedEl.current.style.borderRadius = ''; prevHighlightedEl.current.style.outline = ''; prevHighlightedEl.current.removeAttribute('data-ai-highlight'); prevHighlightedEl.current = null; }
    if (!highlightText || highlightText.length < 5) return;
    const search = highlightText.trim().substring(0, 60);
    const all = Array.from(editor.querySelectorAll('p, li, span, h1, h2, h3, h4')) as HTMLElement[];
    const target = all.find(el => el.children.length === 0 && el.textContent?.includes(search)) ?? all.find(el => el.textContent?.includes(search));
    if (!target) return;
    target.style.background = '#fde68a'; target.style.borderRadius = '3px'; target.style.outline = '2px solid #f59e0b';
    target.setAttribute('data-ai-highlight', 'true'); prevHighlightedEl.current = target;
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [highlightText]);

  useEffect(() => {
    if (!editorRef.current || !initialHtml) return;
    if (editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml;
      externalChangeRef.current = true;
      requestAnimationFrame(() => { scrollContainerRef.current?.scrollTo(0, 0); });
    }
  }, [initialHtml]);

  useEffect(() => {
    if (!externalChangeRef.current) return; externalChangeRef.current = false; if (!editorRef.current) return;
    const html = editorRef.current.innerHTML; onContentChange(html); setHasChanges(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      try { await saveResumeContent(resumeId, { resumeHtml: html, resumeText: editorRef.current?.innerText ?? '' }); setSaveStatus('saved'); setHasChanges(false); setTimeout(() => setSaveStatus('idle'), 2000); } catch { toast.error('Auto-save failed'); }
      finally { setIsSaving(false); }
    }, 1500);
  }, [initialHtml, resumeId, onContentChange]);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      setScale(Math.min(1, (containerRef.current.clientWidth - 32) / 816));
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Track editor content height for proper scaled layout
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const updateHeight = () => setEditorHeight(editor.scrollHeight);
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(editor);
    return () => ro.disconnect();
  }, [initialHtml]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML; onContentChange(html); setHasChanges(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      try { await saveResumeContent(resumeId, { resumeHtml: html, resumeText: editorRef.current?.innerText ?? '' }); setSaveStatus('saved'); setHasChanges(false); setTimeout(() => setSaveStatus('idle'), 2000); } catch { toast.error('Auto-save failed'); }
      finally { setIsSaving(false); }
    }, 3000);
  }, [resumeId, onContentChange]);

  const handleSaveNow = async () => {
    if (!editorRef.current) return; setIsSaving(true);
    try { const html = editorRef.current.innerHTML; await saveResumeContent(resumeId, { resumeHtml: html, resumeText: editorRef.current.innerText }); setSaveStatus('saved'); setHasChanges(false); toast.success('Saved', { duration: 1500 }); setTimeout(() => setSaveStatus('idle'), 2000); }
    catch { toast.error('Save failed'); } finally { setIsSaving(false); }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!editorRef.current) return; setIsDownloading(format); toast.loading(`Generating ${format.toUpperCase()}…`, { id: `dl-${format}` });
    try {
      const computed = window.getComputedStyle(editorRef.current);
      const editorPadding = { top: computed.paddingTop, right: computed.paddingRight, bottom: computed.paddingBottom, left: computed.paddingLeft };
      const res = await fetch('/api/resume/download', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ htmlContent: editorRef.current.innerHTML, editorPadding, resumeId, format }) });
      const ct = res.headers.get('Content-Type') ?? '';
      if (!res.ok || ct.includes('application/json')) { let msg = `${format.toUpperCase()} failed (${res.status})`; try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error; } catch {} throw new Error(msg); }
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = match ? match[1] : `resume_${Date.now()}.${format}`;
      const blob = await res.blob(); const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename }); document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`${format.toUpperCase()} downloaded!`, { id: `dl-${format}` });
    } catch (err) { toast.error(err instanceof Error ? err.message : `Failed`, { id: `dl-${format}` }); }
    finally { setIsDownloading(null); }
  };

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">
      {/* Toolbar Row 1 */}
      <div className="flex-shrink-0 bg-[var(--bg-surface)] backdrop-blur-sm border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
          <div className="flex items-center gap-2"><PenTool className="w-3.5 h-3.5 text-indigo-400" /><span className="text-xs font-medium text-slate-300">Editable Resume</span></div>
          <div className="flex items-center gap-2">
            <button onClick={handleSaveNow} disabled={isSaving || !hasChanges} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${saveStatus === 'saved' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : hasChanges ? 'bg-indigo-600/70 hover:bg-[var(--accent-hover)] text-white cursor-pointer' : 'bg-white/[0.06] text-slate-500 cursor-not-allowed'}`}>
              {isSaving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : saveStatus === 'saved' ? <><Check className="w-3 h-3" /> Saved</> : <><Save className="w-3 h-3" /> Save</>}
            </button>
            <div ref={downloadBtnRef} className="relative">
              <button onClick={() => setShowDownloadMenu(v => !v)} disabled={!!isDownloading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50">
                {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}Download<ChevronDown className={`w-3 h-3 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-raised)] border border-white/[0.08] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)] z-[9999] overflow-hidden">
                  <button onClick={() => { setShowDownloadMenu(false); handleDownload('pdf'); }} className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors cursor-pointer"><FileDown className="w-3.5 h-3.5 text-red-400" /> Download as PDF</button>
                  <div className="h-px bg-white/[0.06]" />
                  <button onClick={() => { setShowDownloadMenu(false); handleDownload('docx'); }} className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors cursor-pointer"><FileDown className="w-3.5 h-3.5 text-blue-400" /> Download as Word</button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Toolbar Row 2 */}
        <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap">
          <select onChange={e => { editorRef.current?.focus(); document.execCommand('fontName', false, e.target.value); }} className="bg-[var(--bg-raised)] text-slate-300 text-xs rounded px-1.5 py-1 border border-white/[0.08] cursor-pointer outline-none" defaultValue="Calibri">
            {['Calibri','Arial','Times New Roman','Georgia','Verdana','Helvetica','Garamond'].map(f => (<option key={f} value={f}>{f}</option>))}
          </select>
          <select onChange={e => { editorRef.current?.focus(); document.execCommand('fontSize', false, e.target.value); }} className="bg-[var(--bg-raised)] text-slate-300 text-xs rounded px-1.5 py-1 border border-white/[0.08] w-14 cursor-pointer outline-none" defaultValue="3">
            {[['1','8pt'],['2','10pt'],['3','11pt'],['4','12pt'],['5','14pt'],['6','18pt'],['7','24pt']].map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
          </select>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Bold" onClick={() => document.execCommand('bold')}><span className="font-bold text-xs">B</span></ToolBtn>
          <ToolBtn title="Italic" onClick={() => document.execCommand('italic')}><span className="italic text-xs">I</span></ToolBtn>
          <ToolBtn title="Underline" onClick={() => document.execCommand('underline')}><span className="underline text-xs">U</span></ToolBtn>
          <ToolBtn title="Strikethrough" onClick={() => document.execCommand('strikeThrough')}><span className="line-through text-xs">S</span></ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Align Left" onClick={() => document.execCommand('justifyLeft')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg></ToolBtn>
          <ToolBtn title="Align Center" onClick={() => document.execCommand('justifyCenter')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M4 3.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm2 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/></svg></ToolBtn>
          <ToolBtn title="Align Right" onClick={() => document.execCommand('justifyRight')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm4 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-4 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg></ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Bullet List" onClick={() => document.execCommand('insertUnorderedList')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg></ToolBtn>
          <ToolBtn title="Numbered List" onClick={() => document.execCommand('insertOrderedList')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/></svg></ToolBtn>
          <ToolBtn title="Indent" onClick={() => document.execCommand('indent')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm3.5 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-3.5 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM2 8l2-2v4z"/></svg></ToolBtn>
          <ToolBtn title="Outdent" onClick={() => document.execCommand('outdent')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm3.5 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-3.5 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM4 8l-2 2V6z"/></svg></ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <label title="Text Color" className="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 cursor-pointer transition-colors">
            <span className="text-xs font-bold text-slate-300" style={{ textDecoration: 'underline 2px solid #6366f1' }}>A</span>
            <input type="color" defaultValue="#000000" onChange={e => { editorRef.current?.focus(); document.execCommand('foreColor', false, e.target.value); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </label>
          <label title="Highlight Color" className="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 cursor-pointer transition-colors">
            <span className="text-xs font-bold" style={{ background: '#fde68a', padding: '0 2px', borderRadius: 2 }}>H</span>
            <input type="color" defaultValue="#fde68a" onChange={e => { editorRef.current?.focus(); document.execCommand('hiliteColor', false, e.target.value); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </label>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Insert Link" onClick={() => { const url = window.prompt('Enter URL:', 'https://'); if (url) document.execCommand('createLink', false, url); }}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 9.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/></svg></ToolBtn>
          <ToolBtn title="Remove Link" onClick={() => document.execCommand('unlink')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 9.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5"/></svg></ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Undo" onClick={() => document.execCommand('undo')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg></ToolBtn>
          <ToolBtn title="Redo" onClick={() => document.execCommand('redo')}><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg></ToolBtn>
        </div>
      </div>
      {/* Editor */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden bg-white/[0.024]">
        <div ref={scrollContainerRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden glass-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px', width: '100%' }}>
            <div style={{ width: `${816 * scale}px`, height: `${editorHeight * scale}px`, position: 'relative', flexShrink: 0 }}>
              <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={handleInput}
                onPaste={e => { e.preventDefault(); const html = e.clipboardData.getData('text/html'); document.execCommand(html ? 'insertHTML' : 'insertText', false, html || e.clipboardData.getData('text/plain')); }}
                className="outline-none rounded shadow-2xl border border-white/10"
                style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: '10pt', lineHeight: '1.4', color: '#000', backgroundColor: '#fff', width: '816px', minHeight: '300px', padding: '72px 72px', boxSizing: 'border-box' as const, wordBreak: 'break-word', overflowWrap: 'break-word', transformOrigin: 'top left', transform: `scale(${scale})`, position: 'absolute', top: 0, left: 0 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center justify-center py-2 bg-white/[0.024] border-t border-white/[0.05]"><p className="text-[11px] text-slate-500">Auto-saves 3 s after typing</p></div>
    </div>
  );
}

// ─── Loading steps ────────────────────────────────────────────────────────────

const loadingSteps: LoadingStep[] = [
  { name: 'Authenticating…', weight: 1 }, { name: 'Loading resume…', weight: 2 },
  { name: 'Fetching analysis…', weight: 2 }, { name: 'Preparing…', weight: 1 }, { name: 'Ready!', weight: 1 },
];

type TabId = 'analysis' | 'benchmark' | 'recruiter' | 'intel' | 'writer';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResumeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useSupabaseUser();

  const [resume, setResume] = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('analysis');
  const [showPreview, setShowPreview] = useState(false);

  const [editorHtml, setEditorHtml] = useState('');
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [, setEditorReady] = useState(false);
  const [persistedAnalysis, setPersistedAnalysis] = useState<OverallAnalysis | null>(null);
  const [persistedAppliedKeys, setPersistedAppliedKeys] = useState<Set<string>>(new Set());
  const [persistedTailorResult, setPersistedTailorResult] = useState<TailorResult | null>(null);

  const [highlightText, setHighlightText] = useState<string | null>(null);
  const handleHighlightLine = useCallback((text: string | null) => { setHighlightText(text); }, []);

  const editorLoadedForId = useRef<string | null>(null);
  const feedbackRecorded = useRef(false);

  useEffect(() => {
    if (resume && !feedbackRecorded.current) {
      feedbackRecorded.current = true;
      recordServiceUse('resume-analyzer');
    }
  }, [resume]);

  // Load resume
  useEffect(() => {
    const load = async () => {
      if (!params.id || typeof params.id !== 'string') { setError('Invalid resume ID'); setLoadingResume(false); return; }
      try {
        setLoadingStep(1);
        const data = await ResumeService.getResume(params.id);
        setLoadingStep(2);
        if (!data) { setError('Resume not found'); setResume(null); }
        else if (user && data.userId !== user.id) { setError('Access denied'); setResume(null); }
        else { setResume(data); if (data.imagePath) setImageUrl(data.imagePath); }
        setLoadingStep(4);
      } catch { setError('Failed to load resume'); setResume(null); }
      finally { setLoadingResume(false); }
    };
    if (user) load(); else if (!loading) setLoadingResume(false);
  }, [params.id, user, loading]);

  // Load editor HTML on writer tab
  useEffect(() => {
    if (activeTab !== 'writer' || !resume) return;
    if (editorLoadedForId.current === resume.id) return;
    editorLoadedForId.current = resume.id;
    const load = async () => {
      setIsLoadingEditor(true);
      try {
        const rd = resume as Resume & { resumeHtml?: string; resumeText?: string; imagePath?: string; resumePath?: string };
        if (rd.resumeHtml && rd.resumeHtml.length > 500 && !rd.resumeHtml.includes('Paste your resume')) { setEditorHtml(rd.resumeHtml); setEditorReady(true); return; }
        // New uploads store a private storage path, not a URL; sign it first
        // (the PDF import used to work only for old Firebase resumes).
        let pdfUrl: string | null = rd.resumePath?.startsWith('http') ? rd.resumePath : null;
        if (!pdfUrl && rd.resumePath && isSupabaseStoragePath(rd.resumePath)) {
          try {
            const sr = await fetch('/api/storage/signed-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ path: rd.resumePath }) });
            if (sr.ok) pdfUrl = ((await sr.json()) as { url?: string }).url ?? null;
          } catch { /* fall through to the plain-text fallback */ }
        }
        if (pdfUrl) {
          try { const res = await fetch('/api/resume/pdf-to-html', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ pdfUrl, resumeId: resume.id }) }); const result = await res.json() as { html?: string }; if (res.ok && result.html && result.html.length > 100) { setEditorHtml(result.html); await saveResumeContent(resume.id, { resumeHtml: result.html }); setEditorReady(true); return; } } catch {}
        }
        if (rd.resumeText && rd.resumeText.length > 100) { const escaped = rd.resumeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); setEditorHtml(`<div style="font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#000;white-space:pre-wrap;line-height:1.4;">${escaped}</div>`); setEditorReady(true); return; }
        if (rd.imagePath?.startsWith('data:image/')) {
          try { const res = await fetch('/api/resume/format-from-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ resumeId: resume.id, imageBase64: rd.imagePath }) }); if (res.ok) { const result = await res.json() as { html?: string }; if (result.html && result.html.length > 100) { setEditorHtml(result.html); await saveResumeContent(resume.id, { resumeHtml: result.html }); setEditorReady(true); return; } } } catch {}
        }
        setEditorHtml('<p style="color:#6b7280;font-style:italic;">Could not extract content. Paste your resume here.</p>'); setEditorReady(true);
      } catch { setEditorHtml('<p>Could not load resume. Paste content here.</p>'); setEditorReady(true); }
      finally { setIsLoadingEditor(false); }
    };
    load();
  }, [activeTab, resume]);

  const handleDownloadPdf = () => {
    if (!resume?.resumePath) { alert('PDF not available'); return; }
    openResumePdf(resume.resumePath, 'download', resume.originalFileName || `resume_${resume.id}.pdf`).catch(() => alert('Failed to download'));
  };

  const handleApplySuggestion = useCallback((o: string, n: string) => { setEditorHtml(h => h.replace(o, n)); }, []);

  const handleViewPdf = () => {
    if (!resume?.resumePath) { alert('PDF not available'); return; }
    openResumePdf(resume.resumePath, 'view').catch(() => alert('Failed'));
  };

  const handleReplaceFullContent = useCallback((html: string) => {
    setEditorHtml(html);
    const save = async () => {
      try {
        const parser = new DOMParser();
        const d = parser.parseFromString(html, 'text/html');
        await saveResumeContent(resume!.id, { resumeHtml: html, resumeText: d.body.innerText || '' });
        toast.success('Tailored resume saved');
      } catch { toast.error('Failed to save'); }
    };
    save();
  }, [resume]);

  // ── Guards ──
  if (loading || loadingResume) return <AnimatedLoader isVisible mode="steps" steps={loadingSteps} currentStep={loadingStep} loadingText="Loading your resume analysis…" showNavigation />;
  if (!user) { router.push('/sign-in'); return null; }
  if (error || !resume) return (
    <div className="flex items-center justify-center min-h-screen px-4"><div className="glass-card max-w-md w-full p-8 text-center">
      <div className="w-14 h-14 gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glass"><FileText className="w-7 h-7 text-white" /></div>
      <h1 className="text-xl font-bold text-white mb-2">{error || 'Resume Not Found'}</h1>
      <p className="text-slate-400 mb-6 text-sm">{error === 'Access denied' ? 'This resume belongs to another user.' : 'This analysis does not exist.'}</p>
      <Link href="/resume"><button className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl glass-button-primary text-white text-sm font-semibold"><ArrowLeft className="w-4 h-4" /> Back to Resumes</button></Link>
    </div></div>
  );

  const resumeDoc = resume as Resume & {
    benchmarkResult?: Record<string, unknown>;
    benchmarkGeneratedAt?: number;
    recruiterSimulation?: Record<string, unknown>;
    recruiterSimulationGeneratedAt?: number;
    deepAnalysis?: Record<string, unknown>;
    deepAnalysisGeneratedAt?: number;
    tailorResult?: Record<string, unknown>;
    tailorResultGeneratedAt?: number;
  };

  const feedback = resume.feedback;

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'analysis', label: 'Analysis', icon: BarChart3 }, { id: 'benchmark', label: 'Benchmark', icon: Users },
    { id: 'recruiter', label: 'Recruiter', icon: Eye }, { id: 'intel', label: 'Intel', icon: Activity }, { id: 'writer', label: 'Writer', icon: PenTool },
  ];

  const MetaBadge = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {resume.jobTitle && <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] text-[12px] text-[var(--text-2)]"><Briefcase className="w-3 h-3 text-slate-400" />{resume.jobTitle}</span>}
      {resume.companyName && <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] text-[12px] text-[var(--text-2)]"><Building2 className="w-3 h-3 text-slate-400" />{resume.companyName}</span>}
      {feedback?.overallScore != null ? <ScoreChip score={feedback.overallScore} /> : resume.score != null && <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${getScoreBg(resume.score)}`}><Star className="w-3 h-3" />{resume.score}/100</span>}
    </div>
  );

  const TabBar = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <div role="tablist" className={`flex items-center ${size === 'sm' ? 'gap-4' : 'gap-6'} border-b border-white/[0.07] overflow-x-auto scrollbar-hide`}>
      {tabs.map(tab => {
        const on = activeTab === tab.id;
        return (
          <button key={tab.id} role="tab" aria-selected={on} onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-1.5 h-11 whitespace-nowrap font-medium transition-colors cursor-pointer ${size === 'sm' ? 'text-[12.5px]' : 'text-[13.5px]'} ${on ? 'text-white' : 'text-[var(--text-3)] hover:text-white'}`}>
            <tab.icon className={`w-4 h-4 ${on ? 'text-[var(--accent)]' : ''}`} />{tab.label}
            <span className={`absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-white transition-transform duration-300 origin-left ${on ? 'scale-x-100' : 'scale-x-0'}`} />
          </button>
        );
      })}
    </div>
  );

  const AnalysisSections = () => <AnalysisPanel data={feedback as unknown as AnalysisData} />;

  // ★ Shared AI Panel props - includes preloaded tailor data
  const aiPanelProps = {
    resumeId: resume.id,
    userId: resume.userId,
    resumeContent: editorHtml,
    onHighlightLine: handleHighlightLine,
    onApplySuggestion: handleApplySuggestion,
    onReplaceFullContent: handleReplaceFullContent,
    initialJobDescription: resume.jobDescription ?? '',
    initialJobTitle: resume.jobTitle ?? '',
    initialCompanyName: resume.companyName ?? '',
    initialDeepAnalysis: (resumeDoc.deepAnalysis ?? null) as OverallAnalysis | null,
    persistedAnalysis,
    persistedAppliedKeys,
    onAnalysisChange: setPersistedAnalysis,
    onAppliedKeysChange: setPersistedAppliedKeys,
    preloadedTailorResult: persistedTailorResult ?? (resumeDoc.tailorResult as TailorResult | undefined) ?? null,
    onTailorResultChange: setPersistedTailorResult,
  };

  const MobilePreviewPanel = () => (
    <div className="space-y-3">
      {imageUrl ? <Image src={imageUrl} alt="Resume" width={800} height={1000} className="w-full rounded-xl shadow-glass border border-white/10 object-contain" />
        : <div className="w-full aspect-[3/4] bg-white/[0.042] border border-dashed border-white/10 rounded-xl flex items-center justify-center"><div className="text-center p-6"><FileText className="w-10 h-10 text-slate-500 mx-auto mb-2" /><p className="text-slate-400 text-sm">Preview unavailable</p></div></div>}
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={handleViewPdf} disabled={!resume.resumePath} className="glass-card hover-lift text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"><Eye className="w-4 h-4" /> View PDF</button>
        <button onClick={handleDownloadPdf} disabled={!resume.resumePath} className="glass-card hover-lift text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"><Download className="w-4 h-4" /> Download</button>
      </div>
    </div>
  );

  return (
    <>
      <ServiceFeedback serviceKey="resume-analyzer" serviceName="Resume Analyzer" triggerAfterUses={2} />

      {/* ═════ MOBILE ═════ */}
      <div className="lg:hidden px-4 py-5 space-y-4">
        <div className="glass-card p-4">
          <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Resume', href: '/resume' }, { label: resume.fileName || 'Analysis' }]} />
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0"><h1 className="text-[20px] font-semibold text-white tracking-tight truncate">{resume.fileName || 'Resume Analysis'}</h1></div>
            <SeeExampleButton serviceId="resume" className="flex-shrink-0" initialTab={activeTab as ResumeInitialTab} />
          </div>
          <MetaBadge />
        </div>

        {activeTab !== 'writer' && (<><button onClick={() => setShowPreview(!showPreview)} className="w-full glass-card p-3 text-slate-300 hover:text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"><Eye className="w-4 h-4" />{showPreview ? 'Hide Preview' : 'Show Preview'}</button>{showPreview && <div className="glass-card p-4"><MobilePreviewPanel /></div>}</>)}

        <TabBar size="sm" />

        {activeTab === 'analysis' && feedback && <AnalysisSections />}
        {activeTab === 'benchmark' && <CandidateBenchmarking resumeId={resume.id} overallScore={feedback?.overallScore ?? 0} jobTitle={resume.jobTitle} preloadedData={resumeDoc.benchmarkResult ?? null} />}
        {activeTab === 'writer' && (
          <div className="space-y-4">
            <div className="glass-card overflow-hidden" style={{ minHeight: 600 }}>
              {isLoadingEditor ? <div className="h-full flex flex-col items-center justify-center gap-3 py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /><p className="text-xs">Converting…</p></div>
                : <InlineResumeEditor resumeId={resume.id} initialHtml={editorHtml} onContentChange={setEditorHtml} highlightText={highlightText} />}
            </div>
            <div className="glass-card overflow-hidden"><IntelligentAIPanel {...aiPanelProps} /></div>
          </div>
        )}
        <div style={{ display: activeTab === 'recruiter' ? 'block' : 'none' }}>
          <RecruiterEyeSimulation resumeId={resume.id} imageUrl={imageUrl} preloadedSimulation={resumeDoc.recruiterSimulation ?? null} jobTitle={resume.jobTitle} companyName={resume.companyName} jobDescription={resume.jobDescription} />
        </div>
        <div style={{ display: activeTab === 'intel' ? 'block' : 'none' }}>
          <InterviewIntelligence resumeId={resume.id} companyName={resume.companyName} jobTitle={resume.jobTitle} jobDescription={resume.jobDescription} preloadedIntel={resume.interviewIntel as unknown as Parameters<typeof InterviewIntelligence>[0]['preloadedIntel']} />
        </div>

        <div className="flex gap-2.5 pt-1 pb-4">
          <Link href="/resume/upload" className="flex-1 glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"><FileText className="w-4 h-4" /> New Analysis</Link>
          <Link href="/resume" className="flex-1 glass-card hover-lift text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> All Resumes</Link>
        </div>
      </div>

      {/* ═════ DESKTOP ═════ */}
      <div className="hidden lg:flex fixed inset-0 lg:left-64 top-[73px] overflow-hidden">
        {/* Left column */}
        <div className="w-[42%] flex-shrink-0 h-full p-4 pr-2">
          <div className="glass-card h-full overflow-hidden" style={{ maxHeight: 'calc(100dvh - 113px)' }}>
            {activeTab === 'writer' ? (
              isLoadingEditor ? <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /><p className="text-xs">Converting PDF…</p></div>
                : <InlineResumeEditor resumeId={resume.id} initialHtml={editorHtml} onContentChange={setEditorHtml} highlightText={highlightText} />
            ) : resume.resumePath ? <ResumePreview resumePath={resume.resumePath} onViewPdf={handleViewPdf} onDownloadPdf={handleDownloadPdf} />
              : <div className="h-full flex flex-col items-center justify-center gap-3 p-6"><div className="w-12 h-12 rounded-xl bg-white/[0.042] flex items-center justify-center"><FileText className="w-6 h-6 text-slate-500" /></div><p className="text-slate-400 text-sm text-center">No PDF available</p>{imageUrl && <Image src={imageUrl} alt="Resume" width={600} height={800} className="w-full rounded-xl shadow-glass border border-white/10 object-contain mt-2" />}</div>}
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col overflow-hidden border-l border-white/[0.06]" style={{ maxHeight: 'calc(100dvh - 73px)' }}>
          <div className="flex-shrink-0 px-6 pt-5">
            <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Resume', href: '/resume' }, { label: resume.fileName || 'Analysis' }]} className="mb-2" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold text-white tracking-[-0.02em] truncate">{resume.fileName || 'Resume Analysis'}</h1>
                <div className="mt-2.5"><MetaBadge /></div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <SeeExampleButton serviceId="resume" className="flex-shrink-0" initialTab={activeTab as ResumeInitialTab} />
                <Link href="/resume/upload" className="btn-primary"><FileText className="w-4 h-4" /> New analysis</Link>
              </div>
            </div>
            <div className="mt-4"><TabBar /></div>
          </div>

          <div className="flex-1 overflow-y-auto glass-scrollbar">
            <div className="px-6 py-6 space-y-4">
              {activeTab === 'writer' && <IntelligentAIPanel {...aiPanelProps} />}

              {activeTab !== 'writer' && (
                <>
                  {activeTab === 'analysis' && feedback && <AnalysisSections />}
                  {activeTab === 'benchmark' && <CandidateBenchmarking resumeId={resume.id} overallScore={feedback?.overallScore ?? 0} jobTitle={resume.jobTitle} preloadedData={resumeDoc.benchmarkResult ?? null} />}
                  <div style={{ display: activeTab === 'recruiter' ? 'block' : 'none' }}>
                    <RecruiterEyeSimulation resumeId={resume.id} imageUrl={imageUrl} preloadedSimulation={resumeDoc.recruiterSimulation ?? null} jobTitle={resume.jobTitle} companyName={resume.companyName} jobDescription={resume.jobDescription} />
                  </div>
                  <div style={{ display: activeTab === 'intel' ? 'block' : 'none' }}>
                    <InterviewIntelligence resumeId={resume.id} companyName={resume.companyName} jobTitle={resume.jobTitle} jobDescription={resume.jobDescription} preloadedIntel={resume.interviewIntel as unknown as Parameters<typeof InterviewIntelligence>[0]['preloadedIntel']} />
                  </div>
                  <div className="pt-2 pb-4">
                    <Link href="/resume" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-3)] hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /> All resumes</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}