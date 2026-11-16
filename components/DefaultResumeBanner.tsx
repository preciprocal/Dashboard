'use client';
// components/DefaultResumeBanner.tsx
//
// A slim "New" strip across the app when the student has a newer resume in
// Preciprocal than the default one in Profile settings, which auto-apply, the
// Apply flow and the extension use. One click makes the newer one the
// default; dismissing hides it until an even newer resume arrives.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { fetchDefaultResumeInfo } from '@/lib/resume/default-client';
import type { DefaultResumeInfo } from '@/lib/resume/default-resume';

const DISMISS_KEY = 'prc_default_resume_banner_dismissed';
/** Fired after the default resume changes, so the banner and pickers refresh. */
export const DEFAULT_RESUME_EVENT = 'prc:default-resume-changed';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function DefaultResumeBanner() {
  const pathname = usePathname();
  const [info, setInfo] = useState<DefaultResumeInfo | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lastLoad = useRef(0);

  const load = useCallback(async (force = false) => {
    // A new resume arrives from another page (Resume upload), so check again
    // on navigation, at most once a minute.
    if (!force && Date.now() - lastLoad.current < 60_000) return;
    lastLoad.current = Date.now();
    setInfo(await fetchDefaultResumeInfo());
  }, []);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY)); } catch { /* storage blocked */ }
    const onChange = () => { void load(true); };
    window.addEventListener(DEFAULT_RESUME_EVENT, onChange);
    return () => window.removeEventListener(DEFAULT_RESUME_EVENT, onChange);
  }, [load]);

  useEffect(() => { void load(); }, [pathname, load]);

  const newer = info?.newer;
  if (!newer || dismissed === newer.id) return null;

  const dismiss = () => {
    setDismissed(newer.id);
    try { localStorage.setItem(DISMISS_KEY, newer.id); } catch { /* hides for this visit */ }
  };

  const makeDefault = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/resume/default', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId: newer.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Could not set the default resume');
      toast.success(`${j.fileName || newer.fileName} is now your default resume`);
      window.dispatchEvent(new Event(DEFAULT_RESUME_EVENT));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set the default resume');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside aria-label="Default resume"
      className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] pl-4 pr-2 py-2 animate-fade-in-up">
      <span className="hidden sm:inline-block flex-shrink-0 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-1.5 py-0.5 text-xs font-semibold text-indigo-200">
        New
      </span>
      <p className="flex-1 min-w-0 text-[13px] text-slate-300 truncate">
        <span className="text-white font-medium">{newer.fileName}</span>
        <span className="text-slate-400"> ({fmt(newer.uploadedAt)}) </span>
        {info?.current
          ? <>is newer than your default resume<span className="hidden md:inline">, {info.current.fileName}. Auto-apply and the extension use the default.</span></>
          : <>is in the app, but you have no default resume<span className="hidden md:inline"> for auto-apply and the extension yet.</span></>}
      </p>
      <Link href="/profile" className="hidden sm:inline-flex items-center flex-shrink-0 px-2 h-8 rounded-md text-[13px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors">
        Settings
      </Link>
      <button onClick={makeDefault} disabled={saving}
        className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold text-[var(--on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-60">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Make it my default
      </button>
      <button onClick={dismiss} aria-label="Dismiss"
        className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors">
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
}
