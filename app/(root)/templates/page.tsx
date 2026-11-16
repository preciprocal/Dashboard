// app/(root)/templates/page.tsx
"use client";
import { Breadcrumbs, crumbsFor } from '@/components/PageHeader';
import { BookOpen, Send, Code2, Users, Layers, MessagesSquare, ArrowRight, LayoutGrid } from 'lucide-react';

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useOutreachFilters, OutreachFilters, OutreachGrid } from '@/components/templates/OutreachTemplateGrid';
import { OUTREACH_TEMPLATES } from '@/lib/outreach/templates';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import {
  AlertCircle, Search, X, Play, Loader2,
  BookmarkCheck, Bookmark, Clock,
  MessageSquare, Filter, ChevronDown,
} from 'lucide-react';

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

// Saved templates live in the browser under the key Profile > Saved reads.
const SAVED_EVENT = 'preciprocal:saved-templates';
function readSavedIds(): Set<string> {
  try { return new Set((JSON.parse(localStorage.getItem('bookmarkedTemplates') || '[]') as { id: string }[]).map(t => String(t.id))); }
  catch { return new Set(); }
}

// ─── Template Card ────────────────────────────────────────────────────────────

const TemplateCard: React.FC<{ template: Template }> = ({ template }) => {
  const router = useRouter();
  const [isStarting,   setIsStarting]   = useState(false);
  // Saved to the browser under the key Profile > Saved reads
  // (app/(root)/profile/page.tsx). It used to toggle on screen only.
  const [isBookmarked, setIsBookmarked] = useState(false);
  // Read after mount: the server render has no localStorage, and reading it
  // during render would make the two disagree.
  useEffect(() => {
    let saved = false;
    try { saved = (JSON.parse(localStorage.getItem('bookmarkedTemplates') || '[]') as { id: string }[]).some(t => String(t.id) === template.id); }
    catch { /* storage blocked */ }
    if (saved) void Promise.resolve().then(() => setIsBookmarked(true));
  }, [template.id]);
  const toggleBookmark = () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    try {
      const list = (JSON.parse(localStorage.getItem('bookmarkedTemplates') || '[]') as { id: string }[]).filter(t => String(t.id) !== template.id);
      if (next) list.unshift({
        id: template.id, title: template.role, role: template.role, category: template.category, description: template.description,
        techstack: template.techstack, difficulty: template.difficulty, type: template.type, duration: template.duration,
        questions: template.questions, rating: template.rating,
      } as { id: string });
      localStorage.setItem('bookmarkedTemplates', JSON.stringify(list.slice(0, 100)));
      window.dispatchEvent(new Event(SAVED_EVENT));
    } catch { /* storage blocked: the on-screen state still changes */ }
  };

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

  // Difficulty as a coloured dot; everything else neutral, so a page of cards
  // stays calm and the role reads first.
  const dot = template.difficulty === 'Beginner' ? 'bg-emerald-400' : template.difficulty === 'Intermediate' ? 'bg-amber-400' : 'bg-rose-400';
  const TypeIcon = template.type === 'Technical' ? Code2 : template.type === 'Behavioral' ? Users : Layers;
  const chip = 'inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11.5px] text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]';

  return (
    <div className="group flex flex-col rounded-2xl ring-1 ring-inset ring-white/[0.07] hover:ring-white/[0.14] hover:bg-white/[0.015] transition-colors">
      {/* Role and save */}
      <div className="p-5 pb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-4)] truncate">{template.category}</p>
          <h3 className="text-[15.5px] font-semibold text-white leading-snug mt-1 truncate">{template.role}</h3>
          <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed mt-1.5 line-clamp-2">{template.description}</p>
        </div>
        <button onClick={toggleBookmark} aria-label={isBookmarked ? 'Remove from saved' : 'Save template'} title={isBookmarked ? 'Saved' : 'Save'}
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${isBookmarked ? 'text-white bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-[var(--text-4)] bg-white/[0.03] ring-1 ring-inset ring-white/[0.07] hover:text-white hover:bg-white/[0.07]'}`}>
          {isBookmarked ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Facts */}
      <div className="px-5 flex flex-wrap items-center gap-1.5">
        <span className={chip}><span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{template.difficulty}</span>
        <span className={chip}><TypeIcon className="w-3 h-3 text-[var(--text-4)]" />{template.type}</span>
        <span className={chip}><MessageSquare className="w-3 h-3 text-[var(--text-4)]" />{template.questions} questions</span>
        <span className={chip}><Clock className="w-3 h-3 text-[var(--text-4)]" />{template.duration}</span>
      </div>

      {/* Skills covered */}
      {template.techstack.length > 0 && (
        <p className="px-5 mt-3 text-[12px] text-[var(--text-4)] leading-relaxed line-clamp-1">
          {template.techstack.slice(0, 5).join(' · ')}{template.techstack.length > 5 ? ` · +${template.techstack.length - 5}` : ''}
        </p>
      )}

      <div className="flex-1" />

      {/* Action */}
      <div className="p-5 pt-4 mt-4 border-t border-white/[0.05]">
        <button onClick={handleStartInterview} disabled={isStarting}
          className="w-full h-9 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 text-[var(--text-1)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.09] group-hover:bg-[var(--primary)] group-hover:text-[var(--on-primary)] group-hover:ring-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
          {isStarting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting</> : <><Play className="w-3.5 h-3.5" /> Start interview</>}
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
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{label}</p>
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
               style={{ background: 'var(--bg-raised)' }}>
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
  const [user, loading] = useSupabaseUser();

  const [searchQuery,        setSearchQuery]        = useState('');
  const [selectedCategory,   setSelectedCategory]   = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedType,       setSelectedType]       = useState('All');
  const [selectedDuration,   setSelectedDuration]   = useState('All');
  const [showFilters,        setShowFilters]        = useState(false);
  const [view,               setView]               = useState<'all' | 'interview' | 'saved' | 'outreach'>('all');
  const [savedIds,           setSavedIds]           = useState<Set<string>>(() => new Set());
  const outreach = useOutreachFilters();

  // Read after mount (no localStorage on the server), and again whenever a
  // card is saved or removed, here or in another tab.
  useEffect(() => {
    const sync = () => setSavedIds(readSavedIds());
    void Promise.resolve().then(sync);
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener('storage', sync);
    { const v = new URLSearchParams(window.location.search).get('view'); if (v === 'saved' || v === 'outreach') void Promise.resolve().then(() => setView(v)); }
    return () => { window.removeEventListener(SAVED_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in');
  }, [user, loading, router]);

  const filteredTemplates = useMemo(() => {
    let f = view === 'saved' ? templateData.filter(t => savedIds.has(t.id)) : templateData;
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
  }, [searchQuery, selectedCategory, selectedDifficulty, selectedType, selectedDuration, view, savedIds]);

  const stats = useMemo(() => ({
    total:            templateData.length,
    categories:       categories.length - 1,
    technical:        templateData.filter(t => t.type === 'Technical').length,
    behavioral:       templateData.filter(t => t.type === 'Behavioral').length,
  }), []);

  // 24 at a time: rendering all 173 made the page 63,000px tall on a phone.
  const PAGE_SIZE = 24;
  const [shown, setShown] = useState(PAGE_SIZE);
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setShown(n => n + PAGE_SIZE);
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });
  const filterKey = `${view}|${searchQuery}|${selectedCategory}|${selectedDifficulty}|${selectedType}|${selectedDuration}`;
  const [shownFor, setShownFor] = useState(filterKey);
  if (shownFor !== filterKey) { setShownFor(filterKey); setShown(PAGE_SIZE); }
  const visibleTemplates = filteredTemplates.slice(0, shown);

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
    <div className="space-y-5 px-4 sm:px-0 pt-4 pb-12">

      {/* ── Header ── */}
      <header>
        <Breadcrumbs crumbs={crumbsFor('/templates', 'Templates')} className="mb-2.5" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] app-glass bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-[18px] h-[18px] text-[var(--accent)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold text-white tracking-[-0.024em] leading-tight">Templates</h1>
            <p className="text-[13px] text-[var(--text-3)] mt-1">
              {view === 'outreach'
                ? `${OUTREACH_TEMPLATES.length} ready-to-send emails and LinkedIn messages for every stage of your search`
                : view === 'interview'
                  ? `${stats.total}+ ready-made mock interviews across every field`
                  : view === 'saved'
                    ? 'Templates you saved, on this browser'
                    : 'Mock interviews to practise with, and messages to send while you search'}
            </p>
          </div>
        </div>

        {/* Views */}
        <div role="tablist" aria-label="Templates" className="mt-5 flex items-center border-b border-white/[0.07] overflow-x-auto scrollbar-hide">
          {([
            ['all', 'All', templateData.length + OUTREACH_TEMPLATES.length, LayoutGrid],
            ['interview', 'Interview', templateData.length, MessagesSquare],
            ['outreach', 'Outreach', OUTREACH_TEMPLATES.length, Send],
            ['saved', 'Saved', savedIds.size, BookmarkCheck],
          ] as const).map(([id, label, n, Icon]) => {
            const on = view === id;
            return (
              <button key={id} role="tab" aria-selected={on} onClick={() => setView(id)}
                className={`relative flex-1 min-w-fit px-4 h-11 flex items-center justify-center gap-2 text-[13.5px] font-medium whitespace-nowrap transition-colors cursor-pointer ${on ? 'text-white' : 'text-[var(--text-3)] hover:text-white'}`}>
                <Icon className={`w-4 h-4 ${on ? 'text-[var(--accent)]' : ''}`} />{label}
                <span className={`min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-semibold flex items-center justify-center tabular-nums ${on ? 'bg-white/[0.12] text-white' : 'bg-white/[0.05] text-[var(--text-4)]'}`}>{n}</span>
                <span className={`absolute left-2 right-2 -bottom-px h-[2px] rounded-full bg-white transition-transform duration-300 origin-left ${on ? 'scale-x-100' : 'scale-x-0'}`} />
              </button>
            );
          })}
        </div>
      </header>

      {view === 'outreach' ? <OutreachFilters f={outreach} /> : (<>
        {/* Stats: one strip */}
        {view !== 'saved' && (
          <div className="glass-card grid grid-cols-2 sm:grid-cols-4 overflow-hidden">
            {[
              { value: `${stats.total}+`, label: 'Mock interviews' },
              { value: `${stats.categories}`, label: 'Fields' },
              { value: `${stats.technical}`, label: 'Technical' },
              { value: `${stats.behavioral}`, label: 'Behavioral' },
            ].map((s, i) => (
              <div key={s.label} className={`px-5 py-4 border-[var(--border)] ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}>
                <p className="font-display text-[22px] font-semibold tracking-[-0.02em] text-white tabular-nums">{s.value}</p>
                <p className="text-[12px] text-[var(--text-3)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Outreach, from the All view */}
        {view === 'all' && (
          <button onClick={() => setView('outreach')}
            className="group w-full flex items-center gap-3.5 rounded-2xl ring-1 ring-inset ring-white/[0.07] hover:ring-white/[0.14] hover:bg-white/[0.015] p-4 text-left transition-colors cursor-pointer">
            <span className="w-10 h-10 rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] flex items-center justify-center flex-shrink-0"><Send className="w-[18px] h-[18px] text-[var(--accent)]" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">{OUTREACH_TEMPLATES.length} outreach templates</span>
              <span className="block text-[12.5px] text-[var(--text-3)] mt-0.5 truncate">Emails and LinkedIn messages for recruiters, referrals, follow-ups and offers</span>
            </span>
            <ArrowRight className="w-4 h-4 text-[var(--text-4)] group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        )}

        {/* Search and filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--text-4)]" />
            <input type="text" placeholder="Search by role, tech stack or keyword" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="field !h-12 !pl-11 !pr-10" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile filter toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden w-full flex items-center justify-between px-4 h-10 rounded-lg ring-1 ring-inset ring-white/[0.08] text-white text-[13px] cursor-pointer">
            <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-[var(--text-4)]" /><span className="font-medium">Filters</span>{hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}</span>
            <ChevronDown className={`w-4 h-4 text-[var(--text-4)] transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className={`${showFilters ? 'flex' : 'hidden'} sm:grid flex-col sm:flex-none grid-cols-4 gap-3`}>
            <FilterDropdown label="Field" value={selectedCategory} options={categoryOptions} onChange={setSelectedCategory} />
            <FilterDropdown label="Difficulty" value={selectedDifficulty} options={difficultyOptions} onChange={setSelectedDifficulty} />
            <FilterDropdown label="Type" value={selectedType} options={typeOptions} onChange={setSelectedType} />
            <FilterDropdown label="Duration" value={selectedDuration} options={durationOptions} onChange={setSelectedDuration} />
          </div>
        </div>
      </>)}

      {view === 'outreach' ? <OutreachGrid f={outreach} /> : (<>
      {/* ── Results count ── */}
      <p className="text-slate-400 text-sm px-1">
        Showing <span className="text-white font-semibold">{filteredTemplates.length}</span> of{' '}
        <span className="text-white font-semibold">{view === 'saved' ? savedIds.size : templateData.length}</span> {view === 'saved' ? 'saved templates' : 'templates'}
      </p>

      {/* ── Grid ── */}
      {view === 'saved' && savedIds.size === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-14 h-14 bg-white/[0.042] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bookmark className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No saved templates yet</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
            Tap the bookmark on any template to keep it here for later practice.
          </p>
          <button onClick={() => setView('all')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-[var(--accent)] hover:bg-[var(--accent-hover)]
                       transition-all cursor-pointer">
            Browse templates
          </button>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="w-14 h-14 bg-white/[0.042] border border-white/[0.06] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No templates found</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
            Try adjusting your search or filters to find what you&apos;re looking for
          </p>
          <button onClick={resetFilters}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-[var(--accent)] hover:bg-[var(--accent-hover)]
                       transition-all cursor-pointer">
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleTemplates.map(template => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
      {filteredTemplates.length > visibleTemplates.length && (
        // The next page loads by itself as this comes into view; the button
        // is there for keyboard users and anyone who scrolls past it.
        <div ref={loadMoreRef} className="flex items-center justify-center gap-3 pt-1">
          <button onClick={() => setShown(n => n + PAGE_SIZE)} className="btn-secondary">
            Show more <ChevronDown />
          </button>
          <span className="text-[13px] text-slate-400 tabular-nums">{visibleTemplates.length} of {filteredTemplates.length}</span>
        </div>
      )}
      </>)}
    </div>
  );
}