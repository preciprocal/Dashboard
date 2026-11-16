'use client';
// components/jobs/H1bTip.tsx
//
// The H-1B line on a job, explained with the employer's own figures from our
// USCIS copy: workers approved in the fiscal year, and how many of those were
// new hires (new employment) rather than renewals or transfers.
import type { ReactNode } from 'react';
import InfoTip from '@/components/ui/info-tip';

export default function H1bTip({ h, year, className, children }: {
  /** [approvals, new employment] from the job feed, or null. */
  h: [number, number] | null | undefined;
  year: string | null;
  className?: string;
  children: ReactNode;
}) {
  const approvals = h?.[0] ?? 0;
  const newHires = h?.[1] ?? 0;
  if (approvals <= 0) return <InfoTip term="h1bNone" className={className}>{children}</InfoTip>;
  return (
    <InfoTip className={className}
      title={`H-1B sponsorship${year ? `, FY${year}` : ''}`}
      body={<>
        Workers USCIS approved for this employer.
        <span className="mt-2.5 grid grid-cols-2 gap-2">
          <span className="rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] px-2.5 py-2">
            <span className="block font-display text-[18px] font-semibold text-white tabular-nums leading-none">{approvals.toLocaleString('en-US')}</span>
            <span className="block text-[11px] text-[var(--text-4)] mt-1">approved</span>
          </span>
          <span className="rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06] px-2.5 py-2">
            <span className="block font-display text-[18px] font-semibold text-white tabular-nums leading-none">{newHires.toLocaleString('en-US')}</span>
            <span className="block text-[11px] text-[var(--text-4)] mt-1">new hires</span>
          </span>
        </span>
        <span className="block mt-2 text-[11.5px] text-[var(--text-4)]">Past sponsorship, not a promise for this role.</span>
      </>}
      source="USCIS H-1B Employer Data Hub.">
      {children}
    </InfoTip>
  );
}
