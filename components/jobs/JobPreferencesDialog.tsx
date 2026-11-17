'use client';
// components/jobs/JobPreferencesDialog.tsx
//
// Edit job preferences from inside Jobs. Onboarding (app/onboarding) is the
// first-run setup for new accounts; once it is done, preferences change here,
// without leaving the app. Saves to the same place (POST /api/onboarding).
import { useEffect, useState } from 'react';
import { Briefcase, Check, Loader2, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import { FAMILY_OPTIONS, LEVEL_OPTIONS, readPreferences, type JobPreferences } from '@/lib/onboarding/preferences';
import { SwitchRow } from '@/components/profile/FormKit';

export default function JobPreferencesDialog({ initial, onClose, onSaved }: {
  initial: JobPreferences; onClose: () => void; onSaved: (p: JobPreferences) => void;
}) {
  const [p, setP] = useState<JobPreferences>(initial);
  const [anywhere, setAnywhere] = useState(!initial.location);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, saving]);

  const toggle = <K extends 'families' | 'levels'>(key: K, id: JobPreferences[K][number]) =>
    setP(v => {
      const list = v[key] as string[];
      return { ...v, [key]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] };
    });

  const save = async () => {
    setSaving(true);
    try {
      const next = { ...p, role: p.role.trim(), location: anywhere ? '' : p.location.trim() };
      const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: next }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save');
      onSaved(readPreferences({ ...next, completedAt: initial.completedAt }));
      toast.success('Job preferences saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const chip = (on: boolean) => `inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] transition-colors ring-1 ring-inset ${on ? 'bg-white/[0.08] text-white ring-white/[0.16]' : 'text-[var(--text-3)] ring-white/[0.07] hover:text-white hover:bg-white/[0.04]'}`;
  const label = 'block text-[12.5px] font-medium text-[var(--text-2)] mb-2';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div role="dialog" aria-modal="true" aria-labelledby="jp-title"
        className="relative w-full sm:max-w-[560px] max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-16px_rgba(0,0,0,0.8)] animate-fade-in-up">
        <header className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 id="jp-title" className="font-display text-[16px] font-semibold tracking-[-0.01em] text-white">Job preferences</h2>
            <p className="text-[12.5px] text-[var(--text-4)] mt-0.5">Jobs opens on these filters. You can still change filters for any search.</p>
          </div>
          <button onClick={onClose} disabled={saving} aria-label="Close"
            className="w-8 h-8 -mr-1.5 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto glass-scrollbar px-5 sm:px-6 py-5 space-y-6">
          <div>
            <span className={label}>Area</span>
            <div className="flex flex-wrap gap-2">
              {FAMILY_OPTIONS.map(f => {
                const on = p.families.includes(f.id);
                return <button key={f.id} type="button" aria-pressed={on} title={f.hint} onClick={() => toggle('families', f.id)} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}{f.label}</button>;
              })}
            </div>
            {!p.families.length && <p className="text-[11.5px] text-[var(--text-5)] mt-2">None picked: all areas are shown.</p>}
          </div>

          <div>
            <label htmlFor="jp-role" className={label}>Target role</label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-[var(--text-5)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input id="jp-role" className="field w-full !pl-10" placeholder="e.g. Data analyst" maxLength={80}
                value={p.role} onChange={e => setP(v => ({ ...v, role: e.target.value }))} />
            </div>
          </div>

          <div>
            <span className={label}>Level</span>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map(l => {
                const on = p.levels.includes(l.id);
                return <button key={l.id} type="button" aria-pressed={on} title={l.hint} onClick={() => toggle('levels', l.id)} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}{l.label}</button>;
              })}
            </div>
            {!p.levels.length && <p className="text-[11.5px] text-rose-300 mt-2">Pick at least one level.</p>}
          </div>

          <div>
            <span className={label}>Location</span>
            <div role="radiogroup" className="inline-flex p-0.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
              {[{ v: true, t: 'Anywhere in the US' }, { v: false, t: 'A city or state' }].map(o => (
                <button key={o.t} type="button" role="radio" aria-checked={anywhere === o.v} onClick={() => setAnywhere(o.v)}
                  className={`h-8 px-3 rounded-md text-[12.5px] font-medium transition-colors ${anywhere === o.v ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`}>
                  {o.t}
                </button>
              ))}
            </div>
            {!anywhere && (
              <div className="relative mt-2">
                <MapPin className="w-4 h-4 text-[var(--text-5)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className="field w-full !pl-10" placeholder="e.g. Boston or New York" maxLength={60} autoFocus
                  value={p.location} onChange={e => setP(v => ({ ...v, location: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <SwitchRow value={p.remote} onChange={v => setP(x => ({ ...x, remote: v }))} label="Open to remote" />
            <SwitchRow value={p.everifyOnly} onChange={v => setP(x => ({ ...x, everifyOnly: v }))} label="E-Verify employers only" desc="Needed for a STEM OPT extension" />
            <SwitchRow value={p.h1bOnly} onChange={v => setP(x => ({ ...x, h1bOnly: v }))} label="Employers with H-1B approvals only" />
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-white/[0.06]">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary !h-9 !text-[13px]">Cancel</button>
          <button type="button" onClick={save} disabled={saving || !p.levels.length || (!anywhere && !p.location.trim())} className="btn-primary !h-9 !text-[13px]">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save preferences
          </button>
        </footer>
      </div>
    </div>
  );
}
