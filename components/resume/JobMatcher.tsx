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

export default function JobMatcher({ resumeId, resumeText: initialResumeText, preloadedMatch }: JobMatcherProps) {
  const [result, setResult] = useState<JobMatchResult | null>(preloadedMatch || null);
  const [showNewMatchForm, setShowNewMatchForm] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resumeText, setResumeText] = useState(initialResumeText || '');
  const [isLoadingResume, setIsLoadingResume] = useState(!initialResumeText);

  useEffect(() => {
    if (preloadedMatch) {
      console.log('✅ Displaying pre-loaded job match results');
      setResult(preloadedMatch);
    }
  }, [preloadedMatch]);

  useEffect(() => {
    if (initialResumeText) {
      setResumeText(initialResumeText);
      setIsLoadingResume(false);
    } else {
      // Try to fetch resume text from the analyze endpoint
      fetchResumeText();
    }
  }, [initialResumeText, resumeId]);

  const fetchResumeText = async () => {
    if (initialResumeText) return;
    
    setIsLoadingResume(true);
    try {
      const response = await fetch(`/api/resume/${resumeId}`);
      if (response.ok) {
        const data = await response.json();
        const text = data.data?.feedback?.resumeText || '';
        if (text) {
          setResumeText(text);
          console.log('✅ Resume text loaded:', text.length, 'characters');
        }
      }
    } catch (error) {
      console.error('Error fetching resume text:', error);
    } finally {
      setIsLoadingResume(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      alert('Please enter a job description');
      return;
    }

    if (!resumeText || resumeText.length < 50) {
      alert('Resume content not available. Please try re-uploading your resume.');
      return;
    }

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      setResult(data.matchResult);
      setShowNewMatchForm(false);
      setJobDescription('');
      setJobTitle('');
      setCompanyName('');
    } catch (error) {
      console.error('Job match error:', error);
      alert(error instanceof Error ? error.message : 'Failed to analyze job match. Please try again.');
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
      <div className="space-y-4 sm:space-y-5">
        {/* Overall Score */}
        <div className={`glass-card-gradient hover-lift bg-gradient-to-br ${getScoreColor(result.overallScore)} p-5 sm:p-6 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <p className="text-xs sm:text-sm font-medium text-white/80 mb-1">Overall Match Score</p>
                <h3 className="text-4xl sm:text-5xl font-bold text-white">{result.overallScore}%</h3>
              </div>
              <div className="p-3 sm:p-4 bg-white/20 rounded-full">
                <Award className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
            </div>
            <p className="text-base sm:text-lg font-semibold text-white">{getScoreLabel(result.overallScore)}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="glass-morphism rounded-xl p-3 sm:p-4 border border-emerald-500/30">
            <p className="text-xs text-emerald-400 mb-1">Matched Keywords</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-300">
              {result.matchedKeywords.length}
            </p>
          </div>

          <div className="glass-morphism rounded-xl p-3 sm:p-4 border border-red-500/30">
            <p className="text-xs text-red-400 mb-1">Missing Keywords</p>
            <p className="text-xl sm:text-2xl font-bold text-red-300">
              {result.missingKeywords.length}
            </p>
          </div>

          <div className="glass-morphism rounded-xl p-3 sm:p-4 border border-blue-500/30 col-span-2 md:col-span-1">
            <p className="text-xs text-blue-400 mb-1">Experience Match</p>
            <p className="text-xl sm:text-2xl font-bold text-blue-300">
              {result.experienceAlignment}%
            </p>
          </div>
        </div>

        {/* Matched Keywords */}
        {result.matchedKeywords.length > 0 && (
          <div className="glass-card-gradient hover-lift">
            <div className="glass-card-gradient-inner">
              <h4 className="font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                Matched Keywords
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.matchedKeywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-emerald-500/20 text-emerald-300 rounded-full text-xs sm:text-sm font-medium border border-emerald-500/30"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Missing Keywords */}
        {result.missingKeywords.length > 0 && (
          <div className="glass-card-gradient hover-lift">
            <div className="glass-card-gradient-inner">
              <h4 className="font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                Missing Keywords
              </h4>
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-red-500/20 text-red-300 rounded-full text-xs sm:text-sm font-medium border border-red-500/30"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Skills Match */}
        <div className="glass-card-gradient hover-lift">
          <div className="glass-card-gradient-inner">
            <h4 className="font-bold text-white mb-3 sm:mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Skills Analysis
            </h4>
            <div className="space-y-2.5 sm:space-y-3">
              {result.skillsMatch.map((skill, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {skill.present ? (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                    )}
                    <span className={`text-xs sm:text-sm font-medium ${skill.present ? 'text-white' : 'text-slate-400 line-through'}`}>
                      {skill.skill}
                    </span>
                  </div>
                  <span className={`text-xs px-2 sm:px-3 py-1 rounded-full font-semibold flex-shrink-0 ${
                    skill.importance === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    skill.importance === 'important' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}>
                    {skill.importance}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Competitive Advantages */}
        {result.competitiveAdvantages.length > 0 && (
          <div className="glass-card-gradient hover-lift border-emerald-500/30">
            <div className="glass-card-gradient-inner">
              <h4 className="font-bold text-emerald-300 mb-3 sm:mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                Your Competitive Advantages
              </h4>
              <ul className="space-y-2">
                {result.competitiveAdvantages.map((advantage, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-emerald-200">{advantage}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Red Flags */}
        {result.redFlags.length > 0 && (
          <div className="glass-card-gradient hover-lift border-red-500/30">
            <div className="glass-card-gradient-inner">
              <h4 className="font-bold text-red-300 mb-3 sm:mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                Potential Red Flags
              </h4>
              <ul className="space-y-2">
                {result.redFlags.map((flag, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-red-200">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="glass-card-gradient hover-lift border-blue-500/30">
          <div className="glass-card-gradient-inner">
            <h4 className="font-bold text-blue-300 mb-3 sm:mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              Recommendations to Improve Match
            </h4>
            <ul className="space-y-2">
              {result.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-blue-200">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Analyze Different Job Button */}
        <button
          onClick={() => setShowNewMatchForm(true)}
          className="w-full glass-button-primary hover-lift py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
          Compare Against Different Job
        </button>
      </div>
    );
  }

  // Show form if no results or user wants new match
  return (
    <div className="glass-card-gradient hover-lift">
      <div className="gradient-primary px-5 sm:px-6 py-4 sm:py-5 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">Job Description Matcher</h2>
            <p className="text-blue-100 text-xs sm:text-sm">Compare your resume against a job posting</p>
          </div>
        </div>
      </div>

      <div className="glass-card-gradient-inner p-5 sm:p-6 space-y-5 sm:space-y-6">
        <div className="glass-morphism rounded-xl p-3 sm:p-4 border border-blue-500/30">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-blue-300 mb-1 text-xs sm:text-sm">
                Paste a Job Description
              </h4>
              <p className="text-xs text-blue-200">
                Enter the job details below to see how well your resume matches the position.
              </p>
            </div>
          </div>
        </div>

        {isLoadingResume && (
          <div className="glass-morphism rounded-xl p-3 sm:p-4 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 animate-spin flex-shrink-0" />
              <p className="text-xs sm:text-sm text-amber-300">Loading resume content...</p>
            </div>
          </div>
        )}

        {!isLoadingResume && !resumeText && (
          <div className="glass-morphism rounded-xl p-3 sm:p-4 border border-red-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-red-300 mb-1 text-xs sm:text-sm">Resume Content Not Available</h4>
                <p className="text-xs text-red-200">Please re-upload your resume to enable job matching analysis.</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-2">
                Job Title
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g., Senior Software Engineer"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 glass-morphism border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Google"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 glass-morphism border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-400 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-2">
              Job Description *
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the complete job description here..."
              rows={8}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 glass-morphism border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none text-white placeholder-slate-400 text-xs sm:text-sm glass-scrollbar"
            />
            <p className="text-xs text-slate-400 mt-2">
              {jobDescription.length} characters
            </p>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3">
          {result && (
            <button
              onClick={() => setShowNewMatchForm(false)}
              className="flex-1 glass-button hover-lift py-2.5 sm:py-3 px-3 sm:px-4 text-white font-medium rounded-xl text-xs sm:text-sm"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={!jobDescription.trim() || isAnalyzing || !resumeText || isLoadingResume}
            className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-xs sm:text-sm ${
              !jobDescription.trim() || isAnalyzing || !resumeText || isLoadingResume
                ? 'glass-button opacity-50 cursor-not-allowed text-slate-400'
                : 'glass-button-primary hover-lift text-white shadow-glass'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                Analyze Job Match
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}