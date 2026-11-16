'use client';
// components/resume/ResumeLibrary.tsx
//
// The resume list as a library: a strip of figures that help pick which
// resume to send (best score, the default that auto-apply sends, which
// resume has led to interviews, fixes still open), then one row per resume
// with its score, area bars, how often it was sent and how many of those
// reached an interview (from the job tracker's "resume sent" field).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileText, MoreHorizontal, Trash2, Star, Send, MessagesSquare, ArrowUpRight, Loader2, CheckCircle2 } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { Resume } from '@/types/resume';
import { fetchDefaultResumeInfo } from '@/lib/resume/default-client';
import type { DefaultResumeInfo } from '@/lib/resume/default-resume';

type Tracked = { resumeId: string | null; status: string; reachedInterviewAt: string | null };
const INTERVIEW = new Set(['phone-screen', 'technical', 'final', 'offer']);

type Sec = { score?: number; tips?: { type: string }[] };
const AREAS: [string, string][] = [['ATS', 'ATS'], ['content', 'Content'], ['structure', 'Structure'], ['skills', 'Skills'], ['toneAndStyle', 'Tone']];
const tone = (s: number) => (s >= 80 ? { t: 'text-emerald-300', b: 'bg-emerald-400', c: '#34d399' } : s >= 60 ? { t: 'text-amber-300', b: 'bg-amber-400', c: '#fbbf24' } : { t: 'text-rose-300', b: 'bg-rose-400', c: '#fb7185' });
const scoreOf = (r: Resume) => r.feedback?.overallScore ?? r.score ?? null;
const openFixes = (r: Resume) => {
  const f = r.feedback as unknown as Record<string, Sec> | undefined;
  return f ? AREAS.reduce((n, [k]) => n + (f[k]?.tips ?? []).filter(t => t.type !== 'good').length, 0) : 0;
};
const when = (d: string | Date | undefined) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '');
const title = (r: Resume) => r.fileName || r.jobTitle || 'Resume';

function Ring({ score, size = 44 }: { score: number | null; size?: number }) {
  if (score === null) return <span className="rounded-full ring-[3px] ring-inset ring-white/[0.06] flex items-center justify-center text-[10px] text-[var(--text-5)] flex-shrink-0" style={{ width: size, height: size }}>New</span>;
  const r = size / 2 - 3.5, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3.5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(score).c} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="absolute text-[13px] font-semibold text-white tabular-nums">{score}</span>
    </span>
  );
}

export interface LibraryProps { resumes: Resume[]; onDelete: (id: string) => Promise<void>; deletingId: string | null }

