'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { doc, updateDoc } from 'firebase/firestore';
import { FirebaseService } from '@/lib/services/firebase-service';
import { Resume } from '@/types/resume';
import {
  ArrowLeft, Download, Eye, FileText, Building2, Briefcase,
  CheckCircle2, Shield, Edit3, Star, TrendingUp, Award,
  Activity, PenTool, ChevronDown, AlertTriangle, Zap, Clock,
  BarChart3, Users, Loader2, Save, Check, FileDown,
} from 'lucide-react';
import RecruiterEyeSimulation  from '@/components/resume/RecruiterEyeSimulation';
import InterviewIntelligence   from '@/components/resume/InterviewIntelligence';
import CandidateBenchmarking   from '@/components/resume/CandidateBenchmarking';
import ResumePreview           from '@/components/resume/ResumePreview';
import IntelligentAIPanel      from '@/components/resume/IntelligentAIPanel';
import type { OverallAnalysis } from '@/components/resume/IntelligentAIPanel';
import AnimatedLoader, { LoadingStep } from '@/components/loader/AnimatedLoader';
import { SeeExampleButton } from '@/components/ServiceModal';
import type { ResumeInitialTab } from '@/components/ServiceModal/types';
import { toast } from 'sonner';
import Image from 'next/image';

// ─── Score helpers ────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}
function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Work';
}

// ─── OverallScoreHero ─────────────────────────────────────────────────────────

