'use client';

// components/calendar/UpcomingInterviews.tsx
// The next two weeks of scheduled interviews, each with a way to prepare.
// Renders nothing when there are none, so the tracker stays as it was for
// anyone who never schedules one.
//
// When Google Calendar is connected the times have already been checked
// against Google (the schedule API follows events the user moved or deleted
// there), so this strip reflects the calendar, not just what was typed here.

import Link from 'next/link';
import { CalendarClock, Mic, Video } from 'lucide-react';
import { GoogleCalendarIcon } from '@/components/icons/BrandIcons';
import { stageLabel } from '@/lib/calendar/events';
import { upcomingWithin, type InterviewSchedule } from '@/lib/calendar/status';

export const UPCOMING_DAYS = 14;

interface AppLite { id: string; company: string; jobTitle: string }

function dayLabel(d: Date): string {
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(today)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function UpcomingInterviews({ schedules, apps, onOpen }: { schedules: InterviewSchedule[]; apps: AppLite[]; onOpen?: (applicationId: string) => void }) {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const items = upcomingWithin(schedules, UPCOMING_DAYS).filter((s) => byId.has(s.applicationId)).slice(0, 4);
  if (!items.length) return null;

  return (
    <section className="glass-card p-4" aria-labelledby="upcoming-interviews">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-indigo-300" />
        <h2 id="upcoming-interviews" className="text-sm font-semibold text-white">Upcoming interviews</h2>
        <span className="text-xs text-slate-400">next {UPCOMING_DAYS} days</span>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((s) => {
          const app = byId.get(s.applicationId)!;
          const start = new Date(s.startsAt);
          return (
            <li key={s.applicationId} className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 min-w-0">
              <button type="button" onClick={() => onOpen?.(s.applicationId)} className="flex-shrink-0 w-[72px] text-left" title="Edit interview time">
                <p className="text-xs font-semibold text-indigo-300">{dayLabel(start)}</p>
                <p className="text-xs text-slate-300 tabular-nums">{start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{app.jobTitle} at {app.company}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                  {s.onGoogle && <GoogleCalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                  {stageLabel(s.stage)}
                  {s.meetingUrl && (
                    <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-300 hover:text-white"><Video className="w-3 h-3" /> Join</a>
                  )}
                </p>
              </div>
              {/* Icon-only on a phone so the role keeps its width. */}
              <Link href={`/interview/create?application=${s.applicationId}`} aria-label={`Prepare for ${app.company}`} className="flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-[var(--r-md)] text-xs font-semibold text-[var(--on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors">
                <Mic className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Prepare</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
