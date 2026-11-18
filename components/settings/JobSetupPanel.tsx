'use client';
// components/settings/JobSetupPanel.tsx
//
// Settings > Job setup. Everything onboarding asks (app/onboarding), editable
// at any time: the jobs wanted, work authorization, the default resume and the
// details read from it. Accounts made before onboarding existed fill it in
// here instead of being sent through the first-run flow. Saves to the same
// place (/api/onboarding), so Jobs, Auto-apply and the extension see it.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Briefcase, Check, CheckCircle2, FileText, Loader2, MapPin, ShieldCheck, Sparkles, UploadCloud, UserRound } from 'lucide-react';
import MarketPay from '@/components/onboarding/MarketPay';
import AutoTextarea from '@/components/ui/auto-textarea';
import { SwitchRow } from '@/components/profile/FormKit';
import { DEFAULT_PREFERENCES, FAMILY_OPTIONS, LEVEL_OPTIONS, STATUS_OPTIONS, type JobPreferences } from '@/lib/onboarding/preferences';

interface Education { school: string; degree: string; field: string; gpa: string; year: string; current: boolean }
interface Details { name: string; phone: string; city: string; state: string; linkedIn: string; github: string; website: string; headline: string; skills: string; education: Education[] }
interface Loaded {
  preferences: JobPreferences; completed: boolean;
  profile: Details & { workAuthorization: string | boolean | null; requireSponsorship: string | boolean | null; visaType: string; desiredSalary: string };
  resume: { fileName: string } | null;
}

const EMPTY_DETAILS: Details = { name: '', phone: '', city: '', state: '', linkedIn: '', github: '', website: '', headline: '', skills: '', education: [] };
const EMPTY_EDU: Education = { school: '', degree: '', field: '', gpa: '', year: '', current: false };

const chip = (on: boolean) => `inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] transition-colors ring-1 ring-inset ${on ? 'bg-white/[0.08] text-white ring-white/[0.16]' : 'text-[var(--text-3)] ring-white/[0.07] hover:text-white hover:bg-white/[0.04]'}`;
const labelCls = 'block text-[12.5px] font-medium text-[var(--text-2)] mb-2';

async function post(body: Record<string, unknown>) {
  // complete: true marks the setup as done, so the overview stops asking.
  const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, complete: true }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not save');
}

