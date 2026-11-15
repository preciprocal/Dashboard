// components/apply/SaveStep.tsx
//
// Step 3: apply on the employer's own form. Applications are submitted there,
// never by us: each employer's form has its own questions (work authorization,
// sponsorship, demographics) that the student answers. The Chrome extension
// fills that form from the student's application details, so this step checks
// everything is ready first, then opens the form and records the submission.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, CheckCircle2, Circle, ExternalLink, Chrome, Download, Copy, FileText, Pen, UserRound,
  ChevronRight, Send, AlertTriangle, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ApplyStepProps } from '@/components/apply/types';
import { useExtensionStatus, extensionStoreUrl } from '@/lib/extension';
import { tailoredResumePdf } from '@/lib/applications/resume-pdf';

interface ApplyProfile {
  firstName: string; lastName: string; email: string; phone: string; city: string; state: string;
  linkedInUrl: string; workAuthorization: string | null; requireSponsorship: boolean | null;
}
interface ProfileResponse { applyProfile: ApplyProfile; files: { resume: { available: boolean; fileName: string | null } } }

function Step({ n, done, title, children, last = false }: { n: number; done: boolean; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-4">
      {!last && <span className="absolute left-[15px] top-9 bottom-0 w-px bg-white/[0.08]" aria-hidden />}
      <span className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-semibold border
        ${done ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/[0.03] border-white/[0.1] text-slate-300'}`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-7">
        <h3 className="text-sm font-semibold text-white mt-1.5 mb-2">{title}</h3>
        {children}
      </div>
    </li>
  );
}

export default function SaveStep({ application, pack, update, goTo }: ApplyStepProps) {
  const ext = useExtensionStatus();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [jobUrl, setJobUrl] = useState(application.jobUrl ?? '');
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/extension/auto-apply')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setProfileError(true));
  }, []);

  const p = profile?.applyProfile;
  const fields: { label: string; ok: boolean; optional?: boolean }[] = p ? [
    { label: 'Name', ok: !!(p.firstName && p.lastName) },
    { label: 'Email', ok: !!p.email },
    { label: 'Phone', ok: !!p.phone },
    { label: 'Location', ok: !!(p.city || p.state) },
    { label: 'LinkedIn', ok: !!p.linkedInUrl, optional: true },
    { label: 'Work authorization', ok: p.workAuthorization !== null && p.workAuthorization !== '' },
    { label: 'Sponsorship answer', ok: p.requireSponsorship !== null },
  ] : [];
  const missing = fields.filter(f => !f.ok && !f.optional);
  const detailsReady = !!p && missing.length === 0;
  const tailored = pack.tailor?.tailoredText ?? '';
  const company = application.company || 'the employer';
  const fileBase = `${[p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Resume'} - ${application.company || application.jobTitle}`;

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error('Could not copy'); }
  };

  const open = async () => {
    const url = jobUrl.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error('Add the link to the job posting first.'); return; }
    if (url !== (application.jobUrl ?? '')) {
      await fetch('/api/job-tracker', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: application.id, jobUrl: url }) });
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpened(true);
  };

  const submitted = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/job-tracker', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: application.id,
          // Only moves a not-yet-applied job forward; a later stage is kept.
          ...(application.status === 'wishlist' ? { status: 'applied', appliedDate: new Date().toISOString().slice(0, 10) } : {}),
          ...(pack.resumeId ? { resumeId: pack.resumeId } : {}),
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not update the tracker');
      await update({ savedToTracker: true });
      toast.success('Marked as applied in your tracker');
      goTo('prep');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the tracker');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
      <section className="glass-card p-5 sm:p-6">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white">Apply on {company}&apos;s site</h2>
          <p className="text-[13px] text-slate-400 mt-1">You submit on the employer&apos;s own form. The Preciprocal extension fills it in with your details, and you review every answer before sending.</p>
        </div>

        <ol>
          <Step n={1} done={ext.status === 'installed'} title="Chrome extension">
            {ext.status === 'checking' ? (
              <p className="text-[13px] text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking this browser</p>
            ) : ext.status === 'installed' ? (
              <p className="text-[13px] text-slate-300">Installed{ext.version ? ` (version ${ext.version})` : ''}. It works on Greenhouse, Lever, Ashby, Workday and other application forms.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13px] text-slate-300">Not found in this browser.</p>
                <a href={extensionStoreUrl('apply-flow')} target="_blank" rel="noopener noreferrer" className="btn-secondary h-9"><Chrome className="w-4 h-4" /> Add to Chrome</a>
                <button onClick={ext.recheck} className="text-xs text-slate-400 hover:text-white">I installed it</button>
              </div>
            )}
          </Step>

          <Step n={2} done={detailsReady} title="Your application details">
            {profileError ? (
              <p className="text-[13px] text-slate-400">Could not load your details. <Link href="/profile?tab=auto-apply" className="text-indigo-300 hover:underline">Open them in your profile</Link>.</p>
            ) : !p ? (
              <p className="text-[13px] text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {fields.map(f => (
                    <span key={f.label} className={`inline-flex items-center gap-1 text-[11.5px] rounded-md border px-2 py-1
                      ${f.ok ? 'text-emerald-200 bg-emerald-500/[0.07] border-emerald-500/20' : f.optional ? 'text-slate-400 border-white/[0.08]' : 'text-amber-200 bg-amber-500/[0.07] border-amber-500/25'}`}>
                      {f.ok ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}{f.label}{!f.ok && f.optional ? ' (optional)' : ''}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {missing.length > 0 && <p className="text-[12.5px] text-amber-200/90">{missing.length} missing. The extension leaves those questions blank for you to answer.</p>}
                  <Link href="/profile?tab=auto-apply" className="inline-flex items-center gap-1.5 text-[12.5px] text-indigo-300 hover:underline">
                    <UserRound className="w-3.5 h-3.5" /> {missing.length ? 'Complete your details' : 'Review your details'}
                  </Link>
                </div>
              </>
            )}
          </Step>

          <Step n={3} done={!!tailored && !!pack.coverLetter} title="Your resume and cover letter">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <p className="text-[13px] font-medium text-white flex items-center gap-2"><FileText className="w-4 h-4 text-indigo-300" /> Tailored resume</p>
                {tailored ? (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => tailoredResumePdf(tailored, fileBase)} className="btn-primary h-9 flex-1 justify-center"><Download className="w-4 h-4" /> PDF</button>
                    <button onClick={() => copy(tailored, 'Resume text')} className="btn-secondary h-9 !px-3" aria-label="Copy resume text"><Copy className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <button onClick={() => goTo('resume')} className="mt-2 text-[12.5px] text-indigo-300 hover:underline">Tailor it in step 1</button>
                )}
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <p className="text-[13px] font-medium text-white flex items-center gap-2"><Pen className="w-4 h-4 text-indigo-300" /> Cover letter</p>
                {pack.coverLetter ? (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => copy(pack.coverLetter!.content, 'Cover letter')} className="btn-secondary h-9 flex-1 justify-center"><Copy className="w-4 h-4" /> Copy</button>
                  </div>
                ) : (
                  <button onClick={() => goTo('letter')} className="mt-2 text-[12.5px] text-indigo-300 hover:underline">Write it in step 2</button>
                )}
              </div>
            </div>
            {profile?.files.resume.available && tailored && (
              <p className="text-[12px] text-slate-500 mt-2.5 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0 mt-0.5" />
                The extension attaches your saved resume, {profile.files.resume.fileName}. On the form, replace it with the tailored PDF.
              </p>
            )}
          </Step>

          <Step n={4} done={!!pack.savedToTrackerAt} title="Open the application and autofill" last>
            {!application.jobUrl && (
              <label className="relative block mb-3">
                <Link2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input className="field w-full pl-10" placeholder="Link to the job posting" value={jobUrl} onChange={e => setJobUrl(e.target.value)} />
              </label>
            )}
            <button onClick={open} className="btn-primary w-full sm:w-auto justify-center">
              <ExternalLink className="w-4 h-4" /> Open {company} application
            </button>
            {opened && (
              <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-4">
                <ol className="space-y-1.5 text-[13px] text-indigo-50 list-decimal pl-4">
                  <li>On the form, click <span className="font-semibold">Autofill Application</span> in the Preciprocal panel.</li>
                  <li>Upload the tailored PDF and paste your cover letter where asked.</li>
                  <li>Check every answer, then submit on their site.</li>
                </ol>
                <button onClick={submitted} disabled={saving} className="btn-primary mt-4 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} I&apos;ve submitted it
                </button>
              </div>
            )}
            {pack.savedToTrackerAt && (
              <p className="text-[12.5px] text-emerald-300 mt-3 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Marked applied {new Date(pack.savedToTrackerAt).toLocaleDateString()}.</p>
            )}
          </Step>
        </ol>
      </section>

      <aside className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">After you submit</h3>
          <p className="text-[12.5px] text-slate-400 mt-1 leading-relaxed">The job moves to Applied in your <Link href="/job-tracker" className="text-indigo-300 hover:underline">tracker</Link>, where its card shows the company&apos;s E-Verify status and H-1B history.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Why you submit it yourself</h3>
          <p className="text-[12.5px] text-slate-400 mt-1 leading-relaxed">Every employer asks its own questions, including work authorization and sponsorship. Your answers there are yours to give, so the extension fills what it knows and leaves the rest for you.</p>
        </div>
        <button onClick={() => goTo('prep')} className="btn-secondary w-full justify-center">Skip to interview prep <ChevronRight className="w-4 h-4" /></button>
      </aside>
    </div>
  );
}
