'use client';
// app/(root)/templates/outreach/page.tsx
// The outreach template library: ready-to-send emails and LinkedIn messages
// for every stage of a search, from the first cold email to declining an
// offer. Master and detail on desktop (the list on the left, the open
// template on the right), stacked on phones.
//
// Fill-in fields are written as [square brackets] in lib/outreach/templates
// and highlighted here, so it is obvious what still needs editing before a
// message goes out. The AI writer in Career Tools is one click away for a
// version written from scratch for a specific person.

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, Check, Search, X, Send, Sparkles, Lightbulb, ArrowLeft, BookOpen } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { LinkedInIcon, OutlookIcon } from '@/components/icons/BrandIcons';
import {
  OUTREACH_CATEGORIES,
  OUTREACH_TEMPLATES,
  type OutreachCategory,
  type OutreachChannel,
  type OutreachTemplate,
} from '@/lib/outreach/templates';

const LINKEDIN_NOTE_LIMIT = 300;

/** Body text with [fill-in fields] highlighted. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\[[^\]]+\]$/.test(part)
          ? <mark key={i} className="rounded px-1 py-px bg-[var(--accent-subtle)] text-indigo-200 font-medium">{part}</mark>
          : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </>
  );
}

function ChannelIcon({ channel, className = 'w-4 h-4' }: { channel: OutreachChannel; className?: string }) {
  return channel === 'linkedin' ? <LinkedInIcon className={className} /> : <OutlookIcon className={className} />;
}

function CopyButton({ text, label, primary = false }: { text: string; label: string; primary?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success(`${label} copied`);
      setTimeout(() => setDone(false), 1800);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };
  return (
    <button type="button" onClick={copy} className={primary ? 'btn-primary' : 'btn-secondary'}>
      {done ? <Check /> : <Copy />} {done ? 'Copied' : `Copy ${label.toLowerCase()}`}
    </button>
  );
}

function TemplateDetail({ t, onBack }: { t: OutreachTemplate; onBack: () => void }) {
  const category = OUTREACH_CATEGORIES.find(c => c.id === t.category);
  const full = t.subject ? `Subject: ${t.subject}\n\n${t.body}` : t.body;
  const fields = Array.from(new Set((t.subject ?? '').concat(' ', t.body).match(/\[[^\]]+\]/g) ?? []));
  const overLimit = t.channel === 'linkedin' && t.body.length > LINKEDIN_NOTE_LIMIT;

  return (
    <article className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-white/[0.06]">
        <button type="button" onClick={onBack}
          className="lg:hidden inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white mb-3 cursor-pointer">
          <ArrowLeft className="w-3.5 h-3.5" /> All templates
        </button>
        <div className="flex items-center gap-2 text-[12px] text-slate-500 mb-2">
          <ChannelIcon channel={t.channel} className="w-3.5 h-3.5" />
          <span>{t.channel === 'linkedin' ? 'LinkedIn message' : 'Email'}</span>
          <span aria-hidden="true">·</span>
          <span>{category?.label}</span>
        </div>
        <h2 className="text-[18px] font-semibold text-white leading-snug">{t.title}</h2>
        <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">
          <span className="text-slate-500">When to use it:</span> {t.situation}
        </p>
      </div>

      {/* Message */}
      <div className="px-5 sm:px-6 py-5 space-y-4">
        {t.subject && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5">Subject</p>
            <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[14px] text-white">
              <Highlighted text={t.subject} />
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Message</p>
            {t.channel === 'linkedin' && (
              <p className={`text-[11px] tabular-nums ${overLimit ? 'text-slate-500' : 'text-emerald-400'}`}>
                {t.body.length} characters{overLimit ? ' (send as a message, not a connection note)' : ` · fits a ${LINKEDIN_NOTE_LIMIT}-character note`}
              </p>
            )}
          </div>
          <div className="rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-4 text-[14px] text-slate-200 leading-relaxed whitespace-pre-wrap">
            <Highlighted text={t.body} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <CopyButton text={full} label={t.subject ? 'Email' : 'Message'} primary />
          {t.subject && <CopyButton text={t.subject} label="Subject" />}
          <Link href="/career-tools?tool=outreach" className="btn-secondary">
            <Sparkles /> Personalise with AI
          </Link>
        </div>
      </div>

      {/* Fields and tips */}
      <div className="grid sm:grid-cols-2 gap-px bg-white/[0.06] border-t border-white/[0.06]">
        <div className="bg-[var(--bg-surface)] px-5 sm:px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-3">Fill in before sending ({fields.length})</p>
          <ul className="flex flex-wrap gap-1.5">
            {fields.map(f => (
              <li key={f} className="rounded-md px-2 py-1 text-[12px] bg-[var(--accent-subtle)] text-indigo-200 border border-[var(--accent-border)]">
                {f.slice(1, -1)}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[var(--bg-surface)] px-5 sm:px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Why it works
          </p>
          <ul className="space-y-2">
            {t.tips.map(tip => (
              <li key={tip} className="flex gap-2 text-[13px] text-slate-300 leading-relaxed">
                <span className="mt-2 w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" aria-hidden="true" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export default function OutreachTemplatesPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<OutreachCategory | 'all'>('all');
  const [channel, setChannel] = useState<OutreachChannel | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string>(OUTREACH_TEMPLATES[0].id);
  // Phones show the list or the open template, not both.
  const [mobileDetail, setMobileDetail] = useState(false);

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

  // Keep the open template in view of the filters; fall back to the first match.
  const selected = filtered.find(t => t.id === selectedId) ?? filtered[0];

  const grouped = OUTREACH_CATEGORIES
    .map(c => ({ ...c, items: filtered.filter(t => t.category === c.id) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="space-y-4 pt-4 pb-12">
      <PageHeader
        title="Outreach Templates"
        description={`${OUTREACH_TEMPLATES.length} ready-to-send emails and LinkedIn messages for every stage of your search`}
        icon={Send}
        actions={<>
          <Link href="/templates" className="btn-secondary"><BookOpen /> Interview templates</Link>
          <Link href="/career-tools?tool=outreach" className="btn-primary"><Sparkles /> Write with AI</Link>
        </>}
      />

      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search: referral, salary, thank you, visa…" aria-label="Search templates"
              className="field pl-10 pr-10" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div role="radiogroup" aria-label="Channel" className="grid grid-cols-3 gap-2 sm:w-[400px]">
            {([['all', 'All'], ['email', 'Email'], ['linkedin', 'LinkedIn']] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={channel === id} onClick={() => setChannel(id)}
                className={`choice min-w-0 ${channel === id ? 'choice-active' : ''}`}>
                {id === 'email' && <OutlookIcon />}{id === 'linkedin' && <LinkedInIcon />}
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist" aria-label="Situation">
          {([{ id: 'all' as const, label: 'All situations' }, ...OUTREACH_CATEGORIES]).map(c => {
            const on = category === c.id;
            return (
              <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setCategory(c.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors cursor-pointer ${
                  on ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)] text-white' : 'border-[var(--border)] text-slate-400 hover:text-white hover:border-[var(--border-hover)]'}`}>
                {c.label}
                <span className={`text-[11px] tabular-nums ${on ? 'text-indigo-200' : 'text-slate-600'}`}>{countFor(c.id)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-white font-medium">No templates match that search</p>
          <p className="text-[13px] text-slate-500 mt-1">Try a broader word, or let the AI write one for your exact situation.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => { setQuery(''); setCategory('all'); setChannel('all'); }}>Clear filters</button>
            <Link href="/career-tools?tool=outreach" className="btn-primary"><Sparkles /> Write with AI</Link>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-4 items-start">
          {/* List */}
          <nav aria-label="Templates" className={`glass-card overflow-hidden ${mobileDetail ? 'hidden lg:block' : ''}`}>
            {grouped.map((g, gi) => (
              <div key={g.id} className={gi > 0 ? 'border-t border-white/[0.06]' : ''}>
                <p className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{g.label}</p>
                <ul className="pb-2">
                  {g.items.map(t => {
                    const on = selected?.id === t.id;
                    return (
                      <li key={t.id}>
                        <button type="button" onClick={() => { setSelectedId(t.id); setMobileDetail(true); }}
                          aria-current={on ? 'true' : undefined}
                          className={`w-full text-left flex items-start gap-3 px-4 py-2.5 border-l-2 transition-colors cursor-pointer ${
                            on ? 'border-[var(--accent)] bg-white/[0.04]' : 'border-transparent hover:bg-white/[0.02]'}`}>
                          <ChannelIcon channel={t.channel} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="min-w-0">
                            <span className={`block text-[14px] leading-snug ${on ? 'text-white font-medium' : 'text-slate-300'}`}>{t.title}</span>
                            <span className="block text-[12px] text-slate-500 mt-0.5 line-clamp-1">{t.situation}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Detail */}
          {selected && (
            <div className={`lg:sticky lg:top-[81px] ${mobileDetail ? '' : 'hidden lg:block'}`}>
              <TemplateDetail t={selected} onBack={() => setMobileDetail(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
