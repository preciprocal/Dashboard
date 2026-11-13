// lib/calendar/time.ts
// Wall-clock time in a named timezone to a real instant, and back.
//
// The scheduling modal asks for "Nov 20, 2:00 PM, America/New_York", which is
// what the recruiter's email says. Neither the browser's Date nor the server's
// knows that zone's offset on that day, so it is read from Intl: format a
// guess in the target zone, see how far off the wall clock is, correct, and
// repeat once more for the DST edge. Pure and isomorphic: the modal and the
// API route both call it, so the card and the calendar event never disagree.

export interface WallTime {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The parts of an instant as a wall clock in `tz`, as if that wall clock were UTC. */
function wallClockAsUtcMs(instantMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}

/**
 * The instant at which the clock in `tz` reads `wall`. Returns null for input
 * that is not a real date or time. A wall time skipped by a DST jump (2:30 AM
 * on spring-forward day) resolves to the instant just after the gap, which is
 * what a person typing it would mean.
 */
export function zonedWallTimeToUtc(wall: WallTime, tz: string): Date | null {
  const d = DATE_RE.exec(wall.date);
  const t = TIME_RE.exec(wall.time);
  if (!d || !t || !isValidTimeZone(tz)) return null;
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const target = Date.UTC(y, mo - 1, da, Number(t[1]), Number(t[2]));
  // Reject 2026-02-31 and friends rather than rolling into March.
  const check = new Date(target);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== da) return null;

  let guess = target;
  for (let i = 0; i < 3; i++) {
    const diff = wallClockAsUtcMs(guess, tz) - target;
    if (diff === 0) break;
    guess -= diff;
  }
  return new Date(guess);
}

/** The wall clock in `tz` at `instant`, for prefilling the edit form. */
export function utcToZonedWallTime(instant: Date, tz: string): WallTime {
  const ms = wallClockAsUtcMs(instant.getTime(), tz);
  const iso = new Date(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** The browser's zone, or UTC when the runtime cannot say. */
export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every zone the runtime knows, with `ensure` included even if it is missing. */
export function listTimeZones(ensure?: string): string[] {
  let zones: string[] = [];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    zones = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : [];
  } catch { /* old runtime */ }
  if (!zones.length) {
    zones = ['UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
      'America/Toronto', 'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
      'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
  }
  if (!zones.includes('UTC')) zones = ['UTC', ...zones];
  if (ensure && !zones.includes(ensure)) zones = [ensure, ...zones];
  return zones;
}

/** "Thu, Nov 20, 2:00 PM" in the viewer's own zone, for the card. */
export function formatScheduled(instant: Date, tz?: string): string {
  return instant.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    ...(tz ? { timeZone: tz } : {}),
  });
}
