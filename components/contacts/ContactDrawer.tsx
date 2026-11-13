'use client';
// components/contacts/ContactDrawer.tsx
// One contact: details, the follow-up, the timeline, and the two things you
// do most (log what happened, decide when to follow up). A right-hand panel
// on desktop so the list stays visible; full width on phones.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { X, Pencil, Trash2, Send, BookOpen, Loader2, CalendarClock, Briefcase } from 'lucide-react';
import { AppSelect } from '@/components/ui/select';
import { LinkedInIcon, OutlookIcon } from '@/components/icons/BrandIcons';
import {
  CONTACT_STATUSES, FOLLOW_UP_PRESETS, INTERACTION_LABELS, INTERACTION_TYPES, RELATIONSHIP_LABELS, STATUS_LABELS,
  followUpDate, isOutreach, isoToLocalDate, lastContactLabel, localDateToIso, outreachHref,
  type Contact, type ContactInteraction, type ContactStatus, type InteractionType,
} from '@/lib/contacts/model';
import { deleteContact, listInteractions, logInteraction, tzOffset, updateContact } from '@/lib/contacts/client';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Avatar, FollowUpText, InteractionIcon, Overlay } from './ui';

const SOURCE_LABEL: Record<Contact['source'], string> = {
  manual: 'Added by you',
  find_contacts: 'From Find Contacts',
  outreach: 'From Cold Outreach',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-white/[0.06]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Days offered when logging, defaulting to a week for outreach: most
// recruiters answer within a few working days, and a week is the usual point
// where a polite nudge is expected rather than pushy.
const LOG_FOLLOW_UP = [
  { value: '0', label: 'No follow-up' },
  ...FOLLOW_UP_PRESETS.map(p => ({ value: String(p.days), label: `In ${p.label}` })),
];

export default function ContactDrawer({ contact, onClose, onChange, onDeleted, onEdit }: {
  contact: Contact;
  onClose: () => void;
  onChange: (c: Contact) => void;
  onDeleted: (id: string) => void;
  onEdit: (c: Contact) => void;
}) {
  const tz = tzOffset();
  const now = new Date();
  const { confirm, ConfirmDialog } = useConfirm();

  const [interactions, setInteractions] = useState<ContactInteraction[] | null>(null);
  const [timelineError, setTimelineError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState(contact.notes ?? '');

  // Log form
  const [logType, setLogType] = useState<InteractionType>(contact.linkedinUrl && !contact.email ? 'linkedin' : 'email');
  const [logDate, setLogDate] = useState(() => isoToLocalDate(new Date().toISOString(), tz));
  const [logSummary, setLogSummary] = useState('');
  const [logFollow, setLogFollow] = useState('7');

  const loadTimeline = useCallback(async () => {
    setTimelineError('');
    try { setInteractions(await listInteractions(contact.id)); }
    catch (e) { setTimelineError(e instanceof Error ? e.message : 'Could not load the timeline'); setInteractions([]); }
  }, [contact.id]);

  useEffect(() => { void loadTimeline(); }, [loadTimeline]);

  const patch = async (key: string, body: Record<string, unknown>, success?: string) => {
    setBusy(key);
    try {
      const updated = await updateContact(contact.id, body);
      onChange(updated);
      if (success) toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the contact');
    } finally {
      setBusy(null);
    }
  };

  const setFollowUp = (days: number | null) =>
    patch(`follow-${days}`, { nextFollowUpAt: days === null ? null : followUpDate(days, new Date(), tz) },
      days === null ? 'Follow-up cleared' : 'Follow-up set');

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('log');
    try {
      const occurredAt = localDateToIso(logDate, tz);
      // Today's date means "just now", so the timeline orders same-day entries
      // by when they were logged, not all at noon.
      const isToday = logDate === isoToLocalDate(new Date().toISOString(), tz);
      const res = await logInteraction({
        contactId: contact.id,
        type: logType,
        occurredAt: isToday ? undefined : occurredAt,
        summary: logSummary,
        followUpDays: isOutreach(logType) ? Number(logFollow) : undefined,
      });
      onChange(res.contact);
      setInteractions(prev => [res.interaction, ...(prev ?? [])].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)));
      setLogSummary('');
      toast.success('Logged');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log that');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: 'Delete contact?', message: `${contact.name} and their timeline will be removed. This cannot be undone.`, danger: true, confirmLabel: 'Delete' }))) return;
    setBusy('delete');
    try {
      await deleteContact(contact.id);
      toast.success('Contact deleted');
      onDeleted(contact.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete the contact');
      setBusy(null);
    }
  };

  const saveNotes = () => {
    if ((contact.notes ?? '') === notes.trim()) return;
    void patch('notes', { notes }, 'Notes saved');
  };

  return (
    <Overlay onClose={onClose}>
      <div className="fixed inset-0 z-[9000] flex justify-end">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={contact.name}
          className="relative w-full sm:max-w-[460px] h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-[var(--shadow-xl)] animate-fade-in-up"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-start gap-3">
              <Avatar name={contact.name} size="lg" />
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold text-white leading-tight break-words">{contact.name}</h2>
                {(contact.role || contact.company) && (
                  <p className="text-[13px] text-slate-400 mt-0.5 break-words">
                    {contact.role}{contact.role && contact.company ? ' at ' : ''}{contact.company}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit(contact)} aria-label="Edit contact" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"><Pencil className="w-4 h-4" /></button>
                <button onClick={remove} disabled={busy === 'delete'} aria-label="Delete contact" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-raised)] text-[13px] font-medium text-slate-200 hover:border-[var(--border-hover)] hover:text-white transition-colors min-w-0 max-w-full">
                  <OutlookIcon className="w-4 h-4 flex-shrink-0" /><span className="truncate">{contact.email}</span>
                </a>
              )}
              {contact.linkedinUrl && (
                <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 h-9 px-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-raised)] text-[13px] font-medium text-slate-200 hover:border-[var(--border-hover)] hover:text-white transition-colors">
                  <LinkedInIcon className="w-4 h-4" />LinkedIn
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Link href={outreachHref(contact)} className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[var(--r-md)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[13px] font-semibold text-white transition-colors">
                <Send className="w-4 h-4" />Write a message
              </Link>
              <Link href="/templates/outreach" className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-raised)] text-[13px] font-medium text-slate-200 hover:border-[var(--border-hover)] hover:text-white transition-colors">
                <BookOpen className="w-4 h-4" />Templates
              </Link>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto glass-scrollbar">
            {/* Status and details */}
            <Section title="Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-1.5">Status</p>
                  <AppSelect
                    aria-label="Status"
                    className="!h-10"
                    value={contact.status}
                    disabled={busy === 'status'}
                    onValueChange={v => patch('status', { status: v as ContactStatus }, `Moved to ${STATUS_LABELS[v as ContactStatus]}`)}
                    options={CONTACT_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 mb-1.5">Relationship</p>
                  <p className="h-10 flex items-center text-[14px] text-slate-200">{RELATIONSHIP_LABELS[contact.relationship]}</p>
                </div>
              </div>
              <dl className="mt-3 space-y-2 text-[13px]">
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Last contact</dt><dd className="text-slate-200 text-right">{lastContactLabel(contact.lastContactedAt, now, tz)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-400">Source</dt><dd className="text-slate-200 text-right">{SOURCE_LABEL[contact.source]}</dd></div>
                {contact.applicationId && (
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">Application</dt><dd className="text-right"><Link href="/job-tracker" className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200"><Briefcase className="w-3.5 h-3.5" />Job Tracker</Link></dd></div>
                )}
              </dl>
            </Section>

            {/* Follow-up */}
            <Section
              title="Follow-up"
              action={contact.nextFollowUpAt ? <button onClick={() => setFollowUp(null)} disabled={!!busy} className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50">Clear</button> : undefined}
            >
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-slate-400" />
                <FollowUpText contact={contact} now={now} tz={tz} />
                {contact.nextFollowUpAt && contact.status !== 'closed' && <span className="text-xs text-slate-400">{formatDate(contact.nextFollowUpAt)}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {FOLLOW_UP_PRESETS.map(p => (
                  <button key={p.days} onClick={() => setFollowUp(p.days)} disabled={!!busy} className="choice !h-9 !px-3 !text-[13px] disabled:opacity-50">
                    {busy === `follow-${p.days}` ? <Loader2 className="animate-spin" /> : null}{p.label}
                  </button>
                ))}
                <input
                  type="date"
                  aria-label="Pick a follow-up date"
                  className="field !h-9 !w-auto !px-3 !text-[13px] [color-scheme:dark]"
                  value={isoToLocalDate(contact.nextFollowUpAt, tz)}
                  onChange={e => { const iso = localDateToIso(e.target.value, tz); if (iso) void patch('follow-date', { nextFollowUpAt: iso }, 'Follow-up set'); }}
                />
              </div>
            </Section>

            {/* Log interaction */}
            <Section title="Log interaction">
              <form onSubmit={submitLog} className="space-y-3">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type">
                  {INTERACTION_TYPES.map(t => (
                    <button
                      key={t} type="button" role="radio" aria-checked={logType === t}
                      onClick={() => setLogType(t)}
                      className={`choice !h-9 !px-3 !text-[13px] !gap-1.5 ${logType === t ? 'choice-active' : ''}`}
                    >
                      <InteractionIcon type={t} />{INTERACTION_LABELS[t]}
                    </button>
                  ))}
                </div>
                <textarea
                  className="field !min-h-[72px] !text-[13px]"
                  rows={2}
                  value={logSummary}
                  onChange={e => setLogSummary(e.target.value)}
                  maxLength={2000}
                  placeholder={logType === 'note' ? 'Anything worth remembering' : 'What was said, what comes next'}
                  aria-label="Summary"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" aria-label="Date" className="field !h-10 !text-[13px] [color-scheme:dark]" value={logDate} max={isoToLocalDate(new Date().toISOString(), tz)} onChange={e => setLogDate(e.target.value)} />
                  {isOutreach(logType)
                    ? <AppSelect aria-label="Follow up" className="!h-10 !text-[13px]" value={logFollow} onValueChange={setLogFollow} options={LOG_FOLLOW_UP} />
                    : <div />}
                </div>
                <button type="submit" disabled={busy === 'log' || !logDate} className="btn-primary w-full !h-10">
                  {busy === 'log' && <Loader2 className="animate-spin" />}Log {INTERACTION_LABELS[logType].toLowerCase()}
                </button>
              </form>
            </Section>

            {/* Timeline */}
            <Section title="Timeline">
              {interactions === null ? (
                <div className="flex items-center gap-2 text-[13px] text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />Loading</div>
              ) : timelineError ? (
                <p className="text-[13px] text-slate-400">{timelineError} <button onClick={() => void loadTimeline()} className="text-indigo-300 hover:text-indigo-200">Retry</button></p>
              ) : interactions.length === 0 ? (
                <p className="text-[13px] text-slate-400">Nothing logged yet. Log your first message above and the next follow-up is set for you.</p>
              ) : (
                <ol className="relative space-y-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/[0.08]">
                  {interactions.map(i => (
                    <li key={i.id} className="relative flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-[var(--bg-raised)] border border-[var(--border)] text-slate-300 flex items-center justify-center flex-shrink-0 z-[1]">
                        <InteractionIcon type={i.type} />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-[13px] font-medium text-slate-200">{INTERACTION_LABELS[i.type]}</p>
                          <p className="text-xs text-slate-400 flex-shrink-0">{formatDate(i.occurredAt)}</p>
                        </div>
                        {i.summary && <p className="text-[13px] text-slate-300 mt-1 whitespace-pre-wrap break-words leading-relaxed">{i.summary}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            {/* Notes */}
            <section className="px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Notes</h3>
              <textarea
                className="field !text-[13px]"
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                onBlur={saveNotes}
                maxLength={4000}
                placeholder="How you met, mutual connections, what they care about"
                aria-label="Notes"
              />
              <p className="text-xs text-slate-400 mt-1.5">Saved when you click away</p>
            </section>
          </div>
        </aside>
      </div>
      <ConfirmDialog />
    </Overlay>
  );
}
