// components/apply/TrackerStep.tsx
//
// Step 4: this application in the student's Job Tracker. Shows where it
// stands, links to the tracker, and keeps interview prep one click away.
'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, ChevronRight, FolderCheck, Target } from 'lucide-react';
import type { ApplyStepProps } from '@/components/apply/types';

const STATUS_LABEL: Record<string, string> = {
  wishlist: 'Saved', applied: 'Applied', 'phone-screen': 'Phone screen', interview: 'Interviewing',
  offer: 'Offer', rejected: 'Not moving forward', withdrawn: 'Withdrawn',
};
const label = (s: string) => STATUS_LABEL[s] ?? s.replace(/[-_]/g, ' ').replace(/^\w/, c => c.toUpperCase());

export default function TrackerStep({ application, pack, goTo }: ApplyStepProps) {
  const applied = !!pack.savedToTrackerAt || application.status !== 'wishlist';
  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] text-[var(--text-2)]">
          <FolderCheck className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">In your Job Tracker</h2>
          <p className="text-[13px] text-[var(--text-3)] mt-0.5 truncate">
            {application.jobTitle}{application.company ? ` at ${application.company}` : ''}
          </p>
        </div>
        <span className="self-start sm:self-auto inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium text-[var(--text-1)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
          <span className={`w-1.5 h-1.5 rounded-full ${applied ? 'bg-emerald-400' : 'bg-sky-400'}`} aria-hidden="true" />
          {label(application.status)}
        </span>
      </div>

      <div className="mt-5 pt-5 border-t border-white/[0.06]">
        {applied ? (
          <p className="text-[13px] text-[var(--text-2)] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            {pack.savedToTrackerAt ? `Marked applied on ${new Date(pack.savedToTrackerAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.` : 'Tracked with its current stage.'}
            {' '}Update the stage there as you hear back.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--text-2)]">
            Saved, not applied yet. Submit on {application.company || 'the employer'}&apos;s site in step 3 and it moves to Applied here.
          </p>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/job-tracker" className="btn-primary !h-9 !text-[13px]">Open Job Tracker <ArrowUpRight className="w-4 h-4" /></Link>
          {!applied && <button onClick={() => goTo('save')} className="btn-secondary !h-9 !text-[13px]">Back to step 3</button>}
          <button onClick={() => goTo('prep')} className="btn-secondary !h-9 !text-[13px]"><Target className="w-4 h-4" /> Prepare for interviews <ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </section>
  );
}
