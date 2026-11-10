'use client';
// components/ExtensionBanner.tsx
// Dashboard prompt to try the Chrome extension: a slim announcement strip
// (one sentence, a text link, one compact action) rather than a promo card.
// Shown only once detection has settled on "not installed", so it never
// flashes for people who have it, and until the person dismisses it.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
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
    <aside aria-label="Chrome extension"
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] pl-4 pr-2 py-2 animate-fade-in-up">
      <span className="hidden sm:inline-block flex-shrink-0 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-indigo-200">
        New
      </span>
      <p className="flex-1 min-w-0 text-[13px] text-slate-300 truncate">
        <span className="sm:hidden text-white font-medium">Try the Chrome extension</span>
        <span className="hidden sm:inline text-white font-medium">Save jobs from LinkedIn in one click</span>
        <span className="hidden md:inline text-slate-400"> with the Preciprocal Chrome extension.</span>
      </p>
      <Link href="/extension" className="hidden sm:inline-flex items-center gap-1 flex-shrink-0 px-2 h-8 rounded-md text-[13px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors">
        Learn more <ArrowRight className="w-3.5 h-3.5" />
      </Link>
      <a href={extensionStoreUrl('app-dashboard-banner')} target="_blank" rel="noopener noreferrer"
        className="flex-shrink-0 inline-flex items-center h-8 px-3 rounded-md text-[13px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors">
        Add to Chrome
      </a>
      <button onClick={dismiss} aria-label="Dismiss"
        className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.05] transition-colors">
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
}
