'use client';
import { AppSelect } from '@/components/ui/select';
import PageHeader from '@/components/PageHeader';
import { Briefcase as HeaderIcon } from 'lucide-react';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import {
  Plus, Loader2, Briefcase, Building2, MapPin, Calendar, ExternalLink,
  Edit3, Trash2, X, Save, Search, Filter, ChevronDown,
  CheckCircle2, DollarSign, Globe, Laptop, Landmark,
  SlidersHorizontal, CalendarPlus, Sparkles, UserSearch,
  Check, Shield, ArrowRight, Mic, ShieldCheck, Send,
} from 'lucide-react';
import Link from 'next/link';
import { CompanyLogo, useCompanyLogos } from '@/components/jobs/CompanyLogo';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';
import { useUsageTracking } from '@/lib/hooks/useUsageTracking';
import { isUnlimited } from '@/lib/config/usage-limits';
import { SeeExampleButton } from '@/components/ServiceModal';
import NextStepPrompt from '@/components/NextStepPrompt'; // ← ADDED
import FunnelDoctor from '@/components/outcomes/FunnelDoctor';
import InboundEmailPanel from '@/components/outcomes/InboundEmailPanel';
import FindContactsSheet from '@/components/job-tracker/FindContactsSheet';
import InterviewScheduleModal from '@/components/calendar/InterviewScheduleModal';
import InterviewScheduleRow from '@/components/calendar/InterviewScheduleRow';
import UpcomingInterviews from '@/components/calendar/UpcomingInterviews';
import { useInterviewSchedules } from '@/components/calendar/useInterviewSchedules';
import TrackerKpis from '@/components/job-tracker/TrackerKpis';
import type { TrackedApp } from '@/lib/overview/metrics';
import type { InterviewSchedule } from '@/lib/calendar/status';
import InfoTip from '@/components/ui/info-tip';
import DateInput from '@/components/ui/date-input';
import { GLOSSARY } from '@/lib/glossary';
import FeatureEmpty from '@/components/ui/feature-empty';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppStatus = 'wishlist' | 'applied' | 'phone-screen' | 'technical' | 'final' | 'offer' | 'rejected' | 'ghosted' | 'withdrew';
type WorkType  = 'remote' | 'hybrid' | 'onsite';

interface Application {
  id: string; userId: string; company: string; jobTitle: string;
  jobUrl: string | null; location: string | null; salary: string | null;
  workType: WorkType; source: string | null; notes: string | null;
  status: AppStatus; appliedDate: string; createdAt: unknown; updatedAt: unknown;
  /** Which resume was sent, for the "which resume gets interviews" report. */
  resumeId?: string | null;
  /** The posting, so "Practise this interview" can build from it. */
  jobDescription?: string | null;
  /** Written once, when the employer first replied or the first interview came. */
  firstResponseAt?: string | null;
  reachedInterviewAt?: string | null;
}

