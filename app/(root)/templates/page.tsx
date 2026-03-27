// app/(root)/templates/page.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import {
  AlertCircle, Search, X, Play, Loader2,
  BookmarkCheck, Bookmark, Star, Users, Clock,
  MessageSquare, Filter, ChevronDown, Sparkles, ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

import {
  interviewTemplates,
  categories as importedCategories,
  difficulties,
  types,
  durations,
} from "@/app/data/interviewTemplates";

const categories  = importedCategories || [];
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

// ─── Template Card ────────────────────────────────────────────────────────────

const TemplateCard: React.FC<{ template: Template }> = ({ template }) => {
  const router = useRouter();
  const [isStarting,   setIsStarting]   = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleStartInterview = async () => {
    setIsStarting(true);
    try {
      const response = await fetch('/api/templates/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create interview');
      router.push(`/interview/${data.interviewId}`);
    } catch (error) {
      console.error('Error starting interview:', error);
      alert('Failed to start interview. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const difficultyStyle = (d: string) =>
    d === 'Beginner'     ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
    d === 'Intermediate' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                           'bg-red-500/10 border-red-500/20 text-red-400';

  const typeStyle = (t: string) =>
    t === 'Technical'  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
    t === 'Behavioral' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                         'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';

  const TypeIcon = ({ type }: { type: string }) => {
    if (type === 'Technical') return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    );
    if (type === 'Behavioral') return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
    return (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  return (
    <div className="glass-card flex flex-col transition-all duration-300 hover:border-purple-500/30 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(139,92,246,0.12)] group">

      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors leading-snug mb-1.5 truncate">
            {template.role}
          </h3>
          <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{template.description}</p>
        </div>
        <button
          onClick={() => setIsBookmarked(!isBookmarked)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
            isBookmarked
              ? 'bg-purple-500/15 border border-purple-500/25 text-purple-400'
              : 'bg-slate-800/60 border border-white/[0.06] text-slate-500 hover:text-slate-300'
          }`}
        >
          {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Stats row */}
      <div className="px-5 pb-4 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span className="text-white font-medium">{template.rating}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          <span>{template.completions.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{template.duration}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{template.questions} Qs</span>
        </div>
      </div>

      {/* Badges */}
      <div className="px-5 pb-4 flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${difficultyStyle(template.difficulty)}`}>
          {template.difficulty}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold ${typeStyle(template.type)}`}>
          <TypeIcon type={template.type} />
          {template.type}
        </span>
      </div>

      {/* Tech stack */}
      <div className="px-5 pb-4 flex flex-wrap gap-1.5">
        {template.techstack.slice(0, 4).map((tech, i) => (
          <span key={i} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/15 text-blue-400 rounded-md text-[10px] font-medium">{tech}</span>
        ))}
        {template.techstack.length > 4 && (
          <span className="px-2 py-0.5 bg-slate-800/60 border border-white/[0.06] text-slate-500 rounded-md text-[10px]">+{template.techstack.length - 4} more</span>
        )}
      </div>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div className="px-5 pb-4 flex flex-wrap gap-1.5">
          {template.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/15 text-purple-400 rounded-md text-[10px] font-medium">{tag}</span>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action button */}
      <div className="px-5 pb-5">
        <button
          onClick={handleStartInterview}
          disabled={isStarting}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2
                     bg-gradient-to-r from-purple-600 to-indigo-600
                     hover:from-purple-500 hover:to-indigo-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all shadow-lg shadow-purple-500/15 cursor-pointer"
        >
          {isStarting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
          ) : (
            <><Play className="w-4 h-4" /> Start Interview</>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Dropdown filter component ────────────────────────────────────────────────

function FilterDropdown({
  label, value, options, onChange, className,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(`.filter-dd-${label.replace(/\s+/g, '-')}`)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, label]);

  const displayLabel = options.find(o => o.value === value)?.label ?? value;

  return (
    <div className={`filter-dd-${label.replace(/\s+/g, '-')} ${className ?? ''}`}>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="glass-input w-full px-3.5 py-2.5 rounded-xl text-white text-sm text-left flex items-center justify-between cursor-pointer"
        >
          <span>{displayLabel}</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-white/[0.08]
                          shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-30 overflow-hidden max-h-60 overflow-y-auto"
               style={{ background: '#0d1526' }}>
            {options.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                  value === opt.value
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  const [searchQuery,        setSearchQuery]        = useState('');
  const [selectedCategory,   setSelectedCategory]   = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedType,       setSelectedType]       = useState('All');
  const [selectedDuration,   setSelectedDuration]   = useState('All');
  const [showFilters,        setShowFilters]        = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [user, loading, router]);

  const filteredTemplates = useMemo(() => {
    let f = templateData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(t =>
        t.role.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.techstack.some(s => s.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
      );
    }
    if (selectedCategory !== 'all') f = f.filter(t => t.category === selectedCategory);
    if (selectedDifficulty !== 'All') f = f.filter(t => t.difficulty === selectedDifficulty);
    if (selectedType !== 'All') f = f.filter(t => t.type === selectedType);
    if (selectedDuration !== 'All') {
      f = f.filter(t => {
        const d = parseInt(t.duration);
        return selectedDuration === '< 30 min' ? d < 30 :
               selectedDuration === '30-45 min' ? d >= 30 && d <= 45 :
               selectedDuration === '45-60 min' ? d > 45 && d <= 60 :
               selectedDuration === '> 60 min'  ? d > 60 : true;
      });
    }
    return f;
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedType, selectedDuration]);

  const stats = useMemo(() => ({
    total:            templateData.length,
    categories:       categories.length - 1,
    avgRating:        (templateData.reduce((s, t) => s + t.rating, 0) / templateData.length).toFixed(1),
    totalCompletions: templateData.reduce((s, t) => s + t.completions, 0),
  }), []);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedDifficulty('All');
    setSelectedType('All');
    setSelectedDuration('All');
  };

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedDifficulty !== 'All' || selectedType !== 'All' || selectedDuration !== 'All';

  if (loading) {
    return <AnimatedLoader isVisible={true} loadingText="Loading templates…" showNavigation />;
  }
  if (!user) return null;

  const categoryOptions = categories.map(c => ({ label: c.name, value: c.id }));
  const difficultyOptions = difficulties.map(d => ({ label: d, value: d }));
  const typeOptions = types.map(t => ({ label: t, value: t }));
  const durationOptions = durations.map(d => ({ label: d, value: d }));

  return (
    <div className="space-y-6 px-4 sm:px-0 pb-12">

      {/* ── Header ── */}
      <div className="glass-card p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 gradient-primary rounded-xl flex items-center justify-center shadow-glass flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Interview Templates</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              {stats.total}+ professionally crafted templates
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { value: `${stats.total}+`,                                          label: 'Templates'   },
            { value: `${stats.categories}`,                                      label: 'Categories'  },
            { value: stats.avgRating, label: 'Avg Rating', star: true },
            { value: `${(stats.totalCompletions / 1000).toFixed(0)}k+`,          label: 'Completions' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/40 border border-white/[0.06] rounded-xl p-3 sm:p-4">
              <div className="flex items-center gap-1 mb-0.5">
                {'star' in s && s.star && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                <span className="text-xl font-bold text-white">{s.value}</span>
              </div>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by role, tech stack, or keywords…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/[0.08] rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/40 transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile filter toggle */}
        <button onClick={() => setShowFilters(!showFilters)}
          className="sm:hidden w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/40 border border-white/[0.06] rounded-xl text-white text-sm mb-3 cursor-pointer">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Filters</span>
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {/* Filters */}
        <div className={`${showFilters ? 'flex' : 'hidden'} sm:grid flex-col sm:flex-none grid-cols-4 gap-3`}>
          <FilterDropdown label="Category"   value={selectedCategory}   options={categoryOptions}   onChange={setSelectedCategory}   />
          <FilterDropdown label="Difficulty" value={selectedDifficulty} options={difficultyOptions} onChange={setSelectedDifficulty} />
          <FilterDropdown label="Type"       value={selectedType}       options={typeOptions}       onChange={setSelectedType}       />
          <FilterDropdown label="Duration"   value={selectedDuration}   options={durationOptions}   onChange={setSelectedDuration}   />
        </div>

        {hasActiveFilters && (
          <div className="mt-3">
            <button onClick={resetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/40 border border-white/[0.06] hover:border-white/10 transition-all cursor-pointer">
              <X className="w-3 h-3" /> Reset filters
            </button>
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      <p className="text-slate-500 text-sm px-1">
        Showing <span className="text-white font-semibold">{filteredTemplates.length}</span> of{' '}
        <span className="text-white font-semibold">{templateData.length}</span> templates
      </p>

      {/* ── Grid ── */}
      {filteredTemplates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-14 h-14 bg-slate-800/60 border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No templates found</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
            Try adjusting your search or filters to find what you&apos;re looking for
          </p>
          <button onClick={resetFilters}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500
                       transition-all cursor-pointer">
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map(template => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}

      {/* ── Back to dashboard ── */}
      <div className="text-center pt-4">
        <Link href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white
                     bg-slate-800/50 border border-white/[0.06] hover:bg-slate-700/60 hover:border-white/10
                     transition-all">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}