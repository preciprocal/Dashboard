'use client';
// components/contacts/ContactsView.tsx
// The Contacts page body: stats, filters, the list (a table on desktop, cards
// on phones) or a pipeline board, plus the drawer and the add/edit modal.
//
// Status, relationship, company and "due" filter on the server; the search
// box filters what came back, so typing never waits on a request.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Contact as ContactIcon, Plus, Search, X, Loader2, List, Columns3, AlertCircle, Database, UserPlus, MessageSquare, BellRing } from 'lucide-react';
import FeatureEmpty from '@/components/ui/feature-empty';
import PageHeader from '@/components/PageHeader';
import { SeeExampleButton } from '@/components/ServiceModal';
import { AppSelect } from '@/components/ui/select';
import {
  CONTACT_STATUSES, RELATIONSHIPS, RELATIONSHIP_LABELS, STATUS_LABELS, isDue, lastContactLabel,
  type Contact, type ContactStats,
} from '@/lib/contacts/model';
import { listContacts, tzOffset, type ContactFilters } from '@/lib/contacts/client';
import { Avatar, FollowUpText, RelationshipText, StatusDot, StatusPill } from './ui';
import ContactDrawer from './ContactDrawer';
import ContactFormModal from './ContactFormModal';
import ContactKpis from './ContactKpis';

type View = 'list' | 'pipeline';

const VIEW_KEY = 'contacts:view';

function matches(c: Contact, q: string) {
  if (!q) return true;
  return [c.name, c.company, c.role, c.email].some(v => v?.toLowerCase().includes(q));
}

