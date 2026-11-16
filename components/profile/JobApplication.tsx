'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import { sensitiveValue, SENSITIVE_ANSWERS_VERSION } from '@/lib/config/sensitive-answers';
import { AppSelect } from '@/components/ui/select';
import AutoTextarea from '@/components/ui/auto-textarea';
import { fetchDefaultResumeInfo } from '@/lib/resume/default-client';
import type { DefaultResumeInfo } from '@/lib/resume/default-resume';
import { AlertCircle, Plus, FileBadge, Loader2 } from 'lucide-react';
import { FormSection, Field, SwitchRow, SectionRail, SaveBar, type RailItem } from '@/components/profile/FormKit';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EducationEntry {
  school: string; degree: string; field: string;
  gpa: string; year: string; current: boolean;
}
interface ExperienceEntry {
  company: string; title: string; startDate: string;
  endDate: string; current: boolean; description: string;
}
interface JobAppProfile {
  phone: string; streetAddress: string; city: string; state: string;
  zipCode: string; country: string;
  headline: string; yearsOfExperience: string; summary: string; skills: string;
  linkedInUrl: string; githubUrl: string; portfolioUrl: string;
  desiredSalary: string; salaryType: string; noticePeriod: string;
  workType: string; employmentType: string; willingToRelocate: boolean;
  // null / '' = not set: autofill leaves that question for the user.
  openToTravel: string; workAuthorization: string; requireSponsorship: boolean | null;
  visaType: string; education: EducationEntry[]; experience: ExperienceEntry[];
  gender: string; pronouns: string; race: string;
  veteranStatus: string; disabilityStatus: string;
  howDidYouHear: string; driverLicense: boolean | null; backgroundCheck: boolean | null;
  drugTest: boolean | null; over18: boolean | null; currentlyEmployed: boolean;
  reasonForLeaving: string; criminalRecord: boolean | null;
  languages: string; certifications: string;
  coverLetterIntro: string; coverLetterBody: string;
  preferredLocations: string[];
}

const DEFAULT_EDU: EducationEntry  = { school:'', degree:'', field:'', gpa:'', year:'', current:false };
const DEFAULT_EXP: ExperienceEntry = { company:'', title:'', startDate:'', endDate:'', current:false, description:'' };
const DEFAULT_PROFILE: JobAppProfile = {
  phone:'', streetAddress:'', city:'', state:'', zipCode:'', country:'United States',
  headline:'', yearsOfExperience:'', summary:'', skills:'',
  linkedInUrl:'', githubUrl:'', portfolioUrl:'',
  desiredSalary:'', salaryType:'yearly', noticePeriod:'2 weeks',
  workType:'Remote', employmentType:'Full-time',
  willingToRelocate:false, openToTravel:'No',
  // Sensitive answers start unset. They used to default to "Yes" / "not a
  // veteran" / "no disability" and were saved as if the user had said so.
  workAuthorization:'', requireSponsorship:null, visaType:'',
  education:[{...DEFAULT_EDU}], experience:[{...DEFAULT_EXP}],
  gender:'', pronouns:'', race:'',
  veteranStatus:'', disabilityStatus:'',
  howDidYouHear:'LinkedIn', driverLicense:null, backgroundCheck:null,
  drugTest:null, over18:null, currentlyEmployed:false,
  reasonForLeaving:'', criminalRecord:null, languages:'English', certifications:'',
  coverLetterIntro:'', coverLetterBody:'', preferredLocations:[],
};

// ─── Completion meter ─────────────────────────────────────────────────────────

function useCompletionScore(p: JobAppProfile) {
  return useMemo(() => {
    const checks = [
      !!p.phone,
      !!p.city,
      !!p.state,
      !!p.zipCode,
      !!p.headline,
      !!p.yearsOfExperience,
      !!p.summary?.trim(),
      !!p.skills?.trim(),
      !!p.linkedInUrl,
      !!p.desiredSalary,
      p.workAuthorization === 'Yes' || p.workAuthorization === 'No',
      p.education.some(e => e.school && e.degree),
      p.experience.some(e => e.company && e.title),
    ];
    const filled  = checks.filter(Boolean).length;
    const total   = checks.length;
    const pct     = Math.round((filled / total) * 100);
    return { filled, total, pct };
  }, [p]);
}

// ─── Custom Dropdown ──────────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string; }

