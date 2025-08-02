"use client"
import React from 'react';
import { 
  BarChart3, 
  Calendar, 
  Trophy, 
  Target, 
  TrendingUp, 
  Star, 
  Clock, 
  CheckCircle,
  Plus,
  BookOpen,
  Video,
  Eye,
  Download,
  Share2,
  PlayCircle
} from 'lucide-react';

export default function DashboardPage() {
  // Mock data
  const userStats = {
    totalInterviews: 12,
    practiceHours: 24,
    averageScore: 87,
    improvement: 23,
    streak: 5,
    remainingSessions: 8,
    plan: 'Free Plan'
  };

  const recentInterviews = [
    {
      id: 1,
      title: 'Google Software Engineer',
      date: '2025-01-28',
      duration: '45 min',
      score: 92,
      type: 'Technical',
      feedback: 'Excellent problem-solving approach'
    },
    {
      id: 2,
      title: 'Meta Product Manager',
      date: '2025-01-27',
      duration: '35 min',
      score: 85,
      type: 'Behavioral',
      feedback: 'Good communication skills'
    },
    {
      id: 3,
      title: 'Amazon ML Engineer',
      date: '2025-01-26',
      duration: '50 min',
      score: 88,
      type: 'Technical',
      feedback: 'Strong technical knowledge'
    }
  ];

  const skillMetrics = [
    { name: 'Problem Solving', score: 88, change: +5 },
    { name: 'Communication', score: 82, change: +2 },
    { name: 'Technical Knowledge', score: 79, change: +8 },
    { name: 'Leadership', score: 74, change: +1 }
  ];

  return (
    <div className="p-4 lg:p-8">
      <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-2xl p-6 border border-blue-500/20">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">Welcome back, Alex! 👋</h1>
            <p className="text-gray-300">Ready to ace your next interview? Let's continue your prep journey.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all flex items-center justify-center">
              <Plus className="w-4 h-4 mr-2" />
              New Interview
            </button>
            <button className="border border-gray-600 text-gray-300 hover:bg-gray-800 px-6 py-3 rounded-xl transition-all flex items-center justify-center">
              <BookOpen className="w-4 h-4 mr-2" />
              Browse Templates
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
            <span className="text-green-400 text-sm bg-green-500/20 px-2 py-1 rounded-full">+{userStats.improvement}%</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{userStats.totalInterviews}</div>
          <div className="text-gray-400 text-sm">Total Interviews</div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Trophy className="w-6 h-6 text-purple-400" />
            </div>
            <span className="text-purple-400 text-sm">Top 15%</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{userStats.averageScore}</div>
          <div className="text-gray-400 text-sm">Average Score</div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-green-400 text-sm">{userStats.streak} days 🔥</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{userStats.practiceHours}</div>
          <div className="text-gray-400 text-sm">Practice Hours</div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-400" />
            </div>
            <span className="text-yellow-400 text-sm">Free Plan</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{userStats.remainingSessions}</div>
          <div className="text-gray-400 text-sm">Sessions Left</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Recent Interviews */}
        <div className="xl:col-span-2">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Recent Interviews</h3>
              <button className="text-blue-400 hover:text-blue-300 text-sm">View All</button>
            </div>
            <div className="space-y-4">
              {recentInterviews.map((interview) => (
                <div key={interview.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Video className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{interview.title}</h4>
                        <p className="text-gray-400 text-sm">{interview.type} • {interview.duration}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        interview.score >= 90 
                          ? 'bg-green-500/20 text-green-400' 
                          : interview.score >= 80 
                          ? 'bg-yellow-500/20 text-yellow-400' 
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {interview.score}/100
                      </span>
                      <button className="text-gray-400 hover:text-white">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{interview.feedback}</p>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>{new Date(interview.date).toLocaleDateString()}</span>
                    <div className="flex space-x-3">
                      <button className="hover:text-white flex items-center">
                        <Download className="w-3 h-3 mr-1" />
                        Report
                      </button>
                      <button className="hover:text-white flex items-center">
                        <Share2 className="w-3 h-3 mr-1" />
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-xl flex items-center">
                <PlayCircle className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Start Practice</div>
                  <div className="text-xs opacity-80">Quick 15-min session</div>
                </div>
              </button>
              <button className="w-full border border-gray-600 text-gray-300 hover:bg-gray-800 p-4 rounded-xl flex items-center">
                <Calendar className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Schedule Interview</div>
                  <div className="text-xs opacity-80">Plan your practice</div>
                </div>
              </button>
              <button className="w-full border border-gray-600 text-gray-300 hover:bg-gray-800 p-4 rounded-xl flex items-center">
                <BarChart3 className="w-5 h-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">View Analytics</div>
                  <div className="text-xs opacity-80">Track progress</div>
                </div>
              </button>
            </div>
          </div>

          {/* Skill Progress */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Skill Progress</h3>
            <div className="space-y-4">
              {skillMetrics.slice(0, 3).map((skill, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm">{skill.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-300 text-sm">{skill.score}/100</span>
                      <span className="text-green-400 text-xs bg-green-500/20 px-2 py-1 rounded-full">
                        +{skill.change}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${skill.score}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievement */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Latest Achievement</h3>
            <div className="text-center">
              <div className="text-4xl mb-3">🔥</div>
              <h4 className="text-white font-medium mb-1">Week Streak!</h4>
              <p className="text-gray-400 text-sm">Practiced for 7 consecutive days</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}