export default function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  // Every contact, kept from unfiltered loads, for the figures in the strip.
  const [all, setAll] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  // ?q= from a link elsewhere in the app (a job's "Your contacts at" step).
  useEffect(() => {
    const q0 = new URLSearchParams(window.location.search).get('q');
    if (q0) setSearch(q0.slice(0, 100));
  }, []);
  const [status, setStatus] = useState('');
  const [relationship, setRelationship] = useState('');
  const [company, setCompany] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [view, setView] = useState<View>('list');

  // A snapshot rather than an id into the list: a filter refresh can drop
  // the open contact from the list (say it is no longer due), and the drawer
  // should stay open on it.
  const [openContact, setOpenContact] = useState<Contact | null>(null);
  // Bumped after an edit so the drawer remounts with the saved values (its
  // notes box keeps local state while typing).
  const [drawerVersion, setDrawerVersion] = useState(0);
  const [form, setForm] = useState<{ contact: Contact | null } | null>(null);

  const tz = tzOffset();
  const now = new Date();

  const filters: ContactFilters = useMemo(() => ({ status, relationship, company, due: dueOnly }), [status, relationship, company, dueOnly]);
  const hasFilters = !!(status || relationship || company || dueOnly || search);

  const load = useCallback(async (f: ContactFilters, first: boolean) => {
    if (first) setLoading(true); else setRefreshing(true);
    try {
      const res = await listContacts(f);
      setSetupRequired(!!res.setupRequired);
      setContacts(res.contacts);
      if (!f.status && !f.relationship && !f.company && !f.due) setAll(res.contacts);
      setStats(res.stats);
      setCompanies(res.companies);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load contacts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Only the first load shows the full loading state; filter changes keep
  // the list on screen with a small spinner.
  const loadedOnce = useRef(false);
  useEffect(() => {
    const first = !loadedOnce.current;
    loadedOnce.current = true;
    void load(filters, first);
  }, [filters, load]);

  // The layout choice is a per-viewer convenience; storage can be blocked.
  useEffect(() => {
    try { if (localStorage.getItem(VIEW_KEY) === 'pipeline') setView('pipeline'); } catch { /* private mode */ }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
  };

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => contacts.filter(c => matches(c, q)), [contacts, q]);

  const refresh = () => load(filters, false);

  const onChanged = (c: Contact) => {
    setContacts(list => list.map(x => (x.id === c.id ? c : x)));
    setOpenContact(o => (o && o.id === c.id ? c : o));
    // Counts and ordering depend on the change; reload them quietly.
    void refresh();
  };
  const onDeleted = (id: string) => {
    setOpenContact(null);
    setContacts(list => list.filter(x => x.id !== id));
    void refresh();
  };
  const onSaved = (c: Contact) => {
    const wasEdit = !!form?.contact;
    setForm(null);
    if (wasEdit) { setDrawerVersion(v => v + 1); onChanged(c); }
    else { setContacts(list => [c, ...list]); setOpenContact(c); void refresh(); }
  };

  const clearFilters = () => { setSearch(''); setStatus(''); setRelationship(''); setCompany(''); setDueOnly(false); };

  const due = stats?.due ?? 0;
  const headerDescription = setupRequired
    ? 'Everyone you reach out to, and when to follow up'
    : due > 0
      ? <span><span className="text-amber-300 font-medium">{due} follow-up{due === 1 ? '' : 's'} due</span>{stats && stats.overdue > 0 ? `, ${stats.overdue} overdue` : ''}</span>
      : 'Everyone you reach out to, and when to follow up';

  const isEmpty = !loading && !error && !setupRequired && (stats?.total ?? 0) === 0;

  return (
    <div className="space-y-4 pt-4">
      <PageHeader
        title="Contacts"
        description={headerDescription}
        icon={ContactIcon}
        actions={<><SeeExampleButton serviceId="contacts" /><button onClick={() => setForm({ contact: null })} disabled={setupRequired} className="btn-primary"><Plus /> Add contact</button></>}
      />

      {setupRequired && (
        <div className="glass-card p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--bg-raised)] border border-[var(--border)] flex items-center justify-center flex-shrink-0"><Database className="w-4 h-4 text-slate-300" /></div>
          <div>
            <p className="text-sm font-semibold text-white">Contacts are not set up yet</p>
            <p className="text-[13px] text-slate-400 mt-0.5">This feature is still being switched on. Your job tracker and outreach tools work as usual in the meantime.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0" />
          <p className="text-[13px] text-slate-300 flex-1">{error}</p>
          <button onClick={() => void load(filters, false)} className="btn-secondary !h-9">Retry</button>
        </div>
      )}

      {loading && (
        <div className="glass-card p-10 flex items-center justify-center gap-2 text-[13px] text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading contacts
        </div>
      )}

      {isEmpty && (
        <FeatureEmpty icon={ContactIcon} title="Keep track of everyone you reach out to"
          body="Recruiters, hiring managers, alumni and referrals in one place: where each conversation stands and when to follow up."
          primary={{ label: 'Add a contact', icon: Plus, onClick: () => setForm({ contact: null }) }}
          secondary={<SeeExampleButton serviceId="contacts" />}
          steps={[
            { icon: UserPlus, title: 'Add a contact', text: 'Name, company, role and how you know them.' },
            { icon: MessageSquare, title: 'Log each message', text: 'Every touch is saved, and the next follow-up date is set for you.' },
            { icon: BellRing, title: 'Follow up on time', text: 'See who is due or waiting on a reply, in a list or a pipeline.' },
          ]} />
      )}

      {!loading && !setupRequired && !isEmpty && stats && (
        <>
          <ContactKpis stats={stats} all={all}
            dueActive={dueOnly} onDue={() => { setDueOnly(d => !d); setStatus(''); }}
            waitingActive={status === 'contacted' && !dueOnly} onWaiting={() => { setDueOnly(false); setStatus(s => (s === 'contacted' ? '' : 'contacted')); }} />

          {/* Search and filters */}
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input className="field !pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, company, role or email" aria-label="Search contacts" />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
              <AppSelect aria-label="Status" className="lg:w-40" value={status} onValueChange={setStatus}
                options={[{ value: '', label: 'All statuses' }, ...CONTACT_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }))]} />
              <AppSelect aria-label="Relationship" className="lg:w-40" value={relationship} onValueChange={setRelationship}
                options={[{ value: '', label: 'All relationships' }, ...RELATIONSHIPS.map(r => ({ value: r, label: RELATIONSHIP_LABELS[r] }))]} />
              <AppSelect aria-label="Company" className="lg:w-40" value={company} onValueChange={setCompany}
                options={[{ value: '', label: 'All companies' }, ...companies.map(c => ({ value: c, label: c }))]} />
              <button onClick={() => setDueOnly(d => !d)} aria-pressed={dueOnly} className={`choice ${dueOnly ? 'choice-active' : ''}`}>Due only</button>
            </div>
          </div>

          {/* Result bar */}
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-[13px] text-slate-400 flex items-center gap-2">
              {visible.length} {visible.length === 1 ? 'contact' : 'contacts'}
              {refreshing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {hasFilters && <button onClick={clearFilters} className="text-indigo-300 hover:text-indigo-200">Clear filters</button>}
            </p>
            <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06]" role="group" aria-label="View">
              <button onClick={() => changeView('list')} aria-pressed={view === 'list'} className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium transition-colors ${view === 'list' ? 'bg-white/[0.1] text-white' : 'text-[var(--text-3)] hover:text-white'}`}><List className="w-4 h-4" />List</button>
              <button onClick={() => changeView('pipeline')} aria-pressed={view === 'pipeline'} className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium transition-colors ${view === 'pipeline' ? 'bg-white/[0.1] text-white' : 'text-[var(--text-3)] hover:text-white'}`}><Columns3 className="w-4 h-4" />Pipeline</button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="glass-card px-6 py-10 text-center">
              <p className="text-sm font-medium text-white">No contacts match these filters</p>
              <button onClick={clearFilters} className="btn-secondary mt-4">Clear filters</button>
            </div>
          ) : view === 'list' ? (
            <>
              {/* Desktop table */}
              <div className="glass-card overflow-hidden hidden md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-xs font-medium text-slate-400">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Company</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Relationship</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Last contact</th>
                      <th className="px-4 py-3 font-medium">Next follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(c => {
                      const dueRow = isDue(c, now, tz);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => setOpenContact(c)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenContact(c); } }}
                          tabIndex={0}
                          className={`border-b border-white/[0.04] last:border-0 cursor-pointer transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:bg-white/[0.04] ${dueRow ? 'shadow-[inset_2px_0_0_0_rgb(252,211,77)]' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={c.name} />
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium text-white truncate max-w-[220px]">{c.name}</p>
                                <p className="text-xs text-slate-400 truncate max-w-[220px]">{c.role || RELATIONSHIP_LABELS[c.relationship]}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-slate-300"><span className="block truncate max-w-[180px]">{c.company || '-'}</span></td>
                          <td className="px-4 py-3 hidden lg:table-cell"><RelationshipText relationship={c.relationship} /></td>
                          <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                          <td className="px-4 py-3 text-[13px] text-slate-300 whitespace-nowrap hidden lg:table-cell">{lastContactLabel(c.lastContactedAt, now, tz)}</td>
                          <td className="px-4 py-3"><FollowUpText contact={c} now={now} tz={tz} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phone cards */}
              <div className="md:hidden space-y-2">
                {visible.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setOpenContact(c)}
                    className={`glass-card w-full text-left p-4 transition-colors hover:border-[var(--border-hover)] ${isDue(c, now, tz) ? 'shadow-[inset_2px_0_0_0_rgb(252,211,77)]' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[14px] font-medium text-white truncate">{c.name}</p>
                          <StatusPill status={c.status} />
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{[c.role, c.company].filter(Boolean).join(' at ') || RELATIONSHIP_LABELS[c.relationship]}</p>
                        <div className="flex items-center justify-between gap-2 mt-2.5 text-xs">
                          <span className="text-slate-400">Last: <span className="text-slate-300">{lastContactLabel(c.lastContactedAt, now, tz)}</span></span>
                          <span className="flex items-center gap-1 text-slate-400">Next: <FollowUpText contact={c} now={now} tz={tz} /></span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            /* Pipeline: scrolls sideways inside its own box, never the page. */
            <div className="overflow-x-auto glass-scrollbar -mx-1 px-1 pb-2">
              <div className="flex gap-3 min-w-max">
                {CONTACT_STATUSES.map(s => {
                  const col = visible.filter(c => c.status === s);
                  return (
                    <div key={s} className="w-[260px] flex-shrink-0 rounded-2xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.015] p-2.5">
                      <div className="flex items-center justify-between px-1.5 pb-2.5">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-slate-200"><StatusDot status={s} />{STATUS_LABELS[s]}</span>
                        <span className="text-xs text-slate-400 tabular-nums">{col.length}</span>
                      </div>
                      <div className="space-y-2">
                        {col.length === 0 && <p className="text-xs text-slate-400 px-1.5 py-3">None</p>}
                        {col.map(c => (
                          <button key={c.id} onClick={() => setOpenContact(c)} className="w-full text-left p-3 rounded-xl bg-[var(--bg-surface)] ring-1 ring-inset ring-white/[0.07] hover:ring-white/[0.14] transition-colors">
                            <p className="text-[13px] font-medium text-white truncate">{c.name}</p>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{[c.role, c.company].filter(Boolean).join(' at ') || RELATIONSHIP_LABELS[c.relationship]}</p>
                            {c.status !== 'closed' && c.nextFollowUpAt && <div className="mt-2"><FollowUpText contact={c} now={now} tz={tz} /></div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {openContact && (
        <ContactDrawer
          key={`${openContact.id}-${drawerVersion}`}
          contact={openContact}
          onClose={() => setOpenContact(null)}
          onChange={onChanged}
          onDeleted={onDeleted}
          onEdit={c => setForm({ contact: c })}
        />
      )}
      {form && <ContactFormModal contact={form.contact} onClose={() => setForm(null)} onSaved={onSaved} />}
    </div>
  );
}
