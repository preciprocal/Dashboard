'use client';

// components/calendar/useInterviewSchedules.ts
// The tracker's scheduled interviews and the Google Calendar status, from
// /api/job-tracker/schedule. Fails quiet: without it the cards simply show
// no times, and the .ics download still works.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { callbackMessage, NOT_CONFIGURED, type CalendarStatus, type InterviewSchedule } from '@/lib/calendar/status';

export interface SchedulesState {
  schedules: Record<string, InterviewSchedule>;
  calendar: CalendarStatus;
  /** Migration 0063 applied, so times can be saved. */
  schemaReady: boolean;
  loaded: boolean;
  reload: () => Promise<void>;
  setOne: (s: InterviewSchedule) => void;
  removeOne: (applicationId: string) => void;
}

export function useInterviewSchedules(enabled: boolean): SchedulesState {
  const [schedules, setSchedules] = useState<Record<string, InterviewSchedule>>({});
  const [calendar, setCalendar] = useState<CalendarStatus>(NOT_CONFIGURED);
  const [schemaReady, setSchemaReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/job-tracker/schedule');
      if (!r.ok) return;
      const j = (await r.json()) as { schemaReady?: boolean; schedules?: InterviewSchedule[]; calendar?: CalendarStatus };
      setSchemaReady(!!j.schemaReady);
      setCalendar(j.calendar ?? NOT_CONFIGURED);
      setSchedules(Object.fromEntries((j.schedules ?? []).map((s) => [s.applicationId, s])));
    } catch {
      /* optional */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);

  // Connecting from the schedule modal comes back to the tracker with
  // ?calendar=<result>. Say what happened once, then drop the parameter.
  useEffect(() => {
    const url = new URL(window.location.href);
    const msg = callbackMessage(url.searchParams.get('calendar'));
    if (!msg) return;
    if (msg.ok) toast.success(`${msg.text}. Add an interview time from any interview-stage card.`); else toast.error(msg.text);
    url.searchParams.delete('calendar');
    window.history.replaceState(null, '', url.toString());
  }, []);

  const setOne = useCallback((s: InterviewSchedule) => setSchedules((p) => ({ ...p, [s.applicationId]: s })), []);
  const removeOne = useCallback((id: string) => setSchedules((p) => {
    const next = { ...p };
    delete next[id];
    return next;
  }), []);

  return { schedules, calendar, schemaReady, loaded, reload, setOne, removeOne };
}
