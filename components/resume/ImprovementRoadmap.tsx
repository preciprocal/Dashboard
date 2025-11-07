// components/resume/ImprovementRoadmap.tsx
'use client';

import { useState } from 'react';
import { Activity, Zap, Clock, TrendingUp } from 'lucide-react';

interface RoadmapItem {
  action: string;
  impact: 'high' | 'medium' | 'low';
  timeToComplete: string;
  priority?: number;
}

interface ImprovementRoadmapProps {
  roadmap: {
    quickWins?: RoadmapItem[];
    mediumTerm?: RoadmapItem[];
    longTerm?: RoadmapItem[];
  };
}

export function ImprovementRoadmap({ roadmap }: ImprovementRoadmapProps) {
  const [activeTab, setActiveTab] = useState<'quick' | 'medium' | 'long'>('quick');

  if (!roadmap) return null;

  const tabs = [
    { 
      key: 'quick' as const, 
      label: 'Quick Wins', 
      data: roadmap.quickWins || [],
      icon: <Zap className="w-4 h-4" />,
    },
    { 
      key: 'medium' as const, 
      label: 'Medium Term', 
      data: roadmap.mediumTerm || [],
      icon: <Clock className="w-4 h-4" />,
    },
    { 
      key: 'long' as const, 
      label: 'Long Term', 
      data: roadmap.longTerm || [],
      icon: <TrendingUp className="w-4 h-4" />,
    }
  ];

  const activeData = tabs.find(tab => tab.key === activeTab)?.data || [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl">
            <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Improvement Roadmap
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Strategic action plan for resume optimization
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 bg-slate-100 dark:bg-slate-700 rounded-xl p-1.5 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeData.length > 0 ? (
            activeData.map((item, index) => (
              <div 
                key={index}
                className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-600"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                    item.impact === 'high' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                    item.impact === 'medium' ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                    'bg-gradient-to-r from-blue-500 to-indigo-500'
                  }`}>
                    {item.impact === 'high' ? 'H' : item.impact === 'medium' ? 'M' : 'L'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                      {item.action}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="w-4 h-4 mr-1" />
                        {item.timeToComplete}
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                        item.impact === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        item.impact === 'medium' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                        {item.impact} impact
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No {activeTab === 'quick' ? 'quick wins' : activeTab === 'medium' ? 'medium-term' : 'long-term'} recommendations at this time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}