// components/resume/OverallScoreHero.tsx
'use client';

import { Award, TrendingUp } from 'lucide-react';
import ScoreCircle from '@/components/resume/ScoreCircle';

interface OverallScoreHeroProps {
  score: number;
}

export function OverallScoreHero({ score }: OverallScoreHeroProps) {
  const getGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  };

  const getLabel = (score: number): string => {
    if (score >= 90) return 'Outstanding';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white rounded-full"></div>
      </div>
      
      <div className="relative">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Score Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Overall Score</h2>
                <p className="text-blue-100">Your resume&apos;s comprehensive performance rating</p>
              </div>
            </div>
            
            <div className="flex items-baseline gap-6">
              <div className="text-6xl font-bold text-white">
                {score}
              </div>
              <div>
                <div className="text-xl font-semibold text-white mb-1">
                  Grade: {getGrade(score)}
                </div>
                <div className="text-blue-100">
                  {getLabel(score)}
                </div>
              </div>
            </div>
          </div>
          
          {/* Score Circle */}
          <div className="flex-shrink-0">
            <ScoreCircle score={score} size="large" />
          </div>
        </div>

        {/* Improvement Potential */}
        {score < 90 && (
          <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Improvement Potential</span>
              </div>
              <div className="text-white text-xl font-bold">
                +{95 - score} points available
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}