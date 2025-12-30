"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import ErrorPage from '@/components/Error';
import { AlertCircle, Search, X } from 'lucide-react';
import Link from 'next/link';

// Import data from separate file
import {
  interviewTemplates,
} from "@/app/data/interviewTemplates";

// Process template data
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
  tags?: string[];
}

interface TemplateCardProps {
  template: Template;
}

interface CriticalError {
  code: string;
  title: string;
  message: string;
  details?: string;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template }) => {
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

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
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case "Behavioral":
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        );
      case "Mixed":
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  return (
    <div className="glass-card hover-lift">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className={`p-1.5 sm:p-2 rounded-lg ${getTypeColor(template.type)} flex-shrink-0`}>
              {getTypeIcon(template.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg text-white truncate">
                {template.role}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 truncate">
                {template.category}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0 ${
              isBookmarked
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
            }`}
            aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
          <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium ${getDifficultyColor(template.difficulty)}`}>
            {template.difficulty}
          </span>
          <span className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium ${getTypeColor(template.type)}`}>
            {template.type}
          </span>
          {template.tags && template.tags.includes("Popular") && (
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-xs font-medium text-purple-400 bg-purple-500/10">
              Popular
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-3 sm:mb-4 line-clamp-2">
          {template.description}
        </p>

        {/* Technologies */}
        <div className="mb-3 sm:mb-4">
          <p className="text-xs text-slate-500 font-medium mb-2">
            Technologies
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {template.techstack.slice(0, 4).map((tech, index) => (
              <span
                key={index}
                className="px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium text-blue-400 bg-blue-500/10"
              >
                {tech}
              </span>
            ))}
            {template.techstack.length > 4 && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium text-slate-400 bg-slate-600/10">
                +{template.techstack.length - 4}
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5 py-2 sm:py-3 border-t border-white/5">
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold text-white mb-0.5">
              {template.questions}
            </div>
            <div className="text-xs text-slate-500">Questions</div>
          </div>
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold text-white mb-0.5">
              {template.duration ? template.duration.split(" ")[0] : "45"}
            </div>
            <div className="text-xs text-slate-500">Minutes</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-base sm:text-lg font-semibold text-white">{template.rating}</span>
            </div>
            <div className="text-xs text-slate-500">Rating</div>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full glass-button-primary hover-lift py-2 sm:py-2.5 px-4 rounded-lg font-medium text-xs sm:text-sm flex items-center justify-center gap-2">
          Use Template
        </button>
      </div>
    </div>
  );
};

export default function TemplatePage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [criticalError, setCriticalError] = useState<CriticalError | null>(null);
  const [dataError, setDataError] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in');
    }
  }, [loading, user, router]);

  // Check for data loading errors
  useEffect(() => {
    try {
      if (!templateData || templateData.length === 0) {
        setDataError('Template data could not be loaded. Please refresh the page.');
      }
    } catch (err: unknown) {
      console.error('Error loading template data:', err);
      const error = err as Error;
      setCriticalError({
        code: '500',
        title: 'Data Loading Error',
        message: 'Unable to load interview templates.',
        details: error.message
      });
    }
  }, []);

  const filteredTemplates = useMemo(() => {
    try {
      return templateData.filter((template) => {
        const matchesSearch =
          (template.role || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (template.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (template.category || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (template.techstack || []).some((tech) =>
            (tech || "").toLowerCase().includes(searchQuery.toLowerCase())
          );
        return matchesSearch;
      });
    } catch (err) {
      console.error('Error filtering templates:', err);
      return [];
    }
  }, [searchQuery]);

  const handleRetryError = (): void => {
    setCriticalError(null);
    setDataError('');
    window.location.reload();
  };

  // Show critical error page
  if (criticalError) {
    return (
      <ErrorPage
        errorCode={criticalError.code}
        errorTitle={criticalError.title}
        errorMessage={criticalError.message}
        errorDetails={criticalError.details}
        showBackButton={true}
        showHomeButton={true}
        showRefreshButton={true}
        onRetry={handleRetryError}
      />
    );
  }

  // Show loader during auth check
  if (loading) {
    return (
      <AnimatedLoader
        isVisible={true}
        loadingText="Loading templates..."
        showNavigation={true}
      />
    );
  }

  // Show auth required message
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card hover-lift max-w-md w-full">
          <div className="text-center p-8 sm:p-12">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Authentication Required</h2>
            <p className="text-sm sm:text-base text-slate-400 mb-6">Please log in to view interview templates</p>
            <Link 
              href="/sign-in"
              className="glass-button-primary hover-lift inline-flex items-center gap-2 px-6 py-3 rounded-lg w-full sm:w-auto justify-center"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      {/* Header */}
      <div className="glass-card hover-lift">
        <div className="p-4 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white mb-1">
            Interview Templates
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            Professionally crafted templates for interview preparation
          </p>
        </div>
      </div>

      {/* Data Error Message */}
      {dataError && (
        <div className="glass-card hover-lift">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-yellow-400 text-sm mb-2 break-words">{dataError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs text-yellow-300 hover:text-yellow-200 underline"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="glass-card hover-lift">
        <div className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by title, category, or technology..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 glass-input rounded-lg text-white placeholder-slate-500 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="px-1">
        <p className="text-xs sm:text-sm text-slate-400">
          {filteredTemplates.length} of {templateData.length} templates
        </p>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card">
          <div className="text-center py-12 sm:py-16 px-4 sm:px-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Search className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
              No templates found
            </h3>
            <p className="text-sm sm:text-base text-slate-400 mb-4 sm:mb-6">
              Try adjusting your search to find more templates
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-sm text-slate-300 hover:text-white underline"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}