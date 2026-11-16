'use client';
// components/cover-letter/LetterLibrary.tsx
//
// The cover letters list as a library: a strip of figures from the student's
// own letters and job tracker (letters written, written this week, companies
// covered, applications sent with no letter for that company), then one row
// per letter with company, role, tone, length and date, and its actions.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, Copy, Download, Trash2, MoreHorizontal, FileDown, Plus } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { CompanyLogo, useCompanyLogos } from '@/components/jobs/CompanyLogo';

export interface LibraryLetter {
  id: string;
  jobRole: string;
  companyName?: string | null;
  tone: string;
  wordCount: number;
  createdAt: Date;
}

type Tracked = { company: string | null; status: string };
const SENT = new Set(['applied', 'phone-screen', 'technical', 'final', 'offer', 'rejected', 'ghosted']);
const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const when = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });

export default function LetterLibrary({ letters, onView, onCopy, onDownload, onDelete }: {
  letters: LibraryLetter[];
  onView: (id: string) => void;
  onCopy: (id: string) => void;
  onDownload: (id: string, format: 'pdf' | 'docx') => void;
  onDelete: (id: string) => void;
}) {
  const [apps, setApps] = useState<Tracked[] | null>(null);
  const [sort, setSort] = useState<'recent' | 'company' | 'role'>('recent');
  useEffect(() => {
    fetch('/api/job-tracker').then(r => (r.ok ? r.json() : null)).then(j => setApps((j?.data ?? []) as Tracked[])).catch(() => setApps([]));
  }, []);

  const logos = useCompanyLogos(letters.filter(l => l.companyName).map(l => ({ company: l.companyName! })));
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = letters.filter(l => l.createdAt.getTime() >= weekAgo).length;
  const companies = new Set(letters.map(l => norm(l.companyName)).filter(Boolean));
  // Applications sent to a company that has no letter (matched by company name).
  const sentApps = (apps ?? []).filter(a => SENT.has(a.status) && norm(a.company));
  const withoutLetter = sentApps.filter(a => !companies.has(norm(a.company))).length;
  const latest = letters[0];

  const list = useMemo(() => {
    const l = [...letters];
    if (sort === 'company') l.sort((a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? ''));
    else if (sort === 'role') l.sort((a, b) => a.jobRole.localeCompare(b.jobRole));
    else l.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return l;
  }, [letters, sort]);

  return (
    <div className="space-y-5">
      <div className="glass-card grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 overflow-hidden">
        <Kpi i={0} label="Letters written" tip="Every cover letter you have saved in Preciprocal." value={letters.length} sub={`${thisWeek} in the last 7 days`} />
        <Kpi i={1} label="Companies covered" tip="Different companies you have written a letter for, by company name." value={companies.size} sub={companies.size === 1 ? 'company' : 'companies'} />
        <Kpi i={2} label="Sent without a letter" tip="Applications in your job tracker marked applied or later, for a company you have no letter for. Matched by company name, so a renamed company can show here."
          value={apps === null ? <span className="h-6 w-10 rounded prc-skeleton" /> : <span className={withoutLetter ? 'text-amber-300' : 'text-white'}>{withoutLetter}</span>}
          sub={apps === null ? ' ' : sentApps.length ? `of ${sentApps.length} applications sent` : 'No applications in your tracker yet'} />
        <Kpi i={3} label="Latest letter" tip="The letter you wrote most recently." value={latest ? <span className="text-[17px] font-semibold tracking-normal truncate">{latest.companyName || latest.jobRole}</span> : '-'}
          sub={latest ? `${latest.jobRole} · ${when(latest.createdAt)}` : ' '} />
      </div>

      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-[13px] text-[var(--text-3)]"><span className="text-white font-semibold tabular-nums">{letters.length}</span> letter{letters.length === 1 ? '' : 's'}</p>
        <div role="radiogroup" aria-label="Sort" className="flex p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06]">
          {([['recent', 'Recent'], ['company', 'Company'], ['role', 'Role']] as const).map(([id, label]) => (
            <button key={id} role="radio" aria-checked={sort === id} onClick={() => setSort(id)}
              className={`h-7 px-3 rounded-full text-[12.5px] font-medium transition-colors ${sort === id ? 'bg-white/[0.1] text-white' : 'text-[var(--text-3)] hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="glass-card overflow-hidden divide-y divide-white/[0.06]">
        <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_120px_90px_100px_120px] gap-4 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">
          <span>Letter</span><span>Tone</span><span>Words</span><span>Written</span><span />
        </div>
        {list.map(l => (
          <Row key={l.id} l={l} domain={l.companyName ? logos[l.companyName] : null} onView={() => onView(l.id)} onCopy={() => onCopy(l.id)}
            onDownload={f => onDownload(l.id, f)} onDelete={() => onDelete(l.id)} />
        ))}
      </div>
      <div className="flex justify-center pt-1">
        <Link href="/cover-letter/create" className="btn-secondary"><Plus className="w-4 h-4" /> Write another letter</Link>
      </div>
    </div>
  );
}

function Kpi({ i, label, tip, value, sub }: { i: number; label: string; tip: string; value: React.ReactNode; sub: string }) {
  const edge = ['', 'border-t sm:border-t-0 sm:border-l', 'border-t xl:border-t-0 xl:border-l', 'border-t sm:border-l xl:border-t-0'][i];
  return (
    <div className={`px-5 py-4 min-w-0 border-[var(--border)] ${edge}`}>
      <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">{label}<InfoTip title={label} body={tip} /></p>
      <div className="font-display text-[26px] font-semibold tracking-[-0.02em] text-white tabular-nums mt-1.5 h-8 flex items-center min-w-0">{value}</div>
      <p className="text-[12px] text-[var(--text-4)] mt-1 truncate">{sub}</p>
    </div>
  );
}

function Row({ l, domain, onView, onCopy, onDownload, onDelete }: {
  l: LibraryLetter; domain: string | null | undefined; onView: () => void; onCopy: () => void; onDownload: (f: 'pdf' | 'docx') => void; onDelete: () => void;
}) {
  const [menu, setMenu] = useState<null | 'more' | 'download'>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', away); return () => document.removeEventListener('mousedown', away);
  }, [menu]);
  const isNew = Date.now() - l.createdAt.getTime() < 2 * 86_400_000;
  const item = 'w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-[var(--text-2)] hover:text-white hover:bg-white/[0.05]';

  return (
    <div className="group grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_120px_90px_100px_120px] gap-x-4 gap-y-2 items-center px-5 py-3.5 hover:bg-white/[0.015] transition-colors">
      <button onClick={onView} className="flex items-center gap-3.5 min-w-0 text-left">
        <CompanyLogo company={l.companyName || l.jobRole} domain={domain} size={38} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-white truncate group-hover:underline underline-offset-4 decoration-white/30">{l.companyName || 'No company'}</span>
            {isNew && <span className="h-5 px-1.5 rounded-md text-[10.5px] font-semibold text-emerald-200 bg-emerald-400/[0.12] inline-flex items-center flex-shrink-0">New</span>}
          </span>
          <span className="block text-[12.5px] text-[var(--text-3)] truncate mt-0.5">{l.jobRole}</span>
        </span>
      </button>
      <span className="text-[12.5px] text-[var(--text-2)] capitalize truncate">{l.tone || 'Standard'}</span>
      <span className="text-[12.5px] text-[var(--text-3)] tabular-nums">{l.wordCount ? `${l.wordCount} words` : '-'}</span>
      <span className="text-[12.5px] text-[var(--text-3)] tabular-nums">{when(l.createdAt)}</span>
      <div ref={ref} className="relative justify-self-start lg:justify-self-end flex items-center gap-1">
        <button onClick={onView} title="Read" aria-label="Read letter" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors"><Eye className="w-4 h-4" /></button>
        <button onClick={onCopy} title="Copy" aria-label="Copy letter" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors"><Copy className="w-4 h-4" /></button>
        <button onClick={() => setMenu(m => (m === 'download' ? null : 'download'))} title="Download" aria-label="Download letter" aria-expanded={menu === 'download'} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors"><Download className="w-4 h-4" /></button>
        <button onClick={() => setMenu(m => (m === 'more' ? null : 'more'))} title="More" aria-label="More actions" aria-expanded={menu === 'more'} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
        {menu && (
          <div className="absolute right-0 top-full mt-1.5 w-48 z-20 rounded-xl bg-[var(--bg-raised)] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75)]">
            {menu === 'download' ? (
              <>
                <button onClick={() => { setMenu(null); onDownload('pdf'); }} className={item}><FileDown className="w-4 h-4 text-rose-300" /> PDF document</button>
                <button onClick={() => { setMenu(null); onDownload('docx'); }} className={item}><FileDown className="w-4 h-4 text-sky-300" /> Word document</button>
              </>
            ) : (
              <>
                <button onClick={() => { setMenu(null); onView(); }} className={item}><Eye className="w-4 h-4" /> Read letter</button>
                <div className="my-1 h-px bg-white/[0.06]" />
                <button onClick={() => { setMenu(null); onDelete(); }} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-rose-300 hover:bg-rose-500/[0.08]"><Trash2 className="w-4 h-4" /> Delete</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
