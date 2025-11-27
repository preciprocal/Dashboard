// components/resume/RecruiterEyeSimulation.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Eye, Clock, TrendingUp, AlertTriangle, CheckCircle2, Zap, Info, Loader2, Brain, Users } from 'lucide-react';

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
  jobDescription
}: RecruiterEyeSimulationProps) {
  const [simulationData, setSimulationData] = useState<RecruiterSimulationData | null>(preloadedData || null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showHeatmap] = useState(true);
  const [autoSimulated, setAutoSimulated] = useState(!!preloadedData);
  const [selectedPerspective, setSelectedPerspective] = useState<number>(0);

  const hasJobDescription = !!(jobDescription && jobDescription.trim().length > 50);
  const hasJobTitleOnly = !!(jobTitle && !hasJobDescription);

  const runSimulation = useCallback(async () => {
    setIsSimulating(true);
    try {
      console.log('👁️ Running recruiter simulation...');
      console.log('   Mode:', hasJobDescription ? 'Company Research' : hasJobTitleOnly ? 'Role-Specific' : 'Multi-Perspective');
      
      const response = await fetch('/api/resume/recruiter-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeId,
          jobTitle,
          companyName,
          jobDescription 
        }),
      });

      if (!response.ok) throw new Error('Simulation failed');

      const data = await response.json();
      setSimulationData(data.simulation);
      console.log('✅ Recruiter simulation completed');
      console.log('   Mode:', data.simulation.simulationMode);
    } catch (error) {
      console.error('Simulation error:', error);
      if (!autoSimulated) {
        alert('Failed to run simulation. Please try again.');
      }
    } finally {
      setIsSimulating(false);
    }
  }, [resumeId, jobTitle, companyName, jobDescription, hasJobDescription, hasJobTitleOnly, autoSimulated]);

  useEffect(() => {
    if (!autoSimulated && !preloadedData && resumeId) {
      console.log('🤖 Auto-running intelligent recruiter simulation');
      runSimulation();
      setAutoSimulated(true);
    } else if (preloadedData) {
      console.log('✅ Using pre-loaded recruiter simulation data');
      setSimulationData(preloadedData);
    }
  }, [resumeId, autoSimulated, preloadedData, runSimulation]);

  const getAttentionColor = (score: number): string => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Mode Indicator Banner */}
      {!isSimulating && simulationData && (
        <div className={`rounded-xl p-4 border ${
          simulationData.simulationMode === 'company-research' 
            ? 'bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800'
            : simulationData.simulationMode === 'role-specific'
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'
            : 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex items-start gap-3">
            {simulationData.simulationMode === 'company-research' ? (
              <>
                <Brain className="w-6 h-6 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-1 flex items-center gap-2">
                    🔬 Company Research Mode
                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded-full">AI-Enhanced</span>
                  </h4>
                  <p className="text-sm text-purple-800 dark:text-purple-300">
                    AI studied {companyName}&apos;s hiring practices and typical requirements for {jobTitle} roles. 
                    Simulation based on company culture, interview process, and role expectations.
                  </p>
                  {simulationData.researchInsights && simulationData.researchInsights.length > 0 && (
                    <div className="mt-3 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2">Research Insights:</p>
                      <ul className="space-y-1">
                        {simulationData.researchInsights.slice(0, 3).map((insight, idx) => (
                          <li key={idx} className="text-xs text-purple-800 dark:text-purple-300">• {insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : simulationData.simulationMode === 'role-specific' ? (
              <>
                <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1 flex items-center gap-2">
                    🎯 Role-Specific Simulation
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">AI Knowledge</span>
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    AI used its knowledge of {jobTitle} hiring to simulate how recruiters for this role would evaluate your resume.
                    {companyName && ` Analysis includes ${companyName}&apos;s known hiring preferences.`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Users className="w-6 h-6 text-slate-600 dark:text-slate-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-200 mb-1">
                    👥 Multi-Perspective Analysis
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-400">
                    Viewing your resume from three different recruiter perspectives: HR Recruiter, Technical Lead, and Hiring Manager.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isSimulating && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4">
            <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {hasJobDescription ? 'Researching Company Practices...' :
             hasJobTitleOnly ? 'Analyzing Role Requirements...' :
             'Running Multi-Perspective Analysis...'}
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Simulating recruiter perspectives
          </p>
        </div>
      )}

      {/* Results Display */}
      {!isSimulating && simulationData && (
        <>
          {/* Multi-Perspective Tabs */}
          {simulationData.perspectives && simulationData.perspectives.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700">
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1.5 m-4 rounded-xl">
                  {simulationData.perspectives.map((perspective, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPerspective(idx)}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        selectedPerspective === idx
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{perspective.icon}</span>
                      {perspective.role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Perspective Content */}
              {simulationData.perspectives[selectedPerspective] && (
                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-2xl">{simulationData.perspectives[selectedPerspective].icon}</span>
                        {simulationData.perspectives[selectedPerspective].role}&apos;s View
                      </h3>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                          {simulationData.perspectives[selectedPerspective].firstImpression.score}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Initial Score</div>
                      </div>
                    </div>
                    
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
                      simulationData.perspectives[selectedPerspective].decision.toLowerCase().includes('pass') ||
                      simulationData.perspectives[selectedPerspective].decision.toLowerCase().includes('advance')
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : simulationData.perspectives[selectedPerspective].decision.toLowerCase().includes('maybe')
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {simulationData.perspectives[selectedPerspective].decision}
                    </div>
                  </div>

                  {/* Key Observations */}
                  <div className="mb-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                    <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      What Stands Out
                    </h4>
                    <ul className="space-y-2">
                      {simulationData.perspectives[selectedPerspective].keyObservations.map((obs, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                          <span className="text-emerald-600">•</span>
                          {obs}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Concerns */}
                  {simulationData.perspectives[selectedPerspective].concerns.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Concerns Raised
                      </h4>
                      <ul className="space-y-2">
                        {simulationData.perspectives[selectedPerspective].concerns.map((concern, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                            <span className="text-amber-600">•</span>
                            {concern}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* First Impression (Standard View) */}
          {!simulationData.perspectives && (
            <div className={`rounded-xl p-6 ${
              simulationData.passScreening 
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {simulationData.passScreening ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      First Impression
                    </h3>
                    <p className={`text-sm ${simulationData.passScreening ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                      {simulationData.passScreening ? 'Likely to Pass Initial Screening ✅' : 'May Not Pass Initial Screening ⚠️'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">
                    {simulationData.firstImpression.score}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Score</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg p-3">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Total Review Time</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {simulationData.timeToReview} seconds
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg p-3">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">First Glance</p>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {simulationData.firstImpression.timeSpentInSeconds} seconds
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Standout Elements */}
          {simulationData.firstImpression?.standoutElements && simulationData.firstImpression.standoutElements.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
              <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Elements That Stand Out
              </h4>
              <div className="space-y-2">
                {simulationData.firstImpression.standoutElements.map((element, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-emerald-600 rounded-full mt-2" />
                    <span className="text-sm text-emerald-800 dark:text-emerald-300">{element}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concerning Elements */}
          {simulationData.firstImpression?.concerningElements && simulationData.firstImpression.concerningElements.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Elements That Raise Concerns
              </h4>
              <div className="space-y-2">
                {simulationData.firstImpression.concerningElements.map((element, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-amber-600 rounded-full mt-2" />
                    <span className="text-sm text-amber-800 dark:text-amber-300">{element}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Eye Tracking Heatmap */}
          {showHeatmap && simulationData.eyeTrackingHeatmap && simulationData.eyeTrackingHeatmap.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Attention Heatmap by Section
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Low</span>
                  <div className="flex gap-1">
                    <div className="w-4 h-4 bg-red-500 opacity-30 rounded" />
                    <div className="w-4 h-4 bg-amber-500 opacity-50 rounded" />
                    <div className="w-4 h-4 bg-emerald-500 opacity-70 rounded" />
                  </div>
                  <span className="text-slate-600 dark:text-slate-400">High</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="space-y-3">
                  {simulationData.eyeTrackingHeatmap.map((point, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-semibold text-slate-900 dark:text-white">
                          {point.section}
                        </h5>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-slate-600 dark:text-slate-400">Time Spent</p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {point.timeSpent}s
                            </p>
                          </div>
                          <div className={`w-3 h-8 rounded-full ${getAttentionColor(point.attentionScore)}`} />
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{point.notes}</p>
                      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getAttentionColor(point.attentionScore)} transition-all duration-500`}
                          style={{ width: `${point.attentionScore}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Screener Notes */}
          {simulationData.screenerNotes && simulationData.screenerNotes.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                <Info className="w-5 h-5" />
                {simulationData.perspectives ? 'Overall Assessment' : 'Recruiter&apos;s Internal Notes'}
              </h4>
              <ul className="space-y-2">
                {simulationData.screenerNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span className="text-sm text-blue-800 dark:text-blue-300">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-run Button */}
          <button
            onClick={runSimulation}
            disabled={isSimulating}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            <Zap className="w-5 h-5" />
            {isSimulating ? 'Running...' : 'Re-run Simulation'}
          </button>
        </>
      )}

      {/* Initial Loading */}
      {!isSimulating && !simulationData && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4">
            <Eye className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Preparing Simulation...
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Loading recruiter perspective analysis
          </p>
        </div>
      )}
    </div>
  );
}