export default function JobSetupPanel() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [prefs, setPrefs] = useState<JobPreferences>(DEFAULT_PREFERENCES);
  const [anywhere, setAnywhere] = useState(true);
  const [salary, setSalary] = useState('');
  const [status, setStatus] = useState('');
  const [authorized, setAuthorized] = useState<'Yes' | 'No' | ''>('');
  const [sponsorship, setSponsorship] = useState<boolean | null>(null);
  const [resume, setResume] = useState<{ fileName: string } | null>(null);
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [saving, setSaving] = useState<'jobs' | 'auth' | 'details' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/onboarding', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(r.status))).then((j: Loaded) => {
      if (!alive) return;
      setLoaded(j);
      setPrefs(j.preferences);
      setAnywhere(!j.preferences.location);
      setSalary(j.profile.desiredSalary ?? '');
      setStatus(STATUS_OPTIONS.find(o => o.visaType === j.profile.visaType)?.id ?? '');
      if (j.profile.workAuthorization === 'Yes' || j.profile.workAuthorization === 'No') setAuthorized(j.profile.workAuthorization);
      if (typeof j.profile.requireSponsorship === 'boolean') setSponsorship(j.profile.requireSponsorship);
      setResume(j.resume);
      setDetails({ ...EMPTY_DETAILS, ...j.profile, education: j.profile.education ?? [] });
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const run = async (which: 'jobs' | 'auth' | 'details', body: Record<string, unknown>, done: string) => {
    setSaving(which);
    try {
      await post(body);
      toast.success(done);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(null);
    }
  };

  const toggle = <K extends 'families' | 'levels'>(key: K, id: JobPreferences[K][number]) =>
    setPrefs(v => {
      const list = v[key] as string[];
      return { ...v, [key]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] };
    });

  const chooseStatus = (id: string) => {
    setStatus(id);
    const s = STATUS_OPTIONS.find(o => o.id === id)?.suggest;
    if (s) { setAuthorized(s.authorized); setSponsorship(s.sponsorship); }
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
      toast.success(`${file.name} is your default resume`);
    } catch {
      toast.error('Could not upload that file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const readResume = async () => {
    setParsing(true);
    try {
      const r = await fetch('/api/onboarding/parse-resume', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.message(j.error || 'Could not read your resume. You can fill in the details yourself.'); return; }
      const d = j.details as Details;
      // What is already saved wins; the resume only fills the blanks.
      setDetails(prev => ({
        name: prev.name || d.name, phone: prev.phone || d.phone, city: prev.city || d.city, state: prev.state || d.state,
        linkedIn: prev.linkedIn || d.linkedIn, github: prev.github || d.github, website: prev.website || d.website,
        headline: prev.headline || d.headline, skills: prev.skills || d.skills,
        education: prev.education.length ? prev.education : d.education,
      }));
      toast.success('Blank fields filled in from your resume. Check them, then save.');
    } catch {
      toast.error('Could not read your resume. You can fill in the details yourself.');
    } finally {
      setParsing(false);
    }
  };

  if (failed) {
    return <Card icon={Briefcase} title="Job setup" subtitle="Could not load your setup."><p className="text-[13px] text-[var(--text-3)]">Please refresh the page to try again.</p></Card>;
  }
  if (!loaded) {
    return <div className="glass-card p-10 flex justify-center"><Loader2 className="w-5 h-5 text-[var(--text-4)] animate-spin" /></div>;
  }

  const edu = details.education[0] ?? EMPTY_EDU;
  const setEdu = (patch: Partial<Education>) => setDetails(d => ({ ...d, education: [{ ...(d.education[0] ?? EMPTY_EDU), ...patch }, ...d.education.slice(1)] }));
  const setD = (k: keyof Omit<Details, 'education'>) => (v: string) => setDetails(d => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      {!loaded.completed && (
        <div className="glass-card p-4 flex items-start gap-3 ring-1 ring-inset ring-[var(--accent-border)]">
          <Sparkles className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
          <p className="text-[13px] text-[var(--text-2)]">Fill these in once and Jobs shows matching roles first, while Auto-apply and the extension answer application forms for you. Each part saves on its own.</p>
        </div>
      )}

      {/* Jobs wanted */}
      <Card icon={Briefcase} title="Jobs you want" subtitle="Jobs opens on these. You can still change filters for any search.">
        <div className="space-y-6">
          <div>
            <span className={labelCls}>Area</span>
            <div className="flex flex-wrap gap-2">
              {FAMILY_OPTIONS.map(f => {
                const on = prefs.families.includes(f.id);
                return <button key={f.id} type="button" aria-pressed={on} title={f.hint} onClick={() => toggle('families', f.id)} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}{f.label}</button>;
              })}
            </div>
            {!prefs.families.length && <p className="text-[11.5px] text-[var(--text-5)] mt-2">None picked: all areas are shown.</p>}
          </div>
          <div>
            <label htmlFor="js-role" className={labelCls}>Target role</label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-[var(--text-5)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input id="js-role" className="field w-full !pl-10" placeholder="e.g. Data analyst" maxLength={80} value={prefs.role} onChange={e => setPrefs(v => ({ ...v, role: e.target.value }))} />
            </div>
          </div>
          <div>
            <span className={labelCls}>Level</span>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map(l => {
                const on = prefs.levels.includes(l.id);
                return <button key={l.id} type="button" aria-pressed={on} title={l.hint} onClick={() => toggle('levels', l.id)} className={chip(on)}>{on && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}{l.label}</button>;
              })}
            </div>
            {!prefs.levels.length && <p className="text-[11.5px] text-rose-300 mt-2">Pick at least one level.</p>}
          </div>
          <div>
            <span className={labelCls}>Location</span>
            <div role="radiogroup" className="inline-flex flex-wrap p-0.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
              {[{ v: true, t: 'Anywhere in the US' }, { v: false, t: 'A city or state' }].map(o => (
                <button key={o.t} type="button" role="radio" aria-checked={anywhere === o.v} onClick={() => setAnywhere(o.v)}
                  className={`h-8 px-3 rounded-md text-[12.5px] font-medium transition-colors ${anywhere === o.v ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`}>
                  {o.t}
                </button>
              ))}
            </div>
            {!anywhere && (
              <div className="relative mt-2">
                <MapPin className="w-4 h-4 text-[var(--text-5)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className="field w-full !pl-10" placeholder="e.g. Boston or New York" maxLength={60} value={prefs.location} onChange={e => setPrefs(v => ({ ...v, location: e.target.value }))} />
              </div>
            )}
            <div className="mt-2"><SwitchRow value={prefs.remote} onChange={v => setPrefs(x => ({ ...x, remote: v }))} label="Open to remote" /></div>
          </div>
          <div>
            <span className={labelCls}>Pay</span>
            <MarketPay role={prefs.role} location={anywhere ? '' : prefs.location} value={salary} onChange={setSalary} />
          </div>
        </div>
        <Footer>
          <button type="button" className="btn-primary !h-9 !text-[13px]" disabled={saving !== null || !prefs.levels.length || (!anywhere && !prefs.location.trim())}
            onClick={() => run('jobs', { preferences: { ...prefs, role: prefs.role.trim(), location: anywhere ? '' : prefs.location.trim() }, desiredSalary: salary }, 'Job preferences saved')}>
            {saving === 'jobs' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
          </button>
        </Footer>
      </Card>

      {/* Work authorization */}
      <Card icon={ShieldCheck} title="Work authorization" subtitle="Application forms ask this every time. The extension answers only with what you choose here.">
        <div className="space-y-6">
          <div>
            <span className={labelCls}>Your current status</span>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map(o => <button key={o.id} type="button" role="radio" aria-checked={status === o.id} onClick={() => chooseStatus(o.id)} className={chip(status === o.id)}>{status === o.id && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}{o.label}</button>)}
            </div>
          </div>
          <YesNo label="Are you legally authorized to work in the US?" value={authorized === '' ? null : authorized === 'Yes'} onChange={v => setAuthorized(v ? 'Yes' : 'No')} />
          <YesNo label="Will you now or in the future need visa sponsorship?" hint="F-1 students usually answer Yes, since OPT ends." value={sponsorship} onChange={setSponsorship} />
          <div className="space-y-2">
            <SwitchRow value={prefs.everifyOnly} onChange={v => setPrefs(x => ({ ...x, everifyOnly: v }))} label="Only E-Verified employers" desc="Needed for a STEM OPT extension" />
            <SwitchRow value={prefs.h1bOnly} onChange={v => setPrefs(x => ({ ...x, h1bOnly: v }))} label="Only employers with H-1B approvals" />
          </div>
        </div>
        <Footer>
          <button type="button" className="btn-primary !h-9 !text-[13px]" disabled={saving !== null || !prefs.levels.length}
            onClick={() => run('auth', {
              preferences: { ...prefs, role: prefs.role.trim(), location: anywhere ? '' : prefs.location.trim() },
              ...(authorized ? { workAuthorization: authorized } : {}),
              ...(sponsorship !== null ? { requireSponsorship: sponsorship } : {}),
              ...(status ? { visaType: STATUS_OPTIONS.find(o => o.id === status)!.visaType } : {}),
            }, 'Work authorization saved')}>
            {saving === 'auth' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
          </button>
        </Footer>
      </Card>

      {/* Resume and details */}
      <Card icon={UserRound} title="Resume and details" subtitle="Your default resume, and the contact and school details read from it.">
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/[0.07] bg-white/[0.02]">
          <span className="w-10 h-10 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] flex items-center justify-center text-[var(--text-2)] flex-shrink-0">
            {resume ? <FileText className="w-4 h-4" /> : <UploadCloud className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-medium text-white truncate">{resume ? resume.fileName : 'No default resume yet'}</p>
            <p className="text-[12px] text-[var(--text-4)]">{resume ? 'Tailored for each job and uploaded to application forms' : 'PDF, up to 5 MB'}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {resume && (
              <button type="button" onClick={readResume} disabled={parsing || uploading} className="btn-secondary !h-9 !text-[13px]">
                {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Fill from resume
              </button>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || parsing} className="btn-secondary !h-9 !text-[13px]">
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{resume ? 'Replace' : 'Upload'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
          <Input label="Full name" value={details.name} onChange={setD('name')} />
          <Input label="Phone" value={details.phone} onChange={setD('phone')} />
          <Input label="City" value={details.city} onChange={setD('city')} />
          <Input label="State" value={details.state} onChange={setD('state')} />
          <Input label="LinkedIn" value={details.linkedIn} onChange={setD('linkedIn')} />
          <Input label="GitHub or portfolio" value={details.github || details.website} onChange={setD('github')} />
          <Input label="School" value={edu.school} onChange={v => setEdu({ school: v })} />
          <Input label="Graduation year" value={edu.year} onChange={v => setEdu({ year: v })} />
        </div>
        <label className="block mt-3">
          <span className="block text-[12px] text-[var(--text-3)] mb-1.5">Skills</span>
          <AutoTextarea className="field w-full min-h-[84px] py-2.5" value={details.skills} onChange={e => setD('skills')(e.target.value)} />
        </label>
        <p className="text-[12px] text-[var(--text-4)] mt-3">More application details, like EEO answers and notice period, are in <Link href="/profile?tab=auto-apply" className="text-[var(--text-2)] underline underline-offset-2 hover:text-white">Profile, Auto-apply</Link>.</p>
        <Footer>
          <button type="button" className="btn-primary !h-9 !text-[13px]" disabled={saving !== null || parsing}
            onClick={() => run('details', { details }, 'Details saved')}>
            {saving === 'details' && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
          </button>
        </Footer>
      </Card>

      {loaded.completed && (
        <p className="text-[12px] text-[var(--text-4)] flex items-center gap-1.5 px-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Your job setup is in use across Jobs, Auto-apply and the extension.</p>
      )}
    </div>
  );
}

function Card({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] flex-shrink-0">
          <Icon className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-white">{title}</h3>
          <p className="text-[12.5px] text-[var(--text-3)] mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex justify-end mt-5 pt-4 border-t border-white/[0.06]">{children}</div>;
}

function YesNo({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {hint && <p className="text-[11.5px] text-[var(--text-4)] -mt-1 mb-2">{hint}</p>}
      <div role="radiogroup" className="inline-flex p-0.5 rounded-lg bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
        {[{ v: true, t: 'Yes' }, { v: false, t: 'No' }].map(o => (
          <button key={o.t} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
            className={`h-8 px-4 rounded-md text-[12.5px] font-medium transition-colors ${value === o.v ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]' : 'text-[var(--text-4)] hover:text-[var(--text-1)]'}`}>
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-[var(--text-3)] mb-1.5">{label}</span>
      <input className="field w-full" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
