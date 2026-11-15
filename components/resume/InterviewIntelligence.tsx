// components/resume/InterviewIntelligence.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Building2, Briefcase, MessageSquare, AlertTriangle, CheckCircle2,
  ChevronDown, Target, Lightbulb, RefreshCw, BookOpen, Trophy, Info, HelpCircle,
} from 'lucide-react';
import { INTEL_VERSION, type InterviewIntel } from '@/types/resume';

interface InterviewIntelligenceProps {
  resumeId: string; companyName?: string; jobTitle?: string;
  jobDescription?: string; preloadedIntel?: InterviewIntel;
}

const ROUND_LABELS: Record<string, string> = {
  recruiter_screen: 'Recruiter screen', technical_phone: 'Technical phone screen', coding: 'Coding',
  system_design: 'System design', behavioral: 'Behavioral', hiring_manager: 'Hiring manager',
  team_match: 'Team match', take_home: 'Take-home',
};

function NotAvailable({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="bg-slate-800/30 border border-white/[0.05] rounded-xl p-6 text-center">
      <div className="w-10 h-10 bg-slate-800/60 border border-white/[0.06] rounded-xl flex items-center justify-center mx-auto mb-3">
        <HelpCircle className="w-5 h-5 text-slate-500" />
      </div>
      <p className="text-slate-400 text-sm font-medium">{message}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

type IntelTab = 'rounds' | 'questions' | 'fit';

export default function InterviewIntelligence({
  resumeId, companyName, jobTitle, jobDescription, preloadedIntel,
}: InterviewIntelligenceProps) {
  // A result saved before the current version held invented figures; treat it as absent.
  const usable = preloadedIntel?.version === INTEL_VERSION ? preloadedIntel : undefined;
  const [intel,            setIntel]            = useState<InterviewIntel | null>(usable || null);
  const [loading,          setLoading]          = useState(!usable);
  const [error,            setError]            = useState('');
  const [activeTab,        setActiveTab]        = useState<IntelTab>('rounds');
  const [expandedRound,    setExpandedRound]    = useState<number | null>(null);
  const [customCompany,    setCustomCompany]    = useState(companyName || '');
  const [customRole,       setCustomRole]       = useState(jobTitle || '');
  const [showCustomInput,  setShowCustomInput]  = useState(false);

  const fetchIntel = useCallback(async (overrideCompany?: string, overrideRole?: string) => {
    setLoading(true); setError(''); setIntel(null);
    try {
      const res = await fetch('/api/resume/interview-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          companyName: overrideCompany || customCompany || companyName,
          jobTitle:    overrideRole    || customRole    || jobTitle,
          jobDescription,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(d.error || `Failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !data.intel) throw new Error('Invalid response from the prep service');
      setIntel(data.intel);
      setActiveTab('rounds');
      setShowCustomInput(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare interview prep');
    } finally {
      setLoading(false);
    }
  }, [resumeId, companyName, jobTitle, jobDescription, customCompany, customRole]);

  useEffect(() => {
    if (!usable && (companyName || jobTitle)) fetchIntel();
    else if (!usable) { setLoading(false); setShowCustomInput(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-10 flex flex-col items-center text-center">
        <Loader2 className="w-7 h-7 text-[var(--accent)] animate-spin mb-4" />
        <h3 className="text-base font-semibold text-white mb-1">Preparing interview prep</h3>
        <p className="text-slate-400 text-sm max-w-sm">Mapping the usual rounds for this role and matching your resume to the job.</p>
      </div>
    );
  }

  if (!intel && !error && showCustomInput) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-6 h-6 text-indigo-200" />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">Interview prep</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
          Enter a company and role to see the rounds typical for this kind of role, likely question themes, and how your resume fits.
        </p>
        <div className="max-w-sm mx-auto space-y-3">
          <input type="text" value={customCompany} onChange={e => setCustomCompany(e.target.value)}
            placeholder="Company name (e.g., Google)" className="field w-full" />
          <input type="text" value={customRole} onChange={e => setCustomRole(e.target.value)}
            placeholder="Role (e.g., Software Engineer)" className="field w-full" />
          <button onClick={() => fetchIntel(customCompany, customRole)}
            disabled={!customCompany.trim() && !customRole.trim()}
            className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed">
            <Target className="w-4 h-4" /> Get interview prep
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-10 text-center">
        <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">Interview prep unavailable</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">{error}</p>
        <button onClick={() => fetchIntel()} className="btn-primary">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!intel) return null;

  const { rounds, questionThemes, candidateFit: fit } = intel;
  const hasFit = !!fit && (fit.strengths.length > 0 || fit.gaps.length > 0 || fit.prepPriorities.length > 0);

  const tabs: { id: IntelTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'rounds',    label: 'Rounds',    icon: <Target        className="w-3.5 h-3.5" />, count: rounds.length },
    { id: 'questions', label: 'Questions', icon: <MessageSquare className="w-3.5 h-3.5" />, count: questionThemes.length },
    { id: 'fit',       label: 'Your fit',  icon: <Trophy        className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{intel.company || 'Interview prep'}</h2>
              {intel.role && (
                <p className="text-[13px] text-slate-400 mt-0.5 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{intel.role}</p>
              )}
            </div>
          </div>
          <button onClick={() => { setShowCustomInput(true); setIntel(null); }} className="btn-secondary flex-shrink-0">
            <RefreshCw className="w-4 h-4" /> Change
          </button>
        </div>
        <div className="mt-4 rounded-xl p-3 border border-white/[0.06] bg-white/[0.02] flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Rounds are typical for this kind of role, not {intel.company ? `${intel.company}'s` : "the company's"} confirmed process. Ask your recruiter what to expect.
          </p>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 p-1.5 bg-slate-800/50 border border-white/[0.06] rounded-xl overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === tab.id ? 'bg-[var(--accent)] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}>
            {tab.icon}
            <span>{tab.label}</span>
            {!!tab.count && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white/20' : 'bg-white/[0.06]'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ROUNDS */}
      {activeTab === 'rounds' && (rounds.length > 0 ? (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 text-indigo-300" /><h3 className="text-sm font-semibold text-white">Typical rounds for this kind of role</h3></div>
          <p className="text-xs text-slate-400 mb-4">What each one usually tests, and how to prepare</p>
          <div className="space-y-2.5">
            {rounds.map((round, i) => {
              const isExp = expandedRound === i;
              return (
                <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedRound(isExp ? null : i)} className="w-full p-3.5 flex items-center gap-3 text-left cursor-pointer">
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-indigo-200 flex items-center justify-center font-semibold text-sm flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{round.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{ROUND_LABELS[round.type] ?? round.type}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                  </button>
                  {isExp && (
                    <div className="px-3.5 pb-3.5 border-t border-white/[0.05] pt-3">
                      {round.whatItTests && <p className="text-xs text-slate-300 leading-relaxed mb-3">{round.whatItTests}</p>}
                      {round.tips.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">How to prepare</p>
                          {round.tips.map((tip, j) => (
                            <div key={j} className="flex items-start gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" /><p className="text-xs text-slate-300">{tip}</p></div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : <NotAvailable message="No rounds to show" sub="Try again with a more specific role" />)}

      {/* QUESTIONS */}
      {activeTab === 'questions' && (questionThemes.length > 0 ? (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-indigo-300" /><h3 className="text-sm font-semibold text-white">Likely question themes</h3></div>
          <p className="text-xs text-slate-400 mb-4">{jobDescription ? 'Drawn from the job description' : 'Common for this kind of role'}, with an example of each</p>
          <div className="space-y-2.5">
            {questionThemes.map((q, i) => (
              <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-white">{q.theme}</p>
                  {q.round && <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400">{q.round}</span>}
                </div>
                {q.example && <p className="text-[13px] text-slate-300 mt-2 leading-relaxed">&ldquo;{q.example}&rdquo;</p>}
                {q.tip && (
                  <div className="mt-2 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-slate-400 leading-relaxed">{q.tip}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : <NotAvailable message="No question themes to show" />)}

      {/* FIT */}
      {activeTab === 'fit' && (hasFit && fit ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 px-1">Based only on what your resume and the job description say.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fit.strengths.length > 0 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-3"><CheckCircle2 className="w-3.5 h-3.5" /> Strengths for this job</p>
                <div className="space-y-2">{fit.strengths.map((s, i) => <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 flex-shrink-0" /><p className="text-xs text-slate-300">{s}</p></div>)}</div>
              </div>
            )}
            {fit.gaps.length > 0 && (
              <div className="glass-card p-4">
                <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-3"><AlertTriangle className="w-3.5 h-3.5" /> Not shown on your resume</p>
                <div className="space-y-2">{fit.gaps.map((g, i) => <div key={i} className="flex items-start gap-2"><div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" /><p className="text-xs text-slate-300">{g}</p></div>)}</div>
              </div>
            )}
          </div>

          {fit.prepPriorities.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4"><BookOpen className="w-4 h-4 text-indigo-300" /><h3 className="text-sm font-semibold text-white">Your prep priorities</h3></div>
              <div className="space-y-3">
                {fit.prepPriorities.map((p, i) => (
                  <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3.5">
                    <h4 className="text-sm font-semibold text-white mb-1">{p.area}</h4>
                    <p className="text-xs text-slate-400">{p.reason}</p>
                    {p.howToPrepare && <p className="text-xs text-slate-300 mt-2">{p.howToPrepare}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : <NotAvailable message="Fit analysis not available" sub="It needs the text of your resume" />)}
    </div>
  );
}
