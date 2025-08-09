// components/profile/InterviewsTab.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Target,
  FileText,
  Star,
  CheckCircle,
  BarChart3,
  BookOpen,
  TrendingUp,
  Filter,
  Search,
  Calendar,
  Clock,
  Trophy,
  Eye,
  RotateCcw,
  Play
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

interface UserStats {
  totalInterviews: number;
  averageScore: number;
  currentStreak: number;
  successRate?: number;
}

interface InterviewsTabProps {
  interviews: Interview[];
  stats: UserStats;
  onTabChange: (tab: string) => void;
}

// Professional Interview Card Component
const InterviewCard: React.FC<{ interview: Interview }> = ({ interview }) => {
  const getTypeConfig = (type: string) => {
    const configs = {
      technical: { icon: '💻', color: 'bg-blue-600', label: 'Technical' },
      behavioral: { icon: '🤝', color: 'bg-green-600', label: 'Behavioral' },
      'system-design': { icon: '🏗️', color: 'bg-purple-600', label: 'System Design' },
      coding: { icon: '⚡', color: 'bg-orange-600', label: 'Coding' },
      mixed: { icon: '🔀', color: 'bg-pink-600', label: 'Mixed' }
    };
    return configs[type as keyof typeof configs] || configs.mixed;
  };

  const typeConfig = getTypeConfig(interview.type);
  const isCompleted = interview.score && interview.score > 0;
  const formattedDate = new Date(interview.createdAt).toLocaleDateString();

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 hover:border-gray-600 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4">
          <div className={`w-12 h-12 ${typeConfig.color} rounded-lg flex items-center justify-center text-white text-xl`}>
            {typeConfig.icon}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">{interview.role}</h3>
            <div className="flex items-center space-x-3 text-sm text-gray-400">
              <span>{typeConfig.label}</span>
              <span>•</span>
              <span>{formattedDate}</span>
              {interview.company && (
                <>
                  <span>•</span>
                  <span>{interview.company}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {isCompleted && (
          <div className="text-right">
            <div className={`text-xl font-bold ${
              interview.score >= 80 ? 'text-green-400' :
              interview.score >= 60 ? 'text-blue-400' :
              'text-orange-400'
            }`}>
              {interview.score}%
            </div>
            <div className="text-gray-400 text-xs">Score</div>
          </div>
        )}
      </div>

      {/* Tech Stack */}
      {interview.techstack && interview.techstack.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {interview.techstack.slice(0, 4).map((tech, index) => (
              <span key={index} className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">
                {tech}
              </span>
            ))}
            {interview.techstack.length > 4 && (
              <span className="px-2 py-1 bg-gray-700 text-gray-400 rounded text-xs">
                +{interview.techstack.length - 4} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {isCompleted ? (
          <>
            <Button asChild className="flex-1 bg-blue-600 hover:bg-blue-700">
              <Link href={`/interview/${interview.id}/feedback`}>
                <Eye className="w-4 h-4 mr-2" />
                View Results
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700">
              <Link href={`/interview/${interview.id}`}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Practice Again
              </Link>
            </Button>
          </>
        ) : (
          <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
            <Link href={`/interview/${interview.id}`}>
              <Play className="w-4 h-4 mr-2" />
              Start Interview
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};

const InterviewsTab: React.FC<InterviewsTabProps> = ({
  interviews,
  stats,
  onTabChange
}) => {
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInterviews = interviews.filter(interview => {
    const matchesType = filterType === "all" || interview.type === filterType;
    const matchesSearch = interview.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         interview.company.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const interviewTypes = [
    { value: "all", label: "All Types" },
    { value: "technical", label: "Technical" },
    { value: "behavioral", label: "Behavioral" },
    { value: "system-design", label: "System Design" },
    { value: "coding", label: "Coding" }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Interview History</h2>
            <p className="text-gray-400">Track your progress and performance</p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={() => onTabChange('analytics')} variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/createinterview">
                <Target className="w-4 h-4 mr-2" />
                New Interview
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {interviews.length > 0 ? (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
              <FileText className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{stats.totalInterviews}</div>
              <div className="text-gray-400 text-sm">Total Interviews</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
              <Star className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{stats.averageScore}%</div>
              <div className="text-gray-400 text-sm">Average Score</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
              <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{stats.currentStreak}</div>
              <div className="text-gray-400 text-sm">Current Streak</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 text-center">
              <CheckCircle className="w-8 h-8 text-orange-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">{stats.successRate || 0}%</div>
              <div className="text-gray-400 text-sm">Success Rate</div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search interviews by role or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {interviewTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Interview List */}
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                {filteredInterviews.length} Interview{filteredInterviews.length !== 1 ? 's' : ''}
                {filterType !== "all" && ` • ${interviewTypes.find(t => t.value === filterType)?.label}`}
              </h3>
            </div>
            
            <div className="p-6">
              {filteredInterviews.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredInterviews.map((interview) => (
                    <InterviewCard key={interview.id} interview={interview} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No interviews match your current filters</p>
                  <Button 
                    onClick={() => {
                      setFilterType("all");
                      setSearchQuery("");
                    }}
                    variant="outline"
                    size="sm"
                    className="mt-3 border-gray-600 text-gray-400 hover:bg-gray-700"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-4">No Interviews Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Start your interview preparation journey with your first mock interview.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/createinterview">
                <Target className="w-4 h-4 mr-2" />
                Start First Interview
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <Link href="/templates">
                <BookOpen className="w-4 h-4 mr-2" />
                Browse Templates
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewsTab;