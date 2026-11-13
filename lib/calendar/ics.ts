// lib/calendar/ics.ts
// An RFC 5545 iCalendar file for one interview, for people who have not
// connected Google Calendar (or use Outlook or Apple Calendar).
//
// Times are written in UTC (the trailing Z), which RFC 5545 allows without a
// VTIMEZONE block; every calendar app converts them to the viewer's zone.
// Text is escaped (backslash, semicolon, comma, newline) and lines are folded
// at 75 octets, counting UTF-8 bytes rather than characters so a company name
// with an accent cannot push a line over the limit.

import { eventTitle, eventDescription, trackerUrl, type ResolvedSchedule } from './events';

/** RFC 5545 3.3.11 TEXT escaping. */
export function escapeIcsText(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** 20261120T190000Z */
export function icsDateTime(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * RFC 5545 3.1: lines longer than 75 octets are split with CRLF followed by a
 * single space. Never splits inside a UTF-8 sequence or a surrogate pair.
 */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    // The first line holds 75 octets; continuation lines lose one to the leading space.
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + n > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export interface IcsOptions {
  /** Stable per application, so re-downloading updates the same event instead of duplicating it. */
  uid: string;
  /** Bumped on every download so the newer file wins in calendar apps. */
  sequence?: number;
  now?: Date;
}

export function buildIcs(s: ResolvedSchedule, appUrl: string, opts: IcsOptions): string {
  const now = opts.now ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Preciprocal//Interview Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `SEQUENCE:${opts.sequence ?? 0}`,
    `DTSTAMP:${icsDateTime(now)}`,
    `DTSTART:${icsDateTime(s.start)}`,
    `DTEND:${icsDateTime(s.end)}`,
    `SUMMARY:${escapeIcsText(eventTitle(s.jobTitle, s.company))}`,
    `DESCRIPTION:${escapeIcsText(eventDescription(s, appUrl))}`,
    ...(s.meetingUrl ? [`LOCATION:${escapeIcsText(s.meetingUrl)}`] : []),
    // URI values are not TEXT, so they are not backslash-escaped.
    `URL:${s.meetingUrl ?? trackerUrl(appUrl, s.applicationId)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(eventTitle(s.jobTitle, s.company))}`,
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function icsFileName(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `interview-${slug || 'preciprocal'}.ics`;
}
