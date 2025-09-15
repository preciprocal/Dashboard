'use client';

import React, { useState, useEffect } from 'react';
import { Resume } from '@/types/resume';

interface ResumeFix {
  id: string;
  category: string;
  issue: string;
  originalText: string;
  improvedText: string;
  explanation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  location?: string;
  confidence?: number;
  estimatedTimeToFix?: string;
  tags?: string[];
}

interface FixesSummary {
  totalFixes: number;
  categoriesBreakdown: Record<string, number>;
  prioritiesBreakdown: Record<string, number>;
  estimatedTotalTime: string;
  topCategories: Array<{ category: string; count: number }>;
}

interface PersonalizedRecommendations {
  quickWins: Array<{ fix: string; reason: string }>;
  focusAreas: string[];
  timeInvestment: {
    immediate: string;
    comprehensive: string;
  };
}

interface ResumeFixerProps {
  resume: Resume;
  jobDescription?: string;
  onHighlightChange?: (highlightedFixes: Set<string>) => void;
  extractedText?: string; // Resume text content from analysis
}

interface FixesResponse {
  fixes: ResumeFix[];
  summary: FixesSummary;
  recommendations: PersonalizedRecommendations;
  meta: {
    timestamp: string;
    model: string;
    type: string;
    fixesGenerated: number;
  };
}

interface AlternativeFixResponse {
  alternative: {
    improvedText: string;
    explanation: string;
    impact: string;
    alternativeApproach?: string;
    confidence?: number;
  };
  meta: {
    timestamp: string;
    type: string;
  };
}

interface ApplyFixResponse {
  updatedContent: string;
  appliedFix: ResumeFix;
  meta: {
    timestamp: string;
    type: string;
    success: boolean;
  };
}

const generateResumeFixes = async (
  resumeContent: string,
  jobDescription?: string,
  feedback?: any,
  targetRole?: string
): Promise<FixesResponse> => {
  console.log('📡 Calling AI resume fixes API...');
  
  const requestData = {
    action: 'generateFixes',
    resumeContent,
    jobDescription: jobDescription || '',
    feedback,
    targetRole,
    experience: 'mid-level' // Could be extracted from resume analysis
  };

  const response = await fetch('/api/analyze-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.message || data.error);
  }

  return data;
};

const regenerateSpecificFix = async (
  originalFix: ResumeFix,
  resumeContent: string,
  jobDescription?: string
): Promise<AlternativeFixResponse> => {
  console.log('🔄 Regenerating specific fix via API...');
  
  const response = await fetch('/api/analyze-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'regenerateFix',
      originalFix,
      resumeContent,
      jobDescription,
      preferences: {
        tone: 'professional',
        emphasis: 'results-oriented'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Failed to regenerate fix: ${response.status}`);
  }

  return response.json();
};

const applyFix = async (resumeContent: string, fix: ResumeFix): Promise<ApplyFixResponse> => {
  const response = await fetch('/api/analyze-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'applyFix',
      resumeContent,
      fixToApply: fix
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to apply fix: ${response.status}`);
  }

  return response.json();
};