type AppForm = Omit<Application, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  wishlist:       { label: 'Wishlist',     color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   dot: 'bg-slate-400'   },
  applied:        { label: 'Applied',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-400'    },
  'phone-screen': { label: 'Phone Screen', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400'  },
  technical:      { label: 'Technical',    color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-400'  },
  final:          { label: 'Final Round',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400'   },
  offer:          { label: 'Offer',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  rejected:       { label: 'Rejected',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-400'     },
  ghosted:        { label: 'Ghosted',      color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   dot: 'bg-slate-500'   },
  withdrew:       { label: 'Withdrew',     color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  dot: 'bg-orange-400'  },
};

const WORK_TYPE_CONFIG: Record<WorkType, { label: string; icon: React.ElementType }> = {
  remote: { label: 'Remote', icon: Globe }, hybrid: { label: 'Hybrid', icon: Laptop }, onsite: { label: 'Onsite', icon: Building2 },
};

const PIPELINE_STAGES: AppStatus[] = ['wishlist', 'applied', 'phone-screen', 'technical', 'final', 'offer'];

const EMPTY_FORM: AppForm = {
  company: '', jobTitle: '', jobUrl: null, location: null, salary: null,
  workType: 'onsite', source: null, notes: null, status: 'applied',
  appliedDate: new Date().toISOString().split('T')[0], resumeId: null, jobDescription: null,
};

// Shared form-control size and style (globals.css .field), so every input,
// select and textarea on this page matches the rest of the app.
const inp = 'field';

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ feature }: { feature: 'jobs' | 'contacts' }) {
  const isJobs = feature === 'jobs';
  return (
    <section className="glass-card p-6 sm:p-8 animate-fade-in-up">
      <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11.5px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />{isJobs ? 'Job tracker limit reached' : 'Contact search limit reached'}
      </span>
      <h2 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-white mt-4">{isJobs ? 'Your plan has reached its tracked jobs' : 'You have used this month\u2019s contact searches'}</h2>
      <p className="text-[13.5px] text-[var(--text-3)] mt-2 max-w-lg">{isJobs ? 'Remove a job you are no longer pursuing, or upgrade.' : 'Your limit resets on your billing date. Upgrade or buy a Networking Pack for more now.'}</p>
      <div className="flex flex-wrap gap-2 mt-6">
        <Link href="/pricing" className="btn-primary">See plans <ArrowRight className="w-4 h-4" /></Link>
      </div>
    </section>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color} ${cfg.bg} ${cfg.border}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />{cfg.label}</span>;
}

// ─── Form modal ───────────────────────────────────────────────────────────────

interface ResumeOption { id: string; fileName: string }
interface FormModalProps { form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>; onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean; resumes: ResumeOption[]; }

function FormModal({ form, setForm, onSave, onCancel, saving, isEdit, resumes }: FormModalProps) {
  const f = (key: keyof AppForm, val: string | null) => setForm(p => ({ ...p, [key]: val || null }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[var(--bg-raised)] border border-white/[0.09] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]"><Briefcase className="w-4 h-4 text-[var(--text-2)]" /></div><h2 className="text-sm font-bold text-white">{isEdit ? 'Edit Application' : 'Add Application'}</h2></div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 space-y-4 glass-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Company *</label><input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="e.g. Stripe" className={inp} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Job Title *</label><input type="text" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} placeholder="e.g. Senior SWE" className={inp} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label><AppSelect value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as AppStatus }))} aria-label="Status" options={(Object.keys(STATUS_CONFIG) as AppStatus[]).map(s => ({ value: s, label: STATUS_CONFIG[s].label }))} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Applied Date</label><DateInput value={form.appliedDate} onChange={v => setForm(p => ({ ...p, appliedDate: v }))} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label><input type="text" value={form.location || ''} onChange={e => f('location', e.target.value)} placeholder="e.g. San Francisco, CA" className={inp} /></div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Work Type</label>
              <div className="flex gap-1.5">
                {(Object.keys(WORK_TYPE_CONFIG) as WorkType[]).map(wt => { const WIcon = WORK_TYPE_CONFIG[wt].icon; return (
                  <button key={wt} type="button" onClick={() => setForm(p => ({ ...p, workType: wt }))}
                    className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${form.workType === wt ? 'bg-white/[0.1] border-white/[0.16] text-white' : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-slate-300 hover:border-white/[0.12]'}`}>
                    <WIcon className="w-3.5 h-3.5" />{WORK_TYPE_CONFIG[wt].label}
                  </button>); })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Salary / Range</label><input type="text" value={form.salary || ''} onChange={e => f('salary', e.target.value)} placeholder="e.g. $140k-$170k" className={inp} /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Source</label><input type="text" value={form.source || ''} onChange={e => f('source', e.target.value)} placeholder="e.g. LinkedIn, referral" className={inp} /></div>
          </div>
          {resumes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Resume sent</label>
              <AppSelect value={form.resumeId ?? ''} onValueChange={v => setForm(p => ({ ...p, resumeId: v || null }))} aria-label="Resume used"
                options={[{ value: '', label: 'Not recorded' }, ...resumes.map(r => ({ value: r.id, label: r.fileName }))]} />
              <p className="text-xs text-slate-500 mt-1">Lets the funnel show which version of your resume gets interviews.</p>
            </div>
          )}
          <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Job URL</label><input type="url" value={form.jobUrl || ''} onChange={e => f('jobUrl', e.target.value)} placeholder="https://…" className={inp} /></div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Job description <span className="text-slate-500 font-normal">(optional)</span></label>
            <textarea rows={3} value={form.jobDescription || ''} onChange={e => setForm(p => ({ ...p, jobDescription: e.target.value || null }))} placeholder="Paste the posting. Practice interviews for this application will be built from it." className={`${inp} resize-y`} maxLength={12000} />
          </div>
          <div><label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label><textarea rows={3} value={form.notes || ''} onChange={e => f('notes', e.target.value)} placeholder="Interview details, recruiter name, key contacts, follow-up dates…" className={`${inp} resize-none`} /></div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button onClick={onSave} disabled={saving || !form.company.trim() || !form.jobTitle.trim()} className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> {isEdit ? 'Update' : 'Save Application'}</>}
          </button>
          <button onClick={onCancel} className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-slate-300 rounded-xl font-semibold text-sm transition-all">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── App card ─────────────────────────────────────────────────────────────────

// ─── E-Verify badge ───────────────────────────────────────────────────────────
// From the daily copy of the public E-Verify Employer Search (lib/jobs/everify.ts).
// STEM OPT needs an E-Verify employer, so this is the first thing an F-1 student
// checks. Employers self-report, so the badge says when it was checked and links
// to the official search for a second look.

type EverifyState = 'enrolled' | 'ending' | 'ended' | 'not-found';
interface EverifyStatus { state: EverifyState; employer: string | null; enrolledOn: string | null; terminatesOn: string | null; workforceSize: string | null }
const EVERIFY_SEARCH_URL = 'https://www.e-verify.gov/e-verify-employer-search';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function EverifyBadge({ status, syncedAt }: { status: EverifyStatus; syncedAt: string | null }) {
  const checked = syncedAt ? `Updated ${fmtDate(syncedAt)}. Click to open the official E-Verify search.` : 'Click to open the official E-Verify search.';
  const conf = {
    enrolled: {
      label: 'E-Verified',
      cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
      term: 'everified' as const,
      fact: `${status.employer} is enrolled${status.enrolledOn ? ` since ${fmtDate(status.enrolledOn)}` : ''}.`,
    },
    ending: {
      label: `E-Verified until ${fmtDate(status.terminatesOn)}`,
      cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
      term: 'everified' as const,
      fact: `${status.employer} is enrolled until ${fmtDate(status.terminatesOn)}. After that date it would need to enrol again.`,
    },
    ended: {
      label: 'No longer E-Verified',
      cls: 'text-red-300 bg-red-500/10 border-red-500/25',
      term: 'everifyEnded' as const,
      fact: `${status.employer}'s enrolment ended${status.terminatesOn ? ` on ${fmtDate(status.terminatesOn)}` : ''}.`,
    },
    'not-found': {
      label: 'E-Verified: no match found',
      cls: 'text-slate-400 bg-white/[0.03] border-white/[0.08]',
      term: 'everifyUnknown' as const,
      fact: null,
    },
  }[status.state];
  const g = GLOSSARY[conf.term];
  return (
    <InfoTip wrap title={g.title} source={checked}
      body={<>{conf.fact && <span className="block text-white/90 mb-1">{conf.fact}</span>}{g.body}</>}>
      <a href={EVERIFY_SEARCH_URL} target="_blank" rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold transition-opacity hover:opacity-80 ${conf.cls}`}>
        <ShieldCheck className="w-3 h-3" /> {conf.label}
      </a>
    </InfoTip>
  );
}

// ─── H-1B badge ───────────────────────────────────────────────────────────────
// From the monthly copy of the USCIS H-1B Employer Data Hub (lib/jobs/h1b.ts).
// Approvals show the employer has had H-1B petitions approved, not that it will
// sponsor this candidate, so the tooltip says so.

interface H1bYear { year: string; newEmployment: number; approvals: number; denials: number }
interface H1bHistory { employer: string; state: string | null; years: H1bYear[] }
const H1B_HUB_URL = 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub';

function H1bBadge({ history, years }: { history: H1bHistory | null; years: string[] }) {
  const span = years.length ? `FY${years[years.length - 1]}-FY${years[0]}` : '';
  if (!history || history.years.every((y) => y.approvals === 0)) {
    return (
      <InfoTip wrap term="h1bNone" source={`Searched ${span}. Click to open the USCIS H-1B Employer Data Hub.`}>
        <a href={H1B_HUB_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold transition-opacity hover:opacity-80 text-slate-400 bg-white/[0.03] border-white/[0.08]">
          <Landmark className="w-3 h-3" /> H-1B: none on record
        </a>
      </InfoTip>
    );
  }
  const latest = history.years.find((y) => y.approvals > 0) ?? history.years[0];
  const n = (v: number) => v.toLocaleString('en-US');
  return (
    <InfoTip wrap title={`H-1B approvals: ${history.employer}`} source="USCIS H-1B Employer Data Hub. Click to open it."
      body={<>
        <table className="w-full text-[11.5px] tabular-nums my-1.5">
          <thead><tr className="text-slate-500"><th className="text-left font-medium">Year</th><th className="text-right font-medium">Approved</th><th className="text-right font-medium">New hires</th><th className="text-right font-medium">Denied</th></tr></thead>
          <tbody>{history.years.map((y) => (
            <tr key={y.year} className="text-slate-200"><td>FY{y.year}</td><td className="text-right">{n(y.approvals)}</td><td className="text-right">{n(y.newEmployment)}</td><td className="text-right">{n(y.denials)}</td></tr>
          ))}</tbody>
        </table>
        {GLOSSARY.h1b.body}
      </>}>
      <a href={H1B_HUB_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold transition-opacity hover:opacity-80 text-sky-300 bg-sky-500/10 border-sky-500/25">
        <Landmark className="w-3 h-3" /> H-1B · {n(latest.approvals)} in FY{latest.year}
      </a>
    </InfoTip>
  );
}

function AppCard({ app, logoDomain, everify, everifySyncedAt, h1b, h1bYears, schedule, onSchedule, onEdit, onDelete, onStatusChange, onCreatePlan, onFindContacts }: {
  app: Application; logoDomain?: string | null; everify?: EverifyStatus; everifySyncedAt: string | null; h1b?: H1bHistory | null; h1bYears: string[] | null; schedule: InterviewSchedule | null; onSchedule: () => void; onEdit: () => void; onDelete: () => void; onStatusChange: (status: AppStatus) => void; onCreatePlan: () => void; onFindContacts: () => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const WIcon = WORK_TYPE_CONFIG[app.workType]?.icon || Building2;

  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowStatusMenu(false); };
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu]);

  const daysSince = (() => { const diff = Math.floor((Date.now() - new Date(app.appliedDate).getTime()) / 86_400_000); if (diff === 0) return 'Today'; if (diff === 1) return '1 day ago'; return `${diff} days ago`; })();

  return (
    <div className="glass-card group flex flex-col">
      <div className="p-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <CompanyLogo company={app.company} domain={logoDomain} size={36} />
            <div className="min-w-0 flex-1"><p className="text-sm text-white font-bold truncate leading-tight">{app.company}</p><p className="text-xs text-slate-400 truncate mt-0.5">{app.jobTitle}</p></div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/[0.08] transition-all"><ExternalLink className="w-3.5 h-3.5" /></a>}
            <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-[#a9b0f7] hover:bg-[var(--accent-subtle)] transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          {app.location && <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="w-3 h-3" /> {app.location}</span>}
          <span className="flex items-center gap-1 text-xs text-slate-500"><WIcon className="w-3 h-3" /> {WORK_TYPE_CONFIG[app.workType]?.label}</span>
          <span className="flex items-center gap-1 text-xs text-slate-500"><Calendar className="w-3 h-3" /> {daysSince}</span>
          {app.salary && <span className="flex items-center gap-1 text-xs text-slate-500"><DollarSign className="w-3 h-3" /> {app.salary}</span>}
          {app.status === 'offer' && <Link href={`/salary?${new URLSearchParams({ title: app.jobTitle, location: app.location ?? '', offer: app.salary ?? '' })}`} className="flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"><DollarSign className="w-3 h-3" /> Market pay</Link>}
          {everify && <EverifyBadge status={everify} syncedAt={everifySyncedAt} />}
          {h1bYears && h1b !== undefined && <H1bBadge history={h1b} years={h1bYears} />}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <StatusBadge status={app.status} />
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${showStatusMenu ? 'rotate-180' : ''}`} />
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full mt-2 z-50 bg-[var(--bg-raised)] border border-white/[0.08] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] py-1 min-w-[175px]">
                {(Object.keys(STATUS_CONFIG) as AppStatus[]).map(s => (
                  <button key={s} onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${app.status === s ? `${STATUS_CONFIG[s].color} bg-white/[0.05] font-semibold` : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[s].dot}`} />{STATUS_CONFIG[s].label}
                    {app.status === s && <CheckCircle2 className="w-3 h-3 ml-auto opacity-60" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {app.source && <span className="text-xs text-slate-500 truncate">{app.source}</span>}
        </div>
        {app.notes && <p className="mt-2.5 text-xs text-slate-500 line-clamp-2 border-t border-white/[0.05] pt-2.5 leading-relaxed">{app.notes}</p>}
      </div>
      {(['phone-screen', 'technical', 'final'] as AppStatus[]).includes(app.status) && (
        <div className="px-4 pb-2 space-y-2">
          {/* The interview time, on the card and (when connected) in Google Calendar. */}
          <InterviewScheduleRow schedule={schedule} onOpen={onSchedule} />
          {/* Practice built from this application's stage, company and saved posting. */}
          <Link href={`/interview/create?application=${app.id}`} className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/[0.07] border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/35 transition-all duration-150">
            <Mic className="w-3.5 h-3.5" /> Practise this interview
          </Link>
        </div>
      )}
      <div className="px-4 pb-2">
        {/* The Apply flow for this job: tailored resume, letter, then per-round prep. */}
        <Link href={`/apply/${app.id}`} className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] font-semibold text-[var(--text-1)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.09] group-hover:bg-[var(--primary)] group-hover:text-[var(--on-primary)] group-hover:ring-transparent transition-colors duration-150">
          <Send className="w-3.5 h-3.5" /> {app.status === 'wishlist' ? 'Apply: tailor resume and letter' : 'Prep pack and follow-up'}
        </Link>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <button onClick={onFindContacts} className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] font-medium text-[var(--text-2)] ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.04] hover:text-white transition-colors duration-150"><UserSearch className="w-3.5 h-3.5 text-sky-300" /> Find Contacts</button>
        <button onClick={onCreatePlan} className="flex items-center justify-center gap-1.5 h-9 rounded-lg text-[12.5px] font-medium text-[var(--text-2)] ring-1 ring-inset ring-white/[0.07] hover:bg-white/[0.04] hover:text-white transition-colors duration-150"><CalendarPlus className="w-3.5 h-3.5 text-emerald-300" /> Create Plan</button>
      </div>
    </div>
  );
}

// ─── Create plan modal ────────────────────────────────────────────────────────

const PLAN_PRESETS = [{ days: 3, label: '3 days' }, { days: 7, label: '1 week' }, { days: 14, label: '2 weeks' }, { days: 21, label: '3 weeks' }, { days: 30, label: '1 month' }];

function CreatePlanModal({ app, onConfirm, onClose }: { app: Application; onConfirm: (days: number) => void; onClose: () => void }) {
  const [selected, setSelected] = useState(7);
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('14');
  const handleConfirm = () => { const days = custom ? Math.max(1, Math.min(90, parseInt(customVal) || 7)) : selected; onConfirm(days); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-raised)] border border-white/[0.09] rounded-2xl w-full max-w-sm shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]"><CalendarPlus className="w-4 h-4 text-[var(--text-2)]" /></div><div><p className="text-sm font-bold text-white">Create Prep Plan</p><p className="text-xs text-slate-400 truncate max-w-[180px]">{app.jobTitle} @ {app.company}</p></div></div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-all"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">When is your interview? We&apos;ll build a day-by-day plan to get you ready.</p>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_PRESETS.map(p => (<button key={p.days} type="button" onClick={() => { setSelected(p.days); setCustom(false); }} className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${!custom && selected === p.days ? 'bg-white/[0.1] border-white/[0.16] text-white' : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/[0.14] hover:text-white'}`}>{p.label}</button>))}
            <button type="button" onClick={() => setCustom(true)} className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${custom ? 'bg-white/[0.1] border-white/[0.16] text-white' : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/[0.14] hover:text-white'}`}>Custom</button>
          </div>
          {custom && <div><label className="block text-xs text-slate-400 mb-1.5">Days until interview (1-90)</label><input type="number" min={1} max={90} value={customVal} onChange={e => setCustomVal(e.target.value)} className={inp} autoFocus /></div>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleConfirm} className="flex-1 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] rounded-xl font-semibold text-sm transition-all  flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> Generate Plan</button>
            <button onClick={onClose} className="px-4 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-slate-300 rounded-xl font-semibold text-sm transition-all">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Custom select ────────────────────────────────────────────────────────────

function CustomSelect<T extends string>({ value, onChange, options, icon: Icon }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; icon?: React.ElementType }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const active = options.find(o => o.value === value);
  useEffect(() => { if (!open) return; const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }, [open]);
  return (
    <div className="relative min-w-0 sm:w-auto" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} className={`w-full flex items-center gap-2 h-11 px-3.5 rounded-[10px] text-[13px] font-medium text-slate-400 bg-white/[0.04] border transition-all min-w-[130px] ${open ? 'border-[var(--accent-border)] text-slate-200' : 'border-white/[0.07] hover:border-white/[0.12] hover:text-slate-200'}`}>
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}<span className="flex-1 text-left truncate">{active?.label}</span><ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-[var(--bg-raised)] border border-white/[0.1] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] py-1 min-w-full">
          {options.map(opt => (<button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }} className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs transition-colors ${value === opt.value ? 'text-[#a9b0f7] bg-purple-500/[0.10] font-semibold' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'}`}>{opt.label}{value === opt.value && <Check className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />}</button>))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobTrackerPage() {
  const [user, loading] = useSupabaseUser();
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();

  const { canUseFeature, getLimit, getRemainingCount, refetch: refetchUsage, loading: loadingUsage } = useUsageTracking();

  const [apps, setApps] = useState<Application[]>([]);
  const [everify, setEverify] = useState<{ statuses: Record<string, EverifyStatus>; syncedAt: string | null }>({ statuses: {}, syncedAt: null });
  // Company logos for the cards (components/jobs/CompanyLogo.tsx).
  const logos = useCompanyLogos(apps.map(a => ({ company: a.company, url: a.jobUrl })));
  const [h1b, setH1b] = useState<{ histories: Record<string, H1bHistory | null>; years: string[] } | null>(null);
  const companyKey = [...new Set(apps.map(a => a.company.trim()).filter(Boolean))].sort().join('|');
  useEffect(() => {
    if (!companyKey) return;
    let cancelled = false;
    fetch('/api/job-tracker/everify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companies: companyKey.split('|') }) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j) return;
        if (j.available) setEverify({ statuses: j.statuses ?? {}, syncedAt: j.syncedAt ?? null });
        if (j.h1b) setH1b({ histories: j.h1b.histories ?? {}, years: j.h1b.years ?? [] });
      })
      .catch(() => { /* the badge is optional */ });
    return () => { cancelled = true; };
  }, [companyKey]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AppForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<AppStatus | 'all'>('all');
  // Only applications waiting over a week (from the KPI strip).
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [filterWork, setFilterWork] = useState<WorkType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'company' | 'status'>('date');
  const [planModal, setPlanModal] = useState<Application | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [contactsModal, setContactsModal] = useState<Application | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [nextStepCtx, setNextStepCtx] = useState<{ company: string; jobTitle: string } | null>(null); // ← ADDED
  // Interview times and Google Calendar (components/calendar).
  const interviews = useInterviewSchedules(!!user);
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const scheduleApp = scheduleFor ? apps.find(a => a.id === scheduleFor) ?? null : null;

  // Read "unlimited" off the quota table rather than off the plan name. The
  // plan-name check missed 'admin', whose jobTracker limit is -1: that made
  // `apps.length < -1` false for every admin and locked them out of adding
  // jobs at all, while the badge read "0 jobs left".
  const jobsLimit     = getLimit('jobTracker');
  const jobsUnlimited = isUnlimited(jobsLimit);
  const canAddJob = jobsUnlimited || apps.length < jobsLimit;
  const jobsLeft  = jobsUnlimited ? -1 : Math.max(0, jobsLimit - apps.length);
  const canFindContacts = canUseFeature('findContacts');
  const contactsLimit   = getLimit('findContacts');

  const fetchApps = useCallback(async () => {
    setLoadingApps(true); setLoadingStep(0);
    try { setLoadingStep(1); const res = await fetch('/api/job-tracker'); setLoadingStep(2); if (!res.ok) throw new Error('Failed to fetch'); const json = await res.json(); setLoadingStep(3); setApps(json.data || []); setLoadingStep(4); }
    catch { toast.error('Failed to load applications'); } finally { setLoadingApps(false); }
  }, []);

  useEffect(() => { if (user) fetchApps(); }, [user, fetchApps]);

  // Re-read the board without the full-page loader, for changes made from a
  // panel (undoing an emailed update) where the page should stay put.
  const refreshApps = useCallback(async () => {
    try { const res = await fetch('/api/job-tracker'); if (res.ok) { const json = await res.json(); setApps(json.data || []); } } catch { /* next load will catch up */ }
  }, []);

  // For the "Resume sent" picker. Optional: without resumes the field hides.
  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  useEffect(() => {
    if (!user) return;
    fetch('/api/resume/list').then(r => (r.ok ? r.json() : null)).then(j => { if (j?.resumes) setResumes(j.resumes); }).catch(() => {});
  }, [user]);
  useEffect(() => { if (!loading && !user) router.push('/sign-in'); }, [user, loading, router]);

  const handleAddApp = () => {
    if (!canAddJob) { toast.error(`Your plan is limited to ${jobsLimit} tracked jobs. Pro and Premium track unlimited jobs.`); return; }
    setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true);
  };

  const handleFindContacts = (app: Application) => {
    if (!canFindContacts) { toast.error(`You've used all ${contactsLimit} contact searches in your plan this month. Upgrade for a higher limit.`); return; }
    setContactsModal(app);
  };

  const handleSave = async () => {
    if (!form.company.trim() || !form.jobTitle.trim()) { toast.error('Company and job title are required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const res = await fetch('/api/job-tracker', { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isEdit ? { id: editingId, ...form } : form) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
      toast.success(isEdit ? 'Application updated' : 'Application added');
      if (!isEdit && user?.id) {
        await NotificationService.createNotification(user.id, 'planner', 'Application Tracked', `${form.jobTitle} at ${form.company} has been added to your job tracker.`, { actionUrl: '/job-tracker', actionLabel: 'View Tracker' });
        setShowFeedback(true);
        setNextStepCtx({ company: form.company.trim(), jobTitle: form.jobTitle.trim() }); // ← ADDED
      }
      setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); await fetchApps();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save'); } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: AppStatus) => {
    const app = apps.find(a => a.id === id);
    setApps(p => p.map(a => a.id === id ? { ...a, status } : a));
    try {
      const res = await fetch('/api/job-tracker', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error('Failed');
      if (user?.id && app) {
        const milestones: Partial<Record<AppStatus, { title: string; message: string; type: 'interview' | 'achievement' | 'planner' }>> = {
          'phone-screen': { type: 'interview', title: 'Phone Screen Scheduled', message: `You advanced to phone screen for ${app.jobTitle} at ${app.company}!` },
          'technical': { type: 'interview', title: 'Technical Round Incoming', message: `You reached the technical round for ${app.jobTitle} at ${app.company}.` },
          'final': { type: 'interview', title: 'Final Round!', message: `You made it to the final round for ${app.jobTitle} at ${app.company}.` },
          'offer': { type: 'achievement', title: 'Offer Received!', message: `Congratulations! You received an offer for ${app.jobTitle} at ${app.company}!` },
        };
        const m = milestones[status];
        if (m) await NotificationService.createNotification(user.id, m.type, m.title, m.message, { actionUrl: '/job-tracker', actionLabel: 'View Application' });
      }
    } catch { setApps(p => p.map(a => a.id === id ? { ...a, status: app?.status ?? a.status } : a)); toast.error('Failed to update status'); }
  };

  const handleCreatePlan = async (app: Application, days: number) => {
    setCreatingPlan(true); setPlanModal(null);
    try {
      const interviewDate = new Date(); interviewDate.setDate(interviewDate.getDate() + days);
      const res = await fetch('/api/planner/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: app.jobTitle, company: app.company, interviewDate: interviewDate.toISOString().split('T')[0], daysUntilInterview: days, skillLevel: 'intermediate' }) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to generate plan'); }
      const data = await res.json();
      toast.success(`${days}-day plan created for ${app.company}!`, { action: { label: 'Open Planner', onClick: () => window.open(`/planner/${data.planId}`, '_blank') } });
      if (user?.id) await NotificationService.createNotification(user.id, 'planner', 'Prep Plan Created', `Your ${days}-day preparation plan for ${app.jobTitle} at ${app.company} is ready.`, { actionUrl: `/planner/${data.planId}`, actionLabel: 'View Plan' });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to create plan'); } finally { setCreatingPlan(false); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ message: 'Delete this application? This cannot be undone.', danger: true, confirmLabel: 'Delete' }))) return;
    setApps(p => p.filter(a => a.id !== id));
    try { const res = await fetch(`/api/job-tracker?id=${id}`, { method: 'DELETE' }); if (!res.ok) throw new Error(); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); await fetchApps(); }
  };

  const handleEdit = (app: Application) => {
    setForm({ company: app.company, jobTitle: app.jobTitle, jobUrl: app.jobUrl, location: app.location, salary: app.salary, workType: app.workType, source: app.source, notes: app.notes, status: app.status, appliedDate: app.appliedDate, resumeId: app.resumeId ?? null, jobDescription: app.jobDescription ?? null });
    setEditingId(app.id); setShowForm(true);
  };

  // Changes whenever a card is added, removed or moves, so the funnel doctor
  // re-reads the diagnosis after every board change.
  const funnelKey = apps.map(a => `${a.id}:${a.status}:${a.resumeId ?? ''}`).join('|');
  // The role they apply for most, to prefill practice interviews.
  const topRole = (() => {
    const n = new Map<string, number>();
    for (const a of apps) { const t = a.jobTitle.trim(); if (t) n.set(t, (n.get(t) ?? 0) + 1); }
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  })();

  const weekAgo = Date.now() - 7 * 86_400_000;
  const isWaiting = (a: Application) => a.status === 'applied' && new Date(`${a.appliedDate.slice(0, 10)}T00:00:00`).getTime() <= weekAgo;

  const filtered = apps
    .filter(a => {
      const q = search.toLowerCase();
      return (!q || a.company.toLowerCase().includes(q) || a.jobTitle.toLowerCase().includes(q) || (a.location || '').toLowerCase().includes(q))
        && (filterStatus === 'all' || a.status === filterStatus) && (filterWork === 'all' || a.workType === filterWork)
        && (!waitingOnly || isWaiting(a));
    })
    .sort((a, b) => { if (sortBy === 'company') return a.company.localeCompare(b.company); if (sortBy === 'status') return a.status.localeCompare(b.status); return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime(); });

  // loadingUsage is part of the guard because canAddJob is derived from the
  // quota: before it resolves getLimit() returns 0, so a user with 0 jobs
  // would briefly render the "limit reached" upgrade gate instead of the list.
  if (loading || loadingApps || loadingUsage) {
    return <AnimatedLoader isVisible={true} mode="steps" steps={[{ name: 'Authenticating…', weight: 1 }, { name: 'Connecting…', weight: 1 }, { name: 'Loading applications…', weight: 3 }, { name: 'Calculating stats…', weight: 2 }, { name: 'Ready!', weight: 1 }]} currentStep={loadingStep} loadingText="Loading your job tracker…" showNavigation={true} />;
  }

  return (
    <>
      <ConfirmDialog />
      {showForm && <FormModal form={form} setForm={setForm} onSave={handleSave} onCancel={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }} saving={saving} isEdit={!!editingId} resumes={resumes} />}
      {contactsModal && <FindContactsSheet app={contactsModal} logoDomain={logos[contactsModal.company]} searchesLeft={isUnlimited(contactsLimit) ? null : getRemainingCount('findContacts')} onClose={() => setContactsModal(null)} onSearched={async () => { await refetchUsage(); }} />}
      {scheduleApp && (
        <InterviewScheduleModal app={scheduleApp} existing={interviews.schedules[scheduleApp.id] ?? null} calendar={interviews.calendar} schemaReady={interviews.schemaReady}
          onClose={() => setScheduleFor(null)} onSaved={interviews.setOne} onRemoved={interviews.removeOne} />
      )}
      {planModal && <CreatePlanModal app={planModal} onConfirm={days => handleCreatePlan(planModal, days)} onClose={() => setPlanModal(null)} />}
      {creatingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-card p-8 text-center">
            <div className="relative w-12 h-12 mx-auto mb-4"><Loader2 className="w-12 h-12 text-[#a9b0f7] animate-spin" /><Sparkles className="w-4 h-4 text-[#a9b0f7] absolute inset-0 m-auto" /></div>
            <p className="text-sm font-bold text-white mb-1">Generating your prep plan…</p><p className="text-xs text-slate-400">Building your personalised prep roadmap</p>
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4">
        <PageHeader
          title="Job Tracker" description="Every application from wishlist to offer" icon={HeaderIcon}
          actions={<>
            <SeeExampleButton serviceId="job-tracker" />
            <span className="btn-pill"><Shield /> {jobsUnlimited ? 'Unlimited' : `${jobsLeft} jobs left`}</span>
            <button onClick={handleAddApp} className="btn-primary"><Plus /> Add Application</button>
          </>}
        />

        {/* Gate or content */}
        {!canAddJob && apps.length === 0 ? (
          <UpgradeGate feature="jobs" />
        ) : (
          <>
            {/* The figures that matter this week, then the pipeline */}
            <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
              <TrackerKpis
                apps={apps as unknown as TrackedApp[]}
                schedules={Object.values(interviews.schedules)}
                stages={PIPELINE_STAGES.map(id => ({ id, label: STATUS_CONFIG[id].label.replace(/^[^A-Za-z]+/, ''), dot: STATUS_CONFIG[id].dot }))}
                waitingActive={waitingOnly}
                onWaiting={() => { setWaitingOnly(w => !w); setFilterStatus('all'); }}
                activeStage={filterStatus}
                onStage={id => { setWaitingOnly(false); setFilterStatus(f => (f === id ? 'all' : id as AppStatus)); }}
              />
            </div>

            {apps.length > 0 && (
              <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                <FunnelDoctor refreshKey={funnelKey} topRole={topRole} />
              </div>
            )}

            {/* Renders nothing until an interview is scheduled in the next two weeks. */}
            <UpcomingInterviews schedules={Object.values(interviews.schedules)} apps={apps} onOpen={setScheduleFor} />

            {/* Hidden until inbound email is configured (INBOUND_EMAIL_DOMAIN). */}
            <InboundEmailPanel apps={apps.map(a => ({ id: a.id, company: a.company, jobTitle: a.jobTitle }))} onChanged={refreshApps} />

            {/* ← ADDED: NextStepPrompt after adding a new application */}
            {nextStepCtx && (
              <NextStepPrompt
                trigger="job_tracked"
                context={nextStepCtx}
                delay={600}
              />
            )}

            {/* Search + filters */}
            <div className="grid grid-cols-3 sm:flex sm:flex-row gap-2.5 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
              <div className="relative col-span-3 sm:flex-1"><Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" /><input type="text" placeholder="Search by company, role, or location…" value={search} onChange={e => setSearch(e.target.value)} className={`${inp} pl-10`} /></div>
              <CustomSelect<AppStatus | 'all'> value={filterStatus} onChange={setFilterStatus} icon={Filter} options={[{ value: 'all', label: `All (${apps.length})` }, ...(Object.keys(STATUS_CONFIG) as AppStatus[]).map(s => ({ value: s, label: STATUS_CONFIG[s].label }))]} />
              <CustomSelect<WorkType | 'all'> value={filterWork} onChange={setFilterWork} options={[{ value: 'all', label: 'All Types' }, ...(Object.keys(WORK_TYPE_CONFIG) as WorkType[]).map(w => ({ value: w, label: WORK_TYPE_CONFIG[w].label }))]} />
              <CustomSelect<'date' | 'company' | 'status'> value={sortBy} onChange={setSortBy} icon={SlidersHorizontal} options={[{ value: 'date', label: 'Recent First' }, { value: 'company', label: 'By Company' }, { value: 'status', label: 'By Status' }]} />
            </div>

            {/* Grid / empty */}
            {apps.length === 0 && canAddJob ? (
              <FeatureEmpty icon={Briefcase} title="Track every application in one place"
                body="Save jobs from the Jobs page or the Chrome extension, or add one yourself. Each one moves through its stages, with prep for every round."
                steps={[
                  { icon: Plus, title: 'Add or save a job', text: 'From Jobs, the extension, or the Add Application form.' },
                  { icon: Filter, title: 'Move it through stages', text: 'Applied, phone screen, interview, offer. Update it as you hear back.' },
                  { icon: CalendarPlus, title: 'Prepare for each round', text: 'Build a prep plan and find contacts at the company.' },
                ]}
                primary={{ label: 'Add your first application', icon: Plus, onClick: () => { setForm({ ...EMPTY_FORM }); setShowForm(true); } }}
                secondary={<SeeExampleButton serviceId="job-tracker" />} />
            ) : filtered.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.07] rounded-2xl flex items-center justify-center mx-auto mb-4"><Briefcase className="w-5 h-5 text-slate-500" /></div>
                <h3 className="text-sm font-bold text-slate-400 mb-2">{apps.length === 0 ? 'No applications yet' : 'No results match your filters'}</h3>
                <p className="text-xs text-slate-500 mb-6 max-w-xs mx-auto leading-relaxed">{apps.length === 0 ? 'Start tracking your job search. Add your first application to see it here.' : 'Try adjusting your search or filters.'}</p>
                {apps.length === 0 && canAddJob && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add First Application</button>
                    <SeeExampleButton serviceId="job-tracker" className="!px-5 !py-2.5 !text-sm !font-semibold" />
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">{filtered.length} application{filtered.length !== 1 ? 's' : ''}{(search || filterStatus !== 'all' || filterWork !== 'all' || waitingOnly) ? ' matching filters' : ''}{waitingOnly && <> · waiting over a week <button onClick={() => setWaitingOnly(false)} className="text-indigo-300 hover:text-indigo-200 ml-1">Clear</button></>}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map(app => (
                    <AppCard key={app.id} app={app} logoDomain={logos[app.company]} everify={everify.statuses[app.company.trim()]} everifySyncedAt={everify.syncedAt} h1b={h1b?.histories[app.company.trim()]} h1bYears={h1b?.years ?? null}
                      schedule={interviews.schedules[app.id] ?? null} onSchedule={() => setScheduleFor(app.id)} onEdit={() => handleEdit(app)} onDelete={() => handleDelete(app.id)}
                      onStatusChange={status => handleStatusChange(app.id, status)} onCreatePlan={() => setPlanModal(app)}
                      onFindContacts={() => handleFindContacts(app)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <UsersFeedback page="job-tracker" forceOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </>
  );
}