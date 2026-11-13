'use client';

// components/calendar/InterviewScheduleModal.tsx
// "Add to calendar" for a tracker card in an interview stage: date, time,
// duration, timezone, stage, link and notes. Saves the time on the card and,
// when Google Calendar is connected, writes a real event with reminders.
// Without a connection it still works: the time is saved and the user
// downloads an .ics for Outlook, Apple Calendar or anything else.
//
// Portalled to <body> so a transformed ancestor (the tracker's fade-in
// sections) cannot become the containing block of this fixed overlay.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { CalendarPlus, Download, Loader2, X, AlertTriangle, Trash2, Check } from 'lucide-react';
import { AppSelect } from '@/components/ui/select';
import { GoogleCalendarIcon } from '@/components/icons/BrandIcons';
import { DURATIONS, INTERVIEW_STAGES, resolveSchedule, stageForStatus, cleanMeetingUrl, type InterviewStage } from '@/lib/calendar/events';
import { buildIcs, icsFileName } from '@/lib/calendar/ics';
import { detectTimeZone, listTimeZones, utcToZonedWallTime } from '@/lib/calendar/time';
import { connectHref, type CalendarStatus, type GoogleSyncResult, type InterviewSchedule } from '@/lib/calendar/status';

export interface ScheduleTarget { id: string; company: string; jobTitle: string; status: string }

interface Props {
  app: ScheduleTarget;
  existing: InterviewSchedule | null;
  calendar: CalendarStatus;
  schemaReady: boolean;
  onClose: () => void;
  onSaved: (s: InterviewSchedule) => void;
  onRemoved: (applicationId: string) => void;
  /** Page to come back to after connecting Google. */
  returnTo?: string;
}

