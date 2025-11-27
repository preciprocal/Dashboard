// components/resume/ResumeRewriter.tsx
'use client';

import React, { useState } from 'react';
import { Wand2, Copy, Check, Loader2, RefreshCw, Sparkles, AlertCircle, Target, Zap, Info, Brain, FileText, Award } from 'lucide-react';

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
  missingSkills?: any[];
}

export default function ResumeRewriter({ 
  resumeId, 
  userId,
  jobTitle,
  companyName,
  jobDescription,
  missingKeywords = [],
  missingSkills = []
}: ResumeRewriterProps) {
  const [selectedText, setSelectedText] = useState('');
  const [section, setSection] = useState('');
  const [suggestions, setSuggestions] = useState<RewriteSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [tone, setTone] = useState<'professional' | 'creative' | 'technical' | 'executive'>('professional');
  const [error, setError] = useState<string>('');
  const [useJobContext, setUseJobContext] = useState(true);
  const [optimizationMode, setOptimizationMode] = useState<string>('');
  const [modeDescription, setModeDescription] = useState<string>('');

  // Determine mode
  const hasFullDescription = !!(jobDescription && jobDescription.trim().length > 50);
  const hasJobTitleOnly = !!(jobTitle && !hasFullDescription);
  const hasNoContext = !jobTitle && !jobDescription;

  const sections = [
    { value: 'summary', label: 'Summary', icon: '📝' },
    { value: 'experience', label: 'Experience', icon: '💼' },
    { value: 'skills', label: 'Skills', icon: '⚡' },
    { value: 'education', label: 'Education', icon: '🎓' },
    { value: 'achievements', label: 'Achievements', icon: '🏆' },
  ];

  const tones = [
    { value: 'professional', label: 'Professional', icon: '💼', desc: 'Corporate' },
    { value: 'creative', label: 'Creative', icon: '🎨', desc: 'Unique' },
    { value: 'technical', label: 'Technical', icon: '⚙️', desc: 'Detailed' },
    { value: 'executive', label: 'Executive', icon: '👔', desc: 'Strategic' },
  ];

  const handleRewrite = async () => {
    if (!selectedText.trim() || !section) {
      setError('Please enter text and select a section');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    
    try {
      console.log('🔄 Starting intelligent rewrite...');
      console.log('   Mode Detection:');
      console.log('     - Full Description:', hasFullDescription);
      console.log('     - Job Title Only:', hasJobTitleOnly);
      console.log('     - No Context:', hasNoContext);

      const response = await fetch('/api/resume/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          userId,
          section,
          originalText: selectedText,
          tone,
          context: useJobContext && (jobTitle || jobDescription) ? {
            jobTitle,
            companyName,
            jobDescription,
            missingKeywords,
            missingSkills: missingSkills.map(s => typeof s === 'string' ? s : s.skill)
          } : undefined,
        }),
      });

      console.log('   Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('   API Error:', errorData);
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('   ✅ Success!');
      console.log('   Suggestions:', data.suggestions?.length);
      console.log('   Mode:', data.optimizationMode);
      console.log('   Confidence:', data.confidenceLevel);

      if (!data.suggestions || data.suggestions.length === 0) {
        throw new Error('No suggestions generated');
      }

      setSuggestions(data.suggestions);
      setOptimizationMode(data.optimizationMode || 'general');
      setModeDescription(data.modeDescription || 'General optimization');
      setError('');
    } catch (error: any) {
      console.error('❌ Error:', error);
      setError(error.message || 'Failed to generate suggestions');
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
          const newSet = new Set(prev);
          newSet.delete(suggestion.id);
          return newSet;
        });
      }, 3000);
    } catch (error) {
      alert('Failed to copy. Please copy manually.');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 80) return 'text-blue-600 dark:text-blue-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header with Mode Indicator */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">AI Resume Rewriter</h2>
              <p className="text-purple-100 text-sm">
                {hasFullDescription ? `Optimized for ${jobTitle || 'target role'}` :
                 hasJobTitleOnly ? `Using AI knowledge about ${jobTitle}` :
                 'General resume enhancement'}
              </p>
            </div>
          </div>
          
          {/* Mode Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
            hasFullDescription ? 'bg-emerald-500/20 border border-emerald-300' :
            hasJobTitleOnly ? 'bg-blue-500/20 border border-blue-300' :
            'bg-slate-500/20 border border-slate-300'
          }`}>
            {hasFullDescription ? (
              <>
                <Target className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">Precision Mode</span>
              </>
            ) : hasJobTitleOnly ? (
              <>
                <Brain className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">AI Knowledge</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">General</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Mode Explanation Banner */}
        {hasFullDescription && useJobContext && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-200 mb-2 flex items-center gap-2">
                  🎯 Precision Mode Active
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">95% Accuracy</span>
                </h4>
                <p className="text-sm text-emerald-800 dark:text-emerald-300 mb-3">
                  Using <strong>full job description</strong> for {jobTitle}
                  {companyName && ` at ${companyName}`}. AI will incorporate missing keywords and optimize for this specific role.
                </p>
                
                {missingKeywords.length > 0 && (
                  <div className="mt-3 p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                      Will naturally incorporate:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {missingKeywords.slice(0, 10).map((keyword, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-white dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-full font-medium">
                          {keyword}
                        </span>
                      ))}
                      {missingKeywords.length > 10 && (
                        <span className="text-xs px-2 py-1 bg-white dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-full font-medium">
                          +{missingKeywords.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {hasJobTitleOnly && useJobContext && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                  🔬 AI Knowledge Mode Active
                  <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">88% Accuracy</span>
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                  Using <strong>AI's knowledge base</strong> about {jobTitle}
                  {companyName && ` at ${companyName}`}. AI will research typical requirements and incorporate relevant skills for this role.
                </p>
                
                <div className="mt-3 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                    AI will research and add:
                  </p>
                  <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                    <li>• Common technical skills for {jobTitle}</li>
                    <li>• Industry-standard technologies</li>
                    <li>• Typical role requirements</li>
                    {companyName && <li>• {companyName}'s known tech stack & culture</li>}
                  </ul>
                </div>
                
                <div className="mt-3 p-2 bg-blue-200/50 dark:bg-blue-800/30 rounded-lg">
                  <p className="text-xs text-blue-900 dark:text-blue-200">
                    💡 <strong>Tip:</strong> For highest accuracy (95%), paste the full job description during upload!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasNoContext && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                  📝 General Enhancement Mode
                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-full">85% Accuracy</span>
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-300 mb-3">
                  No job information available. AI will provide general improvements with strong action verbs and metrics.
                </p>
                <div className="mt-3 p-2 bg-amber-200/50 dark:bg-amber-800/30 rounded-lg">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    💡 <strong>Get better results:</strong> Upload your resume with job title and description for role-specific optimization!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg animate-shake">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">Error</h3>
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                <button
                  onClick={() => setError('')}
                  className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Select Section to Rewrite
          </label>
          <div className="grid grid-cols-5 gap-3">
            {sections.map((s) => (
              <button
                key={s.value}
                onClick={() => setSection(s.value)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  section === s.value
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-105'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl">{s.icon}</span>
                  <span className="text-xs">{s.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tone Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Writing Tone
          </label>
          <div className="grid grid-cols-4 gap-3">
            {tones.map((t) => (
              <button
                key={t.value}
                onClick={() => setTone(t.value as any)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  tone === t.value
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="text-xs opacity-75">{t.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Your Original Text
          </label>
          <textarea
            value={selectedText}
            onChange={(e) => setSelectedText(e.target.value)}
            placeholder={
              hasFullDescription ? `Paste your ${section || 'resume'} text. AI will optimize it specifically for ${jobTitle || 'the role'} by adding missing keywords...` :
              hasJobTitleOnly ? `Paste your ${section || 'resume'} text. AI will enhance it based on typical ${jobTitle} requirements...` :
              "Paste your resume text here for AI enhancement..."
            }
            rows={7}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-slate-900 dark:text-white placeholder-slate-400"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedText.length} characters
            </p>
            {selectedText.length > 0 && selectedText.length < 50 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Add more text for better results (50+ chars recommended)
              </p>
            )}
          </div>
        </div>

        {/* Job Context Toggle */}
        {(jobTitle || jobDescription) && (
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use-job-context"
                checked={useJobContext}
                onChange={(e) => setUseJobContext(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
              />
              <label htmlFor="use-job-context" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {hasFullDescription ? 'Use job description for optimization' :
                 hasJobTitleOnly ? 'Use AI knowledge about this role' :
                 'Enable smart optimization'}
              </label>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {useJobContext ? 'Recommended ✓' : 'Disabled'}
            </span>
          </div>
        )}

        {/* Rewrite Button */}
        <button
          onClick={handleRewrite}
          disabled={!selectedText.trim() || !section || isAnalyzing || selectedText.length < 20}
          className={`w-full py-4 px-6 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
            !selectedText.trim() || !section || isAnalyzing || selectedText.length < 20
              ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {hasFullDescription && useJobContext ? 'Optimizing for Job Role...' :
               hasJobTitleOnly && useJobContext ? 'Researching & Optimizing...' :
               'Generating AI Suggestions...'}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              {hasFullDescription && useJobContext ? 'Rewrite for This Job' :
               hasJobTitleOnly && useJobContext ? 'Rewrite with AI Research' :
               'Rewrite with AI'}
            </>
          )}
        </button>

        {/* Suggestions Display */}
        {suggestions.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  AI Suggestions ({suggestions.length})
                </h3>
                {optimizationMode && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {optimizationMode === 'job-description' && '🎯 Tailored for job description'}
                    {optimizationMode === 'ai-knowledge' && '🔬 Based on AI research'}
                    {optimizationMode === 'general' && '📝 General enhancements'}
                  </p>
                )}
              </div>
              <button
                onClick={handleRewrite}
                disabled={isAnalyzing}
                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate
              </button>
            </div>

            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
              >
                {/* Suggestion Header */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                      {suggestion.tone.toUpperCase()}
                    </span>
                    
                    {suggestion.optimizationMode === 'job-description' && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                        <Target className="w-3 h-3 inline mr-1" />
                        Job-Optimized
                      </span>
                    )}
                    
                    {suggestion.optimizationMode === 'ai-knowledge' && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200">
                        <Brain className="w-3 h-3 inline mr-1" />
                        AI-Researched
                      </span>
                    )}
                    
                    {suggestion.confidenceScore && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {suggestion.confidenceScore}% Confidence
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Quality:</span>
                    <span className={`text-xl font-bold ${getScoreColor(suggestion.score)}`}>
                      {suggestion.score}%
                    </span>
                  </div>
                </div>

                {/* Rewritten Text */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-4 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {suggestion.rewritten}
                  </p>
                </div>

                {/* Keywords Added */}
                {suggestion.keywordsAdded && suggestion.keywordsAdded.length > 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      Keywords Added {suggestion.optimizationMode === 'ai-knowledge' ? '(AI Research)' : '(From Job Description)'}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.keywordsAdded.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full font-medium border border-emerald-300 dark:border-emerald-700"
                        >
                          + {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ATS Optimizations */}
                {suggestion.atsOptimizations && suggestion.atsOptimizations.length > 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      ATS Optimizations Applied:
                    </p>
                    <ul className="space-y-1">
                      {suggestion.atsOptimizations.map((opt, idx) => (
                        <li key={idx} className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                          <span className="text-blue-600 dark:text-blue-400">•</span>
                          <span>{opt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* General Improvements */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                    Key Improvements:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestion.improvements.map((imp, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full"
                      >
                        ✓ {imp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Copy Button */}
                <button
                  onClick={() => handleApply(suggestion)}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    appliedSuggestions.has(suggestion.id)
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {appliedSuggestions.has(suggestion.id) ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied to Clipboard!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy & Apply This Version
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {suggestions.length === 0 && !isAnalyzing && !error && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-xl">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-full mb-4">
              <Wand2 className="w-10 h-10 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Ready to Transform Your Content
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
              {hasFullDescription 
                ? `AI will tailor your text specifically for ${jobTitle || 'your target role'} using the job description`
                : hasJobTitleOnly
                ? `AI will use its knowledge base to optimize for ${jobTitle}${companyName ? ` at ${companyName}` : ''}`
                : 'Enter your resume text above to get AI-powered enhancements'}
            </p>
            
            {(hasFullDescription || hasJobTitleOnly) && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
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