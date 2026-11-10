'use client';
// components/templates/OutreachTemplateGrid.tsx
// The Outreach tab on /templates: the same card grid as the interview
// templates, one card per email or LinkedIn message. A card copies the
// message straight away or opens it in the full reader
// (/templates/outreach?t=<id>), which shows the whole text, the fields to
// fill in and why it works.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, Check, Search, X, ArrowRight, Sparkles, PenLine } from 'lucide-react';
import { LinkedInIcon, OutlookIcon } from '@/components/icons/BrandIcons';
import {
  OUTREACH_CATEGORIES,
  OUTREACH_TEMPLATES,
  type OutreachCategory,
  type OutreachChannel,
  type OutreachTemplate,
} from '@/lib/outreach/templates';

const fieldsIn = (t: OutreachTemplate) =>
  new Set(`${t.subject ?? ''} ${t.body}`.match(/\[[^\]]+\]/g) ?? []).size;

function OutreachCard({ t }: { t: OutreachTemplate }) {
  const [copied, setCopied] = useState(false);
  const category = OUTREACH_CATEGORIES.find(c => c.id === t.category);
  const preview = t.body.replace(/\s+/g, ' ').trim();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.subject ? `Subject: ${t.subject}\n\n${t.body}` : t.body);
      setCopied(true);
      toast.success(t.subject ? 'Email copied' : 'Message copied');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy. Open the template and copy it from there.');
    }
  };

  return (
    <div className="glass-card flex flex-col transition-all duration-300 hover:border-[var(--accent-border)] hover:-translate-y-0.5 group">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
            {t.channel === 'linkedin' ? <LinkedInIcon className="w-4 h-4" /> : <OutlookIcon className="w-4 h-4" />}
            {t.channel === 'linkedin' ? 'LinkedIn message' : 'Email'}
          </span>
          <span className="px-2.5 py-1 rounded-lg border text-xs font-semibold bg-[var(--accent-subtle)] border-[var(--accent-border)] text-indigo-200">
            {category?.label}
          </span>
        </div>
        <h3 className="text-base font-semibold text-white group-hover:text-indigo-200 transition-colors leading-snug mb-1.5">
          {t.title}
        </h3>
        <p className="text-slate-400 text-[13px] leading-relaxed line-clamp-2">{t.situation}</p>
      </div>

      {/* Preview */}
      <div className="px-5 pb-4">
        <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3">
          {t.subject && (
            <p className="text-xs text-slate-300 mb-1.5 truncate">
              <span className="text-slate-500">Subject:</span> {t.subject}
            </p>
          )}
          <p className="text-[13px] text-slate-400 leading-relaxed line-clamp-3">{preview}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="px-5 pb-4 flex items-center gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1"><PenLine className="w-3.5 h-3.5" /> {fieldsIn(t)} fields to fill in</span>
        {t.channel === 'linkedin' && t.body.length <= 300 && (
          <span className="text-emerald-400">Fits a connection note</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="px-5 pb-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="btn-primary w-full">
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
        </button>
        <Link href={`/templates/outreach?t=${t.id}`} className="btn-secondary w-full">
          Open <ArrowRight />
        </Link>
      </div>
    </div>
  );
}

/** Filter state shared by the filters (in the page's header card) and the grid below it. */
export function useOutreachFilters() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<OutreachCategory | 'all'>('all');
  const [channel, setChannel] = useState<OutreachChannel | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OUTREACH_TEMPLATES.filter(t =>
      (category === 'all' || t.category === category) &&
      (channel === 'all' || t.channel === channel) &&
      (!q || `${t.title} ${t.situation} ${t.subject ?? ''} ${t.body}`.toLowerCase().includes(q)),
    );
  }, [query, category, channel]);

  const countFor = (id: OutreachCategory | 'all') =>
    OUTREACH_TEMPLATES.filter(t => (id === 'all' || t.category === id) && (channel === 'all' || t.channel === channel)).length;
  const reset = () => { setQuery(''); setCategory('all'); setChannel('all'); };

  return { query, setQuery, category, setCategory, channel, setChannel, filtered, countFor, reset };
}

type Filters = ReturnType<typeof useOutreachFilters>;

export function OutreachFilters({ f }: { f: Filters }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" value={f.query} onChange={e => f.setQuery(e.target.value)}
            placeholder="Search: referral, salary, thank you, visa…" aria-label="Search outreach templates"
            className="field pl-10 pr-10" />
          {f.query && (
            <button type="button" onClick={() => f.setQuery('')} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Channel" className="grid grid-cols-3 gap-2 sm:w-[400px]">
          {([['all', 'All'], ['email', 'Email'], ['linkedin', 'LinkedIn']] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={f.channel === id} onClick={() => f.setChannel(id)}
              className={`choice min-w-0 ${f.channel === id ? 'choice-active' : ''}`}>
              {id === 'email' && <OutlookIcon />}{id === 'linkedin' && <LinkedInIcon />}
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist" aria-label="Situation">
        {([{ id: 'all' as const, label: 'All situations' }, ...OUTREACH_CATEGORIES]).map(c => {
          const on = f.category === c.id;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => f.setCategory(c.id)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors ${
                on ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-white' : 'border-[var(--border)] text-slate-400 hover:text-white hover:border-[var(--border-hover)]'}`}>
              {c.label}
              <span className={`text-xs tabular-nums ${on ? 'text-indigo-200' : 'text-slate-500'}`}>{f.countFor(c.id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OutreachGrid({ f }: { f: Filters }) {
  return (
    <>
      <p className="text-slate-400 text-sm px-1">
        Showing <span className="text-white font-semibold">{f.filtered.length}</span> of{' '}
        <span className="text-white font-semibold">{OUTREACH_TEMPLATES.length}</span> outreach templates
      </p>
      {f.filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <h3 className="text-lg font-semibold text-white mb-2">No outreach templates match</h3>
          <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">Try a broader word, or let the AI write one for your exact situation.</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={f.reset} className="btn-secondary">Clear filters</button>
            <Link href="/career-tools?tool=outreach" className="btn-primary"><Sparkles /> Write with AI</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {f.filtered.map(t => <OutreachCard key={t.id} t={t} />)}
        </div>
      )}
    </>
  );
}
