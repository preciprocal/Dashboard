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
  ArrowLeft, Download, Eye, FileText, Building2, Briefcase, Star, Activity, PenTool, ScanSearch, Users, Loader2, Save, Check, FileDown,
  ChevronDown, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, List, ListOrdered,
  IndentIncrease, IndentDecrease, Baseline, Highlighter, Link2, Unlink, Undo2, Redo2,
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

// A toolbar button: keeps the editor selection (mousedown, not click).
function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return <button type="button" title={title} aria-label={title} onMouseDown={e => { e.preventDefault(); onClick(); }} className="flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-2)] hover:bg-white/[0.08] hover:text-white active:bg-white/[0.12] transition-colors cursor-pointer flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">{children}</button>;
}

// A set of related toolbar buttons in one segment.
function ToolGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] flex-shrink-0">{children}</div>;
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
      {/* Header: title, save state, download */}
      <div className="flex-shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center justify-between gap-3 px-4 h-12">
          <div className="flex items-center gap-2 min-w-0">
            <PenTool className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
            <span className="text-[13px] font-semibold text-white truncate">Editor</span>
            <span className="text-[12px] text-[var(--text-4)] truncate hidden xl:inline">· changes save as you type</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasChanges || isSaving ? (
              <button onClick={handleSaveNow} disabled={isSaving || !hasChanges}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-1)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.07] transition-colors disabled:opacity-60">
                {isSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</> : <><Save className="w-3.5 h-3.5" /> Save now</>}
              </button>
            ) : (
              <span className={`inline-flex items-center gap-1.5 h-8 px-2 text-[12.5px] ${saveStatus === 'saved' ? 'text-emerald-300' : 'text-[var(--text-4)]'}`}>
                <Check className="w-3.5 h-3.5" /> {saveStatus === 'saved' ? 'Saved' : 'All changes saved'}
              </span>
            )}
            <div ref={downloadBtnRef} className="relative">
              <button onClick={() => setShowDownloadMenu(v => !v)} disabled={!!isDownloading} aria-expanded={showDownloadMenu}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-[var(--shadow-btn)] transition-colors disabled:opacity-60 cursor-pointer">
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Download<ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
              </button>
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-raised)] rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75)] z-[9999] overflow-hidden p-1">
                  <button onClick={() => { setShowDownloadMenu(false); handleDownload('pdf'); }} className="w-full px-3 h-9 rounded-lg text-left text-[12.5px] font-medium text-[var(--text-2)] hover:text-white hover:bg-white/[0.05] flex items-center gap-2.5 transition-colors cursor-pointer"><FileDown className="w-4 h-4 text-rose-300" /> PDF document</button>
                  <button onClick={() => { setShowDownloadMenu(false); handleDownload('docx'); }} className="w-full px-3 h-9 rounded-lg text-left text-[12.5px] font-medium text-[var(--text-2)] hover:text-white hover:bg-white/[0.05] flex items-center gap-2.5 transition-colors cursor-pointer"><FileDown className="w-4 h-4 text-sky-300" /> Word document</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Formatting toolbar: one bar across the full width */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-white/[0.04]">
          <select aria-label="Font" onChange={e => { editorRef.current?.focus(); document.execCommand('fontName', false, e.target.value); }} defaultValue="Calibri"
            className="flex-1 min-w-[120px] h-8 pl-2.5 pr-7 rounded-lg text-[12.5px] text-[var(--text-1)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.06] outline-none cursor-pointer">
            {['Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Helvetica', 'Garamond'].map(f => (<option key={f} value={f}>{f}</option>))}
          </select>
          <select aria-label="Font size" onChange={e => { editorRef.current?.focus(); document.execCommand('fontSize', false, e.target.value); }} defaultValue="3"
            className="w-[86px] flex-shrink-0 h-8 pl-2.5 pr-7 rounded-lg text-[12.5px] text-[var(--text-1)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.06] outline-none cursor-pointer">
            {[['1', '8pt'], ['2', '10pt'], ['3', '11pt'], ['4', '12pt'], ['5', '14pt'], ['6', '18pt'], ['7', '24pt']].map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
          </select>
          <ToolGroup>
            <ToolBtn title="Bold (Ctrl+B)" onClick={() => document.execCommand('bold')}><Bold /></ToolBtn>
            <ToolBtn title="Italic (Ctrl+I)" onClick={() => document.execCommand('italic')}><Italic /></ToolBtn>
            <ToolBtn title="Underline (Ctrl+U)" onClick={() => document.execCommand('underline')}><Underline /></ToolBtn>
            <ToolBtn title="Strikethrough" onClick={() => document.execCommand('strikeThrough')}><Strikethrough /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Align left" onClick={() => document.execCommand('justifyLeft')}><AlignLeft /></ToolBtn>
            <ToolBtn title="Align center" onClick={() => document.execCommand('justifyCenter')}><AlignCenter /></ToolBtn>
            <ToolBtn title="Align right" onClick={() => document.execCommand('justifyRight')}><AlignRight /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Bulleted list" onClick={() => document.execCommand('insertUnorderedList')}><List /></ToolBtn>
            <ToolBtn title="Numbered list" onClick={() => document.execCommand('insertOrderedList')}><ListOrdered /></ToolBtn>
            <ToolBtn title="Increase indent" onClick={() => document.execCommand('indent')}><IndentIncrease /></ToolBtn>
            <ToolBtn title="Decrease indent" onClick={() => document.execCommand('outdent')}><IndentDecrease /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <label title="Text color" className="relative flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-2)] hover:bg-white/[0.08] hover:text-white cursor-pointer transition-colors">
              <Baseline className="w-4 h-4" />
              <input type="color" defaultValue="#000000" onChange={e => { editorRef.current?.focus(); document.execCommand('foreColor', false, e.target.value); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" aria-label="Text color" />
            </label>
            <label title="Highlight" className="relative flex items-center justify-center w-7 h-7 rounded-md text-[var(--text-2)] hover:bg-white/[0.08] hover:text-white cursor-pointer transition-colors">
              <Highlighter className="w-4 h-4" />
              <input type="color" defaultValue="#fde68a" onChange={e => { editorRef.current?.focus(); document.execCommand('hiliteColor', false, e.target.value); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" aria-label="Highlight color" />
            </label>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Add link" onClick={() => { const url = window.prompt('Enter URL:', 'https://'); if (url) document.execCommand('createLink', false, url); }}><Link2 /></ToolBtn>
            <ToolBtn title="Remove link" onClick={() => document.execCommand('unlink')}><Unlink /></ToolBtn>
          </ToolGroup>
          <ToolGroup>
            <ToolBtn title="Undo (Ctrl+Z)" onClick={() => document.execCommand('undo')}><Undo2 /></ToolBtn>
            <ToolBtn title="Redo (Ctrl+Y)" onClick={() => document.execCommand('redo')}><Redo2 /></ToolBtn>
          </ToolGroup>
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
      <div className="flex-shrink-0 flex items-center justify-center h-8 border-t border-white/[0.05]"><p className="text-[11px] text-[var(--text-5)]">Saves automatically 3 seconds after you stop typing</p></div>
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
    { id: 'analysis', label: 'Analysis', icon: ScanSearch }, { id: 'benchmark', label: 'Benchmark', icon: Users },
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
    <div role="tablist" className="flex items-center border-b border-white/[0.07] overflow-x-auto scrollbar-hide">
      {tabs.map(tab => {
        const on = activeTab === tab.id;
        return (
          <button key={tab.id} role="tab" aria-selected={on} onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 min-w-fit px-3 flex items-center justify-center gap-1.5 h-11 whitespace-nowrap font-medium transition-colors cursor-pointer ${size === 'sm' ? 'text-[12.5px]' : 'text-[13.5px]'} ${on ? 'text-white' : 'text-[var(--text-3)] hover:text-white'}`}>
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
                    <Link href="/resume" className="btn-secondary"><ArrowLeft className="w-4 h-4" /> All resumes</Link>
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