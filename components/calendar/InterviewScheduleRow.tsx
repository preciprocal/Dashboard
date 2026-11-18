'use client';

// components/calendar/InterviewScheduleRow.tsx
// The calendar line on a tracker card in an interview stage: "Add to
// calendar" before a time is set, the time (in the viewer's own zone) after.

import { CalendarPlus, Clock, Pencil } from 'lucide-react';
import { ProviderIcon } from '@/components/calendar/GoogleCalendarSettings';
import { formatScheduled } from '@/lib/calendar/time';
import { stageLabel } from '@/lib/calendar/events';
import type { InterviewSchedule } from '@/lib/calendar/status';

export default function InterviewScheduleRow({ schedule, onOpen }: { schedule: InterviewSchedule | null; onOpen: () => void }) {
  if (!schedule) {
    return (
      <button type="button" onClick={onOpen}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-[var(--accent-subtle)] border border-[var(--accent-border)] hover:text-white hover:bg-indigo-500/20 transition-colors">
        <CalendarPlus className="w-3.5 h-3.5" /> Add to calendar
      </button>
    );
  }
  const start = new Date(schedule.startsAt);
  const past = new Date(schedule.endsAt).getTime() < Date.now();
  return (
    <button type="button" onClick={onOpen} title={`${stageLabel(schedule.stage)}, set in ${schedule.timeZone.replace(/_/g, ' ')}. Click to edit.`}
      className="group/sch w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left border border-[var(--border)] bg-[var(--bg-subtle)] hover:border-[var(--border-hover)] transition-colors">
      {schedule.onCalendar || schedule.onGoogle ? <ProviderIcon provider={schedule.onCalendar ?? 'google'} className="w-4 h-4 flex-shrink-0" /> : <Clock className="w-3.5 h-3.5 text-[var(--text-3)] flex-shrink-0" />}
      <span className={`flex-1 min-w-0 truncate text-xs font-semibold ${past ? 'text-slate-400' : 'text-white'}`}>
        {past ? 'Was ' : ''}{formatScheduled(start)}
      </span>
      <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover/sch:text-white flex-shrink-0" aria-label="Edit interview time" />
    </button>
  );
}
