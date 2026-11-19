'use client';
// components/job-tracker/FindContactsSheet.tsx
//
// Find Contacts for one tracked job, as a side sheet over the tracker (a full
// screen sheet on phones). Looks up people at the employer through
// app/api/job-tracker/find-contacts, recruiters and hiring managers first,
// each with a drafted note the student edits before sending from their own
// mail. One search uses one 'findContacts' unit, counted by the route.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, ExternalLink, Globe, Linkedin, Loader2, Mail, RefreshCw, Search, Sparkles, UserSearch, Users, X } from 'lucide-react';
import { CompanyLogo } from '@/components/jobs/CompanyLogo';
import AutoTextarea from '@/components/ui/auto-textarea';
import SaveToContactsButton from '@/components/contacts/SaveToContactsButton';

export interface FoundContact {
  email: string; firstName: string; lastName: string; fullName: string;
  position: string; department: string; confidence: number;
  linkedin: string | null; generatedEmail: string | null; tier?: number;
}

interface JobRef { id: string; company: string; jobTitle: string; jobUrl: string | null; notes: string | null }

/** A short label for what the person does, read from their title. */
function roleLabel(position: string): string {
  const p = position.toLowerCase();
  if (/recruit|talent|\bhr\b|people/.test(p)) return 'Recruiter';
  if (/ceo|founder|president|chief exec/.test(p)) return 'Founder';
  if (/cto|chief tech|vp of eng|vp eng/.test(p)) return 'Engineering lead';
  if (/director|\bvp\b|vice president/.test(p)) return 'Director';
  if (/lead|manager|principal|staff|head/.test(p)) return 'Hiring manager';
  return 'Team member';
}

const initials = (c: FoundContact) => ((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '') || c.fullName?.[0] || '?').toUpperCase();

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center h-5 px-1.5 rounded-md text-[11px] font-medium text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] whitespace-nowrap">{children}</span>;
}

