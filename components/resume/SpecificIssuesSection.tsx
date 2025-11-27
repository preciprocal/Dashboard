// components/resume/SpecificIssuesSection.tsx
'use client';

import { AlertTriangle, Target, CheckCircle2 } from 'lucide-react';

interface Issue {
  description?: string;
  issue?: string;
  problem?: string;
  location?: string;
  example?: string;
  fix?: string;
  suggestion?: string;
  severity?: 'critical' | 'major' | 'minor';
}

interface SpecificIssuesSectionProps {
  issues: Issue[];
  title: string;
}

export function SpecificIssuesSection({ issues, title }: SpecificIssuesSectionProps) {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="p-5 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
      <div className="flex items-center mb-4">
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg mr-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h4 className="font-semibold text-red-900 dark:text-red-200">{title}</h4>
          <p className="text-sm text-red-700 dark:text-red-300">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'} identified
          </p>
        </div>
      </div>
      
      <div className="space-y-3">
        {issues.map((issue, index) => (
          <div 
            key={index}
            className="bg-white dark:bg-slate-800/50 rounded-lg p-4 border border-red-100 dark:border-red-800/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-red-900 dark:text-red-200 mb-2">
                  {issue.description || issue.issue || issue.problem}
                </p>
                
                {issue.location && (
                  <div className="flex items-center mb-2">
                    <Target className="w-3 h-3 text-red-500 mr-1 flex-shrink-0" />
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {issue.location}
                    </span>
                  </div>
                )}
                
                {issue.example && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-2 mb-2">
                    <p className="text-xs font-mono text-red-700 dark:text-red-300">
                      &quot;{issue.example}&quot;
                    </p>
                  </div>
                )}
                
                {(issue.fix || issue.suggestion) && (
                  <div className="mt-2 p-3 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                        {issue.fix || issue.suggestion}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {issue.severity && (
                <span className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${
                  issue.severity === 'critical' ? 'bg-red-500 text-white' :
                  issue.severity === 'major' ? 'bg-orange-500 text-white' :
                  'bg-amber-500 text-white'
                }`}>
                  {issue.severity}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}