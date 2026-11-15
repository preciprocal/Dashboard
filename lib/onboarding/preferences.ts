// lib/onboarding/preferences.ts
//
// What a student is looking for, set once at onboarding (app/onboarding) and
// editable later. Stored in profiles.extended_data.jobPreferences, next to
// the Auto-apply details it shares a profile with. Jobs and the Overview use
// it as their default filters, so the feed opens on the roles that fit.

import type { JobFamily, JobLevel } from '@/lib/jobs/feed';

export interface JobPreferences {
  /** Areas of work, as the job feed groups them. */
  families: JobFamily[];
  /** Free-text role, e.g. "Data analyst". Optional. */
  role: string;
  levels: JobLevel[];
  /** City or state, or '' for anywhere in the US. */
  location: string;
  remote: boolean;
  /** Only employers enrolled in E-Verify (needed for a STEM OPT extension). */
  everifyOnly: boolean;
  /** Only employers with H-1B approvals on record. */
  h1bOnly: boolean;
  /** When onboarding was finished. */
  completedAt: string | null;
}

export const DEFAULT_PREFERENCES: JobPreferences = {
  families: [], role: '', levels: ['intern', 'early'], location: '', remote: false,
  everifyOnly: false, h1bOnly: false, completedAt: null,
};

export const FAMILY_OPTIONS: { id: JobFamily; label: string; hint: string }[] = [
  { id: 'software', label: 'Software engineering', hint: 'Backend, frontend, mobile, ML engineering' },
  { id: 'data', label: 'Data and AI', hint: 'Data analyst, data scientist, ML, BI' },
  { id: 'product', label: 'Product and design', hint: 'Product manager, UX, research' },
  { id: 'business', label: 'Business and finance', hint: 'Consulting, operations, finance, marketing' },
  { id: 'hardware', label: 'Hardware', hint: 'Electrical, embedded, mechanical' },
  { id: 'other', label: 'Something else', hint: 'Anything not listed' },
];

export const LEVEL_OPTIONS: { id: JobLevel; label: string; hint: string }[] = [
  { id: 'intern', label: 'Internship', hint: 'Summer, co-op or CPT' },
  { id: 'early', label: 'Entry level', hint: 'New grad, OPT, 0 to 2 years' },
  { id: 'mid', label: 'Mid level', hint: '2 to 5 years' },
  { id: 'senior', label: 'Senior', hint: '5+ years' },
];

/**
 * Work status options. Picking one suggests answers to the two questions
 * application forms ask, but the student confirms both: nothing is assumed.
 */
export const STATUS_OPTIONS: { id: string; label: string; visaType: string; suggest: { authorized: 'Yes' | 'No'; sponsorship: boolean } | null }[] = [
  { id: 'f1-cpt', label: 'F-1 student (CPT)', visaType: 'CPT', suggest: { authorized: 'Yes', sponsorship: true } },
  { id: 'f1-opt', label: 'F-1 OPT', visaType: 'OPT / STEM OPT', suggest: { authorized: 'Yes', sponsorship: true } },
  { id: 'f1-stem', label: 'F-1 STEM OPT', visaType: 'OPT / STEM OPT', suggest: { authorized: 'Yes', sponsorship: true } },
  { id: 'f1-none', label: 'F-1 student, no work authorization yet', visaType: 'Other Work Visa', suggest: { authorized: 'No', sponsorship: true } },
  { id: 'h1b', label: 'H-1B', visaType: 'H-1B Visa', suggest: { authorized: 'Yes', sponsorship: true } },
  { id: 'h4', label: 'H-4 EAD', visaType: 'H-4 EAD', suggest: { authorized: 'Yes', sponsorship: false } },
  { id: 'gc', label: 'Green card holder', visaType: 'Permanent Resident (Green Card)', suggest: { authorized: 'Yes', sponsorship: false } },
  { id: 'citizen', label: 'US citizen', visaType: 'US Citizen', suggest: { authorized: 'Yes', sponsorship: false } },
  { id: 'other', label: 'Other', visaType: 'Other Work Visa', suggest: null },
];

const FAMILIES = FAMILY_OPTIONS.map(f => f.id);
const LEVELS = LEVEL_OPTIONS.map(l => l.id);

/** A clean copy of whatever was stored, with defaults for anything missing. */
export function readPreferences(raw: unknown): JobPreferences {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof JobPreferences, unknown>>;
  const list = <T extends string>(v: unknown, allowed: T[]) => (Array.isArray(v) ? v.filter((x): x is T => allowed.includes(x as T)) : []);
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const levels = list(r.levels, LEVELS);
  return {
    families: list(r.families, FAMILIES),
    role: str(r.role, 80),
    levels: levels.length ? levels : DEFAULT_PREFERENCES.levels,
    location: str(r.location, 60),
    remote: r.remote === true,
    everifyOnly: r.everifyOnly === true,
    h1bOnly: r.h1bOnly === true,
    completedAt: typeof r.completedAt === 'string' ? r.completedAt : null,
  };
}

/** The job feed query (app/api/jobs) these preferences stand for. */
export function feedQuery(p: JobPreferences, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  if (p.levels.length) q.set('levels', p.levels.join(','));
  if (p.families.length) q.set('families', p.families.join(','));
  if (p.location) q.set('location', p.location);
  // With a city, open to remote means that city or remote; without one, any US location already includes remote.
  if (p.remote && p.location) q.set('orRemote', '1');
  if (p.everifyOnly) q.set('everify', '1');
  if (p.h1bOnly) q.set('h1b', '1');
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}
