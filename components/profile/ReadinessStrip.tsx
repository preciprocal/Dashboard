'use client';
// components/profile/ReadinessStrip.tsx
//
// How ready the account is to apply, on Profile: the Auto-apply answers the
// extension needs, the default resume it sends, the work-authorization dates
// that drive the countdown on Overview, and the profile links forms ask for.
// Each figure comes from the student's own saved data and links to where it
// is fixed.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { autoApplyFields, loadApplyProfile } from '@/components/apply/AutoApplyDetailsNotice';
import { fetchDefaultResumeInfo } from '@/lib/resume/default-client';
import { periods, type VisaTimeline } from '@/lib/visa/timeline';

type Item = { label: string; done: boolean | null; value: string; sub: string; tip: string; href?: string; onClick?: () => void };

export default function ReadinessStrip({ links, onOpenAutoApply, onEditProfile }: {
  /** LinkedIn, GitHub and website as saved on the profile. */
  links: (string | undefined | null)[];
  onOpenAutoApply: () => void;
  onEditProfile: () => void;
}) {
  const [answers, setAnswers] = useState<{ ok: number; total: number; missing: string[] } | null>(null);
  const [resume, setResume] = useState<string | null | undefined>(undefined);
  const [dates, setDates] = useState<number | null>(null);

  useEffect(() => {
    loadApplyProfile().then(p => {
      const req = p ? autoApplyFields(p).filter(f => !f.optional) : [];
      setAnswers(p ? { ok: req.filter(f => f.ok).length, total: req.length, missing: req.filter(f => !f.ok).map(f => f.label) } : { ok: 0, total: 6, missing: [] });
    });
    fetchDefaultResumeInfo().then(i => setResume(i?.current?.fileName ?? null)).catch(() => setResume(null));
    fetch('/api/visa-timeline').then(r => (r.ok ? r.json() : null)).then(j => setDates(j?.timeline ? periods(j.timeline as VisaTimeline).length : 0)).catch(() => setDates(0));
  }, []);

  const linkCount = links.filter(l => !!l && String(l).trim()).length;
  const items: Item[] = [
    {
      label: 'Auto-apply answers', done: answers ? answers.ok === answers.total : null,
      value: answers ? `${answers.ok} of ${answers.total}` : '',
      sub: answers ? (answers.missing.length ? `Missing: ${answers.missing.join(', ')}` : 'Everything the extension needs') : ' ',
      tip: 'The required answers the Chrome extension fills on application forms: name, email, phone, location, work authorization and sponsorship.',
      onClick: onOpenAutoApply,
    },
    {
      label: 'Default resume', done: resume === undefined ? null : !!resume,
      value: resume === undefined ? '' : resume ? 'Set' : 'Not set',
      sub: resume === undefined ? ' ' : resume ?? 'Upload or pick one below',
      tip: 'The resume Auto-apply, the Apply flow and the extension send.',
      onClick: onEditProfile,
    },
    {
      label: 'Work authorization', done: dates === null ? null : dates > 0,
      value: dates === null ? '' : dates > 0 ? `${dates} period${dates === 1 ? '' : 's'}` : 'Not added',
      sub: dates === null ? ' ' : dates > 0 ? 'Countdown on Overview' : 'Add OPT, STEM OPT or H-1B dates',
      tip: 'Your OPT, STEM OPT and H-1B dates, for the days-left countdown and unemployment-day count on Overview.',
      href: '/',
    },
    {
      label: 'Profile links', done: linkCount > 0,
      value: `${linkCount} of 3`, sub: linkCount === 3 ? 'LinkedIn, GitHub and website' : 'Many forms ask for LinkedIn',
      tip: 'LinkedIn, GitHub and website on your profile, filled into forms that ask for them.',
      onClick: onEditProfile,
    },
  ];
  const ready = items.filter(i => i.done).length;

  return (
    <section className="glass-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h3 className="text-[14px] font-semibold text-white">Ready to apply</h3>
        <span className="text-[12px] text-[var(--text-3)] tabular-nums">{ready} of {items.length} done</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-t border-white/[0.06]">
        {items.map((it, i) => {
          const inner = (
            <>
              <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">
                {it.done === null ? <span className="w-3.5 h-3.5 rounded-full prc-skeleton" /> : it.done ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-amber-300" />}
                {it.label}<InfoTip title={it.label} body={it.tip} />
              </p>
              <p className={`font-display text-[22px] font-semibold tracking-[-0.02em] mt-1.5 h-7 ${it.done === false ? 'text-amber-200' : 'text-white'}`}>{it.value || <span className="inline-block h-6 w-16 rounded prc-skeleton" />}</p>
              <p className="text-[12px] text-[var(--text-4)] mt-1 truncate">{it.sub}</p>
            </>
          );
          const edge = `px-5 py-4 border-[var(--border)] text-left ${i > 0 ? 'border-t sm:border-t-0' : ''} ${i % 2 === 1 ? 'sm:border-l' : ''} ${i >= 2 ? 'sm:border-t xl:border-t-0' : ''} ${i === 2 ? 'xl:border-l' : ''} hover:bg-white/[0.02] transition-colors`;
          return it.href
            ? <Link key={it.label} href={it.href} className={`block ${edge}`}>{inner}</Link>
            : <button key={it.label} onClick={it.onClick} className={`block w-full ${edge}`}>{inner}</button>;
        })}
      </div>
    </section>
  );
}
