"use client"
import React, { useState } from 'react';
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
  MoreHorizontal
} from 'lucide-react';

const Dashboard = () => {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Main Layout - Left 70% and Right 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        
        {/* Left Side - 70% */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Top Two Cards - AI Assistant and Personalized Course */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* AI Assistant Card */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-5">
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Hey, How can I help you?
                </h2>
                
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search for templates and documents"
                    className="w-full pl-10 pr-12 py-2.5 text-sm border-0 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:outline-none shadow-sm"
                  />
                  <button className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {['Invoice Template', 'Agreement', 'Story Outline'].map((template) => (
                    <button
                      key={template}
                      className="px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Personalized Course Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Personalized Course
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
                    <span>08 hours 30 minutes in total</span>
                    <span>📈</span>
                  </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-2">
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: '60%' }}></div>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: '80%' }}></div>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: '40%' }}></div>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Pause</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Active</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-green-600 dark:text-green-400">Extra</span>
                  </div>
                </div>

                <p className="text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                  Designed to foster inclusivity and leverage diverse perspectives.
                </p>
              </div>
            </div>
          </div>

          {/* Recently Launched Section */}
          <div className="space-y-4">
            {/* Header with Recently Launched title */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recently Launched</h2>
              <button className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg">
                View all
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Study Techniques Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="inline-block px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-medium">
                    Study Techniques
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                      New Workbook : Absolutely! Here's a suggestion
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>Aug 27, 2024</span>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  <button className="flex items-center text-purple-600 dark:text-purple-400 text-xs font-medium hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
                    <span>See more</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Article Generator Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="inline-block px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full text-xs font-medium">
                    Article Generator
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                      New Workbook : Certainly! in order to help you generate
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>Aug 28, 2024</span>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  <button className="flex items-center text-purple-600 dark:text-purple-400 text-xs font-medium hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
                    <span>See more</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>

              {/* Paragraph Generator Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="inline-block px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full text-xs font-medium">
                    Paragraph Generator
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-sm text-gray-900 dark:text-white font-medium leading-relaxed">
                      New Workbook : In today's highly competitive business
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>Aug 29, 2024</span>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  <button className="flex items-center text-purple-600 dark:text-purple-400 text-xs font-medium hover:text-purple-700 dark:hover:text-purple-300 transition-colors">
                    <span>See more</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - 30% */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Top Row Alignment - Unlock AI Card (aligns with AI Assistant and Personalized Course) */}
          <div className="h-full">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 h-full flex flex-col">
              <div className="space-y-4 flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Unlock AI at your school
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-xs">
                  Get premium features for enhanced learning
                </p>

                {/* Features Grid */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">Unlimited Spaces</span>
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full ml-auto"></div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">Training & Support</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">Mission Control+</span>
                    <div className="w-1.5 h-1.5 bg-pink-500 rounded-full ml-auto"></div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">Latest AI models</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">LMS Integrations</span>
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full ml-auto"></div>
                    <span className="text-xs text-gray-700 dark:text-gray-300">and more!</span>
                  </div>
                </div>

                <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-xl transition-colors flex items-center justify-center space-x-2 text-sm mt-auto">
                  <span>See more</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Documents and Learning Schedule Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Documents Section */}
        <div className="space-y-6 h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Documents</h2>
            <div className="flex items-center space-x-2">
              <button className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <span>+</span>
                <span>New Folder</span>
              </button>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            {/* Project generator */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Project generator</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">Suggest project topics that are relevant and innovati...</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-4">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Aug 24,2024</span>
              </div>
            </div>

            {/* Summarize Text */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">S</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Summarize Text</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">Effortlessly condense large text into shorter summarize...</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-4">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Aug 25,2024</span>
              </div>
            </div>

            {/* Article Generator */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Article Generator</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">Instantly create unique articles on into shorter......</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 ml-4">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>Aug 26,2024</span>
              </div>
            </div>
          </div>

          {/* Show All Button */}
          <button className="w-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium py-4 rounded-2xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
            Show All
          </button>
        </div>

        {/* Learning Schedule Section */}
        <div className="space-y-6 h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Learning Schedule</h2>
            <button className="flex items-center space-x-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <span>Monthly</span>
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 flex-1 flex flex-col">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">August 2024</h3>
              <div className="flex items-center space-x-1">
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <span className="text-gray-500 dark:text-gray-400 text-lg">‹</span>
                </button>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <span className="text-gray-500 dark:text-gray-400 text-lg">›</span>
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-5">
              {/* Week Days */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
              
              {/* Calendar Days */}
              {[15, 16, 17, 18, 19, 20, 21].map((date) => (
                <div key={date} className="flex justify-center py-1">
                  <button 
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-all duration-200 ${
                      date === 19 
                        ? 'bg-purple-600 text-white shadow-lg' 
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {date}
                  </button>
                </div>
              ))}
            </div>

            {/* Today Section */}
            <div className="space-y-3 flex-1 flex flex-col justify-end">
              <h4 className="font-semibold text-gray-900 dark:text-white">Today</h4>
              
              <div className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="w-1 h-12 bg-purple-600 rounded-full flex-shrink-0"></div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="font-semibold text-gray-900 dark:text-white">Figma Design Views</span>
                    </div>
                    <button className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex-shrink-0">
                      Join
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">12:00 - 01:00 PM</div>
                  
                  <div className="flex items-center space-x-1">
                    <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full border-2 border-white dark:border-gray-800"></div>
                    <div className="w-6 h-6 bg-gray-400 dark:bg-gray-500 rounded-full border-2 border-white dark:border-gray-800 -ml-2"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;