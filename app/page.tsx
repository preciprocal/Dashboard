"use client"
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnimatedLoader from "@/components/loader/AnimatedLoader";
import { 
  Search, 
  ArrowRight,
  Clock,
  Users,
  BookOpen,
  FileText,
  Star,
  Brain,
  TrendingUp,
  Sparkles,
  Calendar,
  MoreHorizontal,
  Target,
  Award,
  Zap,
  Activity,
  BarChart3,
  PieChart,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  ExternalLink,
  Bell,
  Filter,
  Video,
  MessageSquare,
  Briefcase,
  Building,
  Globe,
  Phone,
  Mail,
  Edit3,
  Share2,
  Bookmark,
  Eye,
  PlayCircle,
  PauseCircle,
  ArrowUp,
  ArrowDown,
  Plus,
  Minus
} from 'lucide-react';

const ProfessionalDashboard = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [activeMetric, setActiveMetric] = useState('interviews');
  const [performanceView, setPerformanceView] = useState('week'); // 'week' or 'month'

  // Mock data that would come from your Firebase/API
  const dashboardData = {
    user: {
      name: "Alex Johnson",
      email: "alex.johnson@email.com",
      title: "Senior Software Engineer",
      company: "TechCorp Inc.",
      profileImage: null
    },
    metrics: {
      totalInterviews: 24,
      averageScore: 87,
      successRate: 76,
      totalResumes: 8,
      activeApplications: 12,
      responseRate: 23
    },
    recentActivity: [
      { id: 1, type: 'interview', title: 'Technical Interview - Google', score: 92, date: '2 hours ago', status: 'completed' },
      { id: 2, type: 'resume', title: 'Resume Analysis - Meta', score: 85, date: '5 hours ago', status: 'analyzed' },
      { id: 3, type: 'application', title: 'Applied to Senior Engineer - Apple', date: '1 day ago', status: 'pending' },
      { id: 4, type: 'interview', title: 'System Design - Microsoft', score: 88, date: '2 days ago', status: 'completed' }
    ],
    upcomingEvents: [
      { id: 1, title: 'Technical Interview', company: 'Netflix', time: '2:00 PM', date: 'Today', type: 'interview' },
      { id: 2, title: 'HR Screening', company: 'Amazon', time: '10:30 AM', date: 'Tomorrow', type: 'screening' },
      { id: 3, title: 'Final Round', company: 'Tesla', time: '3:00 PM', date: 'Friday', type: 'final' }
    ],
    weeklyProgress: [
      { day: 'Mon', interviews: 2, score: 85 },
      { day: 'Tue', interviews: 1, score: 92 },
      { day: 'Wed', interviews: 3, score: 78 },
      { day: 'Thu', interviews: 2, score: 88 },
      { day: 'Fri', interviews: 1, score: 95 },
      { day: 'Sat', interviews: 0, score: 0 },
      { day: 'Sun', interviews: 1, score: 82 }
    ],
    monthlyProgress: [
      { day: 'Week 1', interviews: 8, score: 82 },
      { day: 'Week 2', interviews: 12, score: 85 },
      { day: 'Week 3', interviews: 15, score: 88 },
      { day: 'Week 4', interviews: 18, score: 90 }
    ],
    documents: [
      { id: 1, name: 'Resume_Software_Engineer_2024.pdf', type: 'resume', size: '245 KB', modified: '2 hours ago', score: 92 },
      { id: 2, name: 'Cover_Letter_Google.pdf', type: 'cover-letter', size: '180 KB', modified: '1 day ago', score: null },
      { id: 3, name: 'Portfolio_Projects.pdf', type: 'portfolio', size: '1.2 MB', modified: '3 days ago', score: null },
      { id: 4, name: 'Interview_Notes_Meta.docx', type: 'notes', size: '95 KB', modified: '5 days ago', score: null }
    ]
  };

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setIsLoading(false), 2000);
  }, []);

  const getInitials = (name) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase();
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'analyzed': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleNewInterview = () => {
    setIsLoading(true);
    setTimeout(() => {
      router.push('/interview');
    }, 1000);
  };

  const handleUploadResume = () => {
    setIsLoading(true);
    setTimeout(() => {
      router.push('/resume/upload');
    }, 1000);
  };

  const getCurrentProgressData = () => {
    return performanceView === 'week' ? dashboardData.weeklyProgress : dashboardData.monthlyProgress;
  };

  const getMaxInterviews = () => {
    const currentData = getCurrentProgressData();
    return Math.max(...currentData.map(item => item.interviews));
  };

  if (isLoading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading Dashboard"
        onHide={() => console.log('Dashboard loaded')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white text-xl font-bold">
              {dashboardData.user.profileImage ? (
                <img src={dashboardData.user.profileImage} alt="Profile" className="w-full h-full rounded-xl object-cover" />
              ) : (
                getInitials(dashboardData.user.name)
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Welcome back, {dashboardData.user.name.split(' ')[0]}!</h1>
              <p className="text-gray-400">{dashboardData.user.title} at {dashboardData.user.company}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 mt-4 lg:mt-0">
            <button 
              onClick={handleNewInterview}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>New Interview</span>
            </button>
            <button 
              onClick={handleUploadResume}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-all duration-200 transform hover:scale-105"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Resume</span>
            </button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-900/30 rounded-lg">
                <Target className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-green-400 text-sm flex items-center">
                <ArrowUp className="w-4 h-4 mr-1" />
                +12%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white">{dashboardData.metrics.totalInterviews}</h3>
            <p className="text-gray-400 text-sm">Total Interviews</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-green-400 text-sm flex items-center">
                <ArrowUp className="w-4 h-4 mr-1" />
                +5%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white">{dashboardData.metrics.averageScore}%</h3>
            <p className="text-gray-400 text-sm">Average Score</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-900/30 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-green-400 text-sm flex items-center">
                <ArrowUp className="w-4 h-4 mr-1" />
                +8%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white">{dashboardData.metrics.successRate}%</h3>
            <p className="text-gray-400 text-sm">Success Rate</p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-yellow-900/30 rounded-lg">
                <FileText className="w-6 h-6 text-yellow-400" />
              </div>
              <span className="text-yellow-400 text-sm flex items-center">
                <ArrowUp className="w-4 h-4 mr-1" />
                +3
              </span>
            </div>
            <h3 className="text-2xl font-bold text-white">{dashboardData.metrics.activeApplications}</h3>
            <p className="text-gray-400 text-sm">Active Applications</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* AI Assistant Card */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-700/30">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Brain className="w-6 h-6 mr-2 text-purple-400" />
                AI Career Assistant
              </h2>
              
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Ask me anything about your career, interviews, or resume..."
                  className="w-full pl-12 pr-12 py-3 text-sm border-0 rounded-xl bg-gray-800/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {['Resume Feedback', 'Interview Tips', 'Salary Negotiation', 'Career Path'].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="px-3 py-2 bg-gray-800/50 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700/50 transition-colors border border-gray-700"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly Performance Chart */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">
                  {performanceView === 'week' ? 'Weekly' : 'Monthly'} Performance
                </h3>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setPerformanceView('week')}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      performanceView === 'week' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Week
                  </button>
                  <button 
                    onClick={() => setPerformanceView('month')}
                    className={`px-3 py-1 rounded-lg text-sm transition-all duration-200 ${
                      performanceView === 'month' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {getCurrentProgressData().map((item) => (
                  <div key={item.day} className="flex items-center space-x-4">
                    <div className="w-16 text-sm text-gray-400 font-medium">{item.day}</div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm text-white">{item.interviews} interviews</span>
                        {item.score > 0 && (
                          <span className={`text-sm font-medium ${getScoreColor(item.score)}`}>
                            {item.score}% avg
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(item.interviews / getMaxInterviews()) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700" style={{ minHeight: '400px' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Recent Activity</h3>
                <button className="text-purple-400 text-sm hover:text-purple-300 transition-colors">View All</button>
              </div>
              
              <div className="space-y-4">
                {dashboardData.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      activity.type === 'interview' ? 'bg-purple-900/30' :
                      activity.type === 'resume' ? 'bg-blue-900/30' :
                      'bg-green-900/30'
                    }`}>
                      {activity.type === 'interview' && <Video className="w-5 h-5 text-purple-400" />}
                      {activity.type === 'resume' && <FileText className="w-5 h-5 text-blue-400" />}
                      {activity.type === 'application' && <Briefcase className="w-5 h-5 text-green-400" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{activity.title}</h4>
                      <p className="text-gray-400 text-sm">{activity.date}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {activity.score && (
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getScoreColor(activity.score)} bg-gray-800`}>
                          {activity.score}%
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getStatusColor(activity.status)}`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            
            {/* Upcoming Events */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Upcoming Events</h3>
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="space-y-3">
                {dashboardData.upcomingEvents.map((event) => (
                  <div key={event.id} className="p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-white font-medium text-sm">{event.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        event.type === 'interview' ? 'bg-purple-900/30 text-purple-400' :
                        event.type === 'screening' ? 'bg-blue-900/30 text-blue-400' :
                        'bg-green-900/30 text-green-400'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{event.company}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400 text-xs">{event.time} - {event.date}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <button className="w-full mt-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
                Schedule New Event
              </button>
            </div>

            {/* Documents Section */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Documents</h3>
                <button className="text-purple-400 hover:text-purple-300 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3">
                {dashboardData.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center space-x-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700/70 transition-colors group">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      doc.type === 'resume' ? 'bg-red-900/30' :
                      doc.type === 'cover-letter' ? 'bg-blue-900/30' :
                      doc.type === 'portfolio' ? 'bg-purple-900/30' :
                      'bg-green-900/30'
                    }`}>
                      <FileText className={`w-5 h-5 ${
                        doc.type === 'resume' ? 'text-red-400' :
                        doc.type === 'cover-letter' ? 'text-blue-400' :
                        doc.type === 'portfolio' ? 'text-purple-400' :
                        'text-green-400'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium text-sm truncate">{doc.name}</h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-xs">{doc.size}</span>
                        <span className="text-gray-400 text-xs">•</span>
                        <span className="text-gray-400 text-xs">{doc.modified}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.score && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(doc.score)} bg-gray-800`}>
                          {doc.score}%
                        </span>
                      )}
                      <button className="p-1.5 hover:bg-gray-600 rounded transition-colors">
                        <Download className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-600 rounded transition-colors">
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 rounded-xl p-6 border border-blue-700/30">
              <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Response Rate</span>
                  </div>
                  <span className="text-white font-medium">{dashboardData.metrics.responseRate}%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Resume Score</span>
                  </div>
                  <span className="text-white font-medium">92%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Interview Streak</span>
                  </div>
                  <span className="text-white font-medium">7 days</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-gray-300 text-sm">Skill Level</span>
                  </div>
                  <span className="text-white font-medium">Advanced</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Learning & Development Section */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Learning & Development</h3>
            <button className="text-purple-400 hover:text-purple-300 transition-colors text-sm">View All Courses</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">System Design Mastery</h4>
                  <p className="text-gray-400 text-xs">8 hours • Advanced</p>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div className="bg-purple-600 h-2 rounded-full transition-all duration-500" style={{ width: '65%' }}></div>
              </div>
              <p className="text-gray-400 text-xs">65% complete</p>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Behavioral Interview Prep</h4>
                  <p className="text-gray-400 text-xs">4 hours • Intermediate</p>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: '90%' }}></div>
              </div>
              <p className="text-gray-400 text-xs">90% complete</p>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">Leadership Skills</h4>
                  <p className="text-gray-400 text-xs">6 hours • Beginner</p>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: '25%' }}></div>
              </div>
              <p className="text-gray-400 text-xs">25% complete</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalDashboard;