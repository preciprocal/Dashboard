// components/apply/TailorStep.tsx
//
// Step 1: propose resume changes for this job and review them one at a time.
// Every change shown has passed the fact checks in
// lib/applications/truthful-tailor.ts; nothing is applied until approved.
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, X, Sparkles, Copy, Download, ShieldCheck, ChevronRight, Info } from 'lucide-react';
import { toast } from 'sonner';
import ResumePicker, { type ResumeOption } from '@/components/apply/ResumePicker';
import type { ApplyStepProps } from '@/components/apply/types';
import { loadResumeOptions } from '@/lib/resume/default-client';


export default function TailorStep({ application, pack, onPack, update, goTo }: ApplyStepProps) {
  const [resumes, setResumes] = useState<ResumeOption[] | null>(null);
  const [resumeId, setResumeId] = useState(pack.resumeId || '');
  const [jd, setJd] = useState(pack.jobDescription || application.jobDescription || '');
  const [editJd, setEditJd] = useState(!(pack.jobDescription || application.jobDescription));
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    // The default resume from settings comes first and is used unless one
    // was already chosen for this application.
    loadResumeOptions(application.resumeId)
      .then(({ options, preferredId }) => {
        setResumes(options);
        setResumeId(prev => prev || preferredId);
      })
      .catch(() => setResumes([]));
  }, [application.resumeId]);

  const propose = async () => {
    if (!resumeId) { toast.error('Choose a resume first.'); return; }
    if (jd.trim().length < 50) { toast.error('Add the job description first.'); return; }
    setRunning(true);
    try {
      const r = await fetch(`/api/apply/${application.id}/tailor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, jobDescription: jd }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not tailor the resume');
      onPack(j.pack);
      setEditJd(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not tailor the resume');
    } finally {
      setRunning(false);
    }
  };

  const decide = async (id: string, d: 'approved' | 'rejected') => {
    const current = pack.tailor?.decisions[id];
    setPending(id);
    const next = await update({ decisions: { [id]: current === d ? null : d } });
    setPending(null);
    if (!next) toast.error('Could not save that. Try again.');
  };

  const t = pack.tailor;
  const reviewed = t ? t.changes.filter(c => t.decisions[c.id]).length : 0;
  const approved = t ? t.changes.filter(c => t.decisions[c.id] === 'approved').length : 0;

  const copy = async () => {
    if (!t) return;
    await navigator.clipboard.writeText(t.tailoredText);
    toast.success('Copied');
  };
  const download = () => {
    if (!t) return;
    const blob = new Blob([t.tailoredText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Resume - ${application.company || application.jobTitle}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <section className="glass-card p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 min-w-0">
            <span className="block text-xs text-slate-400 mb-1.5">Resume to tailor</span>
            <ResumePicker resumes={resumes} value={resumeId} onChange={setResumeId} />
          </label>
          <button onClick={propose} disabled={running || !resumeId} className="btn-primary justify-center disabled:opacity-50">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {t ? 'Propose again' : 'Propose changes'}
          </button>
        </div>
        {editJd ? (
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1.5">Job description</span>
            <textarea className="field w-full min-h-[180px] py-3 leading-relaxed" value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description" />
          </label>
        ) : (
          <button onClick={() => setEditJd(true)} className="text-xs text-slate-400 hover:text-white transition-colors">Job description saved ({jd.length.toLocaleString()} characters). Edit</button>
        )}
        {running && <p className="text-xs text-slate-400">Reading the job and your resume. This takes about 20 seconds.</p>}
      </section>

      {t && (
        <>
          {/* Keyword match */}
          <section className="glass-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Job keywords found in your resume</p>
                <p className="text-2xl font-semibold text-white tabular-nums">
                  {t.before.matched.length}
                  <span className="text-slate-500 mx-2">to</span>
                  <span className={t.after.matched.length > t.before.matched.length ? 'text-emerald-400' : ''}>{t.after.matched.length}</span>
                  <span className="text-base text-slate-400 font-normal"> of {pack.keywords.length}</span>
                </p>
              </div>
              <p className="text-[12px] text-slate-500 max-w-sm">A count of this job&apos;s keywords that appear in the text. It does not predict how any applicant tracking system will rank you.</p>
            </div>
            {t.after.missing.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-slate-400 mb-2">Not on your resume. Add one only if you have the skill; otherwise prepare to talk about it.</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.after.missing.map(k => <span key={k} className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300">{k}</span>)}
                </div>
              </div>
            )}
          </section>

          {/* Changes */}
          <section className="glass-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="text-sm font-semibold text-white">Proposed changes</h2>
              <span className="text-xs text-slate-400 tabular-nums">{reviewed} of {t.changes.length} reviewed, {approved} approved</span>
            </div>
            <p className="text-[12px] text-slate-500 mb-4 flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
              Each change only rewords what your resume already says.
              {t.removedByChecks > 0 && ` ${t.removedByChecks} proposed change${t.removedByChecks === 1 ? ' was' : 's were'} removed because ${t.removedByChecks === 1 ? 'it' : 'they'} added a number, tool or skill your resume does not have.`}
            </p>
            {t.changes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No changes passed the checks. Your resume may already use this job&apos;s language.</p>
            ) : (
              <ol className="space-y-3">
                {t.changes.map((c, i) => {
                  const d = t.decisions[c.id];
                  return (
                    <li key={c.id} className={`rounded-xl border p-4 transition-colors ${d === 'approved' ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : d === 'rejected' ? 'border-white/[0.04] bg-white/[0.01] opacity-60' : 'border-white/[0.08] bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] text-slate-500">{i + 1}. {c.section || 'Resume'}</span>
                        {c.keywordsAdded.length > 0 && (
                          <span className="flex flex-wrap gap-1 justify-end">
                            {c.keywordsAdded.map(k => <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-indigo-200">{k}</span>)}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-3">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Original</p>
                          <p className="text-[13px] text-slate-400 leading-relaxed">{c.original}</p>
                        </div>
                        <div className="rounded-lg bg-white/[0.03] border border-white/[0.08] p-3">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Rewrite</p>
                          <p className="text-[13px] text-white leading-relaxed">{c.rewrite}</p>
                        </div>
                      </div>
                      {c.reason && <p className="text-[12px] text-slate-500 mt-2">{c.reason}</p>}
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => decide(c.id, 'approved')} disabled={pending === c.id}
                          className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${d === 'approved' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'border-white/[0.08] text-slate-300 hover:bg-white/[0.04]'}`}>
                          <Check className="w-3.5 h-3.5" /> {d === 'approved' ? 'Approved' : 'Approve'}
                        </button>
                        <button onClick={() => decide(c.id, 'rejected')} disabled={pending === c.id}
                          className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${d === 'rejected' ? 'bg-white/[0.06] border-white/[0.12] text-slate-300' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
                          <X className="w-3.5 h-3.5" /> {d === 'rejected' ? 'Kept original' : 'Keep original'}
                        </button>
                        {pending === c.id && <Loader2 className="w-4 h-4 animate-spin text-slate-500 self-center" />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Result */}
          <section className="glass-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-semibold text-white">Your resume for this job</h2>
              <div className="flex gap-2">
                <button onClick={copy} className="btn-secondary"><Copy className="w-4 h-4" /> Copy</button>
                <button onClick={download} className="btn-secondary"><Download className="w-4 h-4" /> Download .txt</button>
              </div>
            </div>
            <p className="text-[12px] text-slate-500 mb-3 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> The text of your resume with the {approved} approved change{approved === 1 ? '' : 's'}. Paste it into your own resume file to keep your formatting.</p>
            <pre className="whitespace-pre-wrap text-[12.5px] text-slate-300 leading-relaxed bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 max-h-[420px] overflow-y-auto font-sans">{t.tailoredText}</pre>
            <div className="flex justify-end mt-4">
              <button onClick={() => goTo('letter')} className="btn-primary">Next: cover letter <ChevronRight className="w-4 h-4" /></button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
