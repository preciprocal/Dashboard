"use client"
import React, { useState } from 'react';
import { 
  Search, 
  Plus,
  MoreHorizontal,
  Target,
  Trophy,
  Clock,
  Star,
  Play,
  FileText,
  BookOpen,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  MessageCircle,
  Brain
} from 'lucide-react';

export default function DashboardPage() {
  const [selectedTab, setSelectedTab] = useState('All');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Mock data - this would come from props or API in real implementation
  const userStats = {
    totalInterviews: 12,
    averageScore: 85,
    currentStreak: 7,
    practiceHours: 24,
    improvement: 15,
    remainingSessions: 8
  };

  const recentSessions = [
    {
      id: 1,
      title: "Technical Interview",
      subtitle: "JavaScript & React Focus",
      date: "Aug 27, 2024",
      score: 88,
      type: "technical"
    },
    {
      id: 2,
      title: "System Design",
      subtitle: "Scalable Architecture",
      date: "Aug 28, 2024",
      score: 82,
      type: "system-design"
    },
    {
      id: 3,
      title: "Behavioral Interview",
      subtitle: "Leadership & Communication",
      date: "Aug 29, 2024",
      score: 90,
      type: "behavioral"
    }
  ];

  const assistants = [
    { icon: User, label: "Interview Coach", description: "Practice with AI coach" },
    { icon: FileText, label: "Resume Reviewer", description: "Optimize your resume" },
    { icon: MessageCircle, label: "Q&A Assistant", description: "Get instant answers" },
    { icon: Brain, label: "Skill Assessor", description: "Evaluate your skills" }
  ];

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const tabs = ['All', 'AI Assistant', 'Your Plan', 'Friends', 'Recent', 'Documents', 'Templates', 'Overview'];

  return (
    <div className="min-h-screen">
      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 sticky top-0 z-20 -mx-4 lg:-mx-8 mb-6 lg:mb-8">
        <div className="flex space-x-4 lg:space-x-8 overflow-x-auto scrollbar-hide py-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={`py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                selectedTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-6 lg:space-y-8">
          {/* Welcome Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Hey, How can I help you?
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Active</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Extra</span>
                  </div>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.remainingSessions}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Sessions left</div>
              </div>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for templates and documents"
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white p-1.5 rounded-md hover:bg-blue-700">
                <Search className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Interview Template</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Technical</span>
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Behavioral</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-8 h-8 text-blue-600" />
                <span className="text-green-600 text-sm font-medium">+{userStats.improvement}%</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.totalInterviews}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Interviews</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-8 h-8 text-yellow-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Excellent</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.averageScore}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Average Score</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Clock className="w-8 h-8 text-green-600" />
                <span className="text-orange-600 text-sm">{userStats.currentStreak} days 🔥</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.practiceHours}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Practice Hours</div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Star className="w-8 h-8 text-purple-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400">Pro Plan</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{userStats.remainingSessions}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Sessions Left</div>
            </div>
          </div>

          {/* Recently Launched */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recently Launched</h2>
              <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View all</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recentSessions.map((session) => (
                <div key={session.id} className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      session.type === 'technical' ? 'bg-blue-500' :
                      session.type === 'system-design' ? 'bg-purple-500' : 'bg-green-500'
                    }`}></div>
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{session.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{session.subtitle}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{session.date}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-900 dark:text-white font-medium">{session.score}%</span>
                      <button className="text-blue-600 hover:text-blue-700">
                        <Play className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Documents</h2>
              <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-700">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">New Folder</span>
              </button>
            </div>

            <div className="space-y-3">
              {[
                { title: "Interview Templates", desc: "Common questions and best practices", color: "purple", date: "Aug 24, 2024" },
                { title: "Study Materials", desc: "Technical concepts and frameworks", color: "orange", date: "Aug 25, 2024" },
                { title: "Performance Reports", desc: "Analytics and improvement insights", color: "pink", date: "Aug 26, 2024" }
              ].map((doc, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">{doc.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{doc.desc}</p>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{doc.date}</span>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
              Show All
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Personalized Course */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Personalized Course</h3>
            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-gray-600 dark:text-gray-400">
              <span>08 hours</span>
              <span>30 minutes in total</span>
              <Settings className="w-4 h-4 text-gray-500" />
            </div>
            
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div className="bg-blue-600 h-2 rounded-full w-3/4"></div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-sm border border-gray-300 dark:border-gray-600">Pause</button>
              <button className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">Active</button>
              <button className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">Extra</button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Designed to foster inclusivity and leverage diverse perspectives.
            </p>

            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              See more →
            </button>
          </div>

          {/* Unlock AI Section */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Unlock AI at your school</h3>
            
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">Unlimited Spaces</span>
                <div className="w-2 h-2 bg-green-500 rounded-full ml-auto"></div>
                <span className="text-gray-700 dark:text-gray-300">Training & Support</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">Mission Control+</span>
                <div className="w-2 h-2 bg-orange-500 rounded-full ml-auto"></div>
                <span className="text-gray-700 dark:text-gray-300">Latest AI models</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">LMS Integrations</span>
                <div className="w-2 h-2 bg-yellow-500 rounded-full ml-auto"></div>
                <span className="text-gray-700 dark:text-gray-300">and more!</span>
              </div>
            </div>

            <button className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 text-sm font-medium">
              See more
            </button>
          </div>

          {/* Assistants */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Assistants</h3>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs rounded-full">Assistants</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assistants.map((assistant, index) => (
                <div key={index} className="text-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-2">
                    <assistant.icon className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">{assistant.label}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{assistant.description}</p>
                </div>
              ))}
            </div>

            <button className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
              See more
            </button>
          </div>

          {/* Learning Schedule */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white">Learning Schedule</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Monthly</span>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="text-center mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">August 2024</h4>
            </div>

            {/* Mini Calendar */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-4">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="p-2 text-gray-500 dark:text-gray-400 font-medium">{day}</div>
              ))}
              {getCalendarDays().map((date, index) => (
                <div key={index} className={`p-2 rounded ${
                  date.getMonth() === currentDate.getMonth() 
                    ? date.getDate() === 19 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {date.getDate()}
                </div>
              ))}
            </div>

            {/* Today's Schedule */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Today</div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Technical Interview Prep</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">12:00 - 01:00 PM</p>
                </div>
                <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}