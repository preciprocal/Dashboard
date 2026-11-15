// components/apply/SaveStep.tsx
//
// Step 3: mark the job as applied in the tracker, with the resume used, then
// open the employer's posting (the Chrome extension autofills the form there).
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, ExternalLink, Briefcase, ChevronRight, Chrome } from 'lucide-react';
import { toast } from 'sonner';
import type { ApplyStepProps } from '@/components/apply/types';

export default function SaveStep({ application, pack, update, goTo }: ApplyStepProps) {
  const [saving, setSaving] = useState(false);
  const approved = pack.tailor ? Object.values(pack.tailor.decisions).filter(d => d === 'approved').length : 0;

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/job-tracker', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: application.id,
          // Only moves a not-yet-applied job forward; a later stage is kept.
          ...(application.status === 'wishlist' ? { status: 'applied', appliedDate: new Date().toISOString().slice(0, 10) } : {}),
          ...(pack.resumeId ? { resumeId: pack.resumeId } : {}),
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not update the tracker');
      await update({ savedToTracker: true });
      toast.success('Saved to your job tracker');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the tracker');
    } finally {
      setSaving(false);
    }
  };

  const items = [
    { label: 'Resume tailored', value: pack.tailor ? `${approved} change${approved === 1 ? '' : 's'} approved` : 'Not yet', ok: !!pack.tailor },
    { label: 'Cover letter', value: pack.coverLetter ? 'Ready' : 'Not yet', ok: !!pack.coverLetter },
    { label: 'Job tracker', value: pack.savedToTrackerAt ? `Saved ${new Date(pack.savedToTrackerAt).toLocaleDateString()}` : 'Not saved', ok: !!pack.savedToTrackerAt },
  ];

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Ready to apply</h2>
        <ul className="divide-y divide-white/[0.05]">
          {items.map(i => (
            <li key={i.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-slate-300 flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${i.ok ? 'text-emerald-400' : 'text-slate-600'}`} />{i.label}
              </span>
              <span className="text-slate-400">{i.value}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 mt-5">
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
            {pack.savedToTrackerAt ? 'Save again' : application.status === 'wishlist' ? 'Mark as applied in tracker' : 'Save to tracker'}
          </button>
          {application.jobUrl && (
            <a href={application.jobUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <ExternalLink className="w-4 h-4" /> Open the posting
            </a>
          )}
        </div>
      </section>

      <section className="glass-card p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex gap-3">
          <Chrome className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-slate-400 leading-relaxed">
            On the employer&apos;s form, the <Link href="/extension" className="text-indigo-300 hover:underline">Chrome extension</Link> can fill in your profile details. Upload the resume you saved from step 1.
          </p>
        </div>
        <div className="flex gap-3">
          <Briefcase className="w-5 h-5 text-indigo-300 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-slate-400 leading-relaxed">
            The job&apos;s card in your <Link href="/job-tracker" className="text-indigo-300 hover:underline">tracker</Link> shows the company&apos;s E-Verify status and H-1B history from public records.
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <button onClick={() => goTo('prep')} className="btn-primary">Next: interview prep <ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
