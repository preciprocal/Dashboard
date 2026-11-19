// components/apply/AutoRun.tsx
//
// Auto mode (the Auto-apply toggle on /jobs): runs the Apply flow without
// stopping for review. Tailors the student's default resume, makes every
// change that passed the fact checks (lib/applications/truthful-tailor.ts) in
// their own PDF, shown before and after in red and green,
// writes the cover letter from that resume, hands both to the extension, then
// opens the employer's portal in this tab, where the extension fills the form.
// The student still reviews and submits on the employer's site. Every step can
// be stopped, and anything that cannot continue stops with the reason, leaving
// the manual steps in place.
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Check, Loader2, AlertTriangle, X, Chrome, ArrowRight } from 'lucide-react';
import type { ApplyStepProps } from '@/components/apply/types';
import type { ApplyPack } from '@/lib/applications/pack';
import { detectExtension, extensionStoreUrl, prepareAutofill, versionAtLeast } from '@/lib/extension';
import { loadResumeOptions } from '@/lib/resume/default-client';
import ResumeChanges from '@/components/apply/ResumeChanges';
import AutoApplyDetailsNotice from '@/components/apply/AutoApplyDetailsNotice';

type Status = 'pending' | 'running' | 'done' | 'error';
type Key = 'resume' | 'approve' | 'letter' | 'extension' | 'portal';

const COUNTDOWN = 5;
const MIN_STEP_MS = 900;
// Longer when the resume file was edited, so the changes can be looked over.
const COUNTDOWN_WITH_FILE = 10;

