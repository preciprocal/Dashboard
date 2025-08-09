// components/profile/OverviewTab.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Target,
  TrendingUp,
  Brain,
  Lightbulb,
  CheckCircle,
  Flame,
  Clock,
  Trophy,
  BarChart3,
  BookOpen,
  ChevronRight,
  Activity,
  Star,
  Calendar,
  ArrowRight
} from "lucide-react";

interface Interview {
  id: string;
  userId: string;
  role: string;
  type: "technical" | "behavioral" | "system-design" | "coding";
  techstack: string[];
  company: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  duration: number;
  score?: number;
  status: "completed" | "in-progress" | "scheduled";
  feedback?: any;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  targetRole?: string;
  experienceLevel?: string;
  createdAt: Date;
}

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  improvementRate: number;
  currentStreak: number;
  hoursSpent: number;
  strengthsMap: { [key: string]: number };
  weaknessesMap: { [key: string]: number };
  bestPerformingType?: string;
  worstPerformingType?: string;
  successRate?: number;
  completionRate?: number;
}

interface Achievement {
  id: string;
  name: string;
  earned: boolean;
}

interface OverviewTabProps {
  userProfile: UserProfile;
  stats: UserStats;
  interviews: Interview[];
  achievements: Achievement[];
  onTabChange: (tab: string) => void;
  generateDailyFocus: (interviews: Interview[], stats: UserStats) => any[];
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  userProfile,
  stats,
  interviews,
  achievements,
  onTabChange,
  generateDailyFocus
}) => {
  const getPerformanceStatus = () => {
    if (stats.averageScore >= 85) return { title: "Excellent Performance", level: "High", color: "green" };
    if (stats.averageScore >= 70) return { title: "Good Progress", level: "Medium", color: "blue" };
    if (stats.totalInterviews > 0) return { title: "Building Skills", level: "Developing", color: "orange" };
    return { title: "Ready to Begin", level: "New", color: "gray" };
  };

  const performance = getPerformanceStatus();

  return (
    <div className="space-y-6">
      
      {/* Top Row - Performance Summary & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Performance Summary - 2 columns */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{performance.title}</h2>
              <p className="text-gray-400">Performance Level: {performance.level}</p>
            </div>
            {stats.totalInterviews > 0 && (
              <div className="ml-auto text-right">
                <div className="text-2xl font-bold text-white">{stats.averageScore}%</div>
                <div className="text-gray-400 text-sm">Average Score</div>
              </div>
            )}
          </div>

          {stats.totalInterviews > 0 ? (
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-white">{stats.totalInterviews}</div>
                <div className="text-gray-400 text-sm">Interviews</div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-green-400">{stats.successRate}%</div>
                <div className="text-gray-400 text-sm">Success Rate</div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-purple-400">{stats.currentStreak}</div>
                <div className="text-gray-400 text-sm">Day Streak</div>
              </div>
              <div className="text-center p-4 bg-gray-700 rounded-lg">
                <div className="text-xl font-bold text-orange-400">{stats.hoursSpent}h</div>
                <div className="text-gray-400 text-sm">Practice Time</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-700 rounded-lg">
              <div className="text-gray-400 mb-4">Start your first interview to see performance metrics</div>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/createinterview">
                  <Target className="h-4 w-4 mr-2" />
                  Begin Practice
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Quick Actions - 1 column */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Quick Actions</h3>
          
          <div className="space-y-3">
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700 h-14 justify-start">
              <Link href="/createinterview" className="flex items-center">
                <Target className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Practice Interview</div>
                  <div className="text-xs opacity-90">Start new session</div>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 h-14 justify-start">
              <Link href="/templates" className="flex items-center">
                <BookOpen className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Study Materials</div>
                  <div className="text-xs opacity-75">Browse templates</div>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            
            <Button 
              onClick={() => onTabChange('analytics')} 
              variant="outline" 
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 h-14 justify-start"
            >
              <BarChart3 className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Analytics</div>
                <div className="text-xs opacity-75">View metrics</div>
              </div>
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>
        </div>
      </div>

      {/* Second Row - Performance Insights */}
      {stats.totalInterviews > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Lightbulb className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Performance Insights</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.bestPerformingType && stats.bestPerformingType !== "N/A" && (
              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-green-400 font-medium text-sm">Strength</span>
                </div>
                <div className="text-white font-semibold">{stats.bestPerformingType}</div>
              </div>
            )}
            
            {stats.worstPerformingType && stats.worstPerformingType !== "N/A" && (
              <div className="p-4 bg-orange-900/20 border border-orange-700 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-4 w-4 text-orange-400" />
                  <span className="text-orange-400 font-medium text-sm">Focus Area</span>
                </div>
                <div className="text-white font-semibold">{stats.worstPerformingType}</div>
              </div>
            )}
            
            {stats.improvementRate > 0 && (
              <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-400 font-medium text-sm">Growth</span>
                </div>
                <div className="text-white font-semibold">+{stats.improvementRate}%</div>
              </div>
            )}
            
            {stats.currentStreak >= 3 && (
              <div className="p-4 bg-purple-900/20 border border-purple-700 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Flame className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-400 font-medium text-sm">Streak</span>
                </div>
                <div className="text-white font-semibold">{stats.currentStreak} days</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Third Row - Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Focus */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Star className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">Today's Focus</h3>
          </div>
          
          <div className="space-y-3">
            {generateDailyFocus(interviews, stats).map((focus) => (
              <div key={focus.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{focus.icon}</span>
                  <div>
                    <div className="text-white text-sm font-medium">{focus.text}</div>
                    <div className="text-gray-400 text-xs">{focus.description}</div>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 ${
                  focus.completed 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-gray-500'
                } flex items-center justify-center`}>
                  {focus.completed && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Activity className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
            </div>
            <Button 
              onClick={() => onTabChange('interviews')} 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-white"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {interviews.length > 0 ? (
            <div className="space-y-3">
              {interviews.slice(0, 3).map((interview) => (
                <div key={interview.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      interview.type === 'technical' ? 'bg-blue-600' :
                      interview.type === 'behavioral' ? 'bg-green-600' :
                      interview.type === 'system-design' ? 'bg-purple-600' :
                      'bg-orange-600'
                    }`}>
                      {interview.type === 'technical' ? '💻' :
                       interview.type === 'behavioral' ? '🤝' :
                       interview.type === 'system-design' ? '🏗️' : '⚡'}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium capitalize">
                        {interview.type.replace('-', ' ')}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {new Date(interview.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {interview.score && (
                    <div className={`text-sm font-semibold ${
                      interview.score >= 80 ? 'text-green-400' :
                      interview.score >= 60 ? 'text-blue-400' :
                      'text-orange-400'
                    }`}>
                      {interview.score}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-gray-400 text-sm mb-3">No interviews completed yet</div>
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/createinterview">Start First Interview</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Key Metrics */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Key Metrics</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">This Week</span>
              <span className="text-white font-medium">
                {interviews.filter((i) => {
                  const date = new Date(i.createdAt);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return date >= weekAgo;
                }).length} interviews
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Average Duration</span>
              <span className="text-white font-medium">
                {Math.round((stats.hoursSpent / Math.max(stats.totalInterviews, 1)) * 60)} min
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Completion Rate</span>
              <span className="text-white font-medium">{stats.completionRate || 0}%</span>
            </div>
            
            <div className="flex items-center justify-between pt-3 border-t border-gray-700">
              <span className="text-gray-400">Next Goal</span>
              <span className="text-blue-400 font-medium">
                {stats.averageScore < 70 ? "70% Average" : 
                 stats.averageScore < 85 ? "85% Average" : 
                 stats.totalInterviews < 50 ? "50 Interviews" : "100 Interviews"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row - Skills & Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Skills Overview */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Skills Overview</h3>
            <Button 
              onClick={() => onTabChange('analytics')} 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-white"
            >
              Details
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {Object.keys(stats.strengthsMap).length > 0 || Object.keys(stats.weaknessesMap).length > 0 ? (
            <div className="space-y-4">
              {Object.keys(stats.strengthsMap).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-green-400 mb-2">Strengths</div>
                  <div className="space-y-2">
                    {Object.entries(stats.strengthsMap).slice(0, 3).map(([skill, score]) => (
                      <div key={skill} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                        <span className="text-gray-300 text-sm">{skill}</span>
                        <span className="text-green-400 font-medium text-sm">{score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {Object.keys(stats.weaknessesMap).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-orange-400 mb-2">Areas to Improve</div>
                  <div className="space-y-2">
                    {Object.entries(stats.weaknessesMap).slice(0, 3).map(([skill, score]) => (
                      <div key={skill} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                        <span className="text-gray-300 text-sm">{skill}</span>
                        <span className="text-orange-400 font-medium text-sm">{score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-sm mb-3">Complete interviews to see skill analysis</div>
              <Button asChild size="sm" variant="outline" className="border-gray-600 text-gray-400 hover:bg-gray-700">
                <Link href="/createinterview">Start Practice</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Recent Achievements */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">Recent Achievements</h3>
            </div>
            <Button 
              onClick={() => onTabChange('achievements')} 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-white"
            >
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          {achievements.filter(a => a.earned).length > 0 ? (
            <div className="space-y-3">
              {achievements.filter(a => a.earned).slice(0, 3).map((achievement) => (
                <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                  <span className="text-lg">{achievement.icon}</span>
                  <div>
                    <div className="text-white text-sm font-medium">{achievement.name}</div>
                    <div className="text-gray-400 text-xs">{achievement.description}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 text-sm mb-3">No achievements earned yet</div>
              <div className="text-gray-500 text-xs">Complete interviews to unlock achievements</div>
            </div>
          )}
        </div>
      </div>

      {/* Third Row - Weekly Summary */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Weekly Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span className="text-gray-300 text-sm font-medium">Sessions</span>
            </div>
            <div className="text-xl font-bold text-white">
              {interviews.filter((i) => {
                const date = new Date(i.createdAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date >= weekAgo;
              }).length}
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-purple-400" />
              <span className="text-gray-300 text-sm font-medium">Time Spent</span>
            </div>
            <div className="text-xl font-bold text-white">
              {Math.round(interviews.filter((i) => {
                const date = new Date(i.createdAt);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return date >= weekAgo;
              }).length * 0.75)}h
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-gray-300 text-sm font-medium">Progress</span>
            </div>
            <div className="text-xl font-bold text-green-400">
              {stats.improvementRate > 0 ? `+${stats.improvementRate}%` : 'Stable'}
            </div>
          </div>
          
          <div className="text-center p-4 bg-gray-700 rounded-lg">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="text-gray-300 text-sm font-medium">Achievements</span>
            </div>
            <div className="text-xl font-bold text-white">
              {achievements.filter(a => a.earned).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;