const batchApplyFixes = async (resumeContent: string, fixes: ResumeFix[]) => {
  const response = await fetch('/api/analyze-resume', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'batchApplyFixes',
      resumeContent,
      fixesToApply: fixes
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to apply fixes: ${response.status}`);
  }

  return response.json();
};

export default function AdvancedResumeFixer({ 
  resume, 
  jobDescription, 
  onHighlightChange,
  extractedText 
}: ResumeFixerProps) {
  const [fixes, setFixes] = useState<ResumeFix[]>([]);
  const [summary, setSummary] = useState<FixesSummary | null>(null);
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(new Set());
  const [regeneratingFix, setRegeneratingFix] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [applyingFixes, setApplyingFixes] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);

  // Notify parent component when selected fixes change
  useEffect(() => {
    if (onHighlightChange) {
      onHighlightChange(selectedFixes);
    }
  }, [selectedFixes, onHighlightChange]);

  const handleGenerateFixes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Starting real AI fixes generation...');
      
      // Try to get resume content from various sources
      let resumeContent = extractedText;
      
      // If no extractedText provided, try to construct from resume data
      if (!resumeContent && resume) {
        // Try to use any text-based fields from the resume object
        const resumeParts = [];
        
        // Add any available text data from resume
        if (resume.companyName) resumeParts.push(`Target Company: ${resume.companyName}`);
        if (resume.jobTitle) resumeParts.push(`Target Position: ${resume.jobTitle}`);
        
        // Join available data
        resumeContent = resumeParts.join('\n');
      }
      
      // If still no content, show helpful error
      if (!resumeContent || resumeContent.trim().length < 20) {
        setError('Resume text content is needed for AI analysis. This feature requires the resume text to be extracted during the initial analysis process. Please re-upload your resume to enable text extraction.');
        return;
      }
      
      const result = await generateResumeFixes(
        resumeContent,
        jobDescription,
        resume.feedback,
        jobDescription ? 'Software Engineer' : undefined
      );
      
      setFixes(result.fixes);
      setSummary(result.summary);
      setRecommendations(result.recommendations);
      setAnalysisCompleted(true);
      
      // Auto-select critical and high priority fixes if any exist
      if (result.fixes.length > 0) {
        const highPriorityIds = result.fixes
          .filter(fix => fix.priority === 'critical' || fix.priority === 'high')
          .map(fix => fix.id);
        setSelectedFixes(new Set(highPriorityIds));
      }
      
      console.log(`✅ Generated ${result.fixes.length} real AI fixes`);
      
    } catch (error) {
      console.error('❌ Failed to generate fixes:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate fixes');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateFix = async (fixId: string) => {
    const fix = fixes.find(f => f.id === fixId);
    if (!fix) return;
    
    setRegeneratingFix(fixId);
    
    try {
      const result = await regenerateSpecificFix(fix, resume, jobDescription);
      
      setFixes(prevFixes => 
        prevFixes.map(prevFix => 
          prevFix.id === fixId 
            ? {
                ...prevFix,
                improvedText: result.alternative.improvedText,
                explanation: result.alternative.explanation,
                impact: result.alternative.impact,
                confidence: result.alternative.confidence
              }
            : prevFix
        )
      );
      
      console.log('✅ Fix regenerated successfully');
      
    } catch (error) {
      console.error('❌ Failed to regenerate fix:', error);
      setError('Failed to regenerate fix. Please try again.');
    } finally {
      setRegeneratingFix(null);
    }
  };

  const toggleFixSelection = (fixId: string) => {
    const newSelection = new Set(selectedFixes);
    if (newSelection.has(fixId)) {
      newSelection.delete(fixId);
    } else {
      newSelection.add(fixId);
    }
    setSelectedFixes(newSelection);
  };

  const handleApplyFixes = async () => {
    if (!extractedText || selectedFixes.size === 0) return;
    
    setApplyingFixes(true);
    
    try {
      const selectedFixData = fixes.filter(fix => selectedFixes.has(fix.id));
      
      if (selectedFixData.length === 1) {
        // Apply single fix
        await applyFix(extractedText, selectedFixData[0]);
        console.log('✅ Single fix applied successfully');
      } else {
        // Apply multiple fixes in batch
        const result = await batchApplyFixes(extractedText, selectedFixData);
        console.log(`✅ Applied ${result.appliedFixes.length} fixes successfully`);
        
        if (result.failedFixes.length > 0) {
          console.warn(`⚠️ ${result.failedFixes.length} fixes failed to apply`);
        }
      }
      
      // Here you would typically update the resume content in your parent component
      // or trigger a callback to handle the updated content
      
    } catch (error) {
      console.error('❌ Failed to apply fixes:', error);
      setError('Failed to apply fixes. Please try again.');
    } finally {
      setApplyingFixes(false);
    }
  };

  const handleExportFixes = () => {
    const selectedFixData = fixes.filter(fix => selectedFixes.has(fix.id));
    const timestamp = new Date().toISOString().split('T')[0];
    const fixesText = selectedFixData.map(fix => 
      `**${fix.category}** (${fix.priority} priority)\n` +
      `Issue: ${fix.issue}\n` +
      `Original: "${fix.originalText}"\n` +
      `Improved: "${fix.improvedText}"\n` +
      `Explanation: ${fix.explanation}\n` +
      `Impact: ${fix.impact}\n` +
      `${fix.location ? `Location: ${fix.location}\n` : ''}` +
      `${fix.estimatedTimeToFix ? `Time to Fix: ${fix.estimatedTimeToFix}\n` : ''}\n`
    ).join('\n');
    
    const fullExport = `Resume Fixes Export - ${timestamp}\n` +
      `Generated by AI Resume Analyzer\n\n` +
      `Summary:\n` +
      `- Total Fixes: ${selectedFixData.length}\n` +
      `- Priority Breakdown: ${JSON.stringify(summary?.prioritiesBreakdown || {})}\n` +
      `- Categories: ${Object.keys(summary?.categoriesBreakdown || {}).join(', ')}\n\n` +
      `FIXES:\n${'='.repeat(50)}\n\n${fixesText}`;
    
    const blob = new Blob([fullExport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-fixes-${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Group fixes by category
  const fixesByCategory = fixes.reduce((acc, fix) => {
    if (!acc[fix.category]) {
      acc[fix.category] = [];
    }
    acc[fix.category].push(fix);
    return acc;
  }, {} as Record<string, ResumeFix[]>);

  const categories = Object.keys(fixesByCategory);
  const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

  // Show error state
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">AI Resume Fixer</h3>
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleGenerateFixes}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </button>
          
          {!extractedText && (
            <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
              Resume text extraction required for AI analysis
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">AI Resume Fixer</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              {!analysisCompleted 
                ? 'Real AI analysis of your resume content'
                : fixes.length > 0 
                  ? `${fixes.length} AI-generated improvements ready` 
                  : 'Your resume looks great! No critical issues found.'
              }
            </p>
          </div>
        </div>
        
        {!analysisCompleted ? (
          <button
            onClick={handleGenerateFixes}
            disabled={loading || !extractedText}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Analyzing with AI...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate AI Fixes
              </>
            )}
          </button>
        ) : fixes.length === 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">No fixes needed!</span>
            </div>
            <button
              onClick={() => {
                setAnalysisCompleted(false);
                setFixes([]);
                setSummary(null);
                setRecommendations(null);
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              Re-analyze
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {selectedFixes.size} of {fixes.length} selected
            </span>
            <button
              onClick={handleApplyFixes}
              disabled={selectedFixes.size === 0 || applyingFixes}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
            >
              {applyingFixes ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Applying...
                </>
              ) : (
                'Apply Selected'
              )}
            </button>
            <button
              onClick={handleExportFixes}
              disabled={selectedFixes.size === 0}
              className="inline-flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300 mb-2">AI is analyzing your resume comprehensively...</p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Checking ATS compatibility • Content optimization • Skills analysis • Format review
          </div>
        </div>
      )}

      {/* Show "No fixes needed" message when analysis is complete but no fixes found */}
      {analysisCompleted && fixes.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Resume looks great!</h4>
          <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
            Our AI analysis didn't find any critical issues with your resume. It appears to be well-formatted and optimized.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setAnalysisCompleted(false);
                setFixes([]);
                setSummary(null);
                setRecommendations(null);
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Run Analysis Again
            </button>
            {jobDescription && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                Analysis included job description optimization
              </p>
            )}
          </div>
        </div>
      )}

      {fixes.length > 0 && (
        <div>
          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.totalFixes}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Total Fixes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.prioritiesBreakdown.critical || 0}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Critical Issues</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{categories.length}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Categories</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-800 dark:text-gray-200">{summary.estimatedTotalTime}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">Est. Time</div>
              </div>
            </div>
          )}

          {/* Category Filter Tabs */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === null
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                All ({fixes.length})
              </button>
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {category} ({fixesByCategory[category].length})
                </button>
              ))}
            </div>
          </div>

          {/* Fixes List */}
          <div className="space-y-4">
            {(activeCategory ? fixesByCategory[activeCategory] || [] : fixes)
              .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
              .map((fix) => (
                <div
                  key={fix.id}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    selectedFixes.has(fix.id)
                      ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedFixes.has(fix.id)}
                      onChange={() => toggleFixSelection(fix.id)}
                      className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {fix.category}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            fix.priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            fix.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                            fix.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {fix.priority} priority
                          </span>
                          {fix.confidence && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {Math.round(fix.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleRegenerateFix(fix.id)}
                          disabled={regeneratingFix === fix.id}
                          className="inline-flex items-center px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                        >
                          {regeneratingFix === fix.id ? (
                            <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                          Regenerate
                        </button>
                      </div>
                      
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{fix.issue}</h4>
                      
                      <div className="space-y-3">
                        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border-l-4 border-red-400">
                          <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Before:</p>
                          <p className="text-sm text-red-700 dark:text-red-300 italic whitespace-pre-line">"{fix.originalText}"</p>
                        </div>
                        
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border-l-4 border-green-400">
                          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">After:</p>
                          <p className="text-sm text-green-700 dark:text-green-300 font-medium whitespace-pre-line">"{fix.improvedText}"</p>
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Why this works:</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">{fix.explanation}</p>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Impact: {fix.impact}</p>
                            {fix.estimatedTimeToFix && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">{fix.estimatedTimeToFix}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Recommendations Section */}
          {recommendations && (
            <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-2">AI Recommendations</h4>
                  <div className="space-y-2">
                    <p className="text-gray-700 dark:text-gray-300">
                      Focus Areas: {recommendations.focusAreas.join(', ')}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Quick wins available • {recommendations.timeInvestment.immediate} for immediate impact
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const allIds = new Set(fixes.map(f => f.id));
                      setSelectedFixes(selectedFixes.size === fixes.length ? new Set() : allIds);
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {selectedFixes.size === fixes.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <button
                    onClick={handleApplyFixes}
                    disabled={selectedFixes.size === 0 || applyingFixes}
                    className="inline-flex items-center px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Apply {selectedFixes.size} Fixes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}