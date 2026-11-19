// components/apply/LetterStep.tsx
//
// Step 2: a cover letter written from the resume the student approved in
// step 1 and the job description (app/api/cover-letter, with resumeText).
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pen, Copy, Save, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { AppSelect } from '@/components/ui/select';
import type { ApplyStepProps } from '@/components/apply/types';

import type { WritingCheck } from '@/lib/ai/writing-check';
import AutoLockNote from '@/components/apply/AutoLockNote';

export default function LetterStep({ application, pack, update, goTo, autoRunning = false }: ApplyStepProps) {
  const [text, setText] = useState(pack.coverLetter?.content ?? '');
  const [tone, setTone] = useState('professional');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authenticity, setAuthenticity] = useState<WritingCheck | null>(null);

  useEffect(() => { setText(pack.coverLetter?.content ?? ''); }, [pack.coverLetter?.content]);

  const jd = pack.jobDescription || application.jobDescription || '';
  const resumeText = pack.tailor?.tailoredText ?? '';

  const generate = async () => {
    setRunning(true);
    try {
      const r = await fetch('/api/cover-letter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: application.id, jobRole: application.jobTitle, companyName: application.company || undefined, jobDescription: jd || undefined, tone, resumeText: resumeText || undefined, useTemplate: true }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Could not write the letter');
      setText(j.coverLetter.content);
      setAuthenticity(j.authenticity ?? null);
      await update({ coverLetter: { content: j.coverLetter.content } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not write the letter');
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const next = await update({ coverLetter: { content: text } });
    setSaving(false);
    if (next) toast.success('Saved'); else toast.error('Could not save. Try again.');
  };

  // Numbers or tools in the letter that the resume does not contain, and phrasing that reads as machine-written.
  const flags = [
    ...(authenticity?.unsupported ?? []).map(u => `"${u.text}" is not in your resume. Make sure the letter does not claim it as your experience.`),
    ...(authenticity?.aiTells ?? []).map(t => `"${t.phrase}" reads as machine-written. ${t.suggestion}`),
  ];
  const dirty = text !== (pack.coverLetter?.content ?? '');
  // Writing, saving or Auto-apply: one at a time, so no letter is saved over another.
  const busy = autoRunning || running || saving;

  return (
    <section className="glass-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Cover letter</h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {resumeText ? 'Written from the resume you approved in step 1 and the job description.' : 'Tailor your resume in step 1 first, so the letter matches it.'}
          </p>
        </div>
        <AppSelect className="sm:w-44" value={tone} onValueChange={v => { if (!busy) setTone(v); }} aria-label="Tone" options={[
          { value: 'professional', label: 'Professional' }, { value: 'friendly', label: 'Friendly' },
          { value: 'enthusiastic', label: 'Enthusiastic' }, { value: 'confident', label: 'Confident' },
        ]} />
        <button onClick={generate} disabled={busy || !resumeText} className="btn-primary justify-center disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pen className="w-4 h-4" />} {pack.coverLetter ? 'Write again' : 'Write letter'}
        </button>
      </div>

      {autoRunning && <AutoLockNote what="writing this letter" />}

      {flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3">
          <p className="text-xs font-medium text-amber-300 flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Check these before sending</p>
          <ul className="text-xs text-slate-300 space-y-0.5 list-disc pl-5">{flags.map(f => <li key={f}>{f}</li>)}</ul>
        </div>
      )}

      {text || running ? (
        <textarea className="field w-full min-h-[420px] py-3 leading-relaxed" value={text} onChange={e => setText(e.target.value)} disabled={busy} />
      ) : (
        <p className="text-sm text-slate-400 text-center py-10">No letter yet.</p>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          <button onClick={save} disabled={!dirty || busy} className="btn-secondary disabled:opacity-40"><Save className="w-4 h-4" /> Save edits</button>
          <button onClick={async () => { await navigator.clipboard.writeText(text); toast.success('Copied'); }} disabled={!text} className="btn-secondary disabled:opacity-40"><Copy className="w-4 h-4" /> Copy</button>
        </div>
        <button onClick={() => goTo('save')} className="btn-primary">Next: apply <ChevronRight className="w-4 h-4" /></button>
      </div>
    </section>
  );
}
