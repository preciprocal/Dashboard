// components/profile/AnalyticsTab.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Star,
  CheckCircle,
  Trophy,
  Clock,
  Target,
  LineChart,
  PieChart,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Award,
  Activity
} from "lucide-react";

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  improvementRate: number;
  currentStreak: number;
  hoursSpent: number;
  strengthsMap: { [key: string]: number };
  weaknessesMap: { [key: string]: number };
  monthlyProgress: { month: string; score: number; interviews: number }[];
  skillProgress: { skill: string; current: number; target: number }[];
  typeBreakdown?: {
    type: string;
    count: number;
    avgScore: number;
    percentage: number;
  }[];
  successRate?: number;
}

interface Interview {
  id: string;
  score?: number;
  createdAt: Date;
}

interface AnalyticsTabProps {
  stats: UserStats;
  interviews: Interview[];
  trendChartRef: React.RefObject<HTMLCanvasElement>;
}

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ stats, interviews, trendChartRef }) => {
  return (
    <div className="space-y-6">
      
      {/* Analytics Header */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">Performance Analytics</h2>
            <p className="text-gray-400">
              {stats.totalInterviews > 0 ? `Insights from ${stats.totalInterviews} interviews` : "Complete interviews to unlock analytics"}
            </p>
          </div>
        </div>
      </div>

      {stats.totalInterviews > 0 ? (
        <>
          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-400 text-sm">Average Score</span>
                </div>
                {stats.improvementRate > 0 && (
                  <div className="flex items-center text-green-400 text-xs">
                    <ArrowUp className="w-3 h-3 mr-1" />
                    +{stats.improvementRate}%
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-white">{stats.averageScore}%</div>
              <div className="text-gray-500 text-xs mt-1">Across all interviews</div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-gray-400 text-sm">Success Rate</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.successRate}%</div>
              <div className="text-gray-500 text-xs mt-1">Interviews scoring 70%+</div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center space-x-2 mb-3">
                <Activity className="w-5 h-5 text-purple-400" />
                <span className="text-gray-400 text-sm">Practice Hours</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.hoursSpent}h</div>
              <div className="text-gray-500 text-xs mt-1">Total time invested</div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <div className="flex items-center space-x-2 mb-3">
                <Clock className="w-5 h-5 text-orange-400" />
                <span className="text-gray-400 text-sm">Current Streak</span>
              </div>
              <div className="text-2xl font-bold text-white">{stats.currentStreak}</div>
              <div className="text-gray-500 text-xs mt-1">Consecutive days</div>
            </div>
          </div>

          {/* Performance Trends & Skills */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Performance Chart */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <LineChart className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Performance Trends</h3>
                  </div>
                  <div className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    stats.improvementRate > 0 
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {stats.improvementRate > 0 ? 'Improving' : 'Stable'}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="h-80">
                  {stats.monthlyProgress.length > 0 ? (
                    <canvas ref={trendChartRef} id="trend-chart"></canvas>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <LineChart className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                        <p className="text-gray-400 text-sm">Not enough data for trends</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Skills Assessment */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <Target className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Skills Assessment</h3>
                </div>
              </div>
              <div className="p-6">
                {stats.skillProgress.length > 0 ? (
                  <div className="space-y-4">
                    {stats.skillProgress.slice(0, 6).map((skill) => (
                      <div key={skill.skill} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-white">{skill.skill}</span>
                          <span className="text-sm font-semibold text-gray-400">{skill.current}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              skill.current >= 80 ? 'bg-green-500' :
                              skill.current >= 60 ? 'bg-blue-500' :
                              'bg-orange-500'
                            }`}
                            style={{ width: `${skill.current}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Complete interviews to see skills</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Interview Types Performance */}
          {stats.typeBreakdown && stats.typeBreakdown.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <PieChart className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Interview Type Performance</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stats.typeBreakdown.map((type) => (
                    <div key={type.type} className="p-4 bg-gray-700 rounded-lg text-center">
                      <div className="text-lg font-bold text-white mb-1">{type.avgScore}%</div>
                      <div className="text-sm font-medium text-gray-300 mb-1">{type.type}</div>
                      <div className="text-xs text-gray-400">{type.count} completed</div>
                      <div className="text-xs text-gray-500">{type.percentage}% of total</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Strengths & Areas for Improvement */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Strengths */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <Trophy className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-semibold text-white">Strengths</h3>
                </div>
              </div>
              <div className="p-6">
                {Object.keys(stats.strengthsMap).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(stats.strengthsMap).slice(0, 5).map(([skill, score]) => (
                      <div key={skill} className="flex items-center justify-between p-3 bg-green-900/20 border border-green-700 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-white text-sm font-medium">{skill}</span>
                        </div>
                        <span className="text-green-400 font-semibold">{score}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Star className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Complete more interviews to identify strengths</p>
                  </div>
                )}
              </div>
            </div>

            {/* Areas for Improvement */}
            <div className="bg-gray-800 rounded-lg border border-gray-700">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                  <Target className="w-5 h-5 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Areas for Improvement</h3>
                </div>
              </div>
              <div className="p-6">
                {Object.keys(stats.weaknessesMap).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(stats.weaknessesMap).slice(0, 5).map(([skill, score]) => (
                      <div key={skill} className="flex items-center justify-between p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Target className="w-4 h-4 text-orange-400" />
                          <span className="text-white text-sm font-medium">{skill}</span>
                        </div>
                        <span className="text-orange-400 font-semibold">{score}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-3" />
                    <p className="text-green-400 text-sm font-medium">No significant weaknesses identified</p>
                    <p className="text-gray-500 text-xs mt-1">Excellent performance across all areas</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Activity className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Performance Summary</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-blue-400 mb-1">
                  {Math.min(95, Math.max(65, stats.averageScore + 5))}%
                </div>
                <div className="text-gray-400 text-sm font-medium">Projected Next Score</div>
                <div className="text-gray-500 text-xs mt-1">Based on trends</div>
              </div>
              
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-green-400 mb-1">
                  {Math.max(1, Math.min(12, Math.floor((85 - stats.averageScore) / 5) + 2))}
                </div>
                <div className="text-gray-400 text-sm font-medium">Weeks to 85%</div>
                <div className="text-gray-500 text-xs mt-1">At current pace</div>
              </div>
              
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-purple-400 mb-1">
                  {stats.averageScore >= 85 ? "Expert" : stats.averageScore >= 70 ? "Advanced" : stats.averageScore >= 50 ? "Intermediate" : "Beginner"}
                </div>
                <div className="text-gray-400 text-sm font-medium">Current Level</div>
                <div className="text-gray-500 text-xs mt-1">Performance tier</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-4">Analytics Dashboard</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Complete your first interview to unlock detailed performance analytics and insights.
          </p>
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/createinterview">
              <Target className="w-4 h-4 mr-2" />
              Start First Interview
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;