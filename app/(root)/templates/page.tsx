// app/(root)/templates/page.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { 
  AlertCircle, 
  Search, 
  X, 
  Play,
  Loader2,
  BookmarkCheck,
  Bookmark,
  Star,
  Users,
  Clock,
  MessageSquare,
  Filter,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

// Import data from separate file
import {
  interviewTemplates,
  categories as importedCategories,
  difficulties,
  types,
  durations,
} from "@/app/data/interviewTemplates";

// Process categories with proper icons
const categories = importedCategories || [];
const templateData = interviewTemplates || [];

interface Template {
  id: string;
  role: string;
  category: string;
  type: 'Technical' | 'Behavioral' | 'Mixed';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  techstack: string[];
  questions: number;
  duration: string;
  rating: number;
  completions: number;
  tags?: string[];
}

interface TemplateCardProps {
  template: Template;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template }) => {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  const handleStartInterview = async () => {
    setIsStarting(true);

    try {
      console.log('🎯 Starting interview for template:', template.id);
      
      const response = await fetch('/api/templates/interview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: template.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create interview');
      }

      console.log('✅ Interview created:', data.interviewId);
      
      // Redirect to interview page
      router.push(`/interview/${data.interviewId}`);
    } catch (error) {
      console.error('❌ Error starting interview:', error);
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case "Beginner":
        return "text-emerald-400 bg-emerald-500/10";
      case "Intermediate":
        return "text-amber-400 bg-amber-500/10";
      case "Advanced":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-slate-400 bg-slate-500/10";
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case "Technical":
        return "text-blue-400 bg-blue-500/10";
      case "Behavioral":
        return "text-purple-400 bg-purple-500/10";
      case "Mixed":
        return "text-indigo-400 bg-indigo-500/10";
      default:
        return "text-slate-400 bg-slate-500/10";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Technical":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case "Behavioral":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case "Mixed":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return <></>;
    }
  };

  return (
    <div className="glass-card border border-white/5 rounded-xl p-6 hover:border-purple-500/30 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
            {template.role}
          </h3>
          <p className="text-slate-400 text-sm line-clamp-2">
            {template.description}
          </p>
        </div>
        
        <button
          onClick={() => setIsBookmarked(!isBookmarked)}
          className={`p-2 rounded-lg transition-all duration-300 flex-shrink-0 ml-2 ${
            isBookmarked
              ? "bg-purple-600/20 text-purple-400"
              : "bg-white/5 text-slate-400 hover:bg-white/10"
          }`}
        >
          {isBookmarked ? (
            <BookmarkCheck className="w-5 h-5" />
          ) : (
            <Bookmark className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="text-white font-medium">{template.rating}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Users className="w-4 h-4" />
          <span>{template.completions.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-4 h-4" />
          <span>{template.duration}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <MessageSquare className="w-4 h-4" />
          <span>{template.questions} Qs</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${getDifficultyColor(template.difficulty)}`}>
          {template.difficulty}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${getTypeColor(template.type)}`}>
          {getTypeIcon(template.type)}
          {template.type}
        </span>
      </div>

      {/* Tech Stack */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {template.techstack.slice(0, 4).map((tech, index) => (
            <span
              key={index}
              className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs font-medium"
            >
              {tech}
            </span>
          ))}
          {template.techstack.length > 4 && (
            <span className="px-2.5 py-1 bg-slate-500/10 text-slate-400 rounded-md text-xs">
              +{template.techstack.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {template.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-md text-xs font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleStartInterview}
        disabled={isStarting}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isStarting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Starting Interview...</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            <span>Start Interview</span>
          </>
        )}
      </button>
    </div>
  );
};

export default function TemplatesPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedDuration, setSelectedDuration] = useState("All");
  const [showFilters, setShowFilters] = useState(false);

  // Dropdown states
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showDifficultyMenu, setShowDifficultyMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showDurationMenu, setShowDurationMenu] = useState(false);

  // Check authentication
  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [user, loading, router]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (showCategoryMenu && !target.closest('.category-dropdown')) {
        setShowCategoryMenu(false);
      }
      if (showDifficultyMenu && !target.closest('.difficulty-dropdown')) {
        setShowDifficultyMenu(false);
      }
      if (showTypeMenu && !target.closest('.type-dropdown')) {
        setShowTypeMenu(false);
      }
      if (showDurationMenu && !target.closest('.duration-dropdown')) {
        setShowDurationMenu(false);
      }
    };

    if (showCategoryMenu || showDifficultyMenu || showTypeMenu || showDurationMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryMenu, showDifficultyMenu, showTypeMenu, showDurationMenu]);

  // Filter templates based on search and filters
  const filteredTemplates = useMemo(() => {
    let filtered = templateData;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.role.toLowerCase().includes(query) ||
          template.description.toLowerCase().includes(query) ||
          template.category.toLowerCase().includes(query) ||
          template.techstack.some((tech) =>
            tech.toLowerCase().includes(query)
          ) ||
          (template.tags && template.tags.some((tag) =>
            tag.toLowerCase().includes(query)
          ))
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (template) => template.category === selectedCategory
      );
    }

    // Difficulty filter
    if (selectedDifficulty !== "All") {
      filtered = filtered.filter(
        (template) => template.difficulty === selectedDifficulty
      );
    }

    // Type filter
    if (selectedType !== "All") {
      filtered = filtered.filter((template) => template.type === selectedType);
    }

    // Duration filter
    if (selectedDuration !== "All") {
      filtered = filtered.filter((template) => {
        const duration = parseInt(template.duration);
        switch (selectedDuration) {
          case "< 30 min":
            return duration < 30;
          case "30-45 min":
            return duration >= 30 && duration <= 45;
          case "45-60 min":
            return duration > 45 && duration <= 60;
          case "> 60 min":
            return duration > 60;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [
    searchQuery,
    selectedCategory,
    selectedDifficulty,
    selectedType,
    selectedDuration,
  ]);

  // Get stats
  const stats = useMemo(() => {
    return {
      total: templateData.length,
      categories: categories.length - 1, // Exclude "All"
      avgRating: (
        templateData.reduce((sum, t) => sum + t.rating, 0) /
        templateData.length
      ).toFixed(1),
      totalCompletions: templateData.reduce(
        (sum, t) => sum + t.completions,
        0
      ),
    };
  }, []);

  // Handle authentication loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <AnimatedLoader isVisible={true} loadingText="Loading templates..." />
      </div>
    );
  }

  // Handle unauthenticated
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">
                Interview Templates
              </h1>
              <p className="text-slate-400 mt-1">
                Choose from {stats.total}+ professionally crafted interview templates
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="glass-card p-4 border border-white/5 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">
                {stats.total}+
              </div>
              <div className="text-sm text-slate-400">Templates</div>
            </div>
            <div className="glass-card p-4 border border-white/5 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">
                {stats.categories}
              </div>
              <div className="text-sm text-slate-400">Categories</div>
            </div>
            <div className="glass-card p-4 border border-white/5 rounded-xl">
              <div className="flex items-center gap-1 mb-1">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                <span className="text-2xl font-bold text-white">
                  {stats.avgRating}
                </span>
              </div>
              <div className="text-sm text-slate-400">Avg Rating</div>
            </div>
            <div className="glass-card p-4 border border-white/5 rounded-xl">
              <div className="text-2xl font-bold text-white mb-1">
                {(stats.totalCompletions / 1000).toFixed(0)}k+
              </div>
              <div className="text-sm text-slate-400">Completions</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates by role, tech stack, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-4 text-white placeholder-slate-400 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Filter Toggle Button (Mobile) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden w-full glass-card border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between text-white mb-4"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              <span className="font-medium">Filters</span>
            </div>
            <ChevronDown
              className={`w-5 h-5 transition-transform ${
                showFilters ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Filters - Custom Dropdowns */}
          <div
            className={`space-y-4 sm:space-y-0 sm:grid sm:grid-cols-4 gap-4 ${
              showFilters ? "block" : "hidden sm:grid"
            }`}
          >
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Category
              </label>
              <div className="relative category-dropdown">
                <button
                  type="button"
                  onClick={() => setShowCategoryMenu(!showCategoryMenu)}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                >
                  <span>{categories.find(c => c.id === selectedCategory)?.name || 'All'}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCategoryMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showCategoryMenu && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(category.id);
                          setShowCategoryMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Difficulty
              </label>
              <div className="relative difficulty-dropdown">
                <button
                  type="button"
                  onClick={() => setShowDifficultyMenu(!showDifficultyMenu)}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                >
                  <span>{selectedDifficulty}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDifficultyMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showDifficultyMenu && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                    {difficulties.map((difficulty) => (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => {
                          setSelectedDifficulty(difficulty);
                          setShowDifficultyMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          selectedDifficulty === difficulty
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        {difficulty}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Type
              </label>
              <div className="relative type-dropdown">
                <button
                  type="button"
                  onClick={() => setShowTypeMenu(!showTypeMenu)}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                >
                  <span>{selectedType}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showTypeMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showTypeMenu && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                    {types.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setSelectedType(type);
                          setShowTypeMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          selectedType === type
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Duration Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Duration
              </label>
              <div className="relative duration-dropdown">
                <button
                  type="button"
                  onClick={() => setShowDurationMenu(!showDurationMenu)}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-white text-sm text-left flex items-center justify-between cursor-pointer"
                >
                  <span>{selectedDuration}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDurationMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showDurationMenu && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                    {durations.map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        onClick={() => {
                          setSelectedDuration(duration);
                          setShowDurationMenu(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          selectedDuration === duration
                            ? 'bg-blue-500/30 text-blue-300'
                            : 'text-white hover:bg-white/5'
                        }`}
                      >
                        {duration}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Reset Filters Button */}
          <div className="mt-4">
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedDifficulty("All");
                setSelectedType("All");
                setSelectedDuration("All");
              }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
            >
              Reset All Filters
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-slate-400">
            Showing <span className="text-white font-semibold">{filteredTemplates.length}</span> of{" "}
            <span className="text-white font-semibold">{templateData.length}</span> templates
          </p>
        </div>

        {/* Templates Grid */}
        {filteredTemplates.length === 0 ? (
          <div className="glass-card border border-white/5 rounded-xl p-12 text-center">
            <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No templates found
            </h3>
            <p className="text-slate-400 mb-6">
              Try adjusting your search or filters to find what you&apos;re looking for
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setSelectedDifficulty("All");
                setSelectedType("All");
                setSelectedDuration("All");
              }}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all duration-300"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}