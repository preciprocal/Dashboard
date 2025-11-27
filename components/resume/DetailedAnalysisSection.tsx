// components/resume/DetailedAnalysisSection.tsx
import React, { useState } from 'react';
import { ChevronDown, CheckCircle2, AlertTriangle, Target } from 'lucide-react';
import ScoreCircle from './ScoreCircle';

interface Tip {
  type: 'good' | 'improve' | 'warning' | 'critical';
  tip?: string;
  message?: string;
  explanation?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface SpecificIssue {
  issue?: string;
  word?: string;
  phrase?: string;
  section?: string;
  location?: string;
  fix?: string;
}

interface MissingSkill {
  skill?: string;
  importance?: 'critical' | 'important' | 'recommended';
}

interface SectionData {
  specificIssues?: SpecificIssue[];
  missingSkills?: (MissingSkill | string)[];
}

interface DetailedAnalysisSectionProps {
  title: string;
  description: string;
  score: number;
  tips: Tip[];
  icon: React.ReactNode;
  sectionData?: SectionData;
}

export function DetailedAnalysisSection({ 
  title, 
  description, 
  score, 
  tips, 
  icon, 
  sectionData 
}: DetailedAnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const goodTips = tips.filter(tip => tip.type === 'good');
  const improveTips = tips.filter(tip => tip.type !== 'good');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-all duration-300">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
              {icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-3 mb-2">
              <ScoreCircle score={score} size="medium" />
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{score}</div>
                <div className={`text-xs font-medium ${getScoreColor(score)}`}>
                  {getScoreLabel(score)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">{tips.length}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400">Recommendations</div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {goodTips.length}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">Strengths</div>
          </div>
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">
              {improveTips.length}
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">To Improve</div>
          </div>
        </div>
      </div>

      {/* Expandable Content */}
      <div className="border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between"
        >
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </span>
          <ChevronDown className={`w-5 h-5 text-slate-500 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="px-6 pb-6">
            {/* Specific Issues */}
            {sectionData?.specificIssues && sectionData.specificIssues.length > 0 && (
              <div className="mt-6 p-5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-red-900 dark:text-red-200">Critical Issues</h4>
                    <p className="text-sm text-red-700 dark:text-red-300">{sectionData.specificIssues.length} issues identified</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {sectionData.specificIssues.map((issue: SpecificIssue, index: number) => (
                    <div key={index} className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20">
                      <p className="font-medium text-red-900 dark:text-red-200 mb-2">
                        {issue.issue || issue.word || issue.phrase || issue.section || 'Issue detected'}
                      </p>
                      
                      {issue.location && (
                        <div className="flex items-center mb-2">
                          <Target className="w-3 h-3 text-red-500 mr-1" />
                          <span className="text-xs text-red-600 dark:text-red-400">
                            {issue.location}
                          </span>
                        </div>
                      )}
                      
                      {issue.fix && (
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-md p-3 border border-emerald-200 dark:border-emerald-800/30">
                          <div className="flex items-start">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mr-2 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                              {issue.fix}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Skills */}
            {sectionData?.missingSkills && sectionData.missingSkills.length > 0 && (
              <div className="mt-6 p-5 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 rounded-xl border border-orange-200 dark:border-orange-800/30">
                <div className="flex items-center mb-4">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mr-3">
                    <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-orange-900 dark:text-orange-200">Missing Critical Skills</h4>
                </div>
                <div className="space-y-3">
                  {sectionData.missingSkills.map((skill: MissingSkill | string, index: number) => {
                    const skillObj = typeof skill === 'string' ? { skill } : skill;
                    return (
                      <div key={index} className="flex items-center justify-between bg-white dark:bg-slate-800/50 rounded-lg p-3 border border-orange-100 dark:border-orange-800/20">
                        <span className="font-medium text-orange-800 dark:text-orange-200">
                          {skillObj.skill || String(skill)}
                        </span>
                        {typeof skill === 'object' && skill.importance && (
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            skill.importance === 'critical' ? 'bg-red-500 text-white' :
                            skill.importance === 'important' ? 'bg-orange-500 text-white' :
                            'bg-blue-500 text-white'
                          }`}>
                            {skill.importance}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Tips */}
            <div className="mt-6 space-y-4">
              {tips.map((tip, index) => {
                const tipText = tip.tip || tip.message || '';
                const isGood = tip.type === 'good';
                
                return (
                  <div
                    key={index}
                    className={`p-5 rounded-xl border transition-all duration-200 hover:shadow-md ${
                      isGood
                        ? 'bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/10 dark:to-green-900/10 border-emerald-200 dark:border-emerald-800/30'
                        : 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 border-amber-200 dark:border-amber-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start flex-1">
                        <div className="flex-shrink-0 mt-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isGood 
                              ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                              : 'bg-amber-100 dark:bg-amber-900/30'
                          }`}>
                            {isGood ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            )}
                          </div>
                        </div>
                        
                        <div className="ml-4 flex-1">
                          <h4 className={`text-base font-semibold mb-2 ${
                            isGood ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'
                          }`}>
                            {tipText}
                          </h4>
                          
                          {tip.explanation && (
                            <p className={`text-sm leading-relaxed ${
                              isGood ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
                            }`}>
                              {tip.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {!isGood && tip.priority && (
                        <div className="ml-3">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                            tip.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            tip.priority === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {tip.priority}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}