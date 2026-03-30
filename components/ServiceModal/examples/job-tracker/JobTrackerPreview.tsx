// components/ServiceExampleModal/examples/job-tracker/JobTrackerPreview.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, Calendar,
  CheckCircle2, UserSearch, CalendarPlus, Mail, Linkedin,
  Sparkles, Copy, ExternalLink, Edit3, Trash2, ChevronDown,
  Loader2, Check, Shield, Building2,
  Search, Filter, SlidersHorizontal, X, ArrowLeft,
} from 'lucide-react';
import { FadeIn, TypingText } from '../../primitives';

// ─── Data ─────────────────────────────────────────────────────────────────────

const APPS = [
  { id:'1', company:'Meta',    role:'Data Scientist, Product Analytics', loc:'Onsite', days:'4 days ago',  salary:'$160k–$200k', status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:'About the job As a Data Scientist at Meta, you will shape the future of people-facing and business-facing…' },
  { id:'2', company:'Opendoor', role:'Data Scientist',                   loc:'Onsite', days:'12 days ago', salary:'$140k–$180k', status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:'About the job Data Scientist, PricingLocation: In office 4 days a week; Seattle WA. Opendoor is transformin…' },
  { id:'3', company:'Chewy',   role:'Data Engineer I',                   loc:'Onsite', days:'21 days ago', salary:'$120k–$150k', status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:"About the job Job DescriptionOur Opportunity: Chewy's AI & Data organization is seeking a Da…" },
  { id:'4', company:'ALO',     role:'Data Intern - AI',                  loc:'Onsite', days:'21 days ago', salary:null,          status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:'About the job WHY JOIN ALO? Mindful movement. It\'s at the core of why we do what we do at ALO….' },
  { id:'5', company:'Amazon',  role:'Data Scientist, Prime Air',         loc:'Onsite', days:'22 days ago', salary:'$150k–$185k', status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:'About the job DescriptionHere at Amazon, we embrace our differences…' },
  { id:'6', company:'Spotify', role:'Machine Learning Engineer',         loc:'Onsite', days:'22 days ago', salary:'$155k–$195k', status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:'About the job The Personalization Team…' },
  { id:'7', company:'New York Life', role:'Associate - Data Scientist',  loc:'Onsite', days:'22 days ago', salary:'$130k–$160k', status:'Applied', sColor:'text-blue-400',    sBg:'bg-blue-500/10',    sBorder:'border-blue-500/20',    sDot:'bg-blue-400',    src:'LinkedIn', notes:'About the job Location Designation: Hybrid · 3…' },
  { id:'8', company:'Stripe',  role:'Senior Software Engineer',          loc:'Hybrid', days:'5 days ago',  salary:'$180k–$220k', status:'Technical', sColor:'text-indigo-400', sBg:'bg-indigo-500/10', sBorder:'border-indigo-500/20', sDot:'bg-indigo-400', src:'Referral', notes:'Build distributed payment systems at scale…' },
];

const PIPELINE = [
  { label:'Applied', count:7, color:'text-blue-400', bg:'bg-blue-500/10', border:'border-blue-500/20', dot:'bg-blue-400' },
  { label:'Technical', count:1, color:'text-indigo-400', bg:'bg-indigo-500/10', border:'border-indigo-500/20', dot:'bg-indigo-400' },
];

