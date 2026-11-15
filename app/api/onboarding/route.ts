// app/api/onboarding/route.ts
//
// GET  -> { preferences, completed, isNew, profile, resume }
// POST { preferences?, workAuthorization?, requireSponsorship?, visaType?, details?, complete? } -> { success }
//
// The onboarding flow (app/onboarding) reads what is already known and saves
// each step into the same profile Auto-apply and the extension read: job
// preferences, the two work-authorization answers, and the contact,
// education and skills details confirmed from the resume.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';
import { redis } from '@/lib/redis/redis-client';
import { readPreferences } from '@/lib/onboarding/preferences';
import { LEGACY_DEFAULTS, SENSITIVE_ANSWERS_VERSION, SENSITIVE_KEYS, sensitiveValue } from '@/lib/config/sensitive-answers';

/** Accounts created from this date go through onboarding on first visit. */
const ONBOARDING_LAUNCH = Date.parse('2026-11-15T00:00:00Z');

type Ext = Record<string, unknown>;

async function load(uid: string) {
  const { data } = await supabaseAdmin.from('profiles')
    .select('name, phone, city, state, linked_in, github, website, target_role, resume_path, resume_file_name, extended_data, created_at')
    .eq('user_id', uid).maybeSingle();
  return data;
}

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const p = await load(user.supabaseUserId);
  if (!p) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const ext = (p.extended_data as Ext | null) ?? {};
  const prefs = readPreferences(ext.jobPreferences);
  return NextResponse.json({
    preferences: prefs,
    completed: !!prefs.completedAt,
    isNew: Date.parse(p.created_at as string) >= ONBOARDING_LAUNCH,
    profile: {
      name: (p.name as string) ?? '',
      phone: (p.phone as string) ?? '',
      city: (p.city as string) ?? '',
      state: (p.state as string) ?? '',
      linkedIn: (p.linked_in as string) || (ext.linkedInUrl as string) || '',
      github: (p.github as string) || (ext.githubUrl as string) || '',
      website: (p.website as string) || (ext.portfolioUrl as string) || '',
      headline: (ext.headline as string) || (p.target_role as string) || '',
      skills: (ext.skills as string) ?? '',
      education: Array.isArray(ext.education) ? ext.education : [],
      workAuthorization: sensitiveValue(ext, 'workAuthorization'),
      requireSponsorship: sensitiveValue(ext, 'requireSponsorship'),
      visaType: (ext.visaType as string) ?? '',
    },
    resume: p.resume_path ? { fileName: (p.resume_file_name as string) || 'Resume.pdf' } : null,
  });
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);

interface EducationIn { school?: unknown; degree?: unknown; field?: unknown; gpa?: unknown; year?: unknown; current?: unknown }

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const p = await load(user.supabaseUserId);
  if (!p) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const ext: Ext = { ...((p.extended_data as Ext | null) ?? {}) };
  const columns: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.preferences !== undefined) {
    const prev = readPreferences(ext.jobPreferences);
    const next = readPreferences({ ...(body.preferences as object), completedAt: prev.completedAt });
    if (body.complete === true && !next.completedAt) next.completedAt = new Date().toISOString();
    ext.jobPreferences = next;
    if (next.role) { ext.headline ||= next.role; columns.target_role = next.role; }
  } else if (body.complete === true) {
    const prev = readPreferences(ext.jobPreferences);
    ext.jobPreferences = { ...prev, completedAt: prev.completedAt ?? new Date().toISOString() };
  }

  // The two work-authorization answers, chosen by the student in onboarding.
  // Marking answers as chosen (version 2) would also confirm any old form
  // default still stored for another question, so those, which already count
  // as not set, are cleared first.
  const auth = body.workAuthorization === 'Yes' || body.workAuthorization === 'No' ? body.workAuthorization : undefined;
  const sponsor = typeof body.requireSponsorship === 'boolean' ? body.requireSponsorship : undefined;
  if (auth !== undefined || sponsor !== undefined) {
    if (Number(ext.sensitiveAnswersVersion) < SENSITIVE_ANSWERS_VERSION || ext.sensitiveAnswersVersion === undefined) {
      for (const key of SENSITIVE_KEYS) if (ext[key] === LEGACY_DEFAULTS[key]) delete ext[key];
      ext.sensitiveAnswersVersion = SENSITIVE_ANSWERS_VERSION;
    }
    if (auth !== undefined) ext.workAuthorization = auth;
    if (sponsor !== undefined) ext.requireSponsorship = sponsor;
  }
  const visa = str(body.visaType, 60);
  if (visa !== undefined) ext.visaType = visa;

  // Details confirmed from the resume.
  const d = body.details as Record<string, unknown> | undefined;
  if (d && typeof d === 'object') {
    const set = (col: string, v: string | undefined) => { if (v !== undefined) columns[col] = v; };
    set('name', str(d.name, 120));
    set('phone', str(d.phone, 40));
    set('city', str(d.city, 80));
    set('state', str(d.state, 80));
    const linkedIn = str(d.linkedIn, 300), github = str(d.github, 300), website = str(d.website, 300);
    set('linked_in', linkedIn); set('github', github); set('website', website);
    if (linkedIn !== undefined) ext.linkedInUrl = linkedIn;
    if (github !== undefined) ext.githubUrl = github;
    if (website !== undefined) ext.portfolioUrl = website;
    const headline = str(d.headline, 120); if (headline !== undefined) ext.headline = headline;
    const skills = str(d.skills, 1000); if (skills !== undefined) ext.skills = skills;
    if (Array.isArray(d.education)) {
      ext.education = (d.education as EducationIn[]).slice(0, 4).map(e => ({
        school: str(e.school, 160) ?? '', degree: str(e.degree, 120) ?? '', field: str(e.field, 120) ?? '',
        gpa: str(e.gpa, 10) ?? '', year: str(e.year, 10) ?? '', current: e.current === true,
      })).filter(e => e.school);
    }
  }

  columns.extended_data = ext;
  const { error } = await supabaseAdmin.from('profiles').update(columns).eq('user_id', user.supabaseUserId);
  if (error) {
    console.error('❌ onboarding save:', error);
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  }
  if (redis) await redis.del(`profile-complete:${user.userId}`).catch(() => {});
  return NextResponse.json({ success: true });
}
