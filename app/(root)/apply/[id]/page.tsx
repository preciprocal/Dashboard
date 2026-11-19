// app/(root)/apply/[id]/page.tsx
//
// "Apply to this job" for one tracked application, in four steps:
// tailor the resume (each change approved one by one), the cover letter,
// save to the tracker, then prep for each interview round.
'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, FileText, Pen, CheckCircle2, FolderCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import AnimatedLoader from '@/components/loader/AnimatedLoader';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';
import TailorStep from '@/components/apply/TailorStep';
import LetterStep from '@/components/apply/LetterStep';
import SaveStep from '@/components/apply/SaveStep';
import PrepStep from '@/components/apply/PrepStep';
import TrackerStep from '@/components/apply/TrackerStep';
import AutoRun from '@/components/apply/AutoRun';
import type { ApplyPack, TrackedApplication } from '@/lib/applications/pack';
import type { ApplyStep, ApplyStepProps } from '@/components/apply/types';

type Step = ApplyStep;

export default function ApplyJobPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const [user, loading] = useSupabaseUser();
  const [application, setApplication] = useState<TrackedApplication | null>(null);
  const [pack, setPack] = useState<ApplyPack | null>(null);
  const [step, setStep] = useState<Step>('resume');
  const [error, setError] = useState('');
  // ?auto=1 from the Auto-apply toggle on /jobs: run every step, once per
  // application. The pack records the run (autoRunAt), so coming back from the
  // employer's portal or reloading does not start it again.
  const [auto, setAuto] = useState(false);
  // True while that run is working; the steps lock their actions meanwhile.
  const [autoBusy, setAutoBusy] = useState(false);
  // The sliding highlight under the current step tab.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const b = tabsRef.current?.querySelector<HTMLElement>(`[data-step="${step === 'prep' ? 'tracker' : step}"]`);
      if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step, application, pack]);

  useEffect(() => {
    if (!loading && !user) router.push(`/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/apply/${id}`)
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Could not load this application');
        setApplication(j.application);
        setPack(j.pack);
        if (new URLSearchParams(window.location.search).get('auto') === '1' && !(j.pack as ApplyPack).autoRunAt) setAuto(true);
        // Pick up where the student left off.
        const p = j.pack as ApplyPack;
        setStep(p.prep || p.savedToTrackerAt ? 'tracker' : p.coverLetter ? 'save' : 'resume');
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load this application'));
  }, [user, id]);

  const update = useCallback(async (patch: Record<string, unknown>) => {
    const r = await fetch(`/api/apply/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.pack) return null;
    setPack(j.pack);
    return j.pack as ApplyPack;
  }, [id]);

  if (error) {
    return (
      <div className="glass-card p-10 text-center">
        <p className="text-sm text-slate-300 mb-4">{error}</p>
        <button className="btn-secondary" onClick={() => router.push('/jobs')}>Back to jobs</button>
      </div>
    );
  }
  if (loading || !application || !pack) return <AnimatedLoader isVisible loadingText="Loading application" showNavigation />;

  const approved = pack.tailor ? Object.values(pack.tailor.decisions).filter(d => d === 'approved').length : 0;
  const steps: { id: Step; label: string; icon: React.ElementType; done: boolean }[] = [
    { id: 'resume', label: 'Resume', icon: FileText, done: approved > 0 },
    { id: 'letter', label: 'Cover letter', icon: Pen, done: !!pack.coverLetter },
    { id: 'save', label: 'Apply', icon: Send, done: !!pack.savedToTrackerAt },
    { id: 'tracker', label: 'Job tracker', icon: FolderCheck, done: !!pack.savedToTrackerAt },
  ];
  const props: ApplyStepProps = { application, pack, onPack: setPack, update, goTo: setStep, autoRunning: autoBusy };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${application.jobTitle}${application.company ? ` at ${application.company}` : ''}`}
        icon={Send}
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Jobs', href: '/jobs' }, { label: application.company || application.jobTitle }]}
        description="Your resume and letter for this job, then track it through each round."
      />

      <div ref={tabsRef} className="glass-card p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-hide relative" role="tablist">
        {/* One highlight that slides to the current step */}
        {pill && <span aria-hidden="true" className="absolute top-1.5 bottom-1.5 rounded-[10px] bg-white/[0.08] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[left,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ left: pill.left, width: pill.width }} />}
        {steps.map((s, i) => {
          const Icon = s.icon;
          const active = step === s.id || (step === 'prep' && s.id === 'tracker');
          return (
            <button key={s.id} data-step={s.id} role="tab" aria-selected={active} onClick={() => setStep(s.id)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-2 h-10 px-4 rounded-[10px] text-[13px] font-medium whitespace-nowrap transition-colors
                relative z-[1] ${active ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
              {s.done && !active ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Icon className="w-4 h-4" />}
              <span>{i + 1}. {s.label}</span>
            </button>
          );
        })}
      </div>

      {auto && <AutoRun {...props} onBusy={setAutoBusy} />}

      <div key={step} className="prc-fade">
        {step === 'resume' && <TailorStep {...props} />}
        {step === 'letter' && <LetterStep {...props} />}
        {step === 'save' && <SaveStep {...props} />}
        {step === 'tracker' && <TrackerStep {...props} />}
        {step === 'prep' && <PrepStep {...props} />}
      </div>
    </div>
  );
}
