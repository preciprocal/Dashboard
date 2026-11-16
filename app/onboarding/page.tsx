'use client';
// app/onboarding/page.tsx
//
// First run, about two minutes: what roles the student wants, their work
// authorization, their resume, and the details read from it. Each step saves
// as they go (app/api/onboarding), into the same profile Jobs, Auto-apply and
// the extension use, so they never type the same thing twice. Every step can
// be skipped; ?edit=1 reopens it later to change preferences.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import AutoTextarea from '@/components/ui/auto-textarea';
import Link from 'next/link';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Loader2, MapPin, Sparkles, UploadCloud, Briefcase, ShieldCheck, Landmark, Search } from 'lucide-react';
import logo from '@/public/logo.png';
import InfoTip from '@/components/ui/info-tip';
import MarketPay from '@/components/onboarding/MarketPay';
import { DEFAULT_PREFERENCES, FAMILY_OPTIONS, LEVEL_OPTIONS, STATUS_OPTIONS, type JobPreferences } from '@/lib/onboarding/preferences';

interface Education { school: string; degree: string; field: string; gpa: string; year: string; current: boolean }
interface Details { name: string; phone: string; city: string; state: string; linkedIn: string; github: string; website: string; headline: string; skills: string; education: Education[] }
interface Loaded {
  preferences: JobPreferences; completed: boolean;
  profile: Details & { workAuthorization: string | boolean | null; requireSponsorship: string | boolean | null; visaType: string; desiredSalary: string };
  resume: { fileName: string } | null;
}

const STEPS = [
  { key: 'role', label: 'Roles', title: <>What kind of <b className="text-white">roles</b> are you looking for?</>, sub: 'We use this to show you matching jobs first.' },
  { key: 'auth', label: 'Work status', title: <>Your <b className="text-white">work authorization</b></>, sub: 'Application forms ask this every time. Answer once and the extension fills it in.' },
  { key: 'resume', label: 'Resume', title: <>Add your <b className="text-white">resume</b></>, sub: 'It becomes your default resume: tailored for each job and uploaded for you.' },
  { key: 'details', label: 'Details', title: <>Check your <b className="text-white">details</b></>, sub: 'Read from your resume. Fix anything that is off; nothing is filled in that your resume does not say.' },
] as const;

const EMPTY_DETAILS: Details = { name: '', phone: '', city: '', state: '', linkedIn: '', github: '', website: '', headline: '', skills: '', education: [] };