function CustomDropdown({
  value, onChange, options, placeholder = 'Select…'
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
}) {
  // A saved value that is no longer in the list still shows, as before.
  const list = value && !options.some(o => o.value === value) ? [...options, { value, label: value }] : options;
  return <AppSelect value={value} onValueChange={onChange} options={list} placeholder={placeholder} className="w-full" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOT_SET_LABEL = 'Not set: I will answer myself';
function opts(arr: string[]): DropdownOption[] {
  return arr.map(v => ({ value: v, label: v || NOT_SET_LABEL }));
}
function optsKV(arr: [string, string][]): DropdownOption[] {
  return arr.map(([v, l]) => ({ value: v, label: l }));
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const fieldCls = "field"; // shared size and style, globals.css .field

function F({ label, hint, span, children }: {
  label: string; hint?: string; span?: string; children: React.ReactNode;
}) {
  return <Field label={label} hint={hint} span={span}>{children}</Field>;
}

function FInput({ label, hint, span, value, onChange, placeholder, type = 'text', disabled }: {
  label: string; hint?: string; span?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <F label={label} hint={hint} span={span}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} className={fieldCls + ' disabled:opacity-50'} />
    </F>
  );
}

function FSelect({ label, hint, span, value, onChange, options }: {
  label: string; hint?: string; span?: string; value: string;
  onChange: (v: string) => void; options: DropdownOption[];
}) {
  return (
    <F label={label} hint={hint} span={span}>
      <CustomDropdown value={value} onChange={onChange} options={options} />
    </F>
  );
}

function FTextarea({ label, hint, span, value, onChange, placeholder, rows = 3 }: {
  label: string; hint?: string; span?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <F label={label} hint={hint} span={span}>
      <AutoTextarea value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows} className={fieldCls} />
    </F>
  );
}

