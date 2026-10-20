'use client';
// components/ExtensionBanner.tsx
// Dashboard prompt to try the Chrome extension. Shown only once detection
// has settled on "not installed" (so it never flashes for people who have
// it) and until the person dismisses it.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chrome, Download, X } from 'lucide-react';
import { useExtensionStatus, extensionStoreUrl } from '@/lib/extension';

const DISMISS_KEY = 'prc_ext_banner_dismissed';

export default function ExtensionBanner() {
  const ext = useExtensionStatus();
  // Read after mount: localStorage does not exist during server render.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === '1'); } catch { setDismissed(false); }
  }, []);

  if (dismissed || ext.status !== 'not-installed') return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked: hides for this visit */ }
  };

  return (
    <section aria-labelledby="ext-banner-h"
      className="glass-card relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-in-up">
      <div className="flex items-center gap-3 flex-1 min-w-0 pr-8 sm:pr-0">
        <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
          <Chrome className="w-5 h-5 text-indigo-200" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-300">New · Chrome extension</p>
          <h2 id="ext-banner-h" className="text-[15px] font-semibold text-white mt-0.5">Save jobs from LinkedIn in one click</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">See your match on any posting and keep your Job Tracker filled in as you apply.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/extension" className="btn-secondary">Learn more</Link>
        <a href={extensionStoreUrl('app-dashboard-banner')} target="_blank" rel="noopener noreferrer" className="btn-primary"><Download /> Install</a>
      </div>
      <button onClick={dismiss} aria-label="Dismiss"
        className="absolute top-3 right-3 sm:static sm:ml-1 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors">
        <X className="w-4 h-4" />
      </button>
    </section>
  );
}
