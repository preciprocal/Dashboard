// components/resume/RecruiterEyeSimulation.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye, Clock, TrendingUp, AlertTriangle, CheckCircle2,
   Info, Loader2, Brain, Users, RefreshCw,
} from 'lucide-react';

interface HeatmapPoint {
  section: string;
  attentionScore: number;
  timeSpent: number;
  notes: string;
}

interface FirstImpression {
  score: number;
  standoutElements: string[];
  concerningElements: string[];
  timeSpentInSeconds: number;
}

interface RecruiterPerspective {
  role: string;
  icon: string;
  firstImpression: FirstImpression;
  decision: string;
  keyObservations: string[];
  concerns: string[];
}

interface RecruiterSimulationData {
  firstImpression: FirstImpression;
  timeToReview: number;
  eyeTrackingHeatmap: HeatmapPoint[];
  passScreening: boolean;
  screenerNotes: string[];
  perspectives?: RecruiterPerspective[];
  simulationMode?: 'multi-perspective' | 'role-specific' | 'company-research';
  researchInsights?: string[];
}

interface RecruiterEyeSimulationProps {
  resumeId: string;
  imageUrl?: string;
  preloadedData?: RecruiterSimulationData;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
}

export default function RecruiterEyeSimulation({
  resumeId,
  preloadedData,
  jobTitle,
  companyName,
  jobDescription,
}: RecruiterEyeSimulationProps) {
  const [simulationData,      setSimulationData]      = useState<RecruiterSimulationData | null>(preloadedData || null);
  const [isSimulating,        setIsSimulating]        = useState(false);
  const [showHeatmap]                                 = useState(true);
  const [autoSimulated,       setAutoSimulated]       = useState(!!preloadedData);
  const [selectedPerspective, setSelectedPerspective] = useState<number>(0);

  const hasJobDescription = !!(jobDescription && jobDescription.trim().length > 50);
  const hasJobTitleOnly   = !!(jobTitle && !hasJobDescription);

  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    try {
      const { auth } = await import('@/firebase/client');
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/resume/recruiter-simulation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeId, jobTitle, companyName, jobDescription }),
      });
      if (!response.ok) throw new Error('Simulation failed');
      const data = await response.json();
      setSimulationData(data.simulation);
    } catch (error) {
      console.error('Simulation error:', error);
      if (!autoSimulated) alert('Failed to run simulation. Please try again.');
    } finally {
      setIsSimulating(false);
    }
  }, [resumeId, jobTitle, companyName, jobDescription, hasJobDescription, hasJobTitleOnly, autoSimulated]);

  useEffect(() => {
    if (!autoSimulated && !preloadedData && resumeId) {
      runSimulation();
      setAutoSimulated(true);
    } else if (preloadedData) {
      setSimulationData(preloadedData);
    }
  }, [resumeId, autoSimulated, preloadedData, runSimulation]);

  const getAttentionColor = (score: number) =>
    score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const getAttentionText = (score: number) =>
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';

  if (isSimulating) {
    return (
      <div className="glass-card p-10 text-center">
        <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          {hasJobDescription ? 'Researching company practices…' :
           hasJobTitleOnly   ? 'Analysing role requirements…' :
                               'Running multi-perspective analysis…'}
        </h3>
        <p className="text-slate-400 text-sm">Simulating recruiter perspectives</p>
      </div>
    );
  }

  if (!simulationData) {
    return (
      <div className="glass-card p-10 text-center">
        <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Eye className="w-6 h-6 text-indigo-400" />
        </div>
        <p className="text-white font-semibold mb-1">Preparing simulation…</p>
        <p className="text-slate-400 text-sm">Loading recruiter perspective analysis</p>
      </div>
    );
  }

  const sim = simulationData;

  return (
    <div className="space-y-4">

      {/* ── Mode banner ── */}
      <div className={`glass-card p-4 border ${
        sim.simulationMode === 'company-research' ? 'border-purple-500/20 bg-purple-500/[0.03]' :
        sim.simulationMode === 'role-specific'    ? 'border-blue-500/20 bg-blue-500/[0.03]' :
                                                    'border-white/[0.06]'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            sim.simulationMode === 'company-research' ? 'bg-purple-500/15' :
            sim.simulationMode === 'role-specific'    ? 'bg-blue-500/15' :
                                                        'bg-slate-700/50'
          }`}>
            {sim.simulationMode === 'multi-perspective'
              ? <Users className="w-4 h-4 text-slate-400" />
              : <Brain className={`w-4 h-4 ${sim.simulationMode === 'company-research' ? 'text-purple-400' : 'text-blue-400'}`} />}
          </div>
          <div>
            <p className={`text-xs font-semibold mb-1 ${
              sim.simulationMode === 'company-research' ? 'text-purple-400' :
              sim.simulationMode === 'role-specific'    ? 'text-blue-400' :
                                                          'text-slate-300'
            }`}>
              {sim.simulationMode === 'company-research' ? 'Company Research Mode' :
               sim.simulationMode === 'role-specific'    ? 'Role-Specific Simulation' :
                                                           'Multi-Perspective Analysis'}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {sim.simulationMode === 'company-research'
                ? `AI studied ${companyName ?? 'the company'}'s hiring practices and requirements for ${jobTitle ?? 'this'} roles.`
                : sim.simulationMode === 'role-specific'
                ? `AI used its knowledge of ${jobTitle} hiring to simulate recruiter evaluation.`
                : 'Viewing your resume from three perspectives: HR Recruiter, Technical Lead, and Hiring Manager.'}
            </p>
            {sim.researchInsights && sim.researchInsights.length > 0 && (
              <div className="mt-2.5 space-y-1">
                {sim.researchInsights.slice(0, 3).map((insight, i) => (
                  <p key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                    <span className="text-purple-400 flex-shrink-0">•</span>{insight}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Multi-perspective tabs ── */}
      {sim.perspectives && sim.perspectives.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex gap-1.5 p-3 border-b border-white/[0.06]">
            {sim.perspectives.map((p, idx) => (
              <button key={idx} onClick={() => setSelectedPerspective(idx)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedPerspective === idx
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}>
                <span>{p.icon}</span>
                <span className="hidden sm:inline">{p.role}</span>
              </button>
            ))}
          </div>

          {sim.perspectives[selectedPerspective] && (() => {
            const p      = sim.perspectives![selectedPerspective];
            const isPass = /pass|advance/i.test(p.decision);
            const isMaybe= /maybe/i.test(p.decision);
            return (
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-2">
                      <span>{p.icon}</span>{p.role}&apos;s View
                    </h3>
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${
                      isPass  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      isMaybe ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>{p.decision}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-bold text-white">{p.firstImpression.score}</div>
                    <div className="text-[10px] text-slate-500">Initial score</div>
                  </div>
                </div>

                {p.keyObservations.length > 0 && (
                  <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> What stands out
                    </p>
                    <ul className="space-y-1.5">
                      {p.keyObservations.map((obs, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-emerald-400 flex-shrink-0 mt-0.5">•</span>{obs}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {p.concerns.length > 0 && (
                  <div className="bg-amber-500/[0.05] border border-amber-500/20 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-2.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Concerns raised
                    </p>
                    <ul className="space-y-1.5">
                      {p.concerns.map((c, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <span className="text-amber-400 flex-shrink-0 mt-0.5">•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Standard first impression ── */}
      {!sim.perspectives && (
        <div className={`glass-card p-5 border ${
          sim.passScreening
            ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
            : 'border-red-500/20 bg-red-500/[0.03]'
        }`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sim.passScreening ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                {sim.passScreening
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  : <AlertTriangle className="w-5 h-5 text-red-400" />}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">First Impression</h3>
                <p className={`text-xs mt-0.5 ${sim.passScreening ? 'text-emerald-400' : 'text-red-400'}`}>
                  {sim.passScreening ? 'Likely to pass initial screening' : 'May not pass initial screening'}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold text-white">{sim.firstImpression.score}</div>
              <div className="text-[10px] text-slate-500">Score</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-3 flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Total review time</p>
                <p className="text-sm font-semibold text-white">{sim.timeToReview}s</p>
              </div>
            </div>
            <div className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-3 flex items-center gap-2.5">
              <Eye className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">First glance</p>
                <p className="text-sm font-semibold text-white">{sim.firstImpression.timeSpentInSeconds}s</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Standout elements ── */}
      {sim.firstImpression?.standoutElements?.length > 0 && (
        <div className="glass-card p-5 border border-emerald-500/15 bg-emerald-500/[0.03]">
          <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" /> Elements that stand out
          </p>
          <div className="space-y-2">
            {sim.firstImpression.standoutElements.map((el, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-slate-300 leading-relaxed">{el}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Concerning elements ── */}
      {sim.firstImpression?.concerningElements?.length > 0 && (
        <div className="glass-card p-5 border border-amber-500/15 bg-amber-500/[0.03]">
          <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" /> Elements that raise concerns
          </p>
          <div className="space-y-2">
            {sim.firstImpression.concerningElements.map((el, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-xs text-slate-300 leading-relaxed">{el}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Eye tracking heatmap ── */}
      {showHeatmap && sim.eyeTrackingHeatmap?.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Attention Heatmap</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">Time spent per section</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                <div className="w-3 h-3 bg-red-500/40 rounded" />
                <div className="w-3 h-3 bg-amber-500/60 rounded" />
                <div className="w-3 h-3 bg-emerald-500/80 rounded" />
              </div>
              <span>High</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {sim.eyeTrackingHeatmap.map((pt, i) => (
              <div key={i} className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{pt.section}</span>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Time</p>
                      <p className="text-xs font-semibold text-white">{pt.timeSpent}s</p>
                    </div>
                    <div className={`w-2.5 h-8 rounded-full ${getAttentionColor(pt.attentionScore)}`} />
                  </div>
                </div>
                <p className={`text-[11px] mb-2 ${getAttentionText(pt.attentionScore)}`}>{pt.notes}</p>
                <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div className={`h-full ${getAttentionColor(pt.attentionScore)} rounded-full transition-all duration-500`}
                    style={{ width: `${pt.attentionScore}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Screener notes ── */}
      {sim.screenerNotes?.length > 0 && (
        <div className="glass-card p-5 border border-blue-500/15 bg-blue-500/[0.03]">
          <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5 mb-3">
            <Info className="w-3.5 h-3.5" />
            {sim.perspectives ? 'Overall assessment' : "Recruiter's internal notes"}
          </p>
          <ul className="space-y-2">
            {sim.screenerNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
                <p className="text-xs text-slate-300 leading-relaxed">{note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Re-run ── */}
      <button onClick={runSimulation} disabled={isSimulating}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2
                   bg-gradient-to-r from-indigo-600 to-purple-600
                   hover:from-indigo-500 hover:to-purple-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all shadow-lg shadow-indigo-500/20 cursor-pointer">
        {isSimulating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
          : <><RefreshCw className="w-4 h-4" /> Re-run Simulation</>}
      </button>
    </div>
  );
}