// components/profile/Saved.tsx
//
// Profile > Saved: the interview templates saved from the Templates page
// (stored in this browser under `bookmarkedTemplates`). Every control works:
// search, sort, practice and remove. Only what was saved is shown; nothing
// is filled in when a field is missing.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bookmark, BookmarkX, Clock, ListChecks, Loader2, Play, Search, Target } from 'lucide-react';
import { AppSelect } from '@/components/ui/select';

interface SavedTemplate {
  id: string;
  title?: string;
  role?: string;
  category?: string;
  description?: string;
  techstack?: string[];
  difficulty?: string;
  type?: string;
  duration?: string;
  questions?: number;
}

const KEY = 'bookmarkedTemplates';
// The Templates page fires this when it saves or unsaves one.
const SAVED_EVENT = 'preciprocal:saved-templates';

function readSaved(): SavedTemplate[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter(x => x && typeof x === 'object' && 'id' in x).map(x => ({ ...(x as SavedTemplate), id: String((x as SavedTemplate).id) })) : [];
  } catch {
    return [];
  }
}

const name = (t: SavedTemplate) => t.role || t.title || 'Interview template';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const DIFFICULTY_TONE: Record<string, string> = {
  beginner: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  easy: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  intermediate: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  medium: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  advanced: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  hard: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
};
const tag = 'inline-flex items-center gap-1 text-[11px] font-medium rounded-md border px-2 py-0.5';

export default function ProfileSaved() {
  const [items, setItems] = useState<SavedTemplate[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');

  useEffect(() => {
    const load = () => setItems(readSaved());
    load();
    window.addEventListener(SAVED_EVENT, load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener(SAVED_EVENT, load); window.removeEventListener('storage', load); };
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (items ?? []).filter(t => !needle || [name(t), t.category, t.type, ...(t.techstack ?? [])].some(v => v?.toLowerCase().includes(needle)));
    return sort === 'name' ? [...list].sort((a, b) => name(a).localeCompare(name(b))) : list;
  }, [items, q, sort]);

  const remove = (t: SavedTemplate) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(readSaved().filter(x => x.id !== t.id)));
      window.dispatchEvent(new Event(SAVED_EVENT));
      toast.success(`Removed ${name(t)}`);
    } catch {
      toast.error('Could not update saved templates in this browser');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <section className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-indigo-200">
          <Bookmark className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
            Saved templates
            {items && <span className="text-[11px] font-semibold tabular-nums rounded-md border border-white/[0.08] px-1.5 py-0.5 text-slate-300">{items.length}</span>}
          </h2>
          <p className="text-[12.5px] text-slate-400 mt-0.5">Interview templates you saved from Templates. They are kept in this browser.</p>
        </div>
        <Link href="/templates" className="btn-secondary h-9 justify-center"><Target className="w-4 h-4" /> Browse templates</Link>
      </section>

      {items === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <div key={i} className="glass-card h-[148px] animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <section className="glass-card p-10 text-center">
          <span className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/[0.03] border border-white/[0.08] text-slate-400">
            <Bookmark className="w-5 h-5" />
          </span>
          <h3 className="text-[15px] font-semibold text-white">Nothing saved yet</h3>
          <p className="text-[13px] text-slate-400 mt-1 mb-5 max-w-sm mx-auto">Save a template from the Templates page with its bookmark button and it shows up here, ready to practice.</p>
          <Link href="/templates" className="btn-primary h-9 inline-flex"><Target className="w-4 h-4" /> Find templates</Link>
        </section>
      ) : (
        <>
          <section className="glass-card p-3 grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
            <label className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input className="field w-full pl-10" placeholder="Search by role, category or skill" value={q} onChange={e => setQ(e.target.value)} />
            </label>
            <AppSelect aria-label="Sort saved templates" value={sort} onValueChange={v => setSort(v as 'recent' | 'name')}
              options={[{ value: 'recent', label: 'Recently saved' }, { value: 'name', label: 'Name (A to Z)' }]} />
          </section>

          {shown.length === 0 ? (
            <p className="glass-card p-6 text-center text-[13px] text-slate-400">No saved template matches &ldquo;{q}&rdquo;.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {shown.map(t => <SavedCard key={t.id} t={t} onRemove={() => remove(t)} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SavedCard({ t, onRemove }: { t: SavedTemplate; onRemove: () => void }) {
  const tone = t.difficulty ? DIFFICULTY_TONE[t.difficulty.toLowerCase()] : undefined;
  return (
    <article className="glass-card p-4 flex flex-col gap-3 hover:border-white/[0.14] transition-colors">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-indigo-200">
          <Target className="w-[18px] h-[18px]" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-white truncate">{name(t)}</h3>
          {(t.category || t.type) && (
            <p className="text-[12px] text-slate-400 truncate mt-0.5">{[t.category, t.type && cap(t.type)].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <button onClick={onRemove} aria-label={`Remove ${name(t)} from saved`} title="Remove from saved"
          className="w-8 h-8 -mr-1 -mt-1 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-300 hover:bg-rose-500/[0.08] transition-colors flex-shrink-0">
          <BookmarkX className="w-4 h-4" />
        </button>
      </div>

      {t.description && <p className="text-[12.5px] text-slate-400 leading-relaxed line-clamp-2">{t.description}</p>}

      <div className="flex flex-wrap gap-1.5">
        {t.difficulty && <span className={`${tag} ${tone ?? 'text-slate-300 border-white/[0.08]'}`}>{cap(t.difficulty)}</span>}
        {typeof t.questions === 'number' && t.questions > 0 && <span className={`${tag} text-slate-300 border-white/[0.08]`}><ListChecks className="w-3 h-3" />{t.questions} questions</span>}
        {t.duration && <span className={`${tag} text-slate-300 border-white/[0.08]`}><Clock className="w-3 h-3" />{t.duration}</span>}
        {(t.techstack ?? []).slice(0, 3).map(s => <span key={s} className={`${tag} text-slate-400 border-white/[0.06] bg-white/[0.02]`}>{s}</span>)}
      </div>

      <div className="mt-auto pt-1">
        <PracticeButton templateId={t.id} />
      </div>
    </article>
  );
}

// Starts a mock interview from a saved template, the same way the Templates
// page does.
function PracticeButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch('/api/templates/interview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (!res.ok || !data.interviewId) throw new Error(data.error || 'Could not start the interview');
      router.push(`/interview/${data.interviewId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start the interview');
      setStarting(false);
    }
  };
  return (
    <button onClick={start} disabled={starting} className="btn-primary h-9 w-full justify-center">
      {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {starting ? 'Starting' : 'Practice'}
    </button>
  );
}