export default function Onboarding() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<JobPreferences>(DEFAULT_PREFERENCES);
  const [anywhere, setAnywhere] = useState(true);
  const [status, setStatus] = useState('');
  const [authorized, setAuthorized] = useState<'Yes' | 'No' | ''>('');
  const [sponsorship, setSponsorship] = useState<boolean | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [resume, setResume] = useState<{ fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [salary, setSalary] = useState('');
  const [parsed, setParsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only the latest load counts: a slow earlier answer must not reset what
    // the student has already started choosing.
    let alive = true;
    fetch('/api/onboarding').then(r => (r.ok ? r.json() : Promise.reject(r.status))).then((j: Loaded) => {
      if (!alive) return;
      setLoaded(j);
      setPrefs(j.preferences);
      setAnywhere(!j.preferences.location);
      if (j.profile.workAuthorization === 'Yes' || j.profile.workAuthorization === 'No') setAuthorized(j.profile.workAuthorization);
      if (typeof j.profile.requireSponsorship === 'boolean') setSponsorship(j.profile.requireSponsorship);
      setStatus(STATUS_OPTIONS.find(o => o.visaType === j.profile.visaType)?.id ?? '');
      setResume(j.resume);
      setSalary(j.profile.desiredSalary ?? '');
      setDetails({ ...EMPTY_DETAILS, ...j.profile, education: j.profile.education ?? [] });
    }).catch(code => {
      if (!alive) return;
      if (code === 401) router.replace('/sign-in?redirect=/onboarding');
      else toast.error('Could not load your profile. Please refresh.');
    });
    return () => { alive = false; };
  }, [router]);

  const save = async (body: Record<string, unknown>) => {
    const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save');
  };

  const next = async (skip = false) => {
    setSaving(true);
    try {
      if (!skip) {
        if (step === 0) await save({ preferences: { ...prefs, location: anywhere ? '' : prefs.location }, desiredSalary: salary });
        if (step === 1) await save({
          preferences: { ...prefs, location: anywhere ? '' : prefs.location },
          ...(authorized ? { workAuthorization: authorized } : {}),
          ...(sponsorship !== null ? { requireSponsorship: sponsorship } : {}),
          ...(status ? { visaType: STATUS_OPTIONS.find(o => o.id === status)!.visaType } : {}),
        });
        if (step === 3) await save({ details });
      }
      if (step === 2 && resume && !parsed) void readResume();
      if (step === STEPS.length - 1) {
        await save({ complete: true });
        setDone(true);
      } else {
        setStep(step + 1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const chooseStatus = (id: string) => {
    setStatus(id);
    const s = STATUS_OPTIONS.find(o => o.id === id)?.suggest;
    if (s) { setAuthorized(s.authorized); setSponsorship(s.sponsorship); setSuggested(true); }
    if (id === 'f1-stem' || id === 'f1-opt') setPrefs(p => ({ ...p, everifyOnly: id === 'f1-stem' ? true : p.everifyOnly }));
  };

  const readResume = async () => {
    setParsing(true);
    try {
      const r = await fetch('/api/onboarding/parse-resume', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.message(j.error || 'Could not read your resume. You can fill in the details yourself.'); return; }
      const d = j.details as Details;
      // What the student already has wins; the resume fills the blanks.
      setDetails(prev => ({
        name: prev.name || d.name, phone: prev.phone || d.phone, city: prev.city || d.city, state: prev.state || d.state,
        linkedIn: prev.linkedIn || d.linkedIn, github: prev.github || d.github, website: prev.website || d.website,
        headline: prev.headline || d.headline, skills: prev.skills || d.skills,
        education: prev.education.length ? prev.education : d.education,
      }));
      setParsed(true);
    } finally {
      setParsing(false);
    }
  };

  const upload = async (file: File) => {
    if (file.type !== 'application/pdf') { toast.error('Please choose a PDF.'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('That file is over 5 MB.'); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(file); });
      const r = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ resume: dataUrl, resumeFileName: file.name }) });
      if (!r.ok) throw new Error('Upload failed');
      setResume({ fileName: file.name });
      setParsed(false);
      toast.success(`${file.name} is your default resume`);
    } catch {
      toast.error('Could not upload that file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base,#070a14)]"><Loader2 className="w-6 h-6 text-slate-500 animate-spin" /></div>;
  }

  const S = STEPS[step];
  const canNext = step === 0 ? prefs.levels.length > 0 : true;

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] bg-[var(--bg-base,#070a14)]">
      {/* Left: where they are and why it is asked */}
      <aside className="relative overflow-hidden px-6 sm:px-10 py-8 lg:py-12 flex flex-col border-b lg:border-b-0 lg:border-r border-white/[0.06]"
        style={{ background: 'radial-gradient(120% 80% at 10% 10%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(90% 70% at 90% 100%, rgba(16,185,129,0.14), transparent 60%)' }}>
        <div className="flex items-center gap-2.5">
          <NextImage src={logo} alt="Preciprocal" width={30} height={30} className="rounded-[9px]" priority />
          <span className="text-white font-semibold">Preciprocal</span>
        </div>
        <div className="mt-8 lg:mt-auto lg:mb-auto">
          {!done && <p className="text-[12.5px] font-medium text-indigo-200 mb-3">Step {step + 1} of {STEPS.length}</p>}
          <h1 className="text-[26px] sm:text-[32px] leading-tight text-slate-300 font-normal tracking-tight">
            {done ? <>You are <b className="text-white">all set</b></> : S.title}
          </h1>
          <p className="text-[14px] text-slate-400 mt-3 max-w-md">{done ? 'Your jobs, resume and application details are ready. Here is what we set up.' : S.sub}</p>
          <ol className="hidden lg:flex flex-col gap-2.5 mt-10">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex items-center gap-3 text-[13px]">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border ${done || i < step ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : i === step ? 'bg-[var(--accent)] border-transparent text-white' : 'border-white/[0.12] text-slate-500'}`}>
                  {done || i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span className={i === step && !done ? 'text-white font-medium' : 'text-slate-400'}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      {/* Right: the step */}
      <main className="px-5 sm:px-10 lg:px-16 py-8 lg:py-12 flex flex-col min-w-0">
        <div className="flex justify-end">
          {!done && <Link href="/" className="text-[13px] text-slate-400 hover:text-white transition-colors">Finish later</Link>}
        </div>
        <div className="w-full max-w-[640px] mx-auto flex-1 flex flex-col justify-center py-6">
          {/* Progress bar on small screens */}
          {!done && (
            <div className="lg:hidden h-1 rounded-full bg-white/[0.06] mb-6 overflow-hidden">
              <div className="h-full bg-white/80 transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          )}

          {done ? <Finished prefs={prefs} resume={resume} authorized={authorized} onGo={href => router.push(href)} /> : (
            <div key={step} className="space-y-7 animate-fade-in-up">
              {step === 0 && (
                <>
                  <Field label="Area" hint="Pick any that fit.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {FAMILY_OPTIONS.map(f => (
                        <Tick key={f.id} on={prefs.families.includes(f.id)} label={f.label} hint={f.hint}
                          onClick={() => setPrefs(p => ({ ...p, families: p.families.includes(f.id) ? p.families.filter(x => x !== f.id) : [...p.families, f.id] }))} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Target role" hint="Optional. Used to tailor your resume and cover letters.">
                    <label className="relative block">
                      <Briefcase className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input className="field w-full pl-10" placeholder="e.g. Data analyst" value={prefs.role} maxLength={80} onChange={e => setPrefs(p => ({ ...p, role: e.target.value }))} />
                    </label>
                  </Field>
                  <Field label="Level" required>
                    <div className="grid grid-cols-2 gap-2">
                      {LEVEL_OPTIONS.map(l => (
                        <Tick key={l.id} on={prefs.levels.includes(l.id)} label={l.label} hint={l.hint}
                          onClick={() => setPrefs(p => ({ ...p, levels: p.levels.includes(l.id) ? p.levels.filter(x => x !== l.id) : [...p.levels, l.id] }))} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Location">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Tick on={anywhere} label="Anywhere in the US" onClick={() => setAnywhere(true)} radio />
                      <Tick on={!anywhere} label="A city or state" onClick={() => setAnywhere(false)} radio />
                    </div>
                    {!anywhere && (
                      <label className="relative block mt-2">
                        <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input className="field w-full pl-10" placeholder="e.g. Boston or New York" value={prefs.location} maxLength={60} autoFocus onChange={e => setPrefs(p => ({ ...p, location: e.target.value }))} />
                      </label>
                    )}
                    <div className="mt-2">
                      <Tick on={prefs.remote} label="Open to remote" onClick={() => setPrefs(p => ({ ...p, remote: !p.remote }))} />
                    </div>
                  </Field>
                  <Field label="Pay">
                    <MarketPay role={prefs.role} location={anywhere ? '' : prefs.location} value={salary} onChange={setSalary} />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Your current status">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map(o => <Tick key={o.id} on={status === o.id} label={o.label} onClick={() => chooseStatus(o.id)} radio />)}
                    </div>
                  </Field>
                  <Field label="Are you legally authorized to work in the US?" hint={suggested ? 'Suggested from your status. Change it if it does not fit.' : undefined}>
                    <div className="grid grid-cols-2 gap-2">
                      <Tick on={authorized === 'Yes'} label="Yes" onClick={() => setAuthorized('Yes')} radio />
                      <Tick on={authorized === 'No'} label="No" onClick={() => setAuthorized('No')} radio />
                    </div>
                  </Field>
                  <Field label="Will you now or in the future need visa sponsorship?" hint={suggested ? 'Suggested from your status. F-1 students usually answer Yes, since OPT ends.' : undefined}>
                    <div className="grid grid-cols-2 gap-2">
                      <Tick on={sponsorship === true} label="Yes" onClick={() => setSponsorship(true)} radio />
                      <Tick on={sponsorship === false} label="No" onClick={() => setSponsorship(false)} radio />
                    </div>
                  </Field>
                  <Field label="Show me">
                    <div className="space-y-2">
                      <Tick on={prefs.everifyOnly} onClick={() => setPrefs(p => ({ ...p, everifyOnly: !p.everifyOnly }))}
                        label={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-300" />Only E-Verified employers <InfoTip term="everified" /></span>}
                        hint="Needed for a STEM OPT extension" />
                      <Tick on={prefs.h1bOnly} onClick={() => setPrefs(p => ({ ...p, h1bOnly: !p.h1bOnly }))}
                        label={<span className="inline-flex items-center gap-1.5"><Landmark className="w-4 h-4 text-sky-300" />Only employers with H-1B approvals <InfoTip term="h1b" /></span>}
                        hint="Employers that have sponsored before" />
                    </div>
                  </Field>
                  <p className="text-[12px] text-slate-500">Saved to your Auto-apply details in Settings. The extension answers these questions on forms only with what you choose here.</p>
                </>
              )}

              {step === 2 && (
                <>
                  <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
                  {resume ? (
                    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-5 flex items-center gap-4">
                      <span className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300"><FileText className="w-5 h-5" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-white truncate">{resume.fileName}</p>
                        <p className="text-[12.5px] text-slate-400">Your default resume</p>
                      </div>
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary h-9 flex-shrink-0">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Replace'}</button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                      onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void upload(f); }}
                      className="w-full rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-[var(--accent-border)] bg-white/[0.02] hover:bg-[var(--accent-subtle)] transition-colors p-10 text-center">
                      {uploading ? <Loader2 className="w-7 h-7 text-indigo-300 animate-spin mx-auto" /> : <UploadCloud className="w-8 h-8 text-indigo-300 mx-auto" />}
                      <p className="text-[14px] font-medium text-white mt-3">{uploading ? 'Uploading' : 'Drop your resume here, or choose a file'}</p>
                      <p className="text-[12.5px] text-slate-500 mt-1">PDF, up to 5 MB</p>
                    </button>
                  )}
                  <ul className="space-y-2 text-[13px] text-slate-300">
                    {['We read your contact, education and skills from it, so you do not type them', 'Each job gets a tailored copy, made in your own file', 'Auto-apply and the extension upload it to application forms'].map(t => (
                      <li key={t} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />{t}</li>
                    ))}
                  </ul>
                </>
              )}

              {step === 3 && (
                parsing ? (
                  <div className="py-10 text-center">
                    <Sparkles className="w-7 h-7 text-indigo-300 mx-auto animate-pulse" />
                    <p className="text-[14px] text-white font-medium mt-3">Reading your resume</p>
                    <p className="text-[12.5px] text-slate-500 mt-1">This takes a few seconds.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parsed && <p className="text-[12.5px] text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Filled in from {resume?.fileName ?? 'your resume'}. Empty fields were not in it.</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Full name" value={details.name} onChange={v => setDetails(d => ({ ...d, name: v }))} />
                      <Input label="Phone" value={details.phone} onChange={v => setDetails(d => ({ ...d, phone: v }))} />
                      <Input label="City" value={details.city} onChange={v => setDetails(d => ({ ...d, city: v }))} />
                      <Input label="State" value={details.state} onChange={v => setDetails(d => ({ ...d, state: v }))} />
                      <Input label="LinkedIn" value={details.linkedIn} onChange={v => setDetails(d => ({ ...d, linkedIn: v }))} />
                      <Input label="GitHub or portfolio" value={details.github || details.website} onChange={v => setDetails(d => ({ ...d, github: v }))} />
                    </div>
                    {(details.education[0] || parsed) && (
                      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
                        <Input label="School" value={details.education[0]?.school ?? ''} onChange={v => setDetails(d => ({ ...d, education: [{ ...(d.education[0] ?? { degree: '', field: '', gpa: '', year: '', current: false }), school: v }, ...d.education.slice(1)] }))} />
                        <Input label="Graduation year" value={details.education[0]?.year ?? ''} onChange={v => setDetails(d => ({ ...d, education: [{ ...(d.education[0] ?? { school: '', degree: '', field: '', gpa: '', current: false }), year: v }, ...d.education.slice(1)] }))} />
                        <Input label="Degree" value={[details.education[0]?.degree, details.education[0]?.field].filter(Boolean).join(', ')} readOnly />
                      </div>
                    )}
                    <Input label="Skills" value={details.skills} onChange={v => setDetails(d => ({ ...d, skills: v }))} textarea />
                  </div>
                )
              )}

              <div className="flex items-center gap-3 pt-2">
                {step > 0 && <button onClick={() => setStep(step - 1)} className="btn-secondary h-11 !px-4" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>}
                <button onClick={() => next(false)} disabled={saving || !canNext || uploading || parsing} className="btn-primary h-11 flex-1 justify-center disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {step === STEPS.length - 1 ? 'Finish' : step === 2 && !resume ? 'Continue without a resume' : 'Next'}
                  {!saving && <ArrowRight className="w-4 h-4" />}
                </button>
                {step < STEPS.length - 1 && step !== 2 && <button onClick={() => next(true)} disabled={saving} className="text-[13px] text-slate-400 hover:text-white px-2">Skip</button>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[14px] font-semibold text-white mb-1">{required && <span className="text-rose-400 mr-1">*</span>}{label}</legend>
      {hint && <p className="text-[12.5px] text-slate-500 mb-2.5">{hint}</p>}
      {!hint && <div className="mb-2.5" />}
      {children}
    </fieldset>
  );
}

function Tick({ on, label, hint, onClick, radio }: { on: boolean; label: ReactNode; hint?: string; onClick: () => void; radio?: boolean }) {
  return (
    <button type="button" role={radio ? 'radio' : 'checkbox'} aria-checked={on} onClick={onClick}
      className={`w-full text-left flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${on ? 'bg-[var(--accent-subtle)] border-[var(--accent-border)]' : 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.16]'}`}>
      <span className={`mt-0.5 w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center border transition-colors ${radio ? 'rounded-full' : 'rounded-md'} ${on ? 'bg-[var(--accent)] border-transparent' : 'border-white/[0.2]'}`}>
        {on && (radio ? <span className="w-2 h-2 rounded-full bg-white" /> : <Check className="w-3 h-3 text-white" strokeWidth={3} />)}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-white">{label}</span>
        {hint && <span className="block text-[12px] text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

function Input({ label, value, onChange, textarea, readOnly }: { label: string; value: string; onChange?: (v: string) => void; textarea?: boolean; readOnly?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-slate-400 mb-1.5">{label}</span>
      {textarea
        ? <AutoTextarea className="field w-full min-h-[84px] py-2.5" value={value} onChange={e => onChange?.(e.target.value)} />
        : <input className="field w-full" value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} />}
    </label>
  );
}

function Finished({ prefs, resume, authorized, onGo }: { prefs: JobPreferences; resume: { fileName: string } | null; authorized: string; onGo: (href: string) => void }) {
  const levels = LEVEL_OPTIONS.filter(l => prefs.levels.includes(l.id)).map(l => l.label).join(', ');
  const areas = FAMILY_OPTIONS.filter(f => prefs.families.includes(f.id)).map(f => f.label).join(', ') || 'All areas';
  const items = [
    { ok: true, text: `Jobs: ${levels} in ${areas}${prefs.location ? `, ${prefs.location}` : ', anywhere in the US'}${prefs.remote ? ', open to remote' : ''}${prefs.everifyOnly ? ', E-Verified only' : ''}` },
    { ok: !!resume, text: resume ? `Default resume: ${resume.fileName}` : 'No resume yet. Add one in Settings to auto-apply' },
    { ok: !!authorized, text: authorized ? 'Work authorization answers saved for application forms' : 'Work authorization not answered. The extension will leave it for you' },
  ];
  return (
    <div className="space-y-6 animate-fade-in-up">
      <ul className="space-y-2.5">
        {items.map(i => (
          <li key={i.text} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
            {i.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <span className="w-5 h-5 rounded-full border-2 border-amber-400/70 flex-shrink-0" />}
            <span className="text-[13.5px] text-slate-200">{i.text}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => onGo('/jobs')} className="btn-primary h-11 flex-1 justify-center"><Search className="w-4 h-4" /> See jobs that match</button>
        <button onClick={() => onGo('/')} className="btn-secondary h-11 flex-1 justify-center">Go to my overview</button>
      </div>
    </div>
  );
}