export default function FindContactsSheet({ app, logoDomain, searchesLeft, onClose, onSearched }: {
  app: JobRef;
  logoDomain?: string | null;
  /** Searches left this month, or null when unlimited or unknown. */
  searchesLeft: number | null;
  onClose: () => void;
  onSearched?: () => Promise<void> | void;
}) {
  const [contacts, setContacts] = useState<FoundContact[]>([]);
  const [state, setState] = useState<'intro' | 'loading' | 'done' | 'error'>('intro');
  const [error, setError] = useState('');
  const [domain, setDomain] = useState('');
  const [foundDomain, setFoundDomain] = useState('');
  const [editDomain, setEditDomain] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  /** On phones the list and the person are separate views. */
  const [showPerson, setShowPerson] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const host = useMemo(() => { try { return app.jobUrl ? new URL(app.jobUrl).hostname.replace(/^www\./, '') : ''; } catch { return ''; } }, [app.jobUrl]);

  const search = async () => {
    setState('loading'); setError(''); setContacts([]); setActive(null); setShowPerson(false); setEditDomain(false);
    try {
      const res = await fetch('/api/job-tracker/find-contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: app.company, jobTitle: app.jobTitle, jobDescription: app.notes || '', domain: domain.trim() || undefined, jobUrl: app.jobUrl || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not look up contacts. Please try again.');
      const list = (data.contacts ?? []) as FoundContact[];
      setContacts(list);
      setFoundDomain(data.domain || '');
      const subject = `${app.jobTitle} role at ${app.company}`;
      setDrafts(Object.fromEntries(list.map(c => [c.email, { subject, body: c.generatedEmail ?? '' }])));
      setState(list.length ? 'done' : 'error');
      if (!list.length) setError(`No public work emails turned up for ${data.domain || app.company}. If the company uses another domain, search that instead.`);
      if (list.length) { setActive(0); await onSearched?.(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look up contacts. Please try again.');
      setState('error');
    }
  };

  const copy = (key: string, text: string, what: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1800); toast.success(`${what} copied`); }).catch(() => toast.error('Could not copy'));
  };

  const person = active !== null ? contacts[active] : null;
  const draft = person ? drafts[person.email] : null;
  const setDraft = (patch: Partial<{ subject: string; body: string }>) => person && setDrafts(d => ({ ...d, [person.email]: { ...d[person.email], ...patch } }));

  const gmail = () => {
    if (!person || !draft) return;
    const u = new URL('https://mail.google.com/mail/');
    u.searchParams.set('view', 'cm'); u.searchParams.set('to', person.email); u.searchParams.set('su', draft.subject); u.searchParams.set('body', draft.body);
    window.open(u.toString(), '_blank', 'noopener,noreferrer');
  };
  const mailApp = () => {
    if (!person || !draft) return;
    window.location.href = `mailto:${encodeURIComponent(person.email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  };

  const domainForm = (
    <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (domain.trim()) void search(); }}>
      <label className="relative flex-1 min-w-0">
        <Globe className="w-4 h-4 text-[var(--text-5)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input className="field w-full !pl-10" placeholder="Company domain, e.g. stripe.com" value={domain} autoFocus onChange={e => setDomain(e.target.value)} />
      </label>
      <button type="submit" disabled={!domain.trim()} className="btn-primary !h-10 !text-[13px] flex-shrink-0">Search</button>
    </form>
  );

  const usageNote = searchesLeft === null ? null : (
    <p className="text-[12px] text-[var(--text-4)]">Uses 1 contact search. {searchesLeft} left this month.</p>
  );

  // Rendered on document.body: an animated ancestor would otherwise become
  // the containing block for this fixed sheet (see app/globals.css).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-labelledby="fc-title"
        className="relative w-full lg:w-[880px] max-w-full h-full flex flex-col bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),-24px_0_60px_-16px_rgba(0,0,0,0.8)] animate-slide-in-right">

        {/* Header */}
        <header className="flex items-center gap-3 px-5 sm:px-6 h-[72px] border-b border-white/[0.06] flex-shrink-0">
          <CompanyLogo company={app.company} domain={logoDomain} size={36} />
          <div className="min-w-0 flex-1">
            <h2 id="fc-title" className="font-display text-[16px] font-semibold tracking-[-0.01em] text-white truncate">People at {app.company}</h2>
            <p className="text-[12.5px] text-[var(--text-4)] truncate">{app.jobTitle}{host && <span className="text-[var(--text-5)]"> · {host}</span>}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 -mr-1.5 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </header>

        {/* Intro */}
        {state === 'intro' && (
          <div className="flex-1 overflow-y-auto glass-scrollbar px-5 sm:px-6 py-8">
            <div className="max-w-[460px] mx-auto">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]"><Users className="w-5 h-5 text-[var(--text-2)]" /></span>
              <h3 className="font-display text-[20px] font-semibold text-white tracking-[-0.015em] mt-5">Reach someone at {app.company}</h3>
              <p className="text-[13.5px] text-[var(--text-3)] mt-1.5 leading-relaxed">A short note to the right person is often read before the application pile. We look them up and draft the note; you edit it and send it from your own email.</p>
              <ul className="mt-6 space-y-3">
                {[
                  { icon: Search, t: 'Public work emails', d: `Found on ${host || `${app.company}'s domain`}, each with how sure the source is of the address.` },
                  { icon: UserSearch, t: 'The right people first', d: 'Recruiters and hiring managers ahead of everyone else.' },
                  { icon: Sparkles, t: 'A drafted note for each', d: 'Written for this role. Read and change it before you send.' },
                ].map(i => (
                  <li key={i.t} className="flex items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/[0.06] bg-white/[0.02]">
                    <i.icon className="w-4 h-4 text-[var(--text-3)] mt-0.5 flex-shrink-0" />
                    <span><span className="block text-[13.5px] font-medium text-white">{i.t}</span><span className="block text-[12.5px] text-[var(--text-4)] mt-0.5">{i.d}</span></span>
                  </li>
                ))}
              </ul>
              <div className="mt-7 space-y-3">
                {editDomain ? domainForm : (
                  <button onClick={search} className="btn-primary w-full !h-11 justify-center"><UserSearch className="w-4 h-4" /> Find people at {app.company}</button>
                )}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {usageNote ?? <span />}
                  {!editDomain && <button onClick={() => setEditDomain(true)} className="text-[12.5px] text-[var(--text-3)] hover:text-white transition-colors">Use a different domain</button>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Looking up */}
        {state === 'loading' && (
          <div className="flex-1 overflow-hidden px-5 sm:px-6 py-6" aria-busy="true">
            <p className="text-[13px] text-[var(--text-3)] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Looking up people at {domain.trim() || app.company} and drafting notes. This can take a moment.</p>
            <div className="mt-5 space-y-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/[0.05] bg-white/[0.02]" style={{ opacity: 1 - i * 0.18 }}>
                  <span className="w-9 h-9 rounded-full bg-white/[0.06] animate-pulse" />
                  <span className="flex-1 space-y-2"><span className="block h-3 w-40 rounded bg-white/[0.06] animate-pulse" /><span className="block h-2.5 w-56 max-w-full rounded bg-white/[0.04] animate-pulse" /></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nothing found, or the lookup failed */}
        {state === 'error' && (
          <div className="flex-1 overflow-y-auto glass-scrollbar px-5 sm:px-6 py-10">
            <div className="max-w-[440px] mx-auto text-center">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] mx-auto"><UserSearch className="w-5 h-5 text-[var(--text-3)]" /></span>
              <h3 className="text-[15px] font-semibold text-white mt-4">No one to show yet</h3>
              <p className="text-[13px] text-[var(--text-3)] mt-1.5 leading-relaxed">{error}</p>
              <div className="mt-6 text-left">{domainForm}</div>
              <button onClick={search} className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] hover:text-white transition-colors"><RefreshCw className="w-3.5 h-3.5" /> Try again</button>
            </div>
          </div>
        )}

        {/* Results */}
        {state === 'done' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-2.5 border-b border-white/[0.06] flex-shrink-0">
              {editDomain ? <div className="flex-1">{domainForm}</div> : (
                <>
                  <p className="text-[12.5px] text-[var(--text-3)] truncate"><span className="text-white font-medium">{contacts.length} {contacts.length === 1 ? 'person' : 'people'}</span>{foundDomain && <> at {foundDomain}</>}</p>
                  <button onClick={() => { setDomain(''); setEditDomain(true); }} className="text-[12.5px] text-[var(--text-3)] hover:text-white transition-colors flex-shrink-0">Wrong company?</button>
                </>
              )}
            </div>

            <div className="flex-1 min-h-0 flex">
              {/* People */}
              <ul className={`${showPerson ? 'hidden' : 'flex'} lg:flex flex-col w-full lg:w-[300px] flex-shrink-0 lg:border-r border-white/[0.06] overflow-y-auto glass-scrollbar p-2 gap-1`}>
                {contacts.map((c, i) => {
                  const on = active === i;
                  return (
                    <li key={c.email}>
                      <button onClick={() => { setActive(i); setShowPerson(true); }} aria-current={on ? 'true' : undefined}
                        className={`w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${on ? 'bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]' : 'hover:bg-white/[0.03]'}`}>
                        <span className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white bg-white/[0.07] ring-1 ring-inset ring-white/[0.08] flex-shrink-0">{initials(c)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-white truncate">{c.fullName}</span>
                          <span className="block text-[12px] text-[var(--text-4)] truncate">{c.position || roleLabel(c.position)}</span>
                        </span>
                        <Chip>{roleLabel(c.position)}</Chip>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* The person and the note */}
              {person && draft && (
                <section className={`${showPerson ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0 flex-col overflow-y-auto glass-scrollbar`}>
                  <div className="px-5 sm:px-6 py-5 space-y-5">
                    <button onClick={() => setShowPerson(false)} className="lg:hidden inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> All people</button>

                    <div className="flex items-start gap-3.5">
                      <span className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold text-white bg-white/[0.07] ring-1 ring-inset ring-white/[0.08] flex-shrink-0">{initials(person)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-[17px] font-semibold text-white tracking-[-0.01em]">{person.fullName}</h3>
                          <Chip>{roleLabel(person.position)}</Chip>
                        </div>
                        <p className="text-[13px] text-[var(--text-3)] mt-0.5">{[person.position, person.department].filter(Boolean).join(' · ') || 'Role not listed'}</p>
                      </div>
                    </div>

                    <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.06]">
                      <div className="flex items-center gap-3 px-3.5 h-12">
                        <Mail className="w-4 h-4 text-[var(--text-4)] flex-shrink-0" />
                        <span className="text-[13.5px] text-white truncate flex-1 min-w-0">{person.email}</span>
                        <span className="hidden sm:inline text-[11.5px] text-[var(--text-4)] flex-shrink-0" title="How sure the email source is that this address is right">{person.confidence}% sure</span>
                        <button onClick={() => copy('email', person.email, 'Email')} aria-label="Copy email" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06] flex-shrink-0">
                          {copied === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 flex-wrap">
                        {person.linkedin && (
                          <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className="btn-secondary !h-8 !text-[12.5px]"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</a>
                        )}
                        <SaveToContactsButton key={person.email} person={person} company={app.company} applicationId={app.id} />
                      </div>
                    </div>

                    <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-3.5 h-11 border-b border-white/[0.06]">
                        <span className="text-[12.5px] font-medium text-[var(--text-2)] flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-[var(--text-3)]" /> Your note</span>
                        <button onClick={() => copy('note', `${draft.subject}\n\n${draft.body}`, 'Note')} disabled={!draft.body} className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-3)] hover:text-white disabled:opacity-40">
                          {copied === 'note' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Copy
                        </button>
                      </div>
                      <div className="p-3.5 space-y-3">
                        <label className="block">
                          <span className="block text-[11.5px] text-[var(--text-4)] mb-1.5">Subject</span>
                          <input className="field w-full" value={draft.subject} onChange={e => setDraft({ subject: e.target.value })} />
                        </label>
                        <label className="block">
                          <span className="block text-[11.5px] text-[var(--text-4)] mb-1.5">Message</span>
                          <AutoTextarea className="field w-full min-h-[200px] py-2.5 leading-relaxed" value={draft.body}
                            placeholder={person.generatedEmail ? '' : 'A note could not be drafted for this person. Write your own here.'}
                            onChange={e => setDraft({ body: e.target.value })} />
                        </label>
                        <p className="text-[11.5px] text-[var(--text-5)]">Drafted by AI for this role. Read it, make it yours, then send it from your own email.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 px-3.5 py-3 border-t border-white/[0.06]">
                        <button onClick={gmail} disabled={!draft.body.trim()} className="btn-primary !h-9 !text-[13px] flex-1 justify-center">Open in Gmail <ExternalLink className="w-3.5 h-3.5" /></button>
                        <button onClick={mailApp} disabled={!draft.body.trim()} className="btn-secondary !h-9 !text-[13px] flex-1 justify-center"><Mail className="w-3.5 h-3.5" /> Open in email app</button>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}