export default function ResumeLibrary({ resumes, onDelete, deletingId }: LibraryProps) {
  const [apps, setApps] = useState<Tracked[] | null>(null);
  const [def, setDef] = useState<DefaultResumeInfo | null | undefined>(undefined);
  const [sort, setSort] = useState<'recent' | 'best' | 'needs-work'>('recent');

  useEffect(() => {
    fetch('/api/job-tracker').then(r => (r.ok ? r.json() : null)).then(j => setApps((j?.data ?? []) as Tracked[])).catch(() => setApps([]));
    fetchDefaultResumeInfo().then(setDef).catch(() => setDef(null));
  }, []);

  // Applications sent with each resume, and how many reached an interview.
  const usage = useMemo(() => {
    const m = new Map<string, { sent: number; interviews: number }>();
    for (const a of apps ?? []) {
      if (!a.resumeId || a.status === 'wishlist') continue;
      const u = m.get(a.resumeId) ?? { sent: 0, interviews: 0 };
      u.sent++; if (a.reachedInterviewAt || INTERVIEW.has(a.status)) u.interviews++;
      m.set(a.resumeId, u);
    }
    return m;
  }, [apps]);

  const scored = resumes.filter(r => scoreOf(r) !== null);
  const best = [...scored].sort((a, b) => (scoreOf(b) ?? 0) - (scoreOf(a) ?? 0))[0];
  const topInterview = [...resumes].map(r => ({ r, u: usage.get(r.id) })).filter(x => x.u && x.u.interviews > 0)
    .sort((a, b) => b.u!.interviews - a.u!.interviews || a.u!.sent - b.u!.sent)[0];
  const sentAny = [...usage.values()].reduce((n, u) => n + u.sent, 0);

  const list = useMemo(() => {
    const l = [...resumes];
    if (sort === 'best') l.sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
    else if (sort === 'needs-work') l.sort((a, b) => (scoreOf(a) ?? 101) - (scoreOf(b) ?? 101));
    else l.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return l;
  }, [resumes, sort]);

  return (
    <div className="space-y-5">
      {/* The figures that help pick a resume */}
      <div className="glass-card grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 overflow-hidden">
        <Kpi i={0} label="Best score" tip="The highest overall score among your analyzed resumes."
          value={best ? <span className={tone(scoreOf(best)!).t}>{scoreOf(best)}</span> : '-'} sub={best ? title(best) : 'Analyze a resume to score it'} href={best ? `/resume/${best.id}` : undefined} />
        <Kpi i={1} label="Default resume" tip="The resume in Settings that Auto-apply and the Chrome extension send. Change it from a row's menu."
          value={def === undefined ? <span className="h-6 w-16 rounded prc-skeleton" /> : def?.current ? <CheckCircle2 className="w-6 h-6 text-emerald-300" /> : <span className="text-amber-300">Not set</span>} sub={def === undefined ? ' ' : def?.current?.fileName ?? 'Pick one from a row below'} />
        <Kpi i={2} label="Most interviews" tip="Applications in your tracker that name the resume you sent, and how many of them reached an interview. Set the resume on a tracker card to count it."
          value={topInterview ? <span>{topInterview.u!.interviews}<span className="text-[14px] text-[var(--text-4)] font-normal"> of {topInterview.u!.sent}</span></span> : '-'}
          sub={topInterview ? title(topInterview.r) : sentAny ? 'No interviews from a named resume yet' : 'Name the resume on tracker cards to compare'} href={topInterview ? `/resume/${topInterview.r.id}` : undefined} />
        <Kpi i={3} label="Fixes open on your best" tip="Points to improve in the latest analysis of your best-scoring resume."
          value={best ? openFixes(best) : '-'} sub={best ? 'Open it to work through them' : 'Nothing analyzed yet'} href={best ? `/resume/${best.id}` : undefined} />
      </div>

      {/* Sort */}
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="text-[13px] text-[var(--text-3)]"><span className="text-white font-semibold tabular-nums">{resumes.length}</span> resume{resumes.length === 1 ? '' : 's'}</p>
        <div role="radiogroup" aria-label="Sort" className="flex p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06]">
          {([['recent', 'Recent'], ['best', 'Best first'], ['needs-work', 'Needs work']] as const).map(([id, label]) => (
            <button key={id} role="radio" aria-checked={sort === id} onClick={() => setSort(id)}
              className={`h-7 px-3 rounded-full text-[12.5px] font-medium transition-colors ${sort === id ? 'bg-white/[0.1] text-white' : 'text-[var(--text-3)] hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* The library */}
      <div className="glass-card overflow-hidden divide-y divide-white/[0.06]">
        <div className="hidden lg:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_140px_110px_44px] gap-4 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">
          <span>Resume</span><span>By area</span><span>Sent · interviews</span><span>Analyzed</span><span />
        </div>
        {list.map(r => (
          <Row key={r.id} r={r} usage={usage.get(r.id)} apps={apps} isDefault={!!def?.current && def.current.fileName === r.fileName}
            removing={deletingId === r.id} onDelete={onDelete} onMadeDefault={info => setDef(info)} />
        ))}
      </div>
    </div>
  );
}

function Kpi({ i, label, tip, value, sub, href }: { i: number; label: string; tip: string; value: React.ReactNode; sub: string; href?: string }) {
  const edge = ['', 'sm:border-l', 'border-t sm:border-l xl:border-t-0', 'border-t sm:border-l xl:border-t-0'][i] + (i === 1 ? ' border-t sm:border-t-0' : '') + (i === 2 ? ' sm:border-l-0 xl:border-l' : '');
  const inner = (
    <>
      <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">{label}<InfoTip title={label} body={tip} /></p>
      <div className="font-display text-[26px] font-semibold tracking-[-0.02em] text-white tabular-nums mt-1.5 h-8 flex items-center">{value}</div>
      <p className="text-[12px] text-[var(--text-4)] mt-1 truncate">{sub}</p>
    </>
  );
  const cls = `block px-5 py-4 border-[var(--border)] ${edge}`;
  return href ? <Link href={href} className={`${cls} hover:bg-white/[0.02] transition-colors`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function Row({ r, usage, apps, isDefault, removing, onDelete, onMadeDefault }: {
  r: Resume; usage: { sent: number; interviews: number } | undefined; apps: Tracked[] | null; isDefault: boolean; removing: boolean;
  onDelete: (id: string) => Promise<void>; onMadeDefault: (info: DefaultResumeInfo) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', away); return () => document.removeEventListener('mousedown', away);
  }, [menu]);
  const score = scoreOf(r);
  const f = r.feedback as unknown as Record<string, Sec> | undefined;

  const makeDefault = async () => {
    setMenu(false); setBusy(true);
    try {
      const res = await fetch('/api/resume/default', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId: r.id }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not set the default');
      const info = await fetchDefaultResumeInfo().catch(() => null);
      if (info) onMadeDefault(info);
      toast.success('Default resume updated');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not set the default'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setMenu(false);
    const ok = await confirm({ title: 'Delete this resume?', message: `${title(r)} and its analysis will be removed. This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (ok) await onDelete(r.id).catch(() => {});
  };

  return (
    <div className={`group grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_140px_110px_44px] gap-x-4 gap-y-3 items-center px-5 py-4 transition-all duration-300 hover:bg-white/[0.015] ${removing ? 'opacity-0 scale-[0.98] pointer-events-none' : ''}`}>
      {/* Name */}
      <Link href={`/resume/${r.id}`} className="flex items-center gap-3.5 min-w-0">
        <Ring score={score} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-white truncate group-hover:underline underline-offset-4 decoration-white/30">{title(r)}</span>
            {isDefault && <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10.5px] font-semibold text-emerald-200 bg-emerald-400/[0.12] flex-shrink-0"><Star className="w-3 h-3" />Default</span>}
          </span>
          <span className="block text-[12.5px] text-[var(--text-3)] truncate mt-0.5">{[r.jobTitle, r.companyName].filter(Boolean).join(' at ') || 'General resume'}</span>
        </span>
      </Link>

      {/* Area bars */}
      <div className="grid grid-cols-5 gap-2">
        {AREAS.map(([k, label]) => {
          const s = f?.[k]?.score;
          return (
            <div key={k} title={s !== undefined ? `${label}: ${s}` : label} className="min-w-0">
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">{s !== undefined && <div className={`h-full rounded-full ${tone(s).b}`} style={{ width: `${Math.max(3, s)}%` }} />}</div>
              <p className="text-[10.5px] text-[var(--text-4)] mt-1 truncate">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Use in the tracker */}
      <p className="text-[12.5px] text-[var(--text-3)] flex items-center gap-3">
        {apps === null ? <span className="h-3 w-20 rounded prc-skeleton" /> : (
          <>
            <span className="inline-flex items-center gap-1" title="Applications sent with this resume"><Send className="w-3.5 h-3.5 text-[var(--text-4)]" /><span className="text-white tabular-nums">{usage?.sent ?? 0}</span></span>
            <span className="inline-flex items-center gap-1" title="Of those, reached an interview"><MessagesSquare className="w-3.5 h-3.5 text-[var(--text-4)]" /><span className="text-white tabular-nums">{usage?.interviews ?? 0}</span></span>
          </>
        )}
      </p>

      <p className="text-[12.5px] text-[var(--text-3)] tabular-nums">{when(r.analyzedAt ?? r.createdAt)}</p>

      <ConfirmDialog />
      {/* Actions */}
      <div ref={ref} className="relative justify-self-end flex items-center gap-1">
        <Link href={`/resume/${r.id}`} className="lg:hidden btn-secondary !h-8 !text-[12.5px]">Open <ArrowUpRight className="w-3.5 h-3.5" /></Link>
        <button onClick={() => setMenu(v => !v)} aria-label="More actions" aria-expanded={menu}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
        </button>
        {menu && (
          <div className="absolute right-0 top-full mt-1.5 w-52 z-20 rounded-xl bg-[var(--bg-raised)] p-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75)]">
            <Link href={`/resume/${r.id}`} className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-[var(--text-2)] hover:text-white hover:bg-white/[0.05]"><FileText className="w-4 h-4" /> Open analysis</Link>
            {!isDefault && <button onClick={makeDefault} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-[var(--text-2)] hover:text-white hover:bg-white/[0.05]"><Star className="w-4 h-4" /> Make default for auto-apply</button>}
            <div className="my-1 h-px bg-white/[0.06]" />
            <button onClick={remove} className="w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-[12.5px] text-rose-300 hover:bg-rose-500/[0.08]"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}
