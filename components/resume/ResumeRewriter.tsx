// components/resume/ResumeRewriter.tsx
'use client';

import React, { useState } from 'react';
import {
  Wand2, Copy, Check, Loader2, RefreshCw, Sparkles,
  AlertCircle, Target, Zap, Info, Brain, FileText, Award,
} from 'lucide-react';

interface MissingSkill {
  skill: string;
  [key: string]: unknown;
}

interface RewriteSuggestion {
  id: string;
  original: string;
  rewritten: string;
  improvements: string[];
  tone: 'professional' | 'creative' | 'technical' | 'executive';
  score: number;
  keywordsAdded?: string[];
  atsOptimizations?: string[];
  confidenceScore?: number;
  optimizationMode?: string;
}

interface ResumeRewriterProps {
  resumeId: string;
  userId: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  missingKeywords?: string[];
  missingSkills?: (string | MissingSkill)[];
}

type ToneType = 'professional' | 'creative' | 'technical' | 'executive';

export default function ResumeRewriter({
  resumeId,
  userId,
  jobTitle,
  companyName,
  jobDescription,
  missingKeywords = [],
  missingSkills = [],
}: ResumeRewriterProps) {
  const [selectedText,     setSelectedText]     = useState('');
  const [section,          setSection]          = useState('');
  const [suggestions,      setSuggestions]      = useState<RewriteSuggestion[]>([]);
  const [isAnalyzing,      setIsAnalyzing]      = useState(false);
  const [appliedSuggestions,setAppliedSuggestions]= useState<Set<string>>(new Set());
  const [tone,             setTone]             = useState<ToneType>('professional');
  const [errorMessage,     setErrorMessage]     = useState<string>('');
  const [useJobContext,     setUseJobContext]    = useState(true);
  const [optimizationMode, setOptimizationMode] = useState<string>('');

  const hasFullDescription = !!(jobDescription && jobDescription.trim().length > 50);
  const hasJobTitleOnly    = !!(jobTitle && !hasFullDescription);
  const hasNoContext       = !jobTitle && !jobDescription;

  const sections = [
    { value: 'summary',      label: 'Summary',      icon: '📝' },
    { value: 'experience',   label: 'Experience',   icon: '💼' },
    { value: 'skills',       label: 'Skills',       icon: '⚡' },
    { value: 'education',    label: 'Education',    icon: '🎓' },
    { value: 'achievements', label: 'Achievements', icon: '🏆' },
  ];

  const tones = [
    { value: 'professional' as ToneType, label: 'Professional', icon: '💼', desc: 'Corporate'  },
    { value: 'creative'     as ToneType, label: 'Creative',     icon: '🎨', desc: 'Unique'     },
    { value: 'technical'    as ToneType, label: 'Technical',    icon: '⚙️', desc: 'Detailed'   },
    { value: 'executive'    as ToneType, label: 'Executive',    icon: '👔', desc: 'Strategic'  },
  ];

  const handleRewrite = async () => {
    if (!selectedText.trim() || !section) {
      setErrorMessage('Please enter text and select a section');
      return;
    }
    setIsAnalyzing(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/resume/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId, userId, section,
          originalText: selectedText,
          tone,
          context: useJobContext && (jobTitle || jobDescription) ? {
            jobTitle, companyName, jobDescription, missingKeywords,
            missingSkills: missingSkills.map(s => typeof s === 'string' ? s : s.skill),
          } : undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }
      const data = await response.json();
      if (!data.suggestions || data.suggestions.length === 0) throw new Error('No suggestions generated');
      setSuggestions(data.suggestions);
      setOptimizationMode(data.optimizationMode || 'general');
      setErrorMessage('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate suggestions');
      setSuggestions([]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApply = async (suggestion: RewriteSuggestion) => {
    try {
      await navigator.clipboard.writeText(suggestion.rewritten);
      setAppliedSuggestions(prev => new Set([...prev, suggestion.id]));
      setTimeout(() => {
        setAppliedSuggestions(prev => {
          const s = new Set(prev); s.delete(suggestion.id); return s;
        });
      }, 3000);
    } catch {
      alert('Failed to copy. Please copy manually.');
    }
  };

  const getScoreColor = (score: number) =>
    score >= 90 ? 'text-emerald-400' : score >= 80 ? 'text-blue-400' : score >= 70 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="glass-card overflow-hidden">

      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-white/[0.06]"
           style={{ background: 'linear-gradient(135deg, #2d1b69 0%, #1e1b4b 50%, #1a1730 100%)' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">AI Resume Rewriter</h2>
              <p className="text-purple-200/70 text-xs mt-0.5">
                {hasFullDescription ? `Optimized for ${jobTitle || 'target role'}` :
                 hasJobTitleOnly    ? `Using AI knowledge about ${jobTitle}` :
                                      'General resume enhancement'}
              </p>
            </div>
          </div>

          {/* Mode badge */}
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            hasFullDescription ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
            hasJobTitleOnly    ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' :
                                 'bg-slate-500/15 border-slate-500/30 text-slate-300'
          }`}>
            {hasFullDescription ? <><Target className="w-3.5 h-3.5" /> Precision</> :
             hasJobTitleOnly    ? <><Brain className="w-3.5 h-3.5" /> AI Knowledge</> :
                                  <><FileText className="w-3.5 h-3.5" /> General</>}
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Mode banners ── */}
        {hasFullDescription && useJobContext && (
          <div className="p-4 bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-2">
                  Precision Mode Active
                  <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px]">95% accuracy</span>
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Using full job description for {jobTitle}{companyName && ` at ${companyName}`}.
                  AI will incorporate missing keywords and optimize for this specific role.
                </p>
                {missingKeywords.length > 0 && (
                  <div className="mt-3 p-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg">
                    <p className="text-[10px] font-semibold text-emerald-400 mb-2">Will naturally incorporate:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingKeywords.slice(0, 10).map((kw, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-md font-medium">{kw}</span>
                      ))}
                      {missingKeywords.length > 10 && (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-md font-medium">+{missingKeywords.length - 10} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {hasJobTitleOnly && useJobContext && (
          <div className="p-4 bg-blue-500/[0.05] border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-400 mb-1 flex items-center gap-2">
                  AI Knowledge Mode Active
                  <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-[10px]">88% accuracy</span>
                </p>
                <p className="text-xs text-slate-400 leading-relaxed mb-2">
                  Using AI knowledge base about {jobTitle}{companyName && ` at ${companyName}`}.
                  AI will research typical requirements and incorporate relevant skills.
                </p>
                <div className="p-2.5 bg-blue-500/[0.06] border border-blue-500/15 rounded-lg space-y-1">
                  {[
                    `Common technical skills for ${jobTitle}`,
                    'Industry-standard technologies',
                    'Typical role requirements',
                    ...(companyName ? [`${companyName}'s known tech stack & culture`] : []),
                  ].map((item, i) => (
                    <p key={i} className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span className="text-blue-400">•</span>{item}
                    </p>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  Tip: for 95% accuracy, paste the full job description during upload.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasNoContext && (
          <div className="p-4 bg-amber-500/[0.05] border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-amber-500/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-1">General Enhancement Mode</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  No job information available. AI will provide general improvements with strong action verbs and metrics.
                </p>
                <p className="text-[10px] text-slate-500 mt-2">
                  Upload your resume with a job title and description for role-specific optimization.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {errorMessage && (
          <div className="p-4 bg-red-500/[0.05] border border-red-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-400 mb-1">Error</p>
                <p className="text-xs text-slate-400">{errorMessage}</p>
                <button onClick={() => setErrorMessage('')}
                  className="text-xs text-red-400 hover:text-red-300 mt-1.5 cursor-pointer transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Section selection ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Section</p>
          <div className="grid grid-cols-5 gap-2">
            {sections.map(s => (
              <button key={s.value} onClick={() => setSection(s.value)}
                className={`py-3 px-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  section === s.value
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-800/50 border border-white/[0.06] text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}>
                <span className="text-lg">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tone selection ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Writing Tone</p>
          <div className="grid grid-cols-4 gap-2">
            {tones.map(t => (
              <button key={t.value} onClick={() => setTone(t.value)}
                className={`py-3 px-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  tone === t.value
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-800/50 border border-white/[0.06] text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}>
                <span className="text-base">{t.icon}</span>
                <span className="font-semibold">{t.label}</span>
                <span className="text-[10px] opacity-70">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Text input ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Original Text</p>
          <textarea
            value={selectedText}
            onChange={e => setSelectedText(e.target.value)}
            placeholder={
              hasFullDescription ? `Paste your ${section || 'resume'} text. AI will optimize it for ${jobTitle || 'the role'}…` :
              hasJobTitleOnly    ? `Paste your ${section || 'resume'} text. AI will enhance it for ${jobTitle} roles…` :
                                   'Paste your resume text here for AI enhancement…'
            }
            rows={7}
            className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-sm text-white
                       placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/30
                       resize-none outline-none transition-colors"
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-slate-600">{selectedText.length} characters</p>
            {selectedText.length > 0 && selectedText.length < 50 && (
              <p className="text-[10px] text-amber-500">50+ chars recommended for better results</p>
            )}
          </div>
        </div>

        {/* ── Job context toggle ── */}
        {(jobTitle || jobDescription) && (
          <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-white/[0.06] rounded-xl">
            <label htmlFor="use-job-context" className="flex items-center gap-2.5 cursor-pointer">
              <input
                id="use-job-context"
                type="checkbox"
                checked={useJobContext}
                onChange={e => setUseJobContext(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-300">
                {hasFullDescription ? 'Use job description for optimization' :
                 hasJobTitleOnly    ? 'Use AI knowledge about this role' :
                                      'Enable smart optimization'}
              </span>
            </label>
            <span className="text-[10px] text-slate-500">{useJobContext ? 'Recommended ✓' : 'Disabled'}</span>
          </div>
        )}

        {/* ── Rewrite button ── */}
        <button
          onClick={handleRewrite}
          disabled={!selectedText.trim() || !section || isAnalyzing || selectedText.length < 20}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            !selectedText.trim() || !section || isAnalyzing || selectedText.length < 20
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 hover:-translate-y-0.5'
          }`}>
          {isAnalyzing ? (
            <><Loader2 className="w-4 h-4 animate-spin" />
              {hasFullDescription && useJobContext ? 'Optimizing for role…' :
               hasJobTitleOnly    && useJobContext ? 'Researching & optimizing…' :
                                                    'Generating suggestions…'}</>
          ) : (
            <><Sparkles className="w-4 h-4" />
              {hasFullDescription && useJobContext ? 'Rewrite for This Job' :
               hasJobTitleOnly    && useJobContext ? 'Rewrite with AI Research' :
                                                    'Rewrite with AI'}</>
          )}
        </button>

        {/* ── Suggestions ── */}
        {suggestions.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">AI Suggestions ({suggestions.length})</h3>
                {optimizationMode && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {optimizationMode === 'job-description' && '🎯 Tailored for job description'}
                    {optimizationMode === 'ai-knowledge'    && '🔬 Based on AI research'}
                    {optimizationMode === 'general'         && '📝 General enhancements'}
                  </p>
                )}
              </div>
              <button onClick={handleRewrite} disabled={isAnalyzing}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 disabled:opacity-40 cursor-pointer transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </button>
            </div>

            {suggestions.map(suggestion => (
              <div key={suggestion.id}
                className="bg-slate-800/40 border border-white/[0.06] rounded-xl overflow-hidden">

                {/* Suggestion header */}
                <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-700/60 border border-white/[0.06] text-slate-300">
                      {suggestion.tone.toUpperCase()}
                    </span>
                    {suggestion.optimizationMode === 'job-description' && (
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                        <Target className="w-3 h-3" /> Job-Optimized
                      </span>
                    )}
                    {suggestion.optimizationMode === 'ai-knowledge' && (
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center gap-1">
                        <Brain className="w-3 h-3" /> AI-Researched
                      </span>
                    )}
                    {suggestion.confidenceScore && (
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        {suggestion.confidenceScore}% Confidence
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs text-slate-500">Quality:</span>
                    <span className={`text-base font-bold ${getScoreColor(suggestion.score)}`}>{suggestion.score}%</span>
                  </div>
                </div>

                {/* Rewritten text */}
                <div className="mx-4 mb-3 p-4 bg-slate-900/60 border border-white/[0.06] rounded-xl">
                  <p className="text-sm text-white leading-relaxed font-medium">{suggestion.rewritten}</p>
                </div>

                {/* Keywords added */}
                {suggestion.keywordsAdded && suggestion.keywordsAdded.length > 0 && (
                  <div className="mx-4 mb-3 p-3 bg-emerald-500/[0.05] border border-emerald-500/15 rounded-xl">
                    <p className="text-[10px] font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Keywords Added {suggestion.optimizationMode === 'ai-knowledge' ? '(AI Research)' : '(From Job Description)'}:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.keywordsAdded.map((kw, i) => (
                        <span key={i} className="text-[10px] px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-lg font-medium">
                          + {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ATS optimizations */}
                {suggestion.atsOptimizations && suggestion.atsOptimizations.length > 0 && (
                  <div className="mx-4 mb-3 p-3 bg-blue-500/[0.05] border border-blue-500/15 rounded-xl">
                    <p className="text-[10px] font-semibold text-blue-400 mb-2 flex items-center gap-1">
                      <Target className="w-3 h-3" /> ATS Optimizations Applied:
                    </p>
                    <div className="space-y-1">
                      {suggestion.atsOptimizations.map((opt, i) => (
                        <p key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                          <span className="text-blue-400 flex-shrink-0">•</span>{opt}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improvements */}
                <div className="mx-4 mb-3">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Improvements:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.improvements.map((imp, i) => (
                      <span key={i} className="text-[10px] px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg">
                        ✓ {imp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Copy button */}
                <div className="px-4 pb-4">
                  <button onClick={() => handleApply(suggestion)}
                    className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      appliedSuggestions.has(suggestion.id)
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md'
                    }`}>
                    {appliedSuggestions.has(suggestion.id)
                      ? <><Check className="w-4 h-4" /> Copied to Clipboard!</>
                      : <><Copy className="w-4 h-4" /> Copy &amp; Apply This Version</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {suggestions.length === 0 && !isAnalyzing && !errorMessage && (
          <div className="text-center py-10 bg-slate-800/30 border border-white/[0.04] rounded-xl">
            <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Ready to Transform Your Content</h3>
            <p className="text-slate-400 text-sm mb-4 max-w-sm mx-auto leading-relaxed">
              {hasFullDescription
                ? `AI will tailor your text specifically for ${jobTitle || 'your target role'} using the job description`
                : hasJobTitleOnly
                ? `AI will use its knowledge base to optimize for ${jobTitle}${companyName ? ` at ${companyName}` : ''}`
                : 'Enter your resume text above to get AI-powered enhancements'}
            </p>
            {(hasFullDescription || hasJobTitleOnly) && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-medium text-purple-300">
                  {hasFullDescription ? 'Highest accuracy mode ready' : 'AI research mode ready'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}