/** Yes / No / Not set, for questions autofill must never assume. */
function FTri({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const opt = (v: boolean | null, text: string) => {
    const on = value === v;
    return (
      <button type="button" aria-pressed={on} onClick={() => onChange(v)}
        className={`flex-1 h-8 rounded-md text-[12.5px] font-medium transition-colors ${on ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`}>
        {text}
      </button>
    );
  };
  return (
    <F label={label}>
      <div role="group" aria-label={label} className="flex gap-1 p-1 rounded-[var(--r-md)] ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
        {opt(null, 'Not set')}{opt(true, 'Yes')}{opt(false, 'No')}
      </div>
    </F>
  );
}

function FToggle({ value, onChange, label, desc }: {
  value: boolean; onChange: (v: boolean) => void; label: string; desc?: string;
}) {
  return <SwitchRow value={value} onChange={onChange} label={label} desc={desc} />;
}

// ─── Salary field ─────────────────────────────────────────────────────────────

function SalaryField({ salary, salaryType, onSalary, onType }: {
  salary: string; salaryType: string;
  onSalary: (v: string) => void; onType: (v: string) => void;
}) {
  return (
    <F label="Desired Salary">
      <div className="flex gap-2">
        <input value={salary} onChange={e => onSalary(e.target.value)}
          placeholder="120000" className={fieldCls + ' flex-1'} />
        <div className="w-24 flex-shrink-0">
          <CustomDropdown
            value={salaryType}
            onChange={onType}
            options={[{ value: 'yearly', label: '/ yr' }, { value: 'hourly', label: '/ hr' }]}
          />
        </div>
      </div>
    </F>
  );
}

// ─── Location picker ──────────────────────────────────────────────────────────

const PREFERRED_LOCS = [
  'Remote','New York, NY','San Francisco, CA','Los Angeles, CA','Seattle, WA',
  'Boston, MA','Chicago, IL','Austin, TX','Denver, CO','Atlanta, GA',
  'Washington, DC','Miami, FL','San Diego, CA','Portland, OR','Dallas, TX',
  'Houston, TX','Phoenix, AZ','Minneapolis, MN','Philadelphia, PA','Detroit, MI',
  'San Jose, CA','Oakland, CA','Raleigh, NC','Charlotte, NC','Nashville, TN',
  'Salt Lake City, UT','Las Vegas, NV','Pittsburgh, PA','Columbus, OH','Indianapolis, IN',
];

function LocationPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (loc: string) =>
    onChange(value.includes(loc) ? value.filter(l => l !== loc) : [...value, loc]);
  return (
    <F label="Preferred locations" hint="for office location questions">
      <div className="flex flex-wrap gap-2 mt-1">
        {PREFERRED_LOCS.map(loc => {
          const active = value.includes(loc);
          return (
            <button
              key={loc}
              type="button"
              onClick={() => toggle(loc)}
              aria-pressed={active}
              className={`h-8 px-3 rounded-full text-[12.5px] font-medium transition-colors
                ${active
                  ? 'bg-white/[0.1] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                  : 'text-[var(--text-4)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] hover:text-[var(--text-1)] hover:bg-white/[0.03]'}`}
            >
              {loc}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-[12px] text-[var(--text-4)] mt-2">{value.length} location{value.length !== 1 ? 's' : ''} selected</p>
      )}
    </F>
  );
}

// ─── Option lists ─────────────────────────────────────────────────────────────

const COUNTRIES  = opts(['United States','Canada','United Kingdom','Australia','India','Germany','France','Other']);
const YOE        = optsKV([['','Select…'],['0','Less than 1 year'],['1','1 year'],['2','2 years'],['3','3 years'],['4','4 years'],['5','5 years'],['6','6 years'],['7','7 years'],['8','8 years'],['9','9 years'],['10','10 years'],['12','12 years'],['15','15+ years'],['20','20+ years']]);
const NOTICE     = opts(['Immediately','1 week','2 weeks','3 weeks','1 month','6 weeks','2 months','3 months']);
const WORK_TYPE  = opts(['Remote','Hybrid','On-site','Flexible']);
const EMP_TYPE   = opts(['Full-time','Part-time','Contract','Internship','Freelance','Temporary']);
const TRAVEL     = opts(['No','Occasionally (up to 10%)','Sometimes (10-25%)','Frequently (25-50%)','Yes, as needed']);
const REFERRAL   = opts(['LinkedIn','Indeed','Glassdoor','Company Website','Referral','Job Board','Google','Other']);
// "Not set" is a real choice: autofill then leaves the question for the user.
const WORK_AUTH  = optsKV([['', NOT_SET_LABEL], ['Yes','Yes - I am authorized'],['No','No - I need authorization']]);
const VISA       = opts(['','US Citizen','Permanent Resident (Green Card)','H-1B Visa','H-4 EAD','L-1 Visa','OPT / STEM OPT','CPT','TN Visa (Canada/Mexico)','E-3 (Australian)','Other Work Visa','Not applicable']);
const DEGREE     = opts(['','High School Diploma / GED',"Associate's Degree","Bachelor's Degree","Master's Degree",'MBA','Doctoral Degree (PhD)','JD (Law)','MD (Medicine)','Professional Certificate','Bootcamp Certificate','Other']);
const GRAD_YEARS = optsKV([['','Year…'], ...Array.from({ length: 30 }, (_, k) => { const y = String(2026 - k); return [y, y] as [string, string]; }), ['In Progress', 'In Progress']]);
const GENDER     = opts(['', 'Prefer not to say','Male','Female','Non-binary','Transgender','Genderqueer / Gender non-conforming','Another gender identity']);
const PRONOUNS   = opts(['', 'Prefer not to say','He / Him','She / Her','They / Them','He / They','She / They','Ze / Zir']);
const RACE       = opts(['', 'Prefer not to say','American Indian or Alaska Native','Asian','Black or African American','Hispanic or Latino','Native Hawaiian or Other Pacific Islander','White','Two or more races','Other']);
const VETERAN    = opts(['', 'I am not a protected veteran','I am a protected veteran','I am a disabled veteran','I am a recently separated veteran','Prefer not to say']);
const DISABILITY = opts(['', 'I do not have a disability','I have a disability','I have a history of disability','Prefer not to say']);

// The default resume from Profile, which the extension uploads.
function DefaultResumeCard({ onChange }: { onChange: () => void }) {
  const [info, setInfo] = useState<DefaultResumeInfo | null | undefined>(undefined);
  useEffect(() => { fetchDefaultResumeInfo().then(setInfo); }, []);
  const current = info?.current;
  return (
    <div className="flex items-center gap-3 p-3 pr-2 rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] md:w-[320px] flex-shrink-0">
      <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] text-[var(--text-2)]">
        <FileBadge className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] text-[var(--text-4)]">Resume the extension uploads</p>
        <p className="text-[13px] text-white truncate mt-0.5">
          {info === undefined ? <span className="inline-block h-3 w-28 rounded prc-skeleton align-middle" /> : current ? current.fileName : 'None yet'}
        </p>
      </div>
      <button type="button" onClick={onChange} className="h-8 px-3 rounded-lg text-[12.5px] font-medium text-[var(--text-2)] hover:text-white hover:bg-white/[0.05] transition-colors flex-shrink-0">
        {current ? 'Change' : 'Add'}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/** onOpenProfile switches Settings to the Profile tab, where the default resume is set. */
export default function JobApplicationProfile({ onOpenProfile }: { onOpenProfile?: () => void } = {}) {
  const [user]    = useSupabaseUser();
  const [p, setP] = useState<JobAppProfile>(DEFAULT_PROFILE);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  const { pct, filled, total } = useCompletionScore(p);
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => { if (!loading && base === null) setBase(JSON.stringify(p)); }, [loading, base, p]);
  const dirty = base !== null && JSON.stringify(p) !== base;
  const discard = () => { if (base) setP(JSON.parse(base) as JobAppProfile); };

  // Load from /api/profile (named columns + the extendedData jsonb blob)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (res.ok) {
          const { user: d } = await res.json() as { user: Record<string, unknown> };
          const ext = (d.extendedData as Record<string, unknown>) || {};
          setP(prev => ({
            ...prev,
            phone:              (d.phone as string)         || prev.phone,
            streetAddress:      (d.streetAddress as string) || prev.streetAddress,
            city:               (d.city as string)  || prev.city,
            state:              (d.state as string) || prev.state,
            zipCode:            (ext.zipCode as string)           || prev.zipCode,
            country:            (ext.country as string)           || prev.country,
            headline:           (d.targetRole as string) || (ext.headline as string) || prev.headline,
            yearsOfExperience:  (ext.yearsOfExperience as string) || prev.yearsOfExperience,
            summary:            (d.bio as string) || (ext.summary as string) || prev.summary,
            skills: Array.isArray(d.preferredTech) && (d.preferredTech as string[]).length
              ? (d.preferredTech as string[]).join(', ')
              : typeof ext.skills === 'string' ? ext.skills : prev.skills,
            linkedInUrl:        (d.linkedIn as string) || (ext.linkedInUrl as string) || prev.linkedInUrl,
            githubUrl:          (d.github as string)   || (ext.githubUrl as string)   || prev.githubUrl,
            portfolioUrl:       (d.website as string)  || (ext.portfolioUrl as string) || prev.portfolioUrl,
            desiredSalary:      (ext.desiredSalary as string)     || prev.desiredSalary,
            salaryType:         (ext.salaryType as string)        || prev.salaryType,
            noticePeriod:       (ext.noticePeriod as string)      || prev.noticePeriod,
            workType:           (ext.workType as string)          || prev.workType,
            employmentType:     (ext.employmentType as string)    || prev.employmentType,
            willingToRelocate:  (ext.willingToRelocate as boolean) ?? prev.willingToRelocate,
            openToTravel:       (ext.openToTravel as string)      || prev.openToTravel,
            workAuthorization:  (sensitiveValue(ext, 'workAuthorization') as string | null) ?? '',
            requireSponsorship: sensitiveValue(ext, 'requireSponsorship') as boolean | null,
            visaType:           (ext.visaType as string)          || prev.visaType,
            education:  Array.isArray(ext.education)  && (ext.education as unknown[]).length  ? ext.education  as EducationEntry[]  : prev.education,
            experience: Array.isArray(ext.experience) && (ext.experience as unknown[]).length ? ext.experience as ExperienceEntry[] : prev.experience,
            // An old default saved before v2 shows as "Not set", so the user
            // decides it (lib/config/sensitive-answers.ts).
            gender:           (sensitiveValue(ext, 'gender') as string | null)           ?? '',
            pronouns:         (sensitiveValue(ext, 'pronouns') as string | null)         ?? '',
            race:             (sensitiveValue(ext, 'race') as string | null)             ?? '',
            veteranStatus:    (sensitiveValue(ext, 'veteranStatus') as string | null)    ?? '',
            disabilityStatus: (sensitiveValue(ext, 'disabilityStatus') as string | null) ?? '',
            howDidYouHear:    (ext.howDidYouHear as string)    || prev.howDidYouHear,
            driverLicense:    sensitiveValue(ext, 'driverLicense') as boolean | null,
            backgroundCheck:  sensitiveValue(ext, 'backgroundCheck') as boolean | null,
            drugTest:         sensitiveValue(ext, 'drugTest') as boolean | null,
            over18:           sensitiveValue(ext, 'over18') as boolean | null,
            currentlyEmployed:(ext.currentlyEmployed as boolean) ?? prev.currentlyEmployed,
            reasonForLeaving: (ext.reasonForLeaving as string) || prev.reasonForLeaving,
            criminalRecord:   sensitiveValue(ext, 'criminalRecord') as boolean | null,
            languages:        (ext.languages as string)        || prev.languages,
            certifications:   (ext.certifications as string)   || prev.certifications,
            coverLetterIntro: (ext.coverLetterIntro as string) || prev.coverLetterIntro,
            coverLetterBody:  (ext.coverLetterBody as string)  || prev.coverLetterBody,
            preferredLocations: Array.isArray(ext.preferredLocations) ? ext.preferredLocations as string[] : prev.preferredLocations,
          }));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user]);

  const set = <K extends keyof JobAppProfile>(key: K) => (val: JobAppProfile[K]) =>
    setP(prev => ({ ...prev, [key]: val }));

  const addEdu    = () => setP(p => ({ ...p, education: [...p.education, { ...DEFAULT_EDU }] }));
  const removeEdu = (i: number) => setP(p => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }));
  const setEdu    = <K extends keyof EducationEntry>(i: number, key: K, val: EducationEntry[K]) =>
    setP(p => ({ ...p, education: p.education.map((e, idx) => idx === i ? { ...e, [key]: val } : e) }));

  const addExp    = () => setP(p => ({ ...p, experience: [...p.experience, { ...DEFAULT_EXP }] }));
  const removeExp = (i: number) => setP(p => ({ ...p, experience: p.experience.filter((_, idx) => idx !== i) }));
  const setExp    = <K extends keyof ExperienceEntry>(i: number, key: K, val: ExperienceEntry[K]) =>
    setP(p => ({ ...p, experience: p.experience.map((e, idx) => idx === i ? { ...e, [key]: val } : e) }));

  const save = async () => {
    if (!user) return;
    setSaving(true); setError('');
    try {
      const skillsArray = p.skills.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // Named columns other parts of the app expect
          phone: p.phone, streetAddress: p.streetAddress, city: p.city, state: p.state,
          preferredTech: skillsArray, targetRole: p.headline, bio: p.summary,
          linkedIn: p.linkedInUrl, github: p.githubUrl, website: p.portfolioUrl,
          // Everything else buckets into the extendedData jsonb blob
          zipCode: p.zipCode, country: p.country, headline: p.headline,
          yearsOfExperience: p.yearsOfExperience, summary: p.summary, skills: p.skills,
          linkedInUrl: p.linkedInUrl, githubUrl: p.githubUrl, portfolioUrl: p.portfolioUrl,
          desiredSalary: p.desiredSalary, salaryType: p.salaryType, noticePeriod: p.noticePeriod,
          workType: p.workType, employmentType: p.employmentType, willingToRelocate: p.willingToRelocate,
          openToTravel: p.openToTravel, workAuthorization: p.workAuthorization,
          requireSponsorship: p.requireSponsorship, visaType: p.visaType,
          education: p.education, experience: p.experience,
          gender: p.gender, pronouns: p.pronouns, race: p.race,
          veteranStatus: p.veteranStatus, disabilityStatus: p.disabilityStatus,
          howDidYouHear: p.howDidYouHear, driverLicense: p.driverLicense,
          backgroundCheck: p.backgroundCheck, drugTest: p.drugTest, over18: p.over18,
          currentlyEmployed: p.currentlyEmployed, reasonForLeaving: p.reasonForLeaving,
          criminalRecord: p.criminalRecord, languages: p.languages, certifications: p.certifications,
          coverLetterIntro: p.coverLetterIntro, coverLetterBody: p.coverLetterBody,
          preferredLocations: p.preferredLocations,
          // Everything sensitive in this save was chosen in a form where it
          // started as "Not set" (lib/config/sensitive-answers.ts).
          sensitiveAnswersVersion: SENSITIVE_ANSWERS_VERSION,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Failed to save' }));
        throw new Error(e.error || 'Failed to save');
      }
      setBase(JSON.stringify(p));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-[var(--text-4)] animate-spin" />
    </div>
  );

  const filledOf = (xs: unknown[]) => xs.filter(v => (typeof v === 'string' ? v.trim() !== '' : v !== null && v !== undefined && v !== false)).length;
  const parts: (RailItem & { desc: string })[] = [
    { id: 'aa-personal', title: 'Contact', desc: 'Phone and mailing address, for the contact part of every application.', done: filledOf([p.phone, p.streetAddress, p.city, p.state, p.zipCode, p.country]), total: 6 },
    { id: 'aa-pro', title: 'Professional', desc: 'Headline, summary and skills. "Tell us about yourself" answers start here.', done: filledOf([p.headline, p.yearsOfExperience, p.summary, p.skills, p.linkedInUrl]), total: 5 },
    { id: 'aa-prefs', title: 'Preferences', desc: 'Pay, arrangement and availability questions.', done: filledOf([p.desiredSalary, p.noticePeriod, p.workType, p.employmentType]), total: 4 },
    { id: 'aa-auth', title: 'Work authorization', desc: 'How you answer the visa questions. Anything not set is left for you on each form.', done: filledOf([p.workAuthorization, p.visaType, p.requireSponsorship]), total: 3 },
    { id: 'aa-edu', title: 'Education', desc: 'Degrees, schools and graduation dates.', done: p.education.some(e => e.school && e.degree) ? 1 : 0, total: 1 },
    { id: 'aa-exp', title: 'Experience', desc: 'Your roles, for the work history part of portals.', done: p.experience.some(e => e.company && e.title) ? 1 : 0, total: 1 },
    { id: 'aa-std', title: 'Standard questions', desc: 'Yes or no questions most portals ask. Not set means you answer it yourself.', done: filledOf([p.over18, p.driverLicense, p.backgroundCheck, p.drugTest, p.criminalRecord]), total: 5 },
    { id: 'aa-eeo', title: 'EEO and diversity', desc: 'Voluntary. Only used for EEO sections, and never answered unless you set it.', done: filledOf([p.gender, p.pronouns, p.race, p.veteranStatus, p.disabilityStatus]), total: 5 },
    { id: 'aa-cover', title: 'Cover letter', desc: 'A template for cover letters and "Why us?" questions.', done: filledOf([p.coverLetterIntro, p.coverLetterBody]), total: 2 },
  ];
  const part = (id: string) => parts.find(x => x.id === id)!;
  const sec = (id: string, children: React.ReactNode) => {
    const x = part(id);
    return <FormSection id={x.id} title={x.title} desc={x.desc} done={x.done} total={x.total}>{children}</FormSection>;
  };
  const entryCard = 'rounded-xl p-4 sm:p-5 space-y-4 ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]';
  const removeBtn = 'h-7 px-2.5 rounded-md text-[12px] font-medium text-[var(--text-4)] hover:text-rose-300 hover:bg-rose-500/[0.08] transition-colors';

  return (
    <div className="animate-fade-in-up">
      {/* ── Header: what this is and how complete it is ── */}
      <section className="glass-card p-5 sm:p-6 mb-3">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <CompletionRing pct={pct} />
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.02em] text-white">Auto-apply details</h2>
            <p className="text-[13px] text-[var(--text-3)] mt-1 max-w-xl">Fill these in once. The Chrome extension uses them to answer application questions, and leaves anything not set for you.</p>
            <p className="text-[12px] text-[var(--text-4)] mt-2 tabular-nums">
              {filled} of {total} key fields filled · {pct >= 80 ? 'The extension can fill most questions' : pct >= 50 ? 'Good start. More fields mean fewer questions left to you' : 'Add more for better coverage'}
            </p>
          </div>
          <DefaultResumeCard onChange={() => onOpenProfile?.()} />
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-3 rounded-xl bg-rose-500/10 ring-1 ring-inset ring-rose-500/20 text-rose-300 text-[13px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[200px_minmax(0,1fr)] gap-6 items-start">
        <SectionRail items={parts} />

        <div className="glass-card px-5 sm:px-7 py-6">
          {sec('aa-personal', (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FInput label="Phone" hint="with country code" value={p.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
              <FInput label="Street address" value={p.streetAddress} onChange={set('streetAddress')} placeholder="123 Main St, Apt 4" />
              <FInput label="City" value={p.city} onChange={set('city')} placeholder="Boston" />
              <FInput label="State or province" value={p.state} onChange={set('state')} placeholder="MA" />
              <FInput label="ZIP or postal code" value={p.zipCode} onChange={set('zipCode')} placeholder="02101" />
              <FSelect label="Country" value={p.country} onChange={set('country')} options={COUNTRIES} />
            </div>
          ))}

          {sec('aa-pro', (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FInput label="Target role or headline" value={p.headline} onChange={set('headline')} placeholder="Data Analyst" />
              <FSelect label="Years of experience" value={p.yearsOfExperience} onChange={set('yearsOfExperience')} options={YOE} />
            </div>
            <FTextarea label="Professional summary" hint="for About me questions" value={p.summary} onChange={set('summary')} rows={4}
              placeholder="Data analyst with two years turning messy data into decisions..." />
            <FTextarea label="Skills" hint="comma separated" value={p.skills} onChange={set('skills')} rows={2}
              placeholder="SQL, Python, Tableau, Excel..." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FInput label="LinkedIn" value={p.linkedInUrl} onChange={set('linkedInUrl')} placeholder="linkedin.com/in/you" />
              <FInput label="GitHub" value={p.githubUrl} onChange={set('githubUrl')} placeholder="github.com/you" />
              <FInput label="Portfolio or website" value={p.portfolioUrl} onChange={set('portfolioUrl')} placeholder="yoursite.com" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FInput label="Certifications" hint="comma separated" value={p.certifications} onChange={set('certifications')} placeholder="AWS Cloud Practitioner" />
              <FInput label="Languages" hint="comma separated" value={p.languages} onChange={set('languages')} placeholder="English, Spanish" />
            </div>
          </>))}

          {sec('aa-prefs', (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SalaryField salary={p.desiredSalary} salaryType={p.salaryType} onSalary={set('desiredSalary')} onType={set('salaryType')} />
              <FSelect label="Notice period" value={p.noticePeriod} onChange={set('noticePeriod')} options={NOTICE} />
              <FSelect label="Work arrangement" value={p.workType} onChange={set('workType')} options={WORK_TYPE} />
              <FSelect label="Employment type" value={p.employmentType} onChange={set('employmentType')} options={EMP_TYPE} />
              <FSelect label="Open to travel" value={p.openToTravel} onChange={set('openToTravel')} options={TRAVEL} />
              <FSelect label="How did you hear about us?" hint="default answer" value={p.howDidYouHear} onChange={set('howDidYouHear')} options={REFERRAL} />
            </div>
            <LocationPicker value={p.preferredLocations} onChange={set('preferredLocations')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FToggle value={p.willingToRelocate} onChange={set('willingToRelocate')} label="Willing to relocate" />
              <FToggle value={p.currentlyEmployed} onChange={set('currentlyEmployed')} label="Currently employed" />
            </div>
            {p.currentlyEmployed && (
              <FInput label="Reason for leaving" value={p.reasonForLeaving} onChange={set('reasonForLeaving')} placeholder="Looking for a role closer to analytics..." />
            )}
          </>))}

          {sec('aa-auth', (<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FSelect label="Authorized to work in the US?" value={p.workAuthorization} onChange={set('workAuthorization')} options={WORK_AUTH} />
              <FSelect label="Visa or work status" value={p.visaType} onChange={set('visaType')} options={VISA} />
            </div>
            <FTri label="Will you need visa sponsorship, now or in the future?" value={p.requireSponsorship} onChange={set('requireSponsorship')} />
          </>))}

          {sec('aa-edu', (<>
            {p.education.map((edu, i) => (
              <div key={i} className={entryCard}>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-[var(--text-2)]">{edu.school || (p.education.length > 1 ? `Education ${i + 1}` : 'Education')}</span>
                  {p.education.length > 1 && <button type="button" onClick={() => removeEdu(i)} className={removeBtn}>Remove</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FInput label="School or university" value={edu.school} onChange={v => setEdu(i, 'school', v)} placeholder="Northeastern University" />
                  <FSelect label="Degree" value={edu.degree} onChange={v => setEdu(i, 'degree', v)} options={DEGREE} />
                  <FInput label="Field of study" value={edu.field} onChange={v => setEdu(i, 'field', v)} placeholder="Computer Science" />
                  <FInput label="GPA" hint="optional" value={edu.gpa} onChange={v => setEdu(i, 'gpa', v)} placeholder="3.8" />
                  <FSelect label="Graduation year" value={edu.year} onChange={v => setEdu(i, 'year', v)} options={GRAD_YEARS} />
                  <div className="flex items-end">
                    <FToggle value={edu.current} onChange={v => setEdu(i, 'current', v)} label="Currently enrolled" />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={addEdu} className="btn-secondary !h-9 !text-[13px]"><Plus className="w-3.5 h-3.5" />Add education</button>
          </>))}

          {sec('aa-exp', (<>
            {p.experience.map((exp, i) => (
              <div key={i} className={entryCard}>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-[var(--text-2)] truncate">
                    {exp.title || exp.company ? [exp.title, exp.company].filter(Boolean).join(' at ') : p.experience.length > 1 ? `Position ${i + 1}` : 'Position'}
                  </span>
                  {p.experience.length > 1 && <button type="button" onClick={() => removeExp(i)} className={removeBtn}>Remove</button>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FInput label="Company" value={exp.company} onChange={v => setExp(i, 'company', v)} placeholder="Stripe" />
                  <FInput label="Job title" value={exp.title} onChange={v => setExp(i, 'title', v)} placeholder="Data Analyst Intern" />
                  <FInput label="Start date" value={exp.startDate} onChange={v => setExp(i, 'startDate', v)} placeholder="Jan 2025" />
                  <FInput label="End date" value={exp.current ? 'Present' : exp.endDate} onChange={v => setExp(i, 'endDate', v)} placeholder="Present" disabled={exp.current} />
                </div>
                <FToggle value={exp.current} onChange={v => setExp(i, 'current', v)} label="I currently work here" />
                <FTextarea label="Key responsibilities" hint="for application questions" value={exp.description} onChange={v => setExp(i, 'description', v)} rows={2}
                  placeholder="Built weekly revenue dashboards in Tableau for the finance team..." />
              </div>
            ))}
            <button type="button" onClick={addExp} className="btn-secondary !h-9 !text-[13px]"><Plus className="w-3.5 h-3.5" />Add position</button>
          </>))}

          {sec('aa-std', (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FTri label="18 years or older?" value={p.over18} onChange={set('over18')} />
              <FTri label="Valid driver's license?" value={p.driverLicense} onChange={set('driverLicense')} />
              <FTri label="Consent to a background check?" value={p.backgroundCheck} onChange={set('backgroundCheck')} />
              <FTri label="Consent to a drug test?" value={p.drugTest} onChange={set('drugTest')} />
              <FTri label="Have a criminal record?" value={p.criminalRecord} onChange={set('criminalRecord')} />
            </div>
          ))}

          {sec('aa-eeo', (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FSelect label="Gender" value={p.gender} onChange={set('gender')} options={GENDER} />
              <FSelect label="Pronouns" value={p.pronouns} onChange={set('pronouns')} options={PRONOUNS} />
              <FSelect label="Race or ethnicity" value={p.race} onChange={set('race')} options={RACE} />
              <FSelect label="Veteran status" value={p.veteranStatus} onChange={set('veteranStatus')} options={VETERAN} />
              <FSelect label="Disability status" value={p.disabilityStatus} onChange={set('disabilityStatus')} options={DISABILITY} span="sm:col-span-2" />
            </div>
          ))}

          {sec('aa-cover', (<>
            <FTextarea label="Opening paragraph" hint="personalized per company" rows={3} value={p.coverLetterIntro} onChange={set('coverLetterIntro')}
              placeholder="I am writing to apply for the [Role] position at [Company]..." />
            <FTextarea label="Why you are a good fit" rows={4} value={p.coverLetterBody} onChange={set('coverLetterBody')}
              placeholder="In my internship at [Company], I built..." />
            <p className="text-[12px] text-[var(--text-4)]">
              When auto-apply is off, the Apply flow writes your cover letter from this template, in a professional tone.
            </p>
            <p className="text-[12px] text-[var(--text-4)]">
              Write <code className="px-1 rounded bg-white/[0.06] text-[var(--text-2)]">[Company]</code> and <code className="px-1 rounded bg-white/[0.06] text-[var(--text-2)]">[Role]</code>. The extension fills them in for each job.
            </p>
          </>))}
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={save} onDiscard={dirty ? discard : undefined} label="Save details" />
      <div className="h-4" />
    </div>
  );
}

/** How much of the key information is in, as a ring. */
function CompletionRing({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 flex-shrink-0" aria-label={`${pct}% complete`}>
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={pct >= 80 ? '#34d399' : '#38bdf8'} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[15px] font-semibold text-white tabular-nums">{pct}%</span>
    </div>
  );
}