function OverallScoreHero({ score }: { score: number }) {
  const improvementPotential = Math.min(95 - score, 95);
  return (
    <div className="glass-card p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glass flex-shrink-0">
          <Award className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Overall Score</h2>
          <p className="text-slate-400 text-xs">Comprehensive AI evaluation</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-end gap-3">
          <div className="text-5xl font-bold text-white leading-none">{score}</div>
          <div className="mb-1">
            <span className={`text-sm font-semibold ${getScoreColor(score)}`}>{getScoreLabel(score)}</span>
            <p className="text-slate-500 text-xs">out of 100</p>
          </div>
        </div>
        <div className="flex-1 max-w-[160px]">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Current</span><span>Potential</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5">
            <span className={`font-semibold ${getScoreColor(score)}`}>{score}%</span>
            <span className="text-emerald-400 font-semibold">+{improvementPotential}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DetailedAnalysisSection ──────────────────────────────────────────────────

interface Tip { type: string; tip?: string; message?: string; explanation?: string; solution?: string; priority?: string; }

function DetailedAnalysisSection({ title, description, score, tips, icon }: {
  title: string; description: string; score: number; tips: Tip[]; icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const goodTips    = tips.filter(t => t.type === 'good');
  const improveTips = tips.filter(t => t.type !== 'good');
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 sm:p-5 flex items-center gap-4 text-left cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-glass ${score >= 80 ? 'gradient-success' : score >= 60 ? 'gradient-warning' : 'gradient-secondary'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}</span>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getScoreBg(score)}`}>{getScoreLabel(score)}</div>
            </div>
          </div>
          <p className="text-slate-500 text-xs">{description}</p>
          <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2 border-t border-white/[0.06] pt-4">
          {tips.length === 0
            ? <p className="text-slate-500 text-sm">No specific tips available.</p>
            : [...improveTips, ...goodTips].map((tip, i) => {
              const isGood = tip.type === 'good';
              const text   = tip.tip || tip.message || '';
              return (
                <div key={i} className={`flex gap-3 p-3 rounded-xl border ${isGood ? 'bg-emerald-500/[0.05] border-emerald-500/15' : 'bg-slate-800/40 border-white/[0.06]'}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {isGood ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isGood ? 'text-emerald-300' : 'text-slate-200'}`}>{text}</p>
                    {tip.explanation && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tip.explanation}</p>}
                    {tip.solution && (
                      <div className="mt-2 p-2.5 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-lg">
                        <p className="text-xs text-indigo-300 leading-relaxed"><span className="font-semibold">Fix: </span>{tip.solution}</p>
                      </div>
                    )}
                  </div>
                  {!isGood && tip.priority && (
                    <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border self-start ${tip.priority === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-400' : tip.priority === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}>
                      {tip.priority}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ─── ImprovementRoadmap ───────────────────────────────────────────────────────

interface RoadmapItem { action: string; timeToComplete: string; impact: 'high' | 'medium' | 'low'; }
interface ImprovementRoadmapData {
  quickWins?: RoadmapItem[]; mediumTermGoals?: RoadmapItem[]; mediumTerm?: RoadmapItem[];
  longTermStrategies?: RoadmapItem[]; longTerm?: RoadmapItem[];
}

function ImprovementRoadmap({ roadmap }: { roadmap: ImprovementRoadmapData }) {
  const [activeTab, setActiveTab] = useState<'quick' | 'medium' | 'long'>('quick');
  if (!roadmap) return null;
  const tabs = [
    { key: 'quick'  as const, label: 'Quick Wins',  data: roadmap.quickWins ?? [],                              icon: <Zap        className="w-3.5 h-3.5" /> },
    { key: 'medium' as const, label: 'Medium Term', data: roadmap.mediumTermGoals ?? roadmap.mediumTerm ?? [],  icon: <Clock      className="w-3.5 h-3.5" /> },
    { key: 'long'   as const, label: 'Long Term',   data: roadmap.longTermStrategies ?? roadmap.longTerm ?? [], icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ];
  const activeData = tabs.find(t => t.key === activeTab)?.data ?? [];
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 gradient-primary rounded-lg flex items-center justify-center shadow-glass flex-shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Improvement Roadmap</h3>
          <p className="text-slate-500 text-xs">Prioritised action plan</p>
        </div>
      </div>
      <div className="flex gap-1 p-1 bg-slate-900/50 rounded-xl mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${activeTab === t.key ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {activeData.length === 0
          ? <p className="text-slate-500 text-sm text-center py-4">No items in this category.</p>
          : activeData.map((item, i) => (
            <div key={i} className="flex gap-3 p-3 bg-slate-800/40 rounded-xl border border-white/[0.06]">
              <div className={`w-1.5 rounded-full flex-shrink-0 ${item.impact === 'high' ? 'bg-red-400' : item.impact === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200">{item.action}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.timeToComplete}</p>
              </div>
              <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border self-start capitalize ${item.impact === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-400' : item.impact === 'medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                {item.impact}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── ToolBtn helper ───────────────────────────────────────────────────────────

function ToolBtn({ onClick, title, children }: {
  onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="flex items-center justify-center w-6 h-6 rounded text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer flex-shrink-0"
    >
      {children}
    </button>
  );
}

// ─── InlineResumeEditor ───────────────────────────────────────────────────────

function InlineResumeEditor({
  resumeId, initialHtml, onContentChange, highlightText,
}: {
  resumeId: string;
  initialHtml: string;
  onContentChange: (html: string) => void;
  highlightText?: string | null;
}) {
  const editorRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevHighlightedEl = useRef<HTMLElement | null>(null);
  const saveTimer    = useRef<NodeJS.Timeout | null>(null);

  const [scale,            setScale]            = useState(1);
  const [isSaving,         setIsSaving]         = useState(false);
  const [saveStatus,       setSaveStatus]       = useState<'idle' | 'saved'>('idle');
  const [hasChanges,       setHasChanges]       = useState(false);
  const [isDownloading,    setIsDownloading]    = useState<'pdf' | 'docx' | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (downloadBtnRef.current && !downloadBtnRef.current.contains(e.target as Node))
        setShowDownloadMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const externalChangeRef = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (prevHighlightedEl.current) {
      prevHighlightedEl.current.style.background   = '';
      prevHighlightedEl.current.style.borderRadius = '';
      prevHighlightedEl.current.style.outline      = '';
      prevHighlightedEl.current.removeAttribute('data-ai-highlight');
      prevHighlightedEl.current = null;
    }
    if (!highlightText || highlightText.length < 5) return;
    const searchText = highlightText.trim().substring(0, 60);
    const all = Array.from(
      editor.querySelectorAll('p, li, span, h1, h2, h3, h4')
    ) as HTMLElement[];
    const target =
      all.find(el => el.children.length === 0 && el.textContent?.includes(searchText)) ??
      all.find(el => el.textContent?.includes(searchText));
    if (!target) return;
    target.style.background   = '#fde68a';
    target.style.borderRadius = '3px';
    target.style.outline      = '2px solid #f59e0b';
    target.setAttribute('data-ai-highlight', 'true');
    prevHighlightedEl.current = target;
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [highlightText]);

  useEffect(() => {
    if (!editorRef.current || !initialHtml) return;
    if (editorRef.current.innerHTML !== initialHtml) {
      editorRef.current.innerHTML = initialHtml;
      externalChangeRef.current = true;
    }
  }, [initialHtml]);

  useEffect(() => {
    if (!externalChangeRef.current) return;
    externalChangeRef.current = false;
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
          updatedAt: new Date().toISOString(),
        });
        setSaveStatus('saved');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch { toast.error('Auto-save failed'); }
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
          updatedAt: new Date().toISOString(),
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
        resumeHtml: html,
        resumeText: editorRef.current.innerText,
        updatedAt: new Date().toISOString(),
      });
      setSaveStatus('saved');
      setHasChanges(false);
      toast.success('Saved', { duration: 1500 });
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch { toast.error('Save failed'); }
    finally { setIsSaving(false); }
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!editorRef.current) return;
    setIsDownloading(format);
    toast.loading(`Generating ${format.toUpperCase()}…`, { id: `dl-${format}` });
    try {
      const computed = window.getComputedStyle(editorRef.current);
      const editorPadding = {
        top:    computed.paddingTop,
        right:  computed.paddingRight,
        bottom: computed.paddingBottom,
        left:   computed.paddingLeft,
      };

      const res = await fetch('/api/resume/download', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent:   editorRef.current.innerHTML,
          editorPadding,
          resumeId,
          format,
        }),
      });

      const contentType = res.headers.get('Content-Type') ?? '';
      if (!res.ok || contentType.includes('application/json')) {
        let msg = `${format.toUpperCase()} generation failed (${res.status})`;
        try { const j = await res.json() as { error?: string }; if (j.error) msg = j.error; } catch { /* */ }
        throw new Error(msg);
      }

      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = match ? match[1] : `resume_${Date.now()}.${format}`;

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      toast.success(`${format.toUpperCase()} downloaded!`, { id: `dl-${format}` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to download ${format.toUpperCase()}`, { id: `dl-${format}` });
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 bg-slate-900/80 backdrop-blur-sm border-b border-white/[0.06]">

        {/* Row 1: title + save + download */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <PenTool className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-medium text-slate-300">Editable Resume</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveNow}
              disabled={isSaving || !hasChanges}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                saveStatus === 'saved'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : hasChanges
                  ? 'bg-indigo-600/70 hover:bg-indigo-600 text-white cursor-pointer'
                  : 'bg-slate-700/40 text-slate-600 cursor-not-allowed'
              }`}
            >
              {isSaving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                : saveStatus === 'saved' ? <><Check className="w-3 h-3" /> Saved</>
                : <><Save className="w-3 h-3" /> Save</>}
            </button>

            <div ref={downloadBtnRef} className="relative">
              <button
                onClick={() => setShowDownloadMenu(v => !v)}
                disabled={!!isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white
                           border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
              >
                {isDownloading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Download className="w-3 h-3" />}
                Download
                <ChevronDown className={`w-3 h-3 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
              </button>

              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-2 w-48
                                bg-[#0d1526]/98 border border-white/[0.08]
                                rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.5)]
                                z-[9999] overflow-hidden">
                  <button
                    onClick={() => { setShowDownloadMenu(false); handleDownload('pdf'); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300
                               hover:text-white hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-red-400" /> Download as PDF
                  </button>
                  <div className="h-px bg-white/[0.06]" />
                  <button
                    onClick={() => { setShowDownloadMenu(false); handleDownload('docx'); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-300
                               hover:text-white hover:bg-white/[0.04] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-400" /> Download as Word
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: formatting controls */}
        <div className="flex items-center gap-1 px-2 py-1.5 flex-wrap">
          <select onChange={e => { editorRef.current?.focus(); document.execCommand('fontName', false, e.target.value); }}
            className="bg-slate-800 text-slate-300 text-[11px] rounded px-1.5 py-1 border border-white/[0.08] cursor-pointer outline-none" defaultValue="Calibri">
            {['Calibri','Arial','Times New Roman','Georgia','Verdana','Helvetica','Garamond'].map(f => (<option key={f} value={f}>{f}</option>))}
          </select>
          <select onChange={e => { editorRef.current?.focus(); document.execCommand('fontSize', false, e.target.value); }}
            className="bg-slate-800 text-slate-300 text-[11px] rounded px-1.5 py-1 border border-white/[0.08] w-14 cursor-pointer outline-none" defaultValue="3">
            {[['1','8pt'],['2','10pt'],['3','11pt'],['4','12pt'],['5','14pt'],['6','18pt'],['7','24pt']].map(([v, label]) => (<option key={v} value={v}>{label}</option>))}
          </select>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Bold" onClick={() => document.execCommand('bold')}><span className="font-bold text-[11px]">B</span></ToolBtn>
          <ToolBtn title="Italic" onClick={() => document.execCommand('italic')}><span className="italic text-[11px]">I</span></ToolBtn>
          <ToolBtn title="Underline" onClick={() => document.execCommand('underline')}><span className="underline text-[11px]">U</span></ToolBtn>
          <ToolBtn title="Strikethrough" onClick={() => document.execCommand('strikeThrough')}><span className="line-through text-[11px]">S</span></ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Align Left" onClick={() => document.execCommand('justifyLeft')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>
          </ToolBtn>
          <ToolBtn title="Align Center" onClick={() => document.execCommand('justifyCenter')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M4 3.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm2 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5z"/></svg>
          </ToolBtn>
          <ToolBtn title="Align Right" onClick={() => document.execCommand('justifyRight')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm4 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-4 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>
          </ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Bullet List" onClick={() => document.execCommand('insertUnorderedList')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm-3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>
          </ToolBtn>
          <ToolBtn title="Numbered List" onClick={() => document.execCommand('insertOrderedList')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM1 2.5a.5.5 0 0 1 .5-.5H2a.5.5 0 0 1 0 1h-.5V4H2a.5.5 0 0 1 0 1H1a.5.5 0 0 1 0-1V2.5zm1 4a.5.5 0 0 0-1 0v1.5H.5a.5.5 0 0 0 0 1H2v.5a.5.5 0 0 0 1 0v-3zm-1 5.5H2v-1a.5.5 0 0 0-1 0v1.5H.5a.5.5 0 0 0 0 1H2v.5a.5.5 0 0 0 1 0v-3z"/></svg>
          </ToolBtn>
          <ToolBtn title="Indent" onClick={() => document.execCommand('indent')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm3.5 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-3.5 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM2 8l2-2v4z"/></svg>
          </ToolBtn>
          <ToolBtn title="Outdent" onClick={() => document.execCommand('outdent')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M2 3.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zm3.5 4a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-3.5 4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5zM4 8l-2 2V6z"/></svg>
          </ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <label title="Text Color" className="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 cursor-pointer transition-colors">
            <span className="text-[11px] font-bold text-slate-300" style={{ textDecoration: 'underline 2px solid #6366f1' }}>A</span>
            <input type="color" defaultValue="#000000" onChange={e => { editorRef.current?.focus(); document.execCommand('foreColor', false, e.target.value); }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </label>
          <label title="Highlight Color" className="relative flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 cursor-pointer transition-colors">
            <span className="text-[11px] font-bold" style={{ background: '#fde68a', padding: '0 2px', borderRadius: 2 }}>H</span>
            <input type="color" defaultValue="#fde68a" onChange={e => { editorRef.current?.focus(); document.execCommand('hiliteColor', false, e.target.value); }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
          </label>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Insert Link" onClick={() => { const url = window.prompt('Enter URL:', 'https://'); if (url) document.execCommand('createLink', false, url); }}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 9.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/></svg>
          </ToolBtn>
          <ToolBtn title="Remove Link" onClick={() => document.execCommand('unlink')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 9.5H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z"/><path d="M9 5.5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6.5h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z"/><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5"/></svg>
          </ToolBtn>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn title="Undo" onClick={() => document.execCommand('undo')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg>
          </ToolBtn>
          <ToolBtn title="Redo" onClick={() => document.execCommand('redo')}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
          </ToolBtn>
        </div>
      </div>

      {/* ── Scrollable Word document area ── */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden bg-slate-900/60">
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden glass-scrollbar"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.3) transparent' }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px', width: '100%' }}>
            <div style={{ width: '816px', transformOrigin: 'top center', transform: `scale(${scale})`, marginBottom: `calc((${scale} - 1) * 100%)` }}>
              <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={handleInput}
                onPaste={e => { e.preventDefault(); const html = e.clipboardData.getData('text/html'); document.execCommand(html ? 'insertHTML' : 'insertText', false, html || e.clipboardData.getData('text/plain')); }}
                className="outline-none rounded shadow-2xl border border-white/10"
                style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: '10pt', lineHeight: '1.4', color: '#000', backgroundColor: '#fff', width: '816px', minHeight: '200px', padding: '72px 72px', boxSizing: 'border-box' as const, wordBreak: 'break-word', overflowWrap: 'break-word' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex-shrink-0 flex items-center justify-center py-2 bg-slate-900/40 border-t border-white/[0.05]">
        <p className="text-[10px] text-slate-600">Auto-saves 3 s after typing stops</p>
      </div>
    </div>
  );
}

// ─── Loading steps ────────────────────────────────────────────────────────────

const loadingSteps: LoadingStep[] = [
  { name: 'Authenticating…',      weight: 1 },
  { name: 'Loading resume data…', weight: 2 },
  { name: 'Fetching analysis…',   weight: 2 },
  { name: 'Preparing insights…',  weight: 1 },
  { name: 'Ready!',               weight: 1 },
];

type TabId = 'analysis' | 'benchmark' | 'recruiter' | 'intel' | 'writer';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResumeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const [resume,        setResume]        = useState<Resume | null>(null);
  const [loadingResume, setLoadingResume] = useState(true);
  const [loadingStep,   setLoadingStep]   = useState(0);
  const [error,         setError]         = useState('');
  const [imageUrl,      setImageUrl]      = useState('');
  const [activeTab,     setActiveTab]     = useState<TabId>('analysis');
  const [showPreview,   setShowPreview]   = useState(false);

  const [editorHtml,      setEditorHtml]      = useState('');
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [, setEditorReady]                    = useState(false);
  const [persistedAnalysis,    setPersistedAnalysis]    = useState<OverallAnalysis | null>(null);
  const [persistedAppliedKeys, setPersistedAppliedKeys] = useState<Set<string>>(new Set());

  const [highlightText, setHighlightText] = useState<string | null>(null);
  const handleHighlightLine = useCallback((text: string | null) => {
    setHighlightText(text);
  }, []);

  const editorLoadedForId = useRef<string | null>(null);

  // ── Load resume ──
  useEffect(() => {
    const load = async () => {
      if (!params.id || typeof params.id !== 'string') { setError('Invalid resume ID'); setLoadingResume(false); return; }
      try {
        setLoadingStep(1);
        const data = await FirebaseService.getResume(params.id);
        setLoadingStep(2);
        if (!data) { setError('Resume not found'); setResume(null); }
        else if (user && data.userId !== user.uid) { setError('Access denied'); setResume(null); }
        else { setResume(data); if (data.imagePath) setImageUrl(data.imagePath); }
        setLoadingStep(4);
        await new Promise(r => setTimeout(r, 150));
      } catch { setError('Failed to load resume'); setResume(null); }
      finally  { setLoadingResume(false); }
    };
    if (user) load();
    else if (!loading) setLoadingResume(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, user, loading]);

  // ── Load editable HTML when writer tab is first activated ──
  useEffect(() => {
    if (activeTab !== 'writer' || !resume) return;
    if (editorLoadedForId.current === resume.id) return;
    editorLoadedForId.current = resume.id;

    const load = async () => {
      setIsLoadingEditor(true);
      try {
        const rd = resume as Resume & { resumeHtml?: string; resumeText?: string; imagePath?: string; resumePath?: string };

        if (rd.resumeHtml && rd.resumeHtml.length > 500 && !rd.resumeHtml.includes('Paste your resume')) {
          setEditorHtml(rd.resumeHtml); setEditorReady(true); return;
        }

        if (rd.resumePath && rd.resumePath.startsWith('http')) {
          try {
            const res = await fetch('/api/resume/pdf-to-html', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ pdfUrl: rd.resumePath, resumeId: resume.id }),
            });
            const result = await res.json() as { html?: string; error?: string };
            if (res.ok && result.html && result.html.length > 100) {
              setEditorHtml(result.html);
              await updateDoc(doc(db, 'resumes', resume.id), { resumeHtml: result.html, updatedAt: new Date().toISOString() });
              setEditorReady(true); return;
            }
          } catch (e) { console.warn('[Writer] pdf-to-html failed:', e); }
        }

        if (rd.resumeText && rd.resumeText.length > 100) {
          const escaped = rd.resumeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          setEditorHtml(`<div style="font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#000;white-space:pre-wrap;line-height:1.4;">${escaped}</div>`);
          setEditorReady(true); return;
        }

        if (rd.imagePath?.startsWith('data:image/')) {
          try {
            const res = await fetch('/api/resume/format-from-image', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ resumeId: resume.id, imageBase64: rd.imagePath }),
            });
            if (res.ok) {
              const result = await res.json() as { html?: string };
              if (result.html && result.html.length > 100) {
                setEditorHtml(result.html);
                await updateDoc(doc(db, 'resumes', resume.id), { resumeHtml: result.html, updatedAt: new Date().toISOString() });
                setEditorReady(true); return;
              }
            }
          } catch (e) { console.warn('[Writer] format-from-image failed:', e); }
        }

        setEditorHtml('<p style="color:#6b7280;font-style:italic;">Could not extract resume content. Paste your resume here to get started.</p>');
        setEditorReady(true);
      } catch { setEditorHtml('<p>Could not load resume. Paste your content here.</p>'); setEditorReady(true); }
      finally  { setIsLoadingEditor(false); }
    };
    load();
  }, [activeTab, resume]);

  const handleDownloadPdf = () => {
    if (!resume?.resumePath) { alert('PDF not available'); return; }
    try {
      if (resume.resumePath.startsWith('data:')) {
        const url = FirebaseService.createDownloadableUrl(resume.resumePath);
        const a   = Object.assign(document.createElement('a'), { href: url, download: resume.originalFileName || `resume_${resume.id}.pdf` });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else { window.open(resume.resumePath, '_blank'); }
    } catch { alert('Failed to download PDF'); }
  };

  const handleApplySuggestion = useCallback((o: string, n: string) => {
    setEditorHtml(h => h.replace(o, n));
  }, []);

  const handleViewPdf = () => {
    if (!resume?.resumePath) { alert('PDF not available'); return; }
    try { window.open(resume.resumePath.startsWith('data:') ? FirebaseService.createDownloadableUrl(resume.resumePath) : resume.resumePath, '_blank'); }
    catch { alert('Failed to view PDF'); }
  };

  if (loading || loadingResume)
    return <AnimatedLoader isVisible mode="steps" steps={loadingSteps} currentStep={loadingStep} loadingText="Loading your resume analysis…" showNavigation />;
  if (!user) { router.push('/auth'); return null; }
  if (error || !resume) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="glass-card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 gradient-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glass">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{error || 'Resume Not Found'}</h1>
          <p className="text-slate-400 mb-6 text-sm">{error === 'Access denied' ? 'This resume belongs to another user.' : 'This analysis does not exist.'}</p>
          <Link href="/resume">
            <button className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl glass-button-primary text-white text-sm font-semibold">
              <ArrowLeft className="w-4 h-4" /> Back to Resumes
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const feedback      = resume.feedback;
  const atsData       = feedback?.ATS          ?? { score: 0, tips: [] };
  const contentData   = feedback?.content      ?? { score: 0, tips: [] };
  const structureData = feedback?.structure    ?? { score: 0, tips: [] };
  const skillsData    = feedback?.skills       ?? { score: 0, tips: [] };
  const toneData      = feedback?.toneAndStyle ?? { score: 0, tips: [] };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'analysis',  label: 'Analysis',  icon: BarChart3 },
    { id: 'benchmark', label: 'Benchmark', icon: Users     },
    { id: 'recruiter', label: 'Recruiter', icon: Eye       },
    { id: 'intel',     label: 'Intel',     icon: Activity  },
    { id: 'writer',    label: 'Writer',    icon: PenTool   },
  ];

  const MetaBadge = () => (
    <div className="flex items-center gap-2 flex-wrap">
      {resume.jobTitle    && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-300"><Briefcase className="w-3 h-3 text-slate-500" />{resume.jobTitle}</span>}
      {resume.companyName && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-300"><Building2 className="w-3 h-3 text-slate-500" />{resume.companyName}</span>}
      {resume.score != null && <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${getScoreBg(resume.score)}`}><Star className="w-3 h-3" />{resume.score}/100</span>}
    </div>
  );

  const TabBar = ({ size = 'md' }: { size?: 'sm' | 'md' }) => (
    <div className="flex gap-1 p-1 glass-card">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all cursor-pointer ${size === 'sm' ? 'py-2 px-2 text-xs' : 'py-2.5 px-3 text-sm'} ${activeTab === tab.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'}`}>
          <tab.icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          {tab.label}
        </button>
      ))}
    </div>
  );

  const AnalysisSections = () => (
    <div className="space-y-3">
      <DetailedAnalysisSection title="ATS Compatibility"  description="Applicant tracking system optimization" score={atsData.score}       tips={atsData.tips}       icon={<Shield   className="w-4 h-4 text-white" />} />
      <DetailedAnalysisSection title="Content Quality"    description="Relevance and impact of content"        score={contentData.score}   tips={contentData.tips}   icon={<FileText className="w-4 h-4 text-white" />} />
      <DetailedAnalysisSection title="Structure & Format" description="Organisation and visual appeal"         score={structureData.score} tips={structureData.tips} icon={<Edit3    className="w-4 h-4 text-white" />} />
      <DetailedAnalysisSection title="Skills & Keywords"  description="Technical and soft skills"              score={skillsData.score}    tips={skillsData.tips}    icon={<Star     className="w-4 h-4 text-white" />} />
      {toneData.score > 0 && <DetailedAnalysisSection title="Tone & Style" description="Professional writing quality" score={toneData.score} tips={toneData.tips} icon={<Edit3 className="w-4 h-4 text-white" />} />}
      {feedback?.roadmap && <ImprovementRoadmap roadmap={feedback.roadmap} />}
    </div>
  );

  const MobilePreviewPanel = () => (
    <div className="space-y-3">
      {imageUrl
        ? <Image src={imageUrl} alt="Resume preview" width={800} height={1000} className="w-full rounded-xl shadow-glass border border-white/10 object-contain" />
        : <div className="w-full aspect-[3/4] bg-slate-800/40 border border-dashed border-white/10 rounded-xl flex items-center justify-center"><div className="text-center p-6"><FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" /><p className="text-slate-500 text-sm">Preview unavailable</p></div></div>
      }
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={handleViewPdf}     disabled={!resume.resumePath} className="glass-card hover-lift text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer transition-all"><Eye      className="w-4 h-4" /> View PDF</button>
        <button onClick={handleDownloadPdf} disabled={!resume.resumePath} className="glass-card hover-lift text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer transition-all"><Download className="w-4 h-4" /> Download</button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  return (
    <>
      {/* ═════════════ MOBILE ═════════════ */}
      <div className="lg:hidden px-4 py-5 space-y-4">
        <div className="glass-card p-4">
          <Link href="/resume" className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> All Resumes
          </Link>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="text-xl font-bold text-white mb-0.5">Resume Analysis</h1>
              <p className="text-slate-400 text-xs">AI-powered evaluation</p>
            </div>
            <SeeExampleButton
              serviceId="resume"
              className="!px-3 !py-2 !rounded-lg !text-xs flex-shrink-0"
              initialTab={activeTab as ResumeInitialTab}
            />
          </div>
          <MetaBadge />
        </div>

        {activeTab !== 'writer' && (
          <>
            <button onClick={() => setShowPreview(!showPreview)}
              className="w-full glass-card p-3 text-slate-300 hover:text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <Eye className="w-4 h-4" />{showPreview ? 'Hide Preview' : 'Show Resume Preview'}
            </button>
            {showPreview && <div className="glass-card p-4"><MobilePreviewPanel /></div>}
          </>
        )}

        <TabBar size="sm" />
        {activeTab !== 'writer' && <OverallScoreHero score={feedback?.overallScore ?? 0} />}

        {activeTab === 'analysis'  && feedback && <AnalysisSections />}
        {activeTab === 'benchmark' && <CandidateBenchmarking resumeId={resume.id} overallScore={feedback?.overallScore ?? 0} jobTitle={resume.jobTitle} />}
        {activeTab === 'writer' && (
          <div className="space-y-4">
            <div className="glass-card overflow-hidden" style={{ minHeight: 600 }}>
              {isLoadingEditor
                ? <div className="h-full flex flex-col items-center justify-center gap-3 py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /><p className="text-xs">Converting to editable format…</p></div>
                : <InlineResumeEditor resumeId={resume.id} initialHtml={editorHtml} onContentChange={setEditorHtml} highlightText={highlightText} />
              }
            </div>
            <div className="glass-card overflow-hidden">
              <IntelligentAIPanel
                resumeId={resume.id}
                userId={resume.userId}
                resumeContent={editorHtml}
                onHighlightLine={handleHighlightLine}
                onApplySuggestion={handleApplySuggestion}
                initialJobDescription={resume.jobDescription ?? ''}
                initialJobTitle={resume.jobTitle ?? ''}
                initialCompanyName={resume.companyName ?? ''}
                initialDeepAnalysis={((resume as Resume & { deepAnalysis?: unknown }).deepAnalysis ?? null) as OverallAnalysis | null}
                persistedAnalysis={persistedAnalysis}
                persistedAppliedKeys={persistedAppliedKeys}
                onAnalysisChange={setPersistedAnalysis}
                onAppliedKeysChange={setPersistedAppliedKeys}
              />
            </div>
          </div>
        )}
        <div style={{ display: activeTab === 'recruiter' ? 'block' : 'none' }}>
          <RecruiterEyeSimulation resumeId={resume.id} imageUrl={imageUrl} />
        </div>
        <div style={{ display: activeTab === 'intel' ? 'block' : 'none' }}>
          <InterviewIntelligence resumeId={resume.id} companyName={resume.companyName} jobTitle={resume.jobTitle} jobDescription={resume.jobDescription} preloadedIntel={resume.interviewIntel} />
        </div>

        <div className="flex gap-2.5 pt-1 pb-4">
          <Link href="/resume/upload" className="flex-1 glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"><FileText className="w-4 h-4" /> New Analysis</Link>
          <Link href="/resume"        className="flex-1 glass-card hover-lift text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors"><ArrowLeft className="w-4 h-4" /> All Resumes</Link>
        </div>
      </div>

      {/* ═════════════ DESKTOP ═════════════ */}
      <div className="hidden lg:flex fixed inset-0 lg:left-64 top-[73px] overflow-hidden">

        {/* ── Left column ── */}
        <div className="w-[42%] flex-shrink-0 h-full p-4 pr-2">
          <div className="glass-card h-full overflow-hidden" style={{ maxHeight: 'calc(100vh - 73px)' }}>
            {activeTab === 'writer' ? (
              isLoadingEditor
                ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    <p className="text-xs">Converting PDF to editable format…</p>
                  </div>
                )
                : (
                  <InlineResumeEditor
                    resumeId={resume.id}
                    initialHtml={editorHtml}
                    onContentChange={setEditorHtml}
                    highlightText={highlightText}
                  />
                )
            ) : (
              resume.resumePath
                ? (
                  <ResumePreview
                    resumePath={resume.resumePath}
                    onViewPdf={handleViewPdf}
                    onDownloadPdf={handleDownloadPdf}
                  />
                )
                : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
                    <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-slate-500 text-sm text-center">No PDF available</p>
                    {imageUrl && (
                      <Image src={imageUrl} alt="Resume preview" width={600} height={800}
                        className="w-full rounded-xl shadow-glass border border-white/10 object-contain mt-2" />
                    )}
                  </div>
                )
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 73px)' }}>
          <div className="flex-shrink-0 p-4 pl-2 pb-0 space-y-3">
            <div className="glass-card p-5">
              <Link href="/resume" className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors mb-4">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> All Resumes
              </Link>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h1 className="text-xl font-bold text-white mb-0.5">{resume.fileName || 'Resume Analysis'}</h1>
                  <p className="text-slate-400 text-xs">AI-powered evaluation</p>
                </div>
                <SeeExampleButton
                  serviceId="resume"
                  className="!px-4 !py-2.5 !rounded-lg !text-sm flex-shrink-0"
                  initialTab={activeTab as ResumeInitialTab}
                />
              </div>
              <MetaBadge />
            </div>
            <TabBar />
          </div>

          <div className="flex-1 overflow-y-auto glass-scrollbar">
            <div className="p-4 pl-2 space-y-4">

              {activeTab === 'writer' && (
                <IntelligentAIPanel
                  resumeId={resume.id}
                  userId={resume.userId}
                  resumeContent={editorHtml}
                  onHighlightLine={handleHighlightLine}
                  onApplySuggestion={handleApplySuggestion}
                  initialJobDescription={resume.jobDescription ?? ''}
                  initialJobTitle={resume.jobTitle ?? ''}
                  initialCompanyName={resume.companyName ?? ''}
                  initialDeepAnalysis={((resume as Resume & { deepAnalysis?: unknown }).deepAnalysis ?? null) as OverallAnalysis | null}
                  persistedAnalysis={persistedAnalysis}
                  persistedAppliedKeys={persistedAppliedKeys}
                  onAnalysisChange={setPersistedAnalysis}
                  onAppliedKeysChange={setPersistedAppliedKeys}
                />
              )}

              {activeTab !== 'writer' && (
                <>
                  <OverallScoreHero score={feedback?.overallScore ?? 0} />
                  {activeTab === 'analysis'  && feedback && <AnalysisSections />}
                  {activeTab === 'benchmark' && <CandidateBenchmarking resumeId={resume.id} overallScore={feedback?.overallScore ?? 0} jobTitle={resume.jobTitle} />}
                  <div style={{ display: activeTab === 'recruiter' ? 'block' : 'none' }}>
                    <RecruiterEyeSimulation resumeId={resume.id} imageUrl={imageUrl} />
                  </div>
                  <div style={{ display: activeTab === 'intel' ? 'block' : 'none' }}>
                    <InterviewIntelligence resumeId={resume.id} companyName={resume.companyName} jobTitle={resume.jobTitle} jobDescription={resume.jobDescription} preloadedIntel={resume.interviewIntel} />
                  </div>
                  <div className="flex gap-2.5 pb-4">
                    <Link href="/resume/upload" className="flex-1 glass-button-primary hover-lift px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2">
                      <FileText className="w-4 h-4" /> New Analysis
                    </Link>
                    <Link href="/resume" className="flex-1 glass-card hover-lift text-white px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors">
                      <ArrowLeft className="w-4 h-4" /> All Resumes
                    </Link>
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