'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/firebase/client';
import {
  Plus, Loader2, Briefcase, Building2, MapPin, Calendar, ExternalLink,
  Edit3, Trash2, X, Save, ArrowLeft, Search, Filter, ChevronDown,
  CheckCircle2, AlertTriangle, BarChart3, DollarSign, Globe, Laptop,
  SlidersHorizontal, CalendarPlus, Sparkles, Mail, UserSearch, Copy,
  Check, RefreshCw, Linkedin,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { NotificationService } from '@/lib/services/notification-services';
import UsersFeedback from '@/components/UserFeedback';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

type AppStatus = 'wishlist' | 'applied' | 'phone-screen' | 'technical' | 'final' | 'offer' | 'rejected' | 'ghosted' | 'withdrew';
type WorkType  = 'remote' | 'hybrid' | 'onsite';

interface Application {
  id: string;
  userId: string;
  company: string;
  jobTitle: string;
  jobUrl: string | null;
  location: string | null;
  salary: string | null;
  workType: WorkType;
  source: string | null;
  notes: string | null;
  status: AppStatus;
  appliedDate: string;
  createdAt: unknown;
  updatedAt: unknown;
}

type AppForm = Omit<Application, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

interface Contact {
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string;
  department: string;
  confidence: number;
  linkedin: string | null;
  generatedEmail: string | null;
  tier?: number;
}

function RoleBadge({ position }: { position: string; tier?: number }) {
  const pos = position.toLowerCase();
  let label = ''; let cls = '';
  if (/recruiter|talent|hr|people/.test(pos))                                                           { label = 'Recruiter';   cls = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'; }
  else if (/ceo|founder|president|chief exec/.test(pos))                                                { label = 'CEO/Founder'; cls = 'bg-amber-500/15 text-amber-400 border-amber-500/25'; }
  else if (/cto|chief tech|vp of eng|vp eng/.test(pos))                                                { label = 'CTO/VP Eng'; cls = 'bg-violet-500/15 text-violet-400 border-violet-500/25'; }
  else if (/cpo|chief product/.test(pos))                                                               { label = 'CPO';         cls = 'bg-blue-500/15 text-blue-400 border-blue-500/25'; }
  else if (/director|vp /.test(pos))                                                                    { label = 'Director/VP'; cls = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25'; }
  else if (/team lead|tech lead|lead data|lead ml|lead ai|lead software|lead engineer|technical lead/.test(pos)) { label = 'Team Lead';  cls = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'; }
  else if (/manager|principal|staff/.test(pos))                                                         { label = 'Manager';     cls = 'bg-slate-500/15 text-slate-400 border-slate-500/25'; }
  else                                                                                                  { label = 'Contact';     cls = 'bg-slate-500/15 text-slate-500 border-slate-600/25'; }
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>{label}</span>;
}

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  wishlist:       { label: 'Wishlist',     color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   dot: 'bg-slate-400'   },
  applied:        { label: 'Applied',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-400'    },
  'phone-screen': { label: 'Phone Screen', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-400'  },
  technical:      { label: 'Technical',    color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-400'  },
  final:          { label: 'Final Round',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-400'   },
  offer:          { label: '🎉 Offer',     color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  rejected:       { label: 'Rejected',     color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-400'     },
  ghosted:        { label: 'Ghosted',      color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20',   dot: 'bg-slate-500'   },
  withdrew:       { label: 'Withdrew',     color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  dot: 'bg-orange-400'  },
};

const WORK_TYPE_CONFIG: Record<WorkType, { label: string; icon: React.ElementType }> = {
  remote: { label: 'Remote', icon: Globe    },
  hybrid: { label: 'Hybrid', icon: Laptop   },
  onsite: { label: 'Onsite', icon: Building2 },
};

const PIPELINE_STAGES: AppStatus[] = ['wishlist', 'applied', 'phone-screen', 'technical', 'final', 'offer'];

const EMPTY_FORM: AppForm = {
  company: '', jobTitle: '', jobUrl: null, location: null, salary: null,
  workType: 'onsite', source: null, notes: null, status: 'applied',
  appliedDate: new Date().toISOString().split('T')[0],
};

// ─────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="glass-card px-4 py-3 hover-lift flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className={`text-xl font-bold leading-none mb-1 ${color}`}>{value}</p>
        <p className="text-xs font-medium text-white">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PipelineFunnel({ apps }: { apps: Application[] }) {
  const counts = PIPELINE_STAGES.reduce((acc, s) => { acc[s] = apps.filter(a => a.status === s).length; return acc; }, {} as Record<AppStatus, number>);
  return (
    <div className="glass-card px-4 py-3 hover-lift">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pipeline</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 flex-wrap">
          {PIPELINE_STAGES.map(stage => {
            const cfg = STATUS_CONFIG[stage]; const count = counts[stage];
            if (!count) return null;
            return (
              <div key={stage} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
                {cfg.label} <span className="font-bold">{count}</span>
              </div>
            );
          })}
          {PIPELINE_STAGES.every(s => !counts[s]) && <span className="text-xs text-slate-600">No active applications</span>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Form Modal
// ─────────────────────────────────────────────────────────────────

interface FormModalProps {
  form: AppForm; setForm: React.Dispatch<React.SetStateAction<AppForm>>;
  onSave: () => void; onCancel: () => void; saving: boolean; isEdit: boolean;
}

function FormModal({ form, setForm, onSave, onCancel, saving, isEdit }: FormModalProps) {
  const f   = (key: keyof AppForm, val: string | null) => setForm(p => ({ ...p, [key]: val || null }));
  const inp = "w-full px-3 py-2 bg-slate-900/50 border border-slate-700/60 rounded-lg text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500/60 transition-colors";
  const sel = inp;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900/95 border border-slate-700/60 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Application' : 'Add Application'}</h2>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4 glass-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Company *</label>
              <input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="e.g. Stripe" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Job Title *</label>
              <input type="text" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} placeholder="e.g. Senior SWE" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as AppStatus }))} className={sel}>
                {(Object.keys(STATUS_CONFIG) as AppStatus[]).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Applied Date</label>
              <input type="date" value={form.appliedDate} onChange={e => setForm(p => ({ ...p, appliedDate: e.target.value }))} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
              <input type="text" value={form.location || ''} onChange={e => f('location', e.target.value)} placeholder="e.g. San Francisco, CA" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Work Type</label>
              <div className="flex gap-1.5">
                {(Object.keys(WORK_TYPE_CONFIG) as WorkType[]).map(wt => {
                  const WIcon = WORK_TYPE_CONFIG[wt].icon;
                  return (
                    <button key={wt} type="button" onClick={() => setForm(p => ({ ...p, workType: wt }))}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all border ${form.workType === wt ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      <WIcon className="w-3.5 h-3.5" />{WORK_TYPE_CONFIG[wt].label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Salary / Range</label>
              <input type="text" value={form.salary || ''} onChange={e => f('salary', e.target.value)} placeholder="e.g. $140k–$170k" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Source</label>
              <input type="text" value={form.source || ''} onChange={e => f('source', e.target.value)} placeholder="e.g. LinkedIn, referral" className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Job URL</label>
            <input type="url" value={form.jobUrl || ''} onChange={e => f('jobUrl', e.target.value)} placeholder="https://..." className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
            <textarea rows={3} value={form.notes || ''} onChange={e => f('notes', e.target.value)}
              placeholder="Interview details, recruiter name, key contacts, follow-up dates…"
              className={`${inp} resize-none`} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700/50 flex-shrink-0">
          <button onClick={onSave} disabled={saving || !form.company.trim() || !form.jobTitle.trim()}
            className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> {isEdit ? 'Update' : 'Save Application'}</>}
          </button>
          <button onClick={onCancel} className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl font-medium text-sm transition-all">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// App Card
// ─────────────────────────────────────────────────────────────────

function AppCard({ app, onEdit, onDelete, onStatusChange, onCreatePlan, onFindContacts }: {
  app: Application; onEdit: () => void; onDelete: () => void;
  onStatusChange: (status: AppStatus) => void; onCreatePlan: () => void; onFindContacts: () => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const WIcon = WORK_TYPE_CONFIG[app.workType]?.icon || Building2;

  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowStatusMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusMenu]);

  const daysSince = (() => {
    const d = new Date(app.appliedDate);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return 'Today'; if (diff === 1) return '1 day ago'; return `${diff} days ago`;
  })();

  return (
    <div className="glass-card hover-lift group">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-700 to-slate-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 border border-slate-600/50">
              {app.company.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-semibold text-sm truncate">{app.company}</p>
              <p className="text-slate-400 text-xs truncate">{app.jobTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {app.jobUrl && (
              <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-purple-400 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
          {app.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {app.location}</span>}
          <span className="flex items-center gap-1"><WIcon className="w-3 h-3" /> {WORK_TYPE_CONFIG[app.workType]?.label}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {daysSince}</span>
          {app.salary && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {app.salary}</span>}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="flex items-center gap-1.5">
              <StatusBadge status={app.status} />
              <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 py-1 min-w-[170px]">
                {(Object.keys(STATUS_CONFIG) as AppStatus[]).map(s => (
                  <button key={s} onClick={() => { onStatusChange(s); setShowStatusMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${app.status === s ? `${STATUS_CONFIG[s].color} bg-white/5 font-semibold` : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[s].dot}`} />
                    {STATUS_CONFIG[s].label}
                    {app.status === s && <CheckCircle2 className="w-3 h-3 ml-auto opacity-60" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {app.source && <span className="text-xs text-slate-500 truncate">{app.source}</span>}
        </div>
        {app.notes && <p className="mt-2 text-xs text-slate-500 line-clamp-2 border-t border-slate-700/30 pt-2">{app.notes}</p>}
        <div className="mt-3 pt-3 border-t border-slate-700/30 grid grid-cols-2 gap-2">
          <button onClick={onFindContacts}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all text-purple-400 bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/15 hover:border-purple-500/40 hover:text-purple-300">
            <UserSearch className="w-3.5 h-3.5" /> Find Contacts
          </button>
          <button onClick={onCreatePlan}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all text-violet-400 bg-violet-500/5 border border-violet-500/20 hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-violet-300">
            <CalendarPlus className="w-3.5 h-3.5" /> Create Plan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Contacts Modal — helpers
// ─────────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors flex-shrink-0" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ConfidenceDot({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1" title={`${score}% email verified`}>
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-xs text-slate-500">{score}% verified</span>
    </div>
  );
}

// ── Gmail / Outlook send helpers ──────────────────────────────────

function buildSubject(jobTitle: string, company: string): string {
  return `${jobTitle} Role at ${company} – Reaching Out`;
}

function openInGmail(to: string, subject: string, body: string) {
  const url = new URL('https://mail.google.com/mail/');
  url.searchParams.set('view', 'cm');
  url.searchParams.set('to', to);
  url.searchParams.set('su', subject);
  url.searchParams.set('body', body);
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function openInOutlook(to: string, subject: string, body: string) {
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function SendEmailButtons({
  recipientEmail,
  emailBody,
  jobTitle,
  company,
}: {
  recipientEmail: string;
  emailBody: string;
  jobTitle: string;
  company: string;
}) {
  const subject = buildSubject(jobTitle, company);
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/40">
      <span className="text-xs text-slate-500 flex-shrink-0">Send via</span>

      {/* Gmail */}
      <button
        onClick={() => openInGmail(recipientEmail, subject, emailBody)}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all border border-red-500/25 bg-red-500/8 text-red-400 hover:bg-red-500/18 hover:border-red-500/45 hover:text-red-300"
      >
        {/* Envelope icon representing Gmail */}
        <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-11Z" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 7l10 7 10-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Gmail
        <ExternalLink className="w-3 h-3 opacity-60" />
      </button>

      {/* Outlook / system mail */}
      <button
        onClick={() => openInOutlook(recipientEmail, subject, emailBody)}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all border border-blue-500/25 bg-blue-500/8 text-blue-400 hover:bg-blue-500/18 hover:border-blue-500/45 hover:text-blue-300"
      >
        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
        Outlook
        <ExternalLink className="w-3 h-3 opacity-60" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Contacts Modal
// ─────────────────────────────────────────────────────────────────

function ContactsModal({ app, onClose }: { app: Application; onClose: () => void }) {
  const [contacts,           setContacts]           = useState<Contact[]>([]);
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState('');
  const [domain,             setDomain]             = useState('');
  const [foundDomain,        setFoundDomain]        = useState('');
  const [showDomainOverride, setShowDomainOverride] = useState(false);
  const [activeIdx,          setActiveIdx]          = useState<number | null>(null);
  const [copiedEmail,        setCopiedEmail]        = useState<string | null>(null);

  const fetchContacts = async (overrideDomain?: string) => {
    setLoading(true); setError(''); setContacts([]); setActiveIdx(null);
    try {
      const res  = await fetch('/api/job-tracker/find-contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: app.company, jobTitle: app.jobTitle, jobDescription: app.notes || '', domain: overrideDomain || domain || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch contacts');
      setContacts(data.contacts || []);
      setFoundDomain(data.domain || '');
      if (data.contacts?.length > 0) setActiveIdx(0);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to fetch contacts'); }
    finally { setLoading(false); }
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email); setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000); toast.success('Email copied');
  };

  const activeContact = activeIdx !== null ? contacts[activeIdx] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900/98 border border-slate-700/60 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center shadow-glass"><UserSearch className="w-4 h-4 text-white" /></div>
            <div>
              <h2 className="text-base font-bold text-white">Find Contacts</h2>
              <p className="text-xs text-slate-400">{app.company} · {app.jobTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-slate-700/30 flex-shrink-0">
          {contacts.length > 0 && foundDomain ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Found <span className="text-white font-medium">{contacts.length}</span> contacts at <span className="text-purple-400 font-medium">{foundDomain}</span></p>
              <button onClick={() => { setContacts([]); setFoundDomain(''); setError(''); setShowDomainOverride(true); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Wrong company?
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {showDomainOverride ? (
                <>
                  <div className="flex-1 relative">
                    <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={domain} onChange={e => setDomain(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && fetchContacts()} placeholder="Enter domain manually (e.g. gotinder.com)" autoFocus
                      className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/60 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500/60 transition-colors" />
                  </div>
                  <button onClick={() => fetchContacts()} disabled={loading || !domain.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserSearch className="w-4 h-4" />}
                    {loading ? 'Searching…' : 'Search'}
                  </button>
                  <button onClick={() => setShowDomainOverride(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <p className="text-xs text-slate-500">
                    {loading ? <>Preciprocal AI is finding contacts at <span className="text-purple-400">{app.company}</span>…</> : error ? <>Couldn&apos;t find contacts automatically</> : <>Click Find to search for contacts at <span className="text-white font-medium">{app.company}</span></>}
                  </p>
                  {!loading && (
                    <button onClick={() => fetchContacts()} disabled={loading}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-semibold text-xs transition-all disabled:opacity-50 flex items-center gap-1.5">
                      <UserSearch className="w-3.5 h-3.5" /> Find
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {error && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-red-400" /></div>
                <p className="text-white font-semibold mb-2">Couldn&apos;t find contacts</p>
                <p className="text-slate-400 text-sm mb-5 leading-relaxed">{error}</p>
                <button onClick={() => { setShowDomainOverride(true); setError(''); }}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600/20 to-indigo-600/20 hover:from-purple-600/30 hover:to-indigo-600/30 border border-purple-500/30 rounded-xl text-sm text-purple-300 hover:text-white transition-all flex items-center justify-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Enter domain manually
                </button>
                <button onClick={() => fetchContacts()} className="mt-4 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mx-auto transition-colors">
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && contacts.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <UserSearch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-white font-semibold mb-2">Stop cold-applying. Start warm outreach.</p>
                <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                  Find the recruiter, hiring manager, and decision-makers at <span className="text-slate-300 font-medium">{app.company}</span> and get a personalised email ready to send.
                </p>
                <button onClick={() => fetchContacts()}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm transition-all">
                  <UserSearch className="w-4 h-4" /> Find Contacts at {app.company}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="relative w-12 h-12 mx-auto mb-4">
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                  <UserSearch className="w-5 h-5 text-purple-300 absolute inset-0 m-auto" />
                </div>
                <p className="text-white font-medium mb-1">Finding contacts…</p>
                <p className="text-slate-400 text-sm">Preciprocal AI is finding contacts and writing personalised emails…</p>
              </div>
            </div>
          )}

          {!loading && contacts.length > 0 && (
            <div className="flex flex-1 min-h-0">
              {/* Contact list sidebar */}
              <div className="w-52 flex-shrink-0 border-r border-slate-700/40 overflow-y-auto glass-scrollbar">
                {contacts.map((c, i) => (
                  <button key={c.email} onClick={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-700/30 transition-colors ${activeIdx === i ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : 'hover:bg-slate-800/40'}`}>
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                        {(c.firstName?.[0] || c.fullName?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{c.fullName}</p>
                        <p className="text-xs text-slate-500 truncate mb-1">{c.position}</p>
                        <RoleBadge position={c.position} tier={c.tier} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Active contact detail */}
              {activeContact && (
                <div className="flex-1 overflow-y-auto glass-scrollbar p-5 space-y-4">
                  {/* Contact info */}
                  <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-white font-bold">{activeContact.fullName}</h3>
                          <RoleBadge position={activeContact.position} tier={activeContact.tier} />
                        </div>
                        <p className="text-sm text-slate-400">{activeContact.position}</p>
                        {activeContact.department && <p className="text-xs text-slate-500">{activeContact.department}</p>}
                      </div>
                      <ConfidenceDot score={activeContact.confidence} />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 rounded-lg border border-slate-700/40 flex-1 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-white truncate font-medium">{activeContact.email}</span>
                        <button onClick={() => copyEmail(activeContact.email)} className="flex-shrink-0 text-slate-500 hover:text-white transition-colors">
                          {copiedEmail === activeContact.email ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {activeContact.linkedin && (
                        <a href={activeContact.linkedin} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors flex-shrink-0">
                          <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Generated email */}
                  {activeContact.generatedEmail ? (
                    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/40">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                          <span className="text-xs font-semibold text-white">AI-Written Outreach</span>
                        </div>
                        <CopyBtn text={activeContact.generatedEmail} />
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {activeContact.generatedEmail}
                        </p>

                        {/* ── Open in Gmail / Outlook ── */}
                        <SendEmailButtons
                          recipientEmail={activeContact.email}
                          emailBody={activeContact.generatedEmail}
                          jobTitle={app.jobTitle}
                          company={app.company}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-800/20 border border-dashed border-slate-700/50 rounded-xl p-6 text-center">
                      <p className="text-slate-500 text-sm">Could not generate email for this contact — try again</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Create Plan Modal
// ─────────────────────────────────────────────────────────────────

const PLAN_PRESETS = [{ days: 3, label: '3 days' }, { days: 7, label: '1 week' }, { days: 14, label: '2 weeks' }, { days: 21, label: '3 weeks' }, { days: 30, label: '1 month' }];

function CreatePlanModal({ app, onConfirm, onClose }: { app: Application; onConfirm: (days: number) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<number>(7);
  const [custom,   setCustom]   = useState(false);
  const [customVal,setCustomVal]= useState('14');
  const handleConfirm = () => { const days = custom ? Math.max(1, Math.min(90, parseInt(customVal) || 7)) : selected; onConfirm(days); };
  const inp = "w-full px-3 py-2 bg-slate-900/50 border border-slate-700/60 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/60 transition-colors";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900/95 border border-slate-700/60 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-lg flex items-center justify-center"><CalendarPlus className="w-4 h-4 text-white" /></div>
            <div>
              <p className="text-sm font-semibold text-white">Create Prep Plan</p>
              <p className="text-xs text-slate-400 truncate max-w-[180px]">{app.jobTitle} @ {app.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-400">When is your interview? We&apos;ll build a day-by-day plan to get you ready.</p>
          <div className="grid grid-cols-3 gap-2">
            {PLAN_PRESETS.map(p => (
              <button key={p.days} type="button" onClick={() => { setSelected(p.days); setCustom(false); }}
                className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${!custom && selected === p.days ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-500/20' : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:border-violet-500/50 hover:text-white'}`}>
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => setCustom(true)}
              className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${custom ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-500 text-white shadow-lg shadow-violet-500/20' : 'bg-slate-800/50 border-slate-700/60 text-slate-400 hover:border-violet-500/50 hover:text-white'}`}>
              Custom
            </button>
          </div>
          {custom && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Days until interview (1–90)</label>
              <input type="number" min={1} max={90} value={customVal} onChange={e => setCustomVal(e.target.value)} className={inp} autoFocus />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={handleConfirm}
              className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Generate Plan
            </button>
            <button onClick={onClose} className="px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-white rounded-xl font-medium text-sm transition-all">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Custom Select
// ─────────────────────────────────────────────────────────────────

function CustomSelect<T extends string>({ value, onChange, options, icon: Icon }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; icon?: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  const ref    = React.useRef<HTMLDivElement>(null);
  const active = options.find(o => o.value === value);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2.5 bg-slate-800/50 border rounded-xl text-sm text-white transition-all min-w-[130px] ${open ? 'border-purple-500/60 bg-slate-800' : 'border-slate-700/60 hover:border-slate-600'}`}>
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}
        <span className="flex-1 text-left truncate">{active?.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 py-1 min-w-full">
          {options.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${value === opt.value ? 'text-purple-300 bg-purple-500/10 font-medium' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              {opt.label}
              {value === opt.value && <Check className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────

export default function JobTrackerPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();

  const [apps,          setApps]          = useState<Application[]>([]);
  const [loadingApps,   setLoadingApps]   = useState(true);
  const [loadingStep,   setLoadingStep]   = useState(0);
  const [showForm,      setShowForm]      = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [form,          setForm]          = useState<AppForm>({ ...EMPTY_FORM });
  const [saving,        setSaving]        = useState(false);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState<AppStatus | 'all'>('all');
  const [filterWork,    setFilterWork]    = useState<WorkType | 'all'>('all');
  const [sortBy,        setSortBy]        = useState<'date' | 'company' | 'status'>('date');
  const [planModal,     setPlanModal]     = useState<Application | null>(null);
  const [creatingPlan,  setCreatingPlan]  = useState(false);
  const [contactsModal, setContactsModal] = useState<Application | null>(null);

  const fetchApps = useCallback(async () => {
    setLoadingApps(true); setLoadingStep(0);
    try {
      setLoadingStep(1);
      const res = await fetch('/api/job-tracker');
      setLoadingStep(2);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setLoadingStep(3);
      setApps(json.data || []);
      setLoadingStep(4);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoadingApps(false); }
  }, []);

  useEffect(() => { if (user) fetchApps(); }, [user, fetchApps]);
  useEffect(() => { if (!loading && !user) router.push('/auth'); }, [user, loading, router]);

  const handleSave = async () => {
    if (!form.company.trim() || !form.jobTitle.trim()) { toast.error('Company and job title are required'); return; }
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const res = await fetch('/api/job-tracker', {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(isEdit ? { id: editingId, ...form } : form),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed'); }
      toast.success(isEdit ? 'Application updated' : 'Application added');
      if (!isEdit && user?.uid) {
        await NotificationService.createNotification(user.uid, 'planner', 'Application Tracked 📋',
          `${form.jobTitle} at ${form.company} has been added to your job tracker.`,
          { actionUrl: '/job-tracker', actionLabel: 'View Tracker' });
      }
      setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM });
      await fetchApps();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (id: string, status: AppStatus) => {
    try {
      const res = await fetch('/api/job-tracker', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('Failed');
      const app = apps.find(a => a.id === id);
      setApps(p => p.map(a => a.id === id ? { ...a, status } : a));
      if (user?.uid && app) {
        const milestoneMessages: Partial<Record<AppStatus, { title: string; message: string; type: 'interview' | 'achievement' | 'planner' }>> = {
          'phone-screen': { type: 'interview',   title: 'Phone Screen Scheduled 📞', message: `You advanced to phone screen for ${app.jobTitle} at ${app.company}! Time to prep.` },
          'technical':    { type: 'interview',   title: 'Technical Round Incoming 💻', message: `You reached the technical round for ${app.jobTitle} at ${app.company}. Start practicing.` },
          'final':        { type: 'interview',   title: 'Final Round! 🔥',             message: `You made it to the final round for ${app.jobTitle} at ${app.company}. Give it your all!` },
          'offer':        { type: 'achievement', title: 'Offer Received! 🎉🏆',         message: `Congratulations! You received an offer for ${app.jobTitle} at ${app.company}!` },
        };
        const milestone = milestoneMessages[status];
        if (milestone) {
          await NotificationService.createNotification(user.uid, milestone.type, milestone.title, milestone.message,
            { actionUrl: '/job-tracker', actionLabel: 'View Application' });
        }
      }
    } catch { toast.error('Failed to update status'); }
  };

  const handleCreatePlan = async (app: Application, days: number) => {
    setCreatingPlan(true); setPlanModal(null);
    try {
      const interviewDate = new Date();
      interviewDate.setDate(interviewDate.getDate() + days);
      const res = await fetch('/api/planner/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: app.jobTitle, company: app.company,
          interviewDate: interviewDate.toISOString().split('T')[0], daysUntilInterview: days, skillLevel: 'intermediate' }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Failed to generate plan'); }
      const data = await res.json();
      toast.success(`${days}-day plan created for ${app.company}!`, {
        action: { label: 'Open Planner', onClick: () => window.open(`/planner/${data.planId}`, '_blank') },
      });
      if (user?.uid) {
        await NotificationService.createNotification(user.uid, 'planner', 'Prep Plan Created 📅',
          `Your ${days}-day preparation plan for ${app.jobTitle} at ${app.company} is ready.`,
          { actionUrl: `/planner/${data.planId}`, actionLabel: 'View Plan' });
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed to create plan'); }
    finally { setCreatingPlan(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this application?')) return;
    try {
      const res = await fetch(`/api/job-tracker?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Deleted');
      setApps(p => p.filter(a => a.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const handleEdit = (app: Application) => {
    setForm({ company: app.company, jobTitle: app.jobTitle, jobUrl: app.jobUrl, location: app.location,
      salary: app.salary, workType: app.workType, source: app.source, notes: app.notes,
      status: app.status, appliedDate: app.appliedDate });
    setEditingId(app.id); setShowForm(true);
  };

  const total        = apps.length;
  const activeCount  = apps.filter(a => !['rejected','ghosted','withdrew','offer'].includes(a.status)).length;
  const offerCount   = apps.filter(a => a.status === 'offer').length;
  const responseRate = total > 0 ? Math.round((apps.filter(a => a.status !== 'applied' && a.status !== 'wishlist').length / total) * 100) : 0;

  const filtered = apps
    .filter(a => {
      const q = search.toLowerCase();
      return (!q || a.company.toLowerCase().includes(q) || a.jobTitle.toLowerCase().includes(q) || (a.location || '').toLowerCase().includes(q))
        && (filterStatus === 'all' || a.status === filterStatus)
        && (filterWork   === 'all' || a.workType === filterWork);
    })
    .sort((a, b) => {
      if (sortBy === 'company') return a.company.localeCompare(b.company);
      if (sortBy === 'status')  return a.status.localeCompare(b.status);
      return new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime();
    });

  const loadingSteps = [
    { name: 'Authenticating…',         weight: 1 },
    { name: 'Connecting to database…', weight: 1 },
    { name: 'Loading applications…',   weight: 3 },
    { name: 'Calculating stats…',      weight: 2 },
    { name: 'Ready!',                  weight: 1 },
  ];

  if (loading || loadingApps) {
    return <AnimatedLoader isVisible={true} mode="steps" steps={loadingSteps} currentStep={loadingStep} loadingText="Loading your job tracker…" showNavigation={true} />;
  }

  return (
    <>
      {showForm && (
        <FormModal form={form} setForm={setForm} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingId(null); setForm({ ...EMPTY_FORM }); }}
          saving={saving} isEdit={!!editingId} />
      )}

      <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <Link href="/dashboard" className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-3">
                <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
              </Link>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glass">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">Job Tracker</h1>
                  <p className="text-slate-400 text-sm">Track every application from wishlist to offer</p>
                </div>
              </div>
            </div>
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setEditingId(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 flex-shrink-0">
              <Plus className="w-4 h-4" /> Add Application
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total"         value={total}              color="text-white"       />
            <StatCard label="Active"        value={activeCount}        color="text-blue-400"    sub="in progress" />
            <StatCard label="Response Rate" value={`${responseRate}%`} color="text-amber-400"   />
            <StatCard label="Offers"        value={offerCount}         color="text-emerald-400" />
          </div>

          <PipelineFunnel apps={apps} />

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search by company, role, or location…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-800/50 border border-slate-700/60 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:border-purple-500/60 transition-colors" />
            </div>
            <CustomSelect<AppStatus | 'all'> value={filterStatus} onChange={setFilterStatus} icon={Filter}
              options={[{ value: 'all', label: `All (${apps.length})` }, ...(Object.keys(STATUS_CONFIG) as AppStatus[]).map(s => ({ value: s, label: STATUS_CONFIG[s].label }))]} />
            <CustomSelect<WorkType | 'all'> value={filterWork} onChange={setFilterWork}
              options={[{ value: 'all', label: 'All Types' }, ...(Object.keys(WORK_TYPE_CONFIG) as WorkType[]).map(w => ({ value: w, label: WORK_TYPE_CONFIG[w].label }))]} />
            <CustomSelect<'date' | 'company' | 'status'> value={sortBy} onChange={setSortBy} icon={SlidersHorizontal}
              options={[{ value: 'date', label: 'Recent First' }, { value: 'company', label: 'By Company' }, { value: 'status', label: 'By Status' }]} />
          </div>

          {/* Modals */}
          {contactsModal && <ContactsModal app={contactsModal} onClose={() => setContactsModal(null)} />}
          {planModal && <CreatePlanModal app={planModal} onConfirm={days => handleCreatePlan(planModal, days)} onClose={() => setPlanModal(null)} />}
          {creatingPlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
              <div className="glass-card p-8 text-center">
                <div className="relative w-14 h-14 mx-auto mb-4">
                  <Loader2 className="w-14 h-14 text-violet-400 animate-spin" />
                  <Sparkles className="w-5 h-5 text-violet-300 absolute inset-0 m-auto" />
                </div>
                <p className="text-white font-semibold mb-1">Generating your prep plan…</p>
                <p className="text-slate-400 text-sm">Building your personalised prep roadmap with Preciprocal AI</p>
              </div>
            </div>
          )}

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="glass-card text-center py-16 px-6">
              <div className="w-14 h-14 bg-slate-800 border border-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Briefcase className="w-6 h-6 text-slate-500" /></div>
              <h3 className="text-white font-semibold mb-2">{apps.length === 0 ? 'No applications yet' : 'No results match your filters'}</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                {apps.length === 0 ? 'Start tracking your job search. Add your first application to see it here.' : 'Try adjusting your search or filters.'}
              </p>
              {apps.length === 0 && (
                <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowForm(true); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-sm">
                  <Plus className="w-4 h-4" /> Add First Application
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">{filtered.length} application{filtered.length !== 1 ? 's' : ''}{search || filterStatus !== 'all' || filterWork !== 'all' ? ' matching filters' : ''}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(app => (
                  <AppCard key={app.id} app={app}
                    onEdit={() => handleEdit(app)}
                    onDelete={() => handleDelete(app.id)}
                    onStatusChange={status => handleStatusChange(app.id, status)}
                    onCreatePlan={() => setPlanModal(app)}
                    onFindContacts={() => setContactsModal(app)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <UsersFeedback page="job-tracker" />
    </>
  );
}