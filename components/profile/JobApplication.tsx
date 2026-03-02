'use client';

import React, { useState, useEffect } from 'react';
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

function FSelect({ label, hint, span, value, onChange, children }:
  { label:string; hint?:string; span?:string; value:string; onChange:(v:string)=>void; children:React.ReactNode }) {
  return (
    <F label={label} hint={hint} span={span}>
      <div className="relative">
        <select value={value} onChange={e=>onChange(e.target.value)} className={fieldCls + ' cursor-pointer appearance-none pr-8'}>
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
      </div>
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
          <FSelect label="Country" value={p.country} onChange={set('country')}>
            <option>United States</option><option>Canada</option><option>United Kingdom</option>
            <option>Australia</option><option>India</option><option>Germany</option><option>France</option><option>Other</option>
          </FSelect>
        </div>
      </Section>

      {/* ── 2. Professional ── */}
      <Section id="pro" label="Professional Profile" icon={Briefcase} gradient="gradient-accent" desc="Skills, links & summary">
        <div className="space-y-4 mt-5">
          <div className="grid grid-cols-2 gap-4">
            <FInput label="Target Role / Headline" value={p.headline} onChange={set('headline')} placeholder="Senior Software Engineer" />
            <FSelect label="Years of Experience" value={p.yearsOfExperience} onChange={set('yearsOfExperience')}>
              <option value="">Select…</option>
              {[['0','Less than 1 year'],['1','1 year'],['2','2 years'],['3','3 years'],['4','4 years'],['5','5 years'],
                ['6','6 years'],['7','7 years'],['8','8 years'],['9','9 years'],['10','10 years'],['12','12 years'],['15','15+ years'],['20','20+ years']]
                .map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </FSelect>
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
            <div>
              <F label="Desired Salary">
                <div className="flex gap-2">
                  <input value={p.desiredSalary} onChange={e=>set('desiredSalary')(e.target.value)}
                    placeholder="120000" className={fieldCls + ' flex-1'} />
                  <div className="relative">
                    <select value={p.salaryType} onChange={e=>set('salaryType')(e.target.value)}
                      className={fieldCls + ' w-20 cursor-pointer appearance-none pr-1'}>
                      <option value="yearly">/ yr</option><option value="hourly">/ hr</option>
                    </select>
                  </div>
                </div>
              </F>
            </div>
            <FSelect label="Notice Period" value={p.noticePeriod} onChange={set('noticePeriod')}>
              {['Immediately','1 week','2 weeks','3 weeks','1 month','6 weeks','2 months','3 months'].map(v=><option key={v}>{v}</option>)}
            </FSelect>
            <FSelect label="Work Arrangement" value={p.workType} onChange={set('workType')}>
              <option>Remote</option><option>Hybrid</option><option>On-site</option><option>Flexible</option>
            </FSelect>
            <FSelect label="Employment Type" value={p.employmentType} onChange={set('employmentType')}>
              <option>Full-time</option><option>Part-time</option><option>Contract</option>
              <option>Internship</option><option>Freelance</option><option>Temporary</option>
            </FSelect>
            <FSelect label="Open to Travel" value={p.openToTravel} onChange={set('openToTravel')}>
              <option>No</option><option>Occasionally (up to 10%)</option><option>Sometimes (10–25%)</option>
              <option>Frequently (25–50%)</option><option>Yes, as needed</option>
            </FSelect>
            <FSelect label="How did you hear about us?" hint="default" value={p.howDidYouHear} onChange={set('howDidYouHear')}>
              <option>LinkedIn</option><option>Indeed</option><option>Glassdoor</option>
              <option>Company Website</option><option>Referral</option><option>Job Board</option><option>Google</option><option>Other</option>
            </FSelect>
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
            <FSelect label="Authorized to work in the US?" value={p.workAuthorization} onChange={set('workAuthorization')}>
              <option value="Yes">Yes — I am authorized</option>
              <option value="No">No — I need authorization</option>
            </FSelect>
            <FSelect label="Visa / Work Status" value={p.visaType} onChange={set('visaType')}>
              <option value="">Select status…</option>
              <option>US Citizen</option><option>Permanent Resident (Green Card)</option>
              <option>H-1B Visa</option><option>H-4 EAD</option><option>L-1 Visa</option>
              <option>OPT / STEM OPT</option><option>CPT</option>
              <option>TN Visa (Canada/Mexico)</option><option>E-3 (Australian)</option>
              <option>Other Work Visa</option><option>Not applicable</option>
            </FSelect>
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
                <FSelect label="Degree" value={edu.degree} onChange={v=>setEdu(i,'degree',v)}>
                  <option value="">Select…</option>
                  {["High School Diploma / GED","Associate's Degree","Bachelor's Degree","Master's Degree","MBA",
                    "Doctoral Degree (PhD)","JD (Law)","MD (Medicine)","Professional Certificate","Bootcamp Certificate","Other"]
                    .map(d=><option key={d}>{d}</option>)}
                </FSelect>
                <FInput label="Field of Study / Major" value={edu.field} onChange={v=>setEdu(i,'field',v)} placeholder="Computer Science" />
                <FInput label="GPA" hint="optional" value={edu.gpa} onChange={v=>setEdu(i,'gpa',v)} placeholder="3.8" />
                <FSelect label="Graduation Year" value={edu.year} onChange={v=>setEdu(i,'year',v)}>
                  <option value="">Year…</option>
                  {Array.from({length:30},(_,k)=>2025-k).map(y=><option key={y} value={String(y)}>{y}</option>)}
                  <option value="In Progress">In Progress</option>
                </FSelect>
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
            <FSelect label="Gender" value={p.gender} onChange={set('gender')}>
              <option>Prefer not to say</option><option>Male</option><option>Female</option>
              <option>Non-binary</option><option>Transgender</option>
              <option>Genderqueer / Gender non-conforming</option><option>Another gender identity</option>
            </FSelect>
            <FSelect label="Pronouns" value={p.pronouns} onChange={set('pronouns')}>
              <option>Prefer not to say</option><option>He / Him</option><option>She / Her</option>
              <option>They / Them</option><option>He / They</option><option>She / They</option><option>Ze / Zir</option>
            </FSelect>
            <FSelect label="Race / Ethnicity" value={p.race} onChange={set('race')}>
              <option>Prefer not to say</option><option>American Indian or Alaska Native</option>
              <option>Asian</option><option>Black or African American</option><option>Hispanic or Latino</option>
              <option>Native Hawaiian or Other Pacific Islander</option><option>White</option>
              <option>Two or more races</option><option>Other</option>
            </FSelect>
            <FSelect label="Veteran Status" value={p.veteranStatus} onChange={set('veteranStatus')}>
              <option>I am not a protected veteran</option><option>I am a protected veteran</option>
              <option>I am a disabled veteran</option><option>I am a recently separated veteran</option>
              <option>Prefer not to say</option>
            </FSelect>
            <FSelect label="Disability Status" value={p.disabilityStatus} onChange={set('disabilityStatus')} span="col-span-2">
              <option>I do not have a disability</option><option>I have a disability</option>
              <option>I have a history of disability</option><option>Prefer not to say</option>
            </FSelect>
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