export default function AutoRun({ application, pack, onPack, update, goTo, onBusy }: ApplyStepProps & { onBusy?: (busy: boolean) => void }) {
  const company = application.company || 'the employer';
  const [status, setStatus] = useState<Record<Key, Status>>({ resume: 'pending', approve: 'pending', letter: 'pending', extension: 'pending', portal: 'pending' });
  const [detail, setDetail] = useState<Partial<Record<Key, string>>>({});
  const [error, setError] = useState<{ message: string; action?: React.ReactNode } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stopped, setStopped] = useState(false);
  // The hand-off to the employer's site: a short, visible pause the student
  // can skip or cancel, then a clear 'opening' state while the page changes.
  const [launch, setLaunch] = useState<{ total: number } | null>(null);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const skip = useRef(false);
  const started = useRef(false);
  const cancelled = useRef(false);
  // The latest saved pack, so Try again continues from what is already done.
  const packRef = useRef(pack);
  packRef.current = pack;

  const set = (k: Key, s: Status, d?: string) => {
    if (s === 'running' && !startedAt.current[k]) startedAt.current[k] = Date.now();
    setStatus(prev => ({ ...prev, [k]: s }));
    if (d !== undefined) setDetail(prev => ({ ...prev, [k]: d }));
  };
  // Each step stays on screen long enough to be seen, even when its result
  // was already saved, so the run reads as a flow rather than a jump.
  const startedAt = useRef<Partial<Record<Key, number>>>({});
  const finish = async (k: Key, d?: string) => {
    if (!startedAt.current[k]) set(k, 'running');
    const left = MIN_STEP_MS - (Date.now() - (startedAt.current[k] ?? Date.now()));
    if (left > 0) await new Promise(r => setTimeout(r, left));
    set(k, 'done', d);
  };

  const fail = (k: Key, message: string, action?: React.ReactNode) => { set(k, 'error'); setError({ message, action }); };
  const json = async (r: Response) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`); return j; };

  // Each step is skipped when its result is already saved, so a second run
  // (Try again) continues from the step that stopped.
  const run = async (first: boolean) => {
    let p: ApplyPack = packRef.current;
    if (first) await update({ autoRunStarted: true });

    // 1. Resume
    goTo('resume');
    if (!p.tailor) {
      set('resume', 'running', 'Tailoring your resume to the job description');
      // The default resume from settings, unless one was already chosen here.
      const resumeId = p.resumeId || (await loadResumeOptions(application.resumeId)).preferredId;
      if (!resumeId) return fail('resume', 'Upload a resume first, then try again.', <Link href="/resume/upload" className="btn-secondary h-9">Upload a resume</Link>);
      try {
        p = (await json(await fetch(`/api/apply/${application.id}/tailor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resumeId }) }))).pack;
        onPack(p);
      } catch (e) { return fail('resume', e instanceof Error ? e.message : 'Could not tailor the resume.'); }
    }
    const changes = p.tailor?.changes.length ?? 0;
    await finish('resume', p.tailor?.source
      ? `${changes} change${changes === 1 ? '' : 's'} passed the fact checks and fit in ${p.tailor.source.fileName}`
      : `${changes} change${changes === 1 ? '' : 's'} passed the fact checks`);
    if (cancelled.current) return;

    // 2. Apply every change that passed the checks
    set('approve', 'running');
    const undecided = p.tailor ? p.tailor.changes.some(c => !p.tailor!.decisions[c.id]) : false;
    if (undecided) {
      const next = await update({ approveAll: true });
      if (!next) return fail('approve', 'Could not save the changes. Try again.');
      p = next;
    }
    await finish('approve', p.tailor ? `${p.tailor.before.matched.length} to ${p.tailor.after.matched.length} of ${p.keywords.length} job keywords` : 'No changes needed');
    if (cancelled.current) return;

    // 3. Cover letter
    goTo('letter');
    if (!p.coverLetter) {
      set('letter', 'running', 'Writing it from your tailored resume');
      try {
        const j = await json(await fetch('/api/cover-letter', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationId: application.id,
            jobRole: application.jobTitle, companyName: application.company || undefined,
            jobDescription: p.jobDescription || application.jobDescription || undefined,
            tone: 'professional', resumeText: p.tailor?.tailoredText || undefined,
          }),
        }));
        const next = await update({ coverLetter: { content: j.coverLetter.content } });
        if (!next) throw new Error('Could not save the letter.');
        p = next;
      } catch (e) { return fail('letter', e instanceof Error ? e.message : 'Could not write the cover letter.'); }
    }
    await finish('letter', `${p.coverLetter?.content.split(/\s+/).length ?? 0} words`);
    if (cancelled.current) return;

    // 4. Extension
    goTo('save');
    set('extension', 'running', 'Sending your tailored resume and letter');
    const url = application.jobUrl ?? '';
    if (!/^https?:\/\//i.test(url)) return fail('extension', 'This job has no posting link. Add it in step 3 to open the application.');
    const ext = await detectExtension(true);
    if (ext.status !== 'installed') {
      return fail('extension', 'The Chrome extension fills the form for you. Add it, then press Try again.',
        <a href={extensionStoreUrl('auto-apply')} target="_blank" rel="noopener noreferrer" className="btn-secondary h-9"><Chrome className="w-4 h-4" /> Add to Chrome</a>);
    }
    if (!versionAtLeast(ext.version, '1.8.0')) {
      return fail('extension', `Your extension (${ext.version ?? 'an older version'}) can't take the handoff yet. Update it from the Chrome Web Store and press Try again, or open the application below and click Autofill.`);
    }
    const ready = await prepareAutofill(application.id, url);
    if (!ready) return fail('extension', 'The extension did not respond. Check that you are signed in to it and press Try again, or open the application below and click Autofill.');
    await finish('extension', 'Ready to fill the form');
    if (cancelled.current) return;

    // 5. Portal, after a countdown the student can stop.
    // The card below says what happens next; the row just shows progress.
    set('portal', 'running', '');
    const total = p.tailor?.source && p.tailor.changes.length ? COUNTDOWN_WITH_FILE : COUNTDOWN;
    skip.current = false;
    setLaunch({ total });
    for (let s = total; s > 0 && !skip.current; s--) {
      if (cancelled.current) return;
      setCountdown(s);
      // Wakes early for Open now or Stay here.
      for (let t = 0; t < 10 && !skip.current && !cancelled.current; t++) await new Promise(r => setTimeout(r, 100));
    }
    if (cancelled.current) return;
    setLeaving(true);
    await update({ portalOpened: true });
    set('portal', 'done');
    window.location.href = url;
  };

  // The steps below lock their own buttons while a run is going (onBusy).
  const start = async (first: boolean) => {
    onBusy?.(true);
    try { await run(first); } finally { onBusy?.(false); }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start(true);
  // Runs once, on the pack as loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Starts the progress bar on the frame after the card appears, so it
  // drains smoothly over the whole countdown.
  useEffect(() => {
    if (!launch) { setArmed(false); return; }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)));
    return () => cancelAnimationFrame(id);
  }, [launch]);

  const retry = () => {
    cancelled.current = false;
    setLeaving(false);
    setStopped(false);
    setError(null);
    void start(false);
  };

  const stop = () => {
    cancelled.current = true;
    setStopped(true);
    setCountdown(null);
    setLaunch(null);
  };

  const rows: { key: Key; label: string }[] = [
    { key: 'resume', label: 'Tailor your resume' },
    { key: 'approve', label: 'Apply the changes that passed the fact checks' },
    { key: 'letter', label: 'Write your cover letter' },
    { key: 'extension', label: 'Hand them to the Chrome extension' },
    { key: 'portal', label: `Open ${company}'s application` },
  ];
  const finished = stopped || !!error;
  const doneCount = rows.filter(r => status[r.key] === 'done').length;

  return (
    <section className="glass-card p-5 border border-[var(--accent-border)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">Auto-apply</h2>
          <p className="text-[12.5px] text-slate-400 mt-0.5">
            {stopped ? 'Stopped. Carry on with the steps below, or start again.' : error ? 'Stopped at the step below.' : 'Running each step for you. You review and submit on the employer’s site.'}
          </p>
        </div>
        {!finished && !launch && <button onClick={stop} className="btn-secondary h-9 flex-shrink-0"><X className="w-4 h-4" /> Stop</button>}
        {stopped && <button onClick={retry} className="btn-secondary h-9 flex-shrink-0">Start again</button>}
      </div>
      <AutoApplyDetailsNotice context="auto-apply" className="mb-4" />
      {/* Progress across the five steps */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-700 ease-out" style={{ width: `${(doneCount / rows.length) * 100}%` }} />
        </div>
        <span className="text-[11.5px] tabular-nums text-[var(--text-4)]">{doneCount} of {rows.length}</span>
      </div>
      <ol className="relative">
        {rows.map((r, idx) => {
          const s = status[r.key];
          const active = s === 'running' && !finished;
          const last = idx === rows.length - 1;
          return (
            <li key={r.key} className="relative flex gap-3.5 pb-4 last:pb-0">
              {/* The line to the next step fills once this one is done */}
              {!last && (
                <span className="absolute left-[11px] top-7 bottom-1 w-px bg-white/[0.08] overflow-hidden" aria-hidden="true">
                  <span className={`block w-full bg-emerald-400/70 origin-top transition-transform duration-500 ease-out ${s === 'done' ? 'scale-y-100' : 'scale-y-0'}`} style={{ height: '100%' }} />
                </span>
              )}
              <span className={`relative z-[1] mt-0.5 w-[23px] h-[23px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                s === 'done' ? 'bg-emerald-400/15 text-emerald-300'
                : active ? 'bg-sky-400/15 text-sky-300 ring-4 ring-sky-400/10'
                : s === 'error' ? 'bg-amber-400/15 text-amber-300'
                : 'bg-white/[0.04] text-[var(--text-5)] ring-1 ring-inset ring-white/[0.08]'}`}>
                {s === 'done' ? <Check className="w-3 h-3" strokeWidth={3} />
                  : active ? <Loader2 className="w-3 h-3 animate-spin" />
                  : s === 'error' ? <AlertTriangle className="w-3 h-3" />
                  : <span className="text-[10.5px] font-medium tabular-nums">{idx + 1}</span>}
              </span>
              <div className={`min-w-0 flex-1 rounded-lg px-3 py-1.5 -my-1.5 transition-colors duration-300 ${active ? 'bg-white/[0.03]' : ''}`}>
                <p className={`text-[13.5px] transition-colors duration-300 ${s === 'pending' ? 'text-[var(--text-4)]' : 'text-white'} ${active ? 'font-medium' : ''}`}>{r.label}</p>
                {detail[r.key] && <p key={detail[r.key]} className="text-[12px] text-[var(--text-3)] mt-0.5 prc-fade">{detail[r.key]}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {launch && !finished && (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 animate-fade-in-up" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              {leaving ? <Loader2 className="w-4 h-4 text-emerald-300 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
            </span>
            <div className="flex-1 min-w-[220px]">
              <p className="text-[13.5px] font-semibold text-white">
                {leaving ? `Opening ${company}'s application` : <>Everything is ready. Opening {company}&apos;s application in <span className="tabular-nums">{countdown}</span>s</>}
              </p>
              <p className="text-[12.5px] text-slate-300 mt-0.5">
                {leaving
                  ? 'The extension fills in the form there. Look it over, then submit.'
                  : pack.tailor?.source
                    ? `${pack.tailor.source.fileName} with your changes and your cover letter are with the extension. Look over the changes below while you wait.`
                    : 'Your tailored resume and cover letter are with the extension.'}
              </p>
            </div>
            {!leaving && (
              <div className="flex gap-2">
                <button onClick={stop} className="btn-secondary h-9">Stay here</button>
                <button onClick={() => { skip.current = true; }} className="btn-primary h-9">Open now <ArrowRight className="w-4 h-4" /></button>
              </div>
            )}
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-emerald-400/80"
              style={{ width: armed || leaving ? '0%' : '100%', transition: `width ${leaving ? 0.3 : launch.total}s linear` }} />
          </div>
        </div>
      )}
      {pack.tailor?.source && status.approve === 'done' && (
        <div className="mt-5 pt-4 border-t border-white/[0.06]">
          <ResumeChanges applicationId={application.id} fileName={pack.tailor.source.fileName}
            count={pack.tailor.changes.filter(c => pack.tailor!.decisions[c.id] === 'approved').length}
            changes={pack.tailor.changes.filter(c => pack.tailor!.decisions[c.id] === 'approved')}
            version={`${pack.tailor.generatedAt}:${pack.tailor.changes.filter(c => pack.tailor!.decisions[c.id] === 'approved').map(c => c.id).join(',')}`} />
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3.5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-amber-100 flex-1 min-w-[200px]">{error.message}</p>
          <div className="flex gap-2">
            {error.action}
            <button onClick={retry} className="btn-primary h-9">Try again</button>
          </div>
        </div>
      )}
    </section>
  );
}