const CONTACTS = [
  { name:'Sarah Kim',  initials:'S', position:'Senior Technical Recruiter', dept:'Talent Acquisition', email:'s.kim@meta.com',  confidence:94, badge:'Recruiter',   badgeCls:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', linkedin:true,
    aiEmail:`Hi Sarah,

I came across the Data Scientist, Product Analytics role at Meta and I'm genuinely excited about the opportunity. Having spent 3+ years building ML pipelines and conducting A/B tests at scale, I'm drawn to Meta's data-driven approach to product development.

In my current role, I led a recommendation engine overhaul that improved CTR by 23% and built real-time analytics dashboards serving 50+ stakeholders — work that maps directly to the scale Meta operates at.

I'd love to learn more about the team and how I might contribute. Would you be open to a brief chat?

Best regards,
Alex` },
  { name:'James Park',  initials:'J', position:'Engineering Manager, ML',    dept:'Engineering',        email:'j.park@meta.com', confidence:87, badge:'Manager',     badgeCls:'bg-slate-500/15 text-slate-400 border-slate-500/25',       linkedin:true,
    aiEmail:`Hi James,

I noticed you lead the ML team at Meta and wanted to reach out about the Data Scientist, Product Analytics role. Your team's work on large-scale recommendation systems is exactly the kind of challenge I'm looking for.

I've spent the past 3 years shipping production ML models — most recently a demand forecasting system that reduced inventory waste by 18% and a real-time anomaly detection pipeline processing 500K events/sec. I'd love to hear how your team approaches experimentation at Meta's scale.

Would you have 15 minutes for a quick chat? Happy to work around your schedule.

Best,
Alex` },
  { name:'Lisa Chen',   initials:'L', position:'VP of Engineering',          dept:'Engineering',        email:'l.chen@meta.com', confidence:72, badge:'Director/VP', badgeCls:'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',   linkedin:false,
    aiEmail:`Dear Lisa,

I'm writing to express my interest in the Data Scientist, Product Analytics position at Meta. Your vision for scaling Meta's data infrastructure, particularly the investment in real-time analytics, resonates strongly with my background.

Over the past 3+ years I've built end-to-end data pipelines serving cross-functional teams of 50+ people, driven a 23% improvement in recommendation CTR through rigorous experimentation, and established data quality frameworks that reduced reporting errors by 40%.

I believe my blend of technical depth and cross-functional communication would complement the team well. I'd welcome any opportunity to discuss how I could contribute to Meta's data science initiatives.

Warm regards,
Alex` },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

type View = 'dashboard' | 'form' | 'contacts';

function MiniCard({ app, onFindContacts, onEdit, highlight }: { app: typeof APPS[0]; onFindContacts: () => void; onEdit?: () => void; highlight?: boolean }) {
  return (
    <div className={`bg-[#0d1526]/80 border rounded-xl p-3 flex flex-col group transition-all ${highlight ? 'border-purple-500/40 shadow-[0_0_20px_rgba(139,92,246,0.15)]' : 'border-white/[0.07] hover:border-white/[0.12]'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 bg-white/[0.07] border border-white/[0.09] rounded-lg flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
            {app.company[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-white font-bold truncate leading-tight">{app.company}</p>
            <p className="text-[8px] text-slate-500 truncate">{app.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <ExternalLink className="w-2.5 h-2.5 text-slate-700 hover:text-blue-400 cursor-pointer" />
          <Edit3 className="w-2.5 h-2.5 text-slate-700 hover:text-purple-400 cursor-pointer" onClick={onEdit} />
          <Trash2 className="w-2.5 h-2.5 text-slate-700 hover:text-red-400 cursor-pointer" />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="flex items-center gap-0.5 text-[8px] text-slate-600"><Building2 className="w-2 h-2" />{app.loc}</span>
        <span className="flex items-center gap-0.5 text-[8px] text-slate-600"><Calendar className="w-2 h-2" />{app.days}</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-semibold border ${app.sColor} ${app.sBg} ${app.sBorder}`}>
            <span className={`w-1 h-1 rounded-full ${app.sDot} flex-shrink-0`} />{app.status}
          </span>
          <ChevronDown className="w-2.5 h-2.5 text-slate-600" />
        </div>
        <span className="text-[8px] text-slate-600">{app.src}</span>
      </div>

      {app.notes && (
        <p className="text-[7px] text-slate-600 line-clamp-2 border-t border-white/[0.05] pt-2 mb-2 leading-relaxed">{app.notes}</p>
      )}

      <div className="grid grid-cols-2 gap-1.5 mt-auto">
        <button
          onClick={onFindContacts}
          className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[8px] font-semibold transition-all cursor-pointer ${highlight ? 'text-white bg-purple-600 border border-purple-500 shadow-[0_0_12px_rgba(139,92,246,0.4)] animate-pulse' : 'text-purple-400 bg-purple-500/[0.07] border border-purple-500/20 hover:bg-purple-500/15 hover:border-purple-500/35 hover:text-purple-300'}`}
        >
          <UserSearch className="w-2.5 h-2.5" /> Find Contacts
        </button>
        <button className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-[8px] font-semibold text-violet-400 bg-violet-500/[0.07] border border-violet-500/20 hover:bg-violet-500/15 hover:border-violet-500/35 hover:text-violet-300 transition-all cursor-pointer">
          <CalendarPlus className="w-2.5 h-2.5" /> Create Plan
        </button>
      </div>
    </div>
  );
}

// ─── Main Preview ─────────────────────────────────────────────────────────────

/*
  Auto-play steps (step prop from parent):
  0 = Form filling
  1 = Save success
  2 = Dashboard loading (stats + pipeline)
  3 = Cards appear
  4 = Find contacts searching
  5 = Contacts found
  6 = AI email typing
  7 = Complete — fully interactive
*/

export function JobTrackerExamplePreview({ step }: { step: number }) {
  const isComplete = step >= 8;

  // Interactive state (used once autoplay is done OR user clicks)
  const [view, setView] = useState<View>('form');
  const [contactsCompany, setContactsCompany] = useState('Meta');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsReady, setContactsReady] = useState(false);
  const [emailReady, setEmailReady] = useState(false);
  const [activeContact, setActiveContact] = useState(0);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [userTriggered, setUserTriggered] = useState(false);
  const [highlightFirst, setHighlightFirst] = useState(false);

  // Sync autoplay steps to view
  useEffect(() => {
    if (userTriggered) return;
    if (step <= 1) setView('form');
    else if (step <= 3) { setView('dashboard'); setContactsReady(false); setContactsLoading(false); setEmailReady(false); setHighlightFirst(step === 3); }
    else if (step === 4) { setView('contacts'); setContactsLoading(true); setContactsReady(false); setEmailReady(false); setHighlightFirst(false); }
    else if (step === 5) { setView('contacts'); setContactsLoading(false); setContactsReady(true); setEmailReady(false); }
    else if (step >= 6) { setView('contacts'); setContactsLoading(false); setContactsReady(true); setEmailReady(true); }
  }, [step, userTriggered]);

  // User-triggered find contacts (interactive)
  const handleFindContacts = useCallback((company: string) => {
    setUserTriggered(true);
    setHighlightFirst(false);
    setContactsCompany(company);
    setView('contacts');
    setContactsLoading(true);
    setContactsReady(false);
    setEmailReady(false);
    setActiveContact(0);

    setTimeout(() => {
      setContactsLoading(false);
      setContactsReady(true);
      setTimeout(() => setEmailReady(true), 1200);
    }, 2500);
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setUserTriggered(true);
    setView('dashboard');
    setContactsReady(false);
    setContactsLoading(false);
    setEmailReady(false);
  }, []);

  // ── Form view ──
  if (view === 'form' && !isComplete) {
    return (
      <div style={{ minHeight: 480 }} className="flex items-center justify-center">
        <FadeIn delay={200}>
          <div className="bg-[#0d1526]/90 border border-white/[0.08] rounded-xl overflow-hidden max-w-lg mx-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Briefcase className="w-3 h-3 text-white" />
                </div>
                <span className="text-[10px] font-bold text-white">Add Application</span>
              </div>
              <X className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] text-slate-400 mb-1">Company *</label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px]">
                    {step === 0 ? <TypingText text="Meta" speed={100} delay={400} className="text-white" /> : <span className="text-white">Meta</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-[8px] text-slate-400 mb-1">Job Title *</label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px]">
                    {step === 0 ? <TypingText text="Data Scientist, Product Analytics" speed={30} delay={900} className="text-white" /> : <span className="text-white">Data Scientist, Product Analytics</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] text-slate-400 mb-1">Status</label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-purple-500/40 text-[9px] text-purple-300 flex items-center justify-between">Applied <ChevronDown className="w-2.5 h-2.5" /></div>
                </div>
                <div>
                  <label className="block text-[8px] text-slate-400 mb-1">Applied Date</label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px] text-slate-300">2026-03-26</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[8px] text-slate-400 mb-1">Location</label>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px] text-slate-300">Menlo Park, CA</div>
                </div>
                <div>
                  <label className="block text-[8px] text-slate-400 mb-1">Work Type</label>
                  <div className="flex gap-1">
                    {['Remote','Hybrid','Onsite'].map(w => (
                      <div key={w} className={`flex-1 py-1.5 rounded-lg text-[7px] font-semibold text-center border ${w==='Onsite' ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-white/[0.03] border-white/[0.07] text-slate-600'}`}>{w}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div><label className="block text-[8px] text-slate-400 mb-1">Source</label><div className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[9px] text-slate-300">LinkedIn</div></div>
              {step >= 1 ? (
                <FadeIn delay={100}>
                  <div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-bold text-emerald-400">Application saved!</span>
                  </div>
                </FadeIn>
              ) : (
                <button className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-[10px] font-semibold text-white flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> Save Application
                </button>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    );
  }

  // ── Contacts view ──
  if (view === 'contacts') {
    const contact = CONTACTS[activeContact];

    return (
      <div style={{ minHeight: 480 }}>
        <div className="bg-[#0d1526]/90 border border-white/[0.08] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <button onClick={handleBackToDashboard} className="text-slate-500 hover:text-white transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <UserSearch className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-white">Find Contacts</p>
                <p className="text-[7px] text-slate-500">{contactsCompany} · Data Scientist</p>
              </div>
            </div>
            <button onClick={handleBackToDashboard} className="text-slate-600 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>

          {/* Domain banner */}
          {contactsReady && (
            <FadeIn delay={150}>
              <div className="px-4 py-2 border-b border-white/[0.05]">
                <p className="text-[8px] text-slate-400">Found <span className="text-white font-semibold">{CONTACTS.length}</span> contacts at <span className="text-purple-400 font-semibold">{contactsCompany.toLowerCase()}.com</span></p>
              </div>
            </FadeIn>
          )}

          {/* Loading */}
          {contactsLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="relative w-9 h-9 mx-auto mb-3">
                  <Loader2 className="w-9 h-9 text-purple-400 animate-spin" />
                  <UserSearch className="w-3.5 h-3.5 text-purple-300 absolute inset-0 m-auto" />
                </div>
                <p className="text-[10px] font-semibold text-white mb-0.5">Finding contacts at {contactsCompany}…</p>
                <p className="text-[8px] text-slate-500">Searching and writing personalised emails…</p>
              </div>
            </div>
          )}

          {/* Contacts list + detail */}
          {contactsReady && (
            <div className="flex" style={{ minHeight: 340 }}>
              {/* Sidebar */}
              <div className="w-44 flex-shrink-0 border-r border-white/[0.05]">
                {CONTACTS.map((c, i) => (
                  <FadeIn key={c.email} delay={200 + i * 120}>
                    <button
                      onClick={() => setActiveContact(i)}
                      className={`w-full text-left px-3 py-2.5 border-b border-white/[0.04] transition-colors ${activeContact === i ? 'bg-purple-500/[0.10] border-l-2 border-l-purple-500' : 'hover:bg-white/[0.03]'}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 bg-white/[0.07] rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 mt-0.5">{c.initials}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[9px] font-semibold text-white truncate">{c.name}</p>
                          <p className="text-[7px] text-slate-500 truncate mb-0.5">{c.position}</p>
                          <span className={`inline-flex items-center px-1 py-0.5 rounded text-[7px] font-semibold border ${c.badgeCls}`}>{c.badge}</span>
                        </div>
                      </div>
                    </button>
                  </FadeIn>
                ))}
              </div>

              {/* Detail */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5" style={{ maxHeight: 340 }}>
                <FadeIn delay={500}>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="text-[10px] font-bold text-white">{contact.name}</span>
                          <span className={`inline-flex items-center px-1 py-0.5 rounded text-[7px] font-semibold border ${contact.badgeCls}`}>{contact.badge}</span>
                        </div>
                        <p className="text-[8px] text-slate-400">{contact.position}</p>
                        <p className="text-[7px] text-slate-600">{contact.dept}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${contact.confidence >= 80 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="text-[8px] text-slate-500">{contact.confidence}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] border border-white/[0.07] rounded-lg flex-1 min-w-0">
                        <Mail className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                        <span className="text-[8px] text-white truncate font-medium">{contact.email}</span>
                        <button
                          onClick={() => { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }}
                          className="flex-shrink-0 text-slate-600 hover:text-white transition-colors"
                        >
                          {copiedEmail ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                      </div>
                      {contact.linkedin && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/[0.08] border border-blue-500/20 rounded-lg text-blue-400 text-[7px] font-semibold flex-shrink-0 cursor-pointer hover:bg-blue-500/15 transition-colors">
                          <Linkedin className="w-2.5 h-2.5" /> LinkedIn
                        </div>
                      )}
                    </div>
                  </div>
                </FadeIn>

                {/* AI Email */}
                {emailReady && (
                  <FadeIn delay={300}>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.05]">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                          <span className="text-[8px] font-bold text-white">AI-Written Outreach</span>
                        </div>
                        <button
                          onClick={() => { setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000); }}
                          className="text-slate-600 hover:text-white transition-colors"
                        >
                          {copiedEmail ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                      </div>
                      <div className="p-2.5">
                        {!userTriggered && !isComplete ? (
                          <TypingText text={contact.aiEmail} speed={6} delay={200} className="text-[8px] text-slate-300 leading-relaxed whitespace-pre-wrap" />
                        ) : (
                          <p className="text-[8px] text-slate-300 leading-relaxed whitespace-pre-wrap">{contact.aiEmail}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.05]">
                          <span className="text-[7px] text-slate-600 flex-shrink-0">Send via</span>
                          <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[7px] font-semibold border border-red-500/20 bg-red-500/[0.07] text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer">
                            <Mail className="w-2.5 h-2.5" /> Gmail <ExternalLink className="w-2 h-2 opacity-50" />
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[7px] font-semibold border border-blue-500/20 bg-blue-500/[0.07] text-blue-400 hover:bg-blue-500/15 transition-colors cursor-pointer">
                            <Mail className="w-2.5 h-2.5" /> Outlook <ExternalLink className="w-2 h-2 opacity-50" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard view (default / complete) ──
  return (
    <div style={{ minHeight: 480 }}>
      {/* Header bar */}
      <FadeIn delay={100}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(102,126,234,0.3)]">
              <Briefcase className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-white">Job Tracker</p>
              <p className="text-[7px] text-slate-500">Track every application from wishlist to offer</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/[0.07] border border-purple-500/20">
              <Shield className="w-2.5 h-2.5 text-purple-400" />
              <span className="text-[8px] font-semibold text-purple-400">Unlimited</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[8px] font-semibold cursor-pointer">
              <Plus className="w-2.5 h-2.5" /> Add
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Stats row */}
      <FadeIn delay={250}>
        <div className="grid grid-cols-4 gap-2 mb-2.5">
          {[
            { label:'TOTAL', val:'8', color:'text-white' },
            { label:'ACTIVE', val:'8', color:'text-blue-400', sub:'in progress' },
            { label:'RESPONSE RATE', val:'13%', color:'text-amber-400' },
            { label:'OFFERS', val:'0', color:'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2">
              <p className="text-[7px] text-slate-500 uppercase tracking-wide font-semibold mb-1">{s.label}</p>
              <p className={`text-sm font-bold tabular-nums ${s.color}`}>{s.val}</p>
              {s.sub && <p className="text-[7px] text-slate-600">{s.sub}</p>}
            </div>
          ))}
        </div>
      </FadeIn>

      {/* Pipeline */}
      <FadeIn delay={400}>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {PIPELINE.map(p => (
              <div key={p.label} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-semibold ${p.bg} ${p.border} ${p.color}`}>
                <span className={`w-1 h-1 rounded-full ${p.dot} flex-shrink-0`} />{p.label} <span className="font-bold">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Search bar */}
      {(step >= 3 || isComplete || userTriggered) && (
        <FadeIn delay={200}>
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="relative flex-1">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
              <input type="text" readOnly placeholder="Search by company, role, or location…" className="w-full pl-7 pr-2 py-1.5 rounded-lg text-[8px] text-white bg-white/[0.04] border border-white/[0.08] placeholder-slate-600 cursor-default" />
            </div>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[8px] text-slate-400">
              <Filter className="w-2.5 h-2.5" /> All ({APPS.length}) <ChevronDown className="w-2.5 h-2.5" />
            </div>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[8px] text-slate-400">
              All Types <ChevronDown className="w-2.5 h-2.5" />
            </div>
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[8px] text-slate-400">
              <SlidersHorizontal className="w-2.5 h-2.5" /> Recent <ChevronDown className="w-2.5 h-2.5" />
            </div>
          </div>
        </FadeIn>
      )}

      {/* Cards grid — full width, 4 cols */}
      {(step >= 3 || isComplete || userTriggered) && (
        <FadeIn delay={100}>
          <p className="text-[8px] text-slate-600 mb-1.5">{APPS.length} applications</p>
          <div className="grid grid-cols-4 gap-2">
            {APPS.slice(0, 8).map((app, i) => (
              <FadeIn key={app.id} delay={150 + i * 80}>
                <MiniCard
                  app={app}
                  onFindContacts={() => handleFindContacts(app.company)}
                  highlight={highlightFirst && i === 0}
                />
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      )}
    </div>
  );
}