function tomorrow(): string {
  const d = new Date(Date.now() + 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const label = 'block text-xs font-medium text-slate-400 mb-1.5';

export default function InterviewScheduleModal({ app, existing, calendar, schemaReady, onClose, onSaved, onRemoved, returnTo = '/job-tracker' }: Props) {
  const initial = useMemo(() => {
    const tz = existing?.timeZone ?? detectTimeZone();
    if (existing) {
      const wall = utcToZonedWallTime(new Date(existing.startsAt), tz);
      const mins = Math.round((new Date(existing.endsAt).getTime() - new Date(existing.startsAt).getTime()) / 60_000);
      return { ...wall, tz, duration: mins, stage: existing.stage as InterviewStage, link: existing.meetingUrl ?? '', notes: existing.notes ?? '' };
    }
    return { date: tomorrow(), time: '10:00', tz, duration: 45, stage: stageForStatus(app.status), link: '', notes: '' };
  }, [existing, app.status]);

  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [tz, setTz] = useState(initial.tz);
  const [duration, setDuration] = useState(initial.duration);
  const [stage, setStage] = useState<InterviewStage>(initial.stage);
  const [link, setLink] = useState(initial.link);
  const [notes, setNotes] = useState(initial.notes);
  const [toGoogle, setToGoogle] = useState(true);
  const [busy, setBusy] = useState<'save' | 'ics' | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const zones = useMemo(() => listTimeZones(tz).map((z) => ({ value: z, label: z.replace(/_/g, ' ') })), [tz]);
  const durationOptions: number[] = (DURATIONS as readonly number[]).includes(duration) ? [...DURATIONS] : [...DURATIONS, duration].sort((a, b) => a - b);

  const linkBad = !!link.trim() && !cleanMeetingUrl(link);
  const resolved = resolveSchedule({
    applicationId: app.id, company: app.company, jobTitle: app.jobTitle,
    wall: { date, time }, timeZone: tz, durationMinutes: duration, stage,
    meetingUrl: cleanMeetingUrl(link), notes: notes.trim() || null,
  });
  const invalid = 'error' in resolved ? resolved.error : linkBad ? 'Meeting link must start with https://' : null;

  const googleReady = calendar.configured && calendar.connected;
  const willGoogle = googleReady && (toGoogle || !!existing?.onGoogle);

  const save = async (google: boolean): Promise<InterviewSchedule | null> => {
    const res = await fetch('/api/job-tracker/schedule', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: app.id, date, time, timeZone: tz, durationMinutes: duration, stage, meetingUrl: link.trim() || null, notes: notes.trim() || null, google }),
    });
    const j = (await res.json().catch(() => ({}))) as { error?: string; schedule?: InterviewSchedule; google?: GoogleSyncResult };
    if (!res.ok || !j.schedule) throw new Error(j.error || 'Could not save the interview time');
    onSaved(j.schedule);
    if (j.google === 'reconnect') toast.warning('Saved on the card. Google Calendar needs reconnecting in Settings, or download an .ics.');
    else if (j.google === 'failed') toast.warning('Saved on the card, but Google Calendar did not accept the event. Try again or download an .ics.');
    return j.schedule;
  };

  const handleSave = async () => {
    if (invalid) return;
    setBusy('save');
    try {
      await save(willGoogle);
      toast.success(willGoogle ? 'Interview added to Google Calendar' : 'Interview time saved');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  const handleIcs = async () => {
    if (invalid || 'error' in resolved) return;
    setBusy('ics');
    try {
      const ics = buildIcs(resolved, window.location.origin, {
        uid: `${app.id}@preciprocal.com`,
        // Higher on every download, so a calendar app replaces the older copy.
        sequence: Math.floor((Date.now() - Date.UTC(2024, 0, 1)) / 1000),
      });
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = icsFileName(app.company);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      // Keep the time on the card too, when there is somewhere to keep it.
      if (schemaReady) {
        try { await save(false); } catch { /* the file is what they asked for */ }
      }
      toast.success('Calendar file downloaded. Open it to add the interview.');
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setBusy('remove');
    try {
      const res = await fetch(`/api/job-tracker/schedule?applicationId=${encodeURIComponent(app.id)}`, { method: 'DELETE' });
      const j = (await res.json().catch(() => ({}))) as { error?: string; google?: GoogleSyncResult };
      if (!res.ok) throw new Error(j.error || 'Could not remove');
      onRemoved(app.id);
      toast.success(j.google === 'deleted' ? 'Removed from the card and Google Calendar' : j.google === 'reconnect' || j.google === 'failed' ? 'Removed from the card. Delete the event in Google Calendar yourself.' : 'Interview time removed');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove');
    } finally {
      setBusy(null);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-[var(--r-2xl)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[0_32px_64px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[var(--r-md)] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
              <CalendarPlus className="w-4 h-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <h2 id="schedule-title" className="text-sm font-semibold text-white">{existing ? 'Edit interview time' : 'Add interview to calendar'}</h2>
              <p className="text-xs text-slate-400 truncate">{app.jobTitle} at {app.company}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={!!busy} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 glass-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="sch-date" className={label}>Date</label><input id="sch-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field [color-scheme:dark]" /></div>
            <div><label htmlFor="sch-time" className={label}>Time</label><input id="sch-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field [color-scheme:dark]" /></div>
          </div>

          <div>
            <span className={label}>Duration</span>
            <div className="grid grid-cols-4 gap-2">
              {durationOptions.slice(0, 5).map((m) => (
                <button key={m} type="button" onClick={() => setDuration(m)} className={`choice !px-2 ${duration === m ? 'choice-active' : ''}`}>{m} min</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><span className={label}>Timezone</span><AppSelect value={tz} onValueChange={setTz} options={zones} aria-label="Timezone" /></div>
            <div><span className={label}>Interview stage</span><AppSelect value={stage} onValueChange={(v) => setStage(v as InterviewStage)} options={INTERVIEW_STAGES} aria-label="Interview stage" /></div>
          </div>

          <div>
            <label htmlFor="sch-link" className={label}>Meeting link <span className="text-slate-500 font-normal">(optional)</span></label>
            <input id="sch-link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://zoom.us/j/..." className="field" />
            {linkBad && <p className="text-xs text-amber-300 mt-1">Use a full link starting with https://</p>}
          </div>

          <div>
            <label htmlFor="sch-notes" className={label}>Notes <span className="text-slate-500 font-normal">(optional)</span></label>
            <textarea id="sch-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Interviewer names, what to bring, dial-in details" className="field" />
          </div>

          {/* Where the event goes */}
          {googleReady ? (
            existing?.onGoogle ? (
              <div className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3">
                <GoogleCalendarIcon className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs text-slate-300">Changes update the event in Google Calendar{calendar.email ? <> ({calendar.email})</> : null}.</p>
              </div>
            ) : (
              <label className="flex items-center gap-2.5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3 cursor-pointer">
                <input type="checkbox" checked={toGoogle} onChange={(e) => setToGoogle(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
                <GoogleCalendarIcon className="w-5 h-5 flex-shrink-0" />
                <span className="text-xs text-slate-300 min-w-0">Add to Google Calendar{calendar.email ? <span className="text-slate-400"> ({calendar.email})</span> : null}</span>
              </label>
            )
          ) : calendar.configured && calendar.broken ? (
            <div className="flex items-start gap-2.5 rounded-[var(--r-md)] border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-amber-200">Google Calendar stopped accepting our access. Reconnect to add events, or download an .ics.</p>
                <a href={connectHref(returnTo)} className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-white hover:text-indigo-200"><GoogleCalendarIcon className="w-4 h-4" /> Reconnect Google Calendar</a>
              </div>
            </div>
          ) : calendar.configured ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-3">
              <p className="text-xs text-slate-400 flex-1">Connect Google Calendar to add this as an event with reminders. No account? Download an .ics below.</p>
              <a href={connectHref(returnTo)} className="btn-secondary !h-9 !text-xs flex-shrink-0"><GoogleCalendarIcon /> Connect Google Calendar</a>
            </div>
          ) : null}

          {invalid && (date && time) && <p className="text-xs text-amber-300">{invalid}</p>}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 px-5 py-4 border-t border-[var(--border)] flex-shrink-0">
          {existing && (
            <button type="button" onClick={handleRemove} disabled={!!busy}
              className={`inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-[var(--r-md)] text-xs font-semibold transition-colors sm:mr-auto ${confirmRemove ? 'text-red-300 bg-red-500/10 border border-red-500/30' : 'text-slate-400 hover:text-red-300 border border-transparent'}`}>
              {busy === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {confirmRemove ? (existing.onGoogle ? 'Remove from card and Google' : 'Confirm remove') : 'Remove'}
            </button>
          )}
          <button type="button" onClick={handleIcs} disabled={!!busy || !!invalid} className={`btn-secondary ${existing ? '' : 'sm:mr-auto'} disabled:opacity-45 disabled:cursor-not-allowed`}>
            {busy === 'ics' ? <Loader2 className="animate-spin" /> : <Download />} Download .ics
          </button>
          {schemaReady && (
            <button type="button" onClick={handleSave} disabled={!!busy || !!invalid} className="btn-primary">
              {busy === 'save' ? <Loader2 className="animate-spin" /> : willGoogle ? <CalendarPlus /> : <Check />}
              {willGoogle ? (existing?.onGoogle ? 'Update event' : 'Add to Google Calendar') : 'Save time'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
