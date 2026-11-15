'use client';
// components/apply/AutoApplyDetailsNotice.tsx
//
// Auto-apply and the extension fill application forms from the Auto-apply
// details in Settings. This tells the student so wherever they turn either
// on, and lists what is still missing. Questions with no saved answer are
// left blank on the form for them to answer.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, ArrowRight } from 'lucide-react';

export const AUTO_APPLY_SETTINGS_HREF = '/profile?tab=auto-apply';

export interface ApplyProfileLike {
  firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null;
  city?: string | null; state?: string | null; linkedInUrl?: string | null;
  workAuthorization?: string | null; requireSponsorship?: boolean | string | null;
}

/** The details a form needs most, and whether each is filled in. */
export function autoApplyFields(p: ApplyProfileLike): { label: string; ok: boolean; optional?: boolean }[] {
  return [
    { label: 'Name', ok: !!(p.firstName && p.lastName) },
    { label: 'Email', ok: !!p.email },
    { label: 'Phone', ok: !!p.phone },
    { label: 'Location', ok: !!(p.city || p.state) },
    { label: 'LinkedIn', ok: !!p.linkedInUrl, optional: true },
    { label: 'Work authorization', ok: p.workAuthorization !== null && p.workAuthorization !== undefined && p.workAuthorization !== '' },
    { label: 'Sponsorship answer', ok: p.requireSponsorship !== null && p.requireSponsorship !== undefined },
  ];
}

// One request per page load, shared by every notice on the page.
let profilePromise: Promise<ApplyProfileLike | null> | null = null;
export function loadApplyProfile(): Promise<ApplyProfileLike | null> {
  return (profilePromise ??= fetch('/api/extension/auto-apply')
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j?.applyProfile as ApplyProfileLike | undefined) ?? null)
    .catch(() => null));
}

export default function AutoApplyDetailsNotice({ context, className = '' }: {
  /** Who fills the form, for the wording. */
  context: 'auto-apply' | 'extension';
  className?: string;
}) {
  const [profile, setProfile] = useState<ApplyProfileLike | null | undefined>(undefined);
  useEffect(() => { loadApplyProfile().then(setProfile); }, []);
  if (profile === undefined) return null;

  const who = context === 'extension' ? 'The extension' : 'Auto-apply';
  const missing = profile ? autoApplyFields(profile).filter(f => !f.ok && !f.optional) : null;

  if (missing && missing.length === 0) {
    return (
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 ${className}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <p className="text-[12.5px] text-slate-300 flex-1 min-w-[200px]">
          {who} fills forms from your Auto-apply details in Settings. They are complete; keep them up to date.
        </p>
        <Link href={AUTO_APPLY_SETTINGS_HREF} className="text-[12.5px] font-medium text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1">
          Review <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3 ${className}`} role="note">
      <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-500/10 border border-amber-500/20 text-amber-300">
        <ClipboardList className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-[220px]">
        <p className="text-[13px] font-semibold text-white">Fill in your Auto-apply details first</p>
        <p className="text-[12.5px] text-slate-300 mt-0.5 leading-relaxed">
          {who} answers application forms from the Auto-apply tab in Settings. Anything not filled in there is left blank on the form for you to answer.
        </p>
        {missing && missing.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {missing.map(f => (
              <span key={f.label} className="text-[11px] font-medium rounded-md border border-amber-500/25 bg-amber-500/[0.08] text-amber-200 px-2 py-0.5">{f.label}</span>
            ))}
          </div>
        )}
      </div>
      <Link href={AUTO_APPLY_SETTINGS_HREF} className="btn-primary h-9 flex-shrink-0 self-center">
        Complete details <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
