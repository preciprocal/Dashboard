// components/resume/JobMatcher.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Target, Zap, AlertCircle, CheckCircle2, TrendingUp, Award, Loader2, Info, RefreshCw } from 'lucide-react';

interface SkillMatch {
  skill: string;
  present: boolean;
  importance: 'critical' | 'important' | 'nice-to-have';
}

interface JobMatchResult {
  overallScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  skillsMatch: SkillMatch[];
  experienceAlignment: number;
  recommendations: string[];
  competitiveAdvantages: string[];
  redFlags: string[];
}

interface JobMatcherProps {
  resumeId: string;
  resumeText?: string;
  preloadedMatch?: JobMatchResult;
}

export default function JobMatcher({ resumeId, resumeText, preloadedMatch }: JobMatcherProps) {
  const [result, setResult] = useState<JobMatchResult | null>(preloadedMatch || null);
  const [showNewMatchForm, setShowNewMatchForm] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (preloadedMatch) {
      console.log('✅ Displaying pre-loaded job match results');
      setResult(preloadedMatch);
    }
  }, [preloadedMatch]);

  const handleAnalyze = async () => {
    if (!jobDescription.trim() || !resumeText) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/resume/job-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId,
          resumeText,
          jobDescription,
          jobTitle,
          companyName,
        }),
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setResult(data.matchResult);
      setShowNewMatchForm(false);
      setJobDescription('');
      setJobTitle('');
      setCompanyName('');
    } catch (error) {
      console.error('Job match error:', error);
      alert('Failed to analyze job match. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-green-600';
    if (score >= 60) return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent Match';
    if (score >= 80) return 'Strong Match';
    if (score >= 70) return 'Good Match';
    if (score >= 60) return 'Fair Match';
    return 'Weak Match';
  };

  // Show results if available
  if (result && !showNewMatchForm) {
    return (
      <div className="space-y-6">
        {/* Overall Score */}
        <div className={`bg-gradient-to-br ${getScoreColor(result.overallScore)} rounded-2xl p-6 text-white relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-white/80 mb-1">Overall Match Score</p>
                <h3 className="text-5xl font-bold">{result.overallScore}%</h3>
              </div>
              <div className="p-4 bg-white/20 rounded-full">
                <Award className="w-8 h-8" />
              </div>
            </div>
            <p className="text-lg font-semibold">{getScoreLabel(result.overallScore)}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">Matched Keywords</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {result.matchedKeywords.length}
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400 mb-1">Missing Keywords</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {result.missingKeywords.length}
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800 col-span-2 md:col-span-1">
            <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Experience Match</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {result.experienceAlignment}%
            </p>
          </div>
        </div>

        {/* Matched Keywords */}
        {result.matchedKeywords.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">
              ✅ Matched Keywords
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.matchedKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full text-sm font-medium"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing Keywords */}
        {result.missingKeywords.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">
              ⚠️ Missing Keywords
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.missingKeywords.map((keyword, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Skills Match */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            Skills Analysis
          </h4>
          <div className="space-y-3">
            {result.skillsMatch.map((skill, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {skill.present ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${skill.present ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 line-through'}`}>
                    {skill.skill}
                  </span>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                  skill.importance === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                  skill.importance === 'important' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {skill.importance}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Competitive Advantages */}
        {result.competitiveAdvantages.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl p-5 border border-emerald-200 dark:border-emerald-800">
            <h4 className="font-bold text-emerald-900 dark:text-emerald-200 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Your Competitive Advantages
            </h4>
            <ul className="space-y-2">
              {result.competitiveAdvantages.map((advantage, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                  <span className="text-sm text-emerald-800 dark:text-emerald-300">{advantage}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {result.redFlags.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-5 border border-red-200 dark:border-red-800">
            <h4 className="font-bold text-red-900 dark:text-red-200 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Potential Red Flags
            </h4>
            <ul className="space-y-2">
              {result.redFlags.map((flag, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />
                  <span className="text-sm text-red-800 dark:text-red-300">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
          <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-3">
            💡 Recommendations to Improve Match
          </h4>
          <ul className="space-y-2">
            {result.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
                <span className="text-sm text-blue-800 dark:text-blue-300">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Analyze Different Job Button */}
        <button
          onClick={() => setShowNewMatchForm(true)}
          className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Compare Against Different Job
        </button>
      </div>
    );
  }

  // Show form if no results or user wants new match
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Job Description Matcher</h2>
            <p className="text-blue-100 text-sm">Compare your resume against a job posting</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Paste a Job Description
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Enter the job details below to see how well your resume matches the position.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Google"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the complete job description here..."
              rows={10}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none text-slate-900 dark:text-white placeholder-slate-400"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {jobDescription.length} characters
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {result && (
            <button
              onClick={() => setShowNewMatchForm(false)}
              className="flex-1 py-3 px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={!jobDescription.trim() || isAnalyzing || !resumeText}
            className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              !jobDescription.trim() || isAnalyzing || !resumeText
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Analyze Job Match
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}