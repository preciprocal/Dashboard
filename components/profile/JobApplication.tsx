'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/firebase/client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  User, Briefcase, GraduationCap, Shield, Users,
  Save, CheckCircle, AlertCircle, Plus, Trash2,
  Building2, FileText, Star, Heart, ChevronDown,
} from 'lucide-react';

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
  openToTravel: string; workAuthorization: string; requireSponsorship: boolean;
  visaType: string; education: EducationEntry[]; experience: ExperienceEntry[];
  gender: string; pronouns: string; race: string;
  veteranStatus: string; disabilityStatus: string;
  howDidYouHear: string; driverLicense: boolean; backgroundCheck: boolean;
  drugTest: boolean; over18: boolean; currentlyEmployed: boolean;
  reasonForLeaving: string; criminalRecord: boolean;
  languages: string; certifications: string;
  coverLetterIntro: string; coverLetterBody: string;
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
  workAuthorization:'Yes', requireSponsorship:false, visaType:'',
  education:[{...DEFAULT_EDU}], experience:[{...DEFAULT_EXP}],
  gender:'Prefer not to say', pronouns:'Prefer not to say', race:'Prefer not to say',
  veteranStatus:'I am not a protected veteran', disabilityStatus:'I do not have a disability',
  howDidYouHear:'LinkedIn', driverLicense:true, backgroundCheck:true,
  drugTest:true, over18:true, currentlyEmployed:false,
  reasonForLeaving:'', criminalRecord:false, languages:'English', certifications:'',
  coverLetterIntro:'', coverLetterBody:'',
};

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
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Calculate position relative to viewport
  const reposition = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const panelH = Math.min(224, options.length * 42 + 8); // estimate panel height
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= panelH
      ? r.bottom + window.scrollY + 6
      : r.top + window.scrollY - panelH - 6;
    setCoords({ top, left: r.left + window.scrollX, width: r.width });
  }, [options.length]);

  const handleOpen = () => {
    reposition();
    setOpen(o => !o);
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const onScroll = () => { reposition(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  const selected = options.find(o => o.value === value);
  const displayLabel = selected?.label ?? value ?? placeholder;

  const panel = mounted && open ? createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        zIndex: 9999,
        background: '#0f1729',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ maxHeight: '224px', overflowY: 'auto' }} className="py-1 custom-scrollbar">
        {options.map(opt => {
          const isActive = opt.value === value || (!value && opt.value === '');
          return (
            <button
              key={opt.value}
              type="button"
              onMouseDown={e => e.preventDefault()} // prevent blur before click
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                ${isActive
                  ? 'bg-blue-600/30 text-white font-medium'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-all
          border bg-slate-900/60 backdrop-blur-sm
          ${open
            ? 'border-purple-500/50 text-white'
            : 'border-white/[0.08] text-slate-300 hover:border-white/[0.15] hover:text-white'
          }`}
      >
        <span className={`truncate ${!selected && !value ? 'text-slate-500' : ''}`}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 ml-2 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {panel}
    </div>
  );
}

// ─── Helper: build options from string array ──────────────────────────────────

function opts(arr: string[]): DropdownOption[] {
  return arr.map(v => ({ value: v, label: v }));
}
function optsKV(arr: [string, string][]): DropdownOption[] {
  return arr.map(([v, l]) => ({ value: v, label: l }));
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const fieldCls = "w-full glass-input rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all";

function F({ label, hint, span, children }: { label:string; hint?:string; span?:string; children:React.ReactNode }) {
  return (
    <div className={span}>
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
        {label}{hint && <span className="text-slate-600 normal-case tracking-normal font-normal ml-1.5">· {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function FInput({ label, hint, span, value, onChange, placeholder, type='text', disabled }:
  { label:string; hint?:string; span?:string; value:string; onChange:(v:string)=>void; placeholder?:string; type?:string; disabled?:boolean }) {
  return (
    <F label={label} hint={hint} span={span}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} className={fieldCls} />
    </F>
  );
}

function FSelect({ label, hint, span, value, onChange, options }: {
  label:string; hint?:string; span?:string; value:string; onChange:(v:string)=>void; options: DropdownOption[];
}) {
  return (
    <F label={label} hint={hint} span={span}>
      <CustomDropdown value={value} onChange={onChange} options={options} />
    </F>
  );
}

function FTextarea({ label, hint, span, value, onChange, placeholder, rows=3 }:
  { label:string; hint?:string; span?:string; value:string; onChange:(v:string)=>void; placeholder?:string; rows?:number }) {
  return (
    <F label={label} hint={hint} span={span}>
      <textarea value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} rows={rows} className={fieldCls + ' resize-none'} />
    </F>
  );
}

function FToggle({ value, onChange, label, desc }: { value:boolean; onChange:(v:boolean)=>void; label:string; desc?:string }) {
  return (
    <button onClick={()=>onChange(!value)}
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border transition-all duration-200 text-left group
        ${value ? 'bg-purple-500/10 border-purple-500/25' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/10'}`}>
      <div>
        <p className={`text-sm font-medium transition-colors ${value ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <div className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-200 ${value ? 'bg-purple-600' : 'bg-slate-700'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
    </button>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({ label, icon:Icon, gradient, desc, children, defaultOpen=true }:
  { id:string; label:string; icon:React.ElementType; gradient:string; desc:string; children:React.ReactNode; defaultOpen?:boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card overflow-hidden">
      <button onClick={()=>setOpen(o=>!o)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group">
        <div className={`w-9 h-9 ${gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-glass group-hover:scale-105 transition-transform`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-500 truncate">{desc}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 pt-1 border-t border-white/[0.05]">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Salary dropdown (special combined field) ─────────────────────────────────

function SalaryField({ salary, salaryType, onSalary, onType }: {
  salary: string; salaryType: string;
  onSalary: (v:string)=>void; onType: (v:string)=>void;
}) {
  return (
    <F label="Desired Salary">
      <div className="flex gap-2">
        <input value={salary} onChange={e=>onSalary(e.target.value)}
          placeholder="120000" className={fieldCls + ' flex-1'} />
        <div className="w-24 flex-shrink-0">
          <CustomDropdown
            value={salaryType}
            onChange={onType}
            options={[{ value:'yearly', label:'/ yr' },{ value:'hourly', label:'/ hr' }]}
          />
        </div>
      </div>
    </F>
  );
}

// ─── Option lists ─────────────────────────────────────────────────────────────

const COUNTRIES   = opts(['United States','Canada','United Kingdom','Australia','India','Germany','France','Other']);
const YOE         = optsKV([['','Select…'],['0','Less than 1 year'],['1','1 year'],['2','2 years'],['3','3 years'],['4','4 years'],['5','5 years'],['6','6 years'],['7','7 years'],['8','8 years'],['9','9 years'],['10','10 years'],['12','12 years'],['15','15+ years'],['20','20+ years']]);
const NOTICE      = opts(['Immediately','1 week','2 weeks','3 weeks','1 month','6 weeks','2 months','3 months']);
const WORK_TYPE   = opts(['Remote','Hybrid','On-site','Flexible']);
const EMP_TYPE    = opts(['Full-time','Part-time','Contract','Internship','Freelance','Temporary']);
const TRAVEL      = opts(['No','Occasionally (up to 10%)','Sometimes (10–25%)','Frequently (25–50%)','Yes, as needed']);
const REFERRAL    = opts(['LinkedIn','Indeed','Glassdoor','Company Website','Referral','Job Board','Google','Other']);
const WORK_AUTH   = optsKV([['Yes','Yes — I am authorized'],['No','No — I need authorization']]);
const VISA        = opts(['','US Citizen','Permanent Resident (Green Card)','H-1B Visa','H-4 EAD','L-1 Visa','OPT / STEM OPT','CPT','TN Visa (Canada/Mexico)','E-3 (Australian)','Other Work Visa','Not applicable']);
const DEGREE      = opts(['','High School Diploma / GED',"Associate's Degree","Bachelor's Degree","Master's Degree",'MBA','Doctoral Degree (PhD)','JD (Law)','MD (Medicine)','Professional Certificate','Bootcamp Certificate','Other']);
const GRAD_YEARS  = optsKV([['','Year…'], ...Array.from({length:30},(_,k)=>{ const y=String(2026-k); return [y,y] as [string,string]; }), ['In Progress','In Progress']]);
const GENDER      = opts(['Prefer not to say','Male','Female','Non-binary','Transgender','Genderqueer / Gender non-conforming','Another gender identity']);
const PRONOUNS    = opts(['Prefer not to say','He / Him','She / Her','They / Them','He / They','She / They','Ze / Zir']);
const RACE        = opts(['Prefer not to say','American Indian or Alaska Native','Asian','Black or African American','Hispanic or Latino','Native Hawaiian or Other Pacific Islander','White','Two or more races','Other']);
const VETERAN     = opts(['I am not a protected veteran','I am a protected veteran','I am a disabled veteran','I am a recently separated veteran','Prefer not to say']);
const DISABILITY  = opts(['I do not have a disability','I have a disability','I have a history of disability','Prefer not to say']);

// ─── Main component ───────────────────────────────────────────────────────────

export default function JobApplicationProfile() {
  const [user]  = useAuthState(auth);
  const [p, setP] = useState<JobAppProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');
  const [loading,setLoading]= useState(true);

  useEffect(()=>{
    if(!user) return;
    (async()=>{
      try {
        const snap = await getDoc(doc(db,'users',user.uid));
        if(snap.exists()){
          const d = snap.data();
          setP(prev=>({
            ...prev,
            phone:             d.phone             || prev.phone,
            streetAddress:     d.streetAddress     || prev.streetAddress,
            city:              d.city              || prev.city,
            state:             d.state             || prev.state,
            zipCode:           d.zipCode           || prev.zipCode,
            country:           d.country           || prev.country,
            headline:          d.targetRole        || d.headline      || prev.headline,
            yearsOfExperience: d.yearsOfExperience || prev.yearsOfExperience,
            summary:           d.bio               || d.summary       || prev.summary,
            skills:            Array.isArray(d.preferredTech) && d.preferredTech.length
                               ? (d.preferredTech as string[]).join(', ')
                               : Array.isArray(d.skills) && d.skills.length
                               ? (d.skills as string[]).join(', ')
                               : typeof d.skills==='string' ? d.skills : prev.skills,
            linkedInUrl:       d.linkedIn          || d.linkedInUrl   || prev.linkedInUrl,
            githubUrl:         d.github            || d.githubUrl     || prev.githubUrl,
            portfolioUrl:      d.website           || d.portfolioUrl  || prev.portfolioUrl,
            desiredSalary:     d.desiredSalary     || prev.desiredSalary,
            salaryType:        d.salaryType        || prev.salaryType,
            noticePeriod:      d.noticePeriod      || prev.noticePeriod,
            workType:          d.workType          || prev.workType,
            employmentType:    d.employmentType    || prev.employmentType,
            willingToRelocate: d.willingToRelocate ?? prev.willingToRelocate,
            openToTravel:      d.openToTravel      || prev.openToTravel,
            workAuthorization: d.workAuthorization || prev.workAuthorization,
            requireSponsorship:d.requireSponsorship?? prev.requireSponsorship,
            visaType:          d.visaType          || prev.visaType,
            education:         Array.isArray(d.education)  && d.education.length  ? d.education  as EducationEntry[]  : prev.education,
            experience:        Array.isArray(d.experience) && d.experience.length ? d.experience as ExperienceEntry[] : prev.experience,
            gender:            d.gender            || prev.gender,
            pronouns:          d.pronouns          || prev.pronouns,
            race:              d.race              || prev.race,
            veteranStatus:     d.veteranStatus     || prev.veteranStatus,
            disabilityStatus:  d.disabilityStatus  || prev.disabilityStatus,
            howDidYouHear:     d.howDidYouHear     || prev.howDidYouHear,
            driverLicense:     d.driverLicense     ?? prev.driverLicense,
            backgroundCheck:   d.backgroundCheck   ?? prev.backgroundCheck,
            drugTest:          d.drugTest          ?? prev.drugTest,
            over18:            d.over18            ?? prev.over18,
            currentlyEmployed: d.currentlyEmployed ?? prev.currentlyEmployed,
            reasonForLeaving:  d.reasonForLeaving  || prev.reasonForLeaving,
            criminalRecord:    d.criminalRecord    ?? prev.criminalRecord,
            languages:         d.languages         || prev.languages,
            certifications:    d.certifications    || prev.certifications,
            coverLetterIntro:  d.coverLetterIntro  || prev.coverLetterIntro,
            coverLetterBody:   d.coverLetterBody   || prev.coverLetterBody,
          }));
        }
      } catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  },[user]);

  const set = <K extends keyof JobAppProfile>(key:K) => (val:JobAppProfile[K]) =>
    setP(prev=>({...prev,[key]:val}));

  const addEdu    = ()=>setP(p=>({...p,education:[...p.education,{...DEFAULT_EDU}]}));
  const removeEdu = (i:number)=>setP(p=>({...p,education:p.education.filter((_,idx)=>idx!==i)}));
  const setEdu    = <K extends keyof EducationEntry>(i:number,key:K,val:EducationEntry[K])=>
    setP(p=>({...p,education:p.education.map((e,idx)=>idx===i?{...e,[key]:val}:e)}));

  const addExp    = ()=>setP(p=>({...p,experience:[...p.experience,{...DEFAULT_EXP}]}));
  const removeExp = (i:number)=>setP(p=>({...p,experience:p.experience.filter((_,idx)=>idx!==i)}));
  const setExp    = <K extends keyof ExperienceEntry>(i:number,key:K,val:ExperienceEntry[K])=>
    setP(p=>({...p,experience:p.experience.map((e,idx)=>idx===i?{...e,[key]:val}:e)}));

  const save = async()=>{
    if(!user) return;
    setSaving(true); setError('');
    try {
      const skillsArray = p.skills.split(',').map(s=>s.trim()).filter(Boolean);
      await setDoc(doc(db,'users',user.uid),{
        ...p, preferredTech:skillsArray, skills:skillsArray,
        targetRole:p.headline, bio:p.summary,
        linkedIn:p.linkedInUrl, github:p.githubUrl, website:p.portfolioUrl,
        updatedAt:new Date().toISOString(),
      },{merge:true});
      setSaved(true);
      setTimeout(()=>setSaved(false),3000);
    } catch(e){
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  if(loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-3 animate-fade-in-up">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-4 gradient-primary rounded-full" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Auto-Apply</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Job Application Profile</h2>
          <p className="text-slate-500 text-sm mt-1">Fill once · the extension answers every question automatically</p>
        </div>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glass
            ${saved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'glass-button-primary text-white hover:shadow-[0_4px_20px_rgba(102,126,234,0.35)]'}
            disabled:opacity-50 disabled:cursor-not-allowed`}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : saved  ? <CheckCircle className="w-4 h-4" />
            : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Profile'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── 1. Personal ── */}
      <Section id="personal" label="Personal Information" icon={User} gradient="gradient-primary" desc="Contact & address details">
        <div className="grid grid-cols-2 gap-4 mt-5">
          <FInput label="Phone" hint="with country code" value={p.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
          <FInput label="Street Address" value={p.streetAddress} onChange={set('streetAddress')} placeholder="123 Main St, Apt 4" />
          <FInput label="City" value={p.city} onChange={set('city')} placeholder="Boston" />
          <FInput label="State" value={p.state} onChange={set('state')} placeholder="MA" />
          <FInput label="ZIP Code" value={p.zipCode} onChange={set('zipCode')} placeholder="02101" />
          <FSelect label="Country" value={p.country} onChange={set('country')} options={COUNTRIES} />
        </div>
      </Section>

      {/* ── 2. Professional ── */}
      <Section id="pro" label="Professional Profile" icon={Briefcase} gradient="gradient-accent" desc="Skills, links & summary">
        <div className="space-y-4 mt-5">
          <div className="grid grid-cols-2 gap-4">
            <FInput label="Target Role / Headline" value={p.headline} onChange={set('headline')} placeholder="Senior Software Engineer" />
            <FSelect label="Years of Experience" value={p.yearsOfExperience} onChange={set('yearsOfExperience')} options={YOE} />
          </div>
          <FTextarea label="Professional Summary" hint="used for 'About Me' questions"
            value={p.summary} onChange={set('summary')} rows={4}
            placeholder="Experienced software engineer with 5+ years building scalable web applications…" />
          <FTextarea label="Skills" hint="comma-separated"
            value={p.skills} onChange={set('skills')} rows={2}
            placeholder="React, TypeScript, Node.js, Python, AWS, PostgreSQL…" />
          <div className="grid grid-cols-3 gap-4">
            <FInput label="LinkedIn" value={p.linkedInUrl} onChange={set('linkedInUrl')} placeholder="linkedin.com/in/username" />
            <FInput label="GitHub"   value={p.githubUrl}   onChange={set('githubUrl')}   placeholder="github.com/username" />
            <FInput label="Portfolio" value={p.portfolioUrl} onChange={set('portfolioUrl')} placeholder="yoursite.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FInput label="Certifications" hint="comma-separated" value={p.certifications} onChange={set('certifications')} placeholder="AWS Solutions Architect, PMP…" />
            <FInput label="Languages" hint="comma-separated" value={p.languages} onChange={set('languages')} placeholder="English, Spanish" />
          </div>
        </div>
      </Section>

      {/* ── 3. Preferences ── */}
      <Section id="prefs" label="Job Preferences" icon={Star} gradient="gradient-warning" desc="Salary, work type & availability">
        <div className="space-y-4 mt-5">
          <div className="grid grid-cols-2 gap-4">
            <SalaryField salary={p.desiredSalary} salaryType={p.salaryType} onSalary={set('desiredSalary')} onType={set('salaryType')} />
            <FSelect label="Notice Period"      value={p.noticePeriod}    onChange={set('noticePeriod')}    options={NOTICE} />
            <FSelect label="Work Arrangement"   value={p.workType}        onChange={set('workType')}        options={WORK_TYPE} />
            <FSelect label="Employment Type"    value={p.employmentType}  onChange={set('employmentType')}  options={EMP_TYPE} />
            <FSelect label="Open to Travel"     value={p.openToTravel}    onChange={set('openToTravel')}    options={TRAVEL} />
            <FSelect label="How did you hear about us?" hint="default" value={p.howDidYouHear} onChange={set('howDidYouHear')} options={REFERRAL} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FToggle value={p.willingToRelocate} onChange={set('willingToRelocate')} label="Willing to relocate" />
            <FToggle value={p.currentlyEmployed} onChange={set('currentlyEmployed')} label="Currently employed" />
          </div>
          {p.currentlyEmployed && (
            <FInput label="Reason for leaving" value={p.reasonForLeaving} onChange={set('reasonForLeaving')}
              placeholder="Seeking new challenges and growth opportunities…" />
          )}
        </div>
      </Section>

      {/* ── 4. Work Auth ── */}
      <Section id="auth" label="Work Authorization" icon={Shield} gradient="gradient-success" desc="Visa & authorization status">
        <div className="space-y-4 mt-5">
          <div className="grid grid-cols-2 gap-4">
            <FSelect label="Authorized to work in the US?" value={p.workAuthorization} onChange={set('workAuthorization')} options={WORK_AUTH} />
            <FSelect label="Visa / Work Status" value={p.visaType} onChange={set('visaType')} options={VISA} />
          </div>
          <FToggle value={p.requireSponsorship} onChange={set('requireSponsorship')}
            label="Require visa sponsorship" desc="Now or in the future" />
        </div>
      </Section>

      {/* ── 5. Education ── */}
      <Section id="education" label="Education" icon={GraduationCap} gradient="gradient-secondary" desc="Degrees & schools">
        <div className="space-y-3 mt-5">
          {p.education.map((edu,i)=>(
            <div key={i} className="glass-morphism rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  {p.education.length > 1 ? `Education #${i+1}` : 'Education'}
                </span>
                {p.education.length > 1 && (
                  <button onClick={()=>removeEdu(i)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FInput label="School / University" value={edu.school} onChange={v=>setEdu(i,'school',v)} placeholder="Northeastern University" />
                <FSelect label="Degree" value={edu.degree} onChange={v=>setEdu(i,'degree',v)} options={DEGREE} />
                <FInput label="Field of Study / Major" value={edu.field} onChange={v=>setEdu(i,'field',v)} placeholder="Computer Science" />
                <FInput label="GPA" hint="optional" value={edu.gpa} onChange={v=>setEdu(i,'gpa',v)} placeholder="3.8" />
                <FSelect label="Graduation Year" value={edu.year} onChange={v=>setEdu(i,'year',v)} options={GRAD_YEARS} />
                <div className="flex items-end pb-0.5">
                  <FToggle value={edu.current} onChange={v=>setEdu(i,'current',v)} label="Currently enrolled" />
                </div>
              </div>
            </div>
          ))}
          <button onClick={addEdu} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors group">
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </div>
            Add another education
          </button>
        </div>
      </Section>

      {/* ── 6. Experience ── */}
      <Section id="experience" label="Work Experience" icon={Building2} gradient="gradient-accent" desc="Work history & roles">
        <div className="space-y-3 mt-5">
          {p.experience.map((exp,i)=>(
            <div key={i} className="glass-morphism rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                  {p.experience.length > 1 ? `Position #${i+1}` : 'Position'}
                </span>
                {p.experience.length > 1 && (
                  <button onClick={()=>removeExp(i)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FInput label="Company" value={exp.company} onChange={v=>setExp(i,'company',v)} placeholder="Google" />
                <FInput label="Job Title" value={exp.title} onChange={v=>setExp(i,'title',v)} placeholder="Software Engineer" />
                <FInput label="Start Date" value={exp.startDate} onChange={v=>setExp(i,'startDate',v)} placeholder="Jan 2022" />
                <FInput label="End Date" value={exp.endDate} onChange={v=>setExp(i,'endDate',v)} placeholder="Present" disabled={exp.current} />
              </div>
              <FToggle value={exp.current} onChange={v=>setExp(i,'current',v)} label="I currently work here" />
              <FTextarea label="Key Responsibilities" hint="used for application questions"
                value={exp.description} onChange={v=>setExp(i,'description',v)} rows={2}
                placeholder="Built REST APIs serving 1M+ users, led team of 4 engineers…" />
            </div>
          ))}
          <button onClick={addExp} className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors group">
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </div>
            Add another position
          </button>
        </div>
      </Section>

      {/* ── 7. Quick Questions ── */}
      <Section id="questions" label="Standard Questions" icon={FileText} gradient="gradient-primary" desc="Common yes/no questions on every portal" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <FToggle value={p.over18}          onChange={set('over18')}          label="18 years or older" />
          <FToggle value={p.driverLicense}   onChange={set('driverLicense')}   label="Valid driver's license" />
          <FToggle value={p.backgroundCheck} onChange={set('backgroundCheck')} label="Consent to background check" />
          <FToggle value={p.drugTest}         onChange={set('drugTest')}         label="Consent to drug test" />
          <FToggle value={p.criminalRecord}   onChange={set('criminalRecord')}   label="Have a criminal record" />
        </div>
      </Section>

      {/* ── 8. EEO ── */}
      <Section id="eeo" label="EEO & Diversity" icon={Users} gradient="gradient-primary" desc="Optional — voluntary diversity questions" defaultOpen={false}>
        <div className="space-y-4 mt-5">
          <div className="px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
            <p className="text-xs text-blue-400/80">Only used to auto-fill voluntary EEO sections. Never shared for any other purpose.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FSelect label="Gender"         value={p.gender}    onChange={set('gender')}    options={GENDER} />
            <FSelect label="Pronouns"       value={p.pronouns}  onChange={set('pronouns')}  options={PRONOUNS} />
            <FSelect label="Race / Ethnicity" value={p.race}    onChange={set('race')}      options={RACE} />
            <FSelect label="Veteran Status" value={p.veteranStatus} onChange={set('veteranStatus')} options={VETERAN} />
            <FSelect label="Disability Status" value={p.disabilityStatus} onChange={set('disabilityStatus')} options={DISABILITY} span="col-span-2" />
          </div>
        </div>
      </Section>

      {/* ── 9. Cover Letter ── */}
      <Section id="cover" label="Cover Letter" icon={Heart} gradient="gradient-secondary" desc="Template for cover letters & 'Why us?' questions" defaultOpen={false}>
        <div className="space-y-4 mt-5">
          <FTextarea label="Opening Paragraph" hint="personalize per company" rows={3}
            value={p.coverLetterIntro} onChange={set('coverLetterIntro')}
            placeholder="I am writing to express my strong interest in the [Role] position at [Company]. With [X] years of experience in [field], I am confident I can contribute meaningfully…" />
          <FTextarea label="Body — Why you're a great fit" rows={4}
            value={p.coverLetterBody} onChange={set('coverLetterBody')}
            placeholder="In my previous role at [Company], I led the development of [achievement]. I am particularly drawn to [Company] because…" />
          <div className="px-4 py-3 rounded-xl bg-purple-500/8 border border-purple-500/15">
            <p className="text-xs text-purple-400/70">
              💡 Use <code className="bg-purple-500/20 px-1 rounded text-purple-300">[Company]</code> and <code className="bg-purple-500/20 px-1 rounded text-purple-300">[Role]</code> — the extension replaces them automatically.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Footer save ── */}
      <div className="flex justify-end pt-2 pb-8">
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-glass
            ${saved ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                    : 'glass-button-primary text-white hover:shadow-[0_4px_24px_rgba(102,126,234,0.4)]'}
            disabled:opacity-50 disabled:cursor-not-allowed`}>
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : saved  ? <CheckCircle className="w-4 h-4" />
            : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : saved ? 'Profile Saved!' : 'Save Auto-Apply Profile'}
        </button>
      </div>

    </div>
  );
}