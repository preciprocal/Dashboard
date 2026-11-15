// components/apply/PrepStep.tsx
//
// Step 4: prep for each round of this application, built from the student's
// own resume and the job description (app/api/apply/[id]/prep), plus a study
// plan counted back from the interview date and a debrief after each round
// (app/api/apply/[id]/after-round) that sets the next round's focus and drafts
// the thank-you email.
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2, Sparkles, Copy, Mic, Calendar, ExternalLink, ShieldCheck, Landmark, Save,
  Target, MessageSquare, Users, Briefcase, NotebookPen, Info, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppSelect } from '@/components/ui/select';
import type { ApplyStepProps } from '@/components/apply/types';
import type { StarStory } from '@/lib/applications/pack';
import { AUTH_STAGES, SOURCES, type AuthStage } from '@/lib/applications/sponsorship';
import InfoTip from '@/components/ui/info-tip';

type RoundTab = 'recruiter' | 'technical' | 'behavioral' | 'manager' | 'plan' | 'after';

const ROUND_NAMES = ['Recruiter screen', 'Technical', 'Behavioral', 'Hiring manager', 'Final round'];
const EVERIFY_SEARCH_URL = 'https://www.e-verify.gov/e-verify-employer-search';
const H1B_HUB_URL = 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub';

const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Could not copy'));
}

function Card({ title, icon: Icon, children, action }: { title: string; icon: React.ElementType; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="glass-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Icon className="w-4 h-4 text-indigo-300" />{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => <li key={i} className="flex gap-2 text-[13px] text-slate-300 leading-relaxed"><span className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-2 flex-shrink-0" />{t}</li>)}
    </ul>
  );
}

export default function PrepStep({ application, pack, onPack, update }: ApplyStepProps) {
  const [tab, setTab] = useState<RoundTab>('recruiter');
  const [running, setRunning] = useState(false);
  const prep = pack.prep;

  const build = async () => {
    setRunning(true);
    try {
      const r = await fetch(`/api/apply/${application.id}/prep`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not build the prep pack');
      onPack(j.pack);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build the prep pack');
    } finally {
      setRunning(false);
    }
  };

  const setStage = async (v: string) => {
    if (!(await update({ authStage: v || null }))) toast.error('Could not save that. Try again.');
  };

  const tabs: { id: RoundTab; label: string; icon: React.ElementType }[] = [
    { id: 'recruiter', label: 'Recruiter screen', icon: MessageSquare },
    { id: 'technical', label: 'Technical', icon: Target },
    { id: 'behavioral', label: 'Behavioral', icon: Users },
    { id: 'manager', label: 'Hiring manager', icon: Briefcase },
    { id: 'plan', label: 'Study plan', icon: Calendar },
    { id: 'after', label: 'After a round', icon: NotebookPen },
  ];

  return (
    <div className="space-y-4">
      <section className="glass-card p-5 flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex-1 min-w-0">
          <span className="block text-xs text-slate-400 mb-1.5">Your work authorization (for the sponsorship question)</span>
          <AppSelect value={pack.authStage ?? ''} onValueChange={setStage} aria-label="Work authorization" placeholder="Choose one"
            options={AUTH_STAGES.map(s => ({ value: s.id, label: s.label }))} />
        </label>
        <button onClick={build} disabled={running} className="btn-primary justify-center disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {prep ? 'Rebuild prep pack' : 'Build prep pack'}
        </button>
      </section>
      {running && <p className="text-xs text-slate-400 px-1">Building from your resume and the job description. This takes about 30 seconds.</p>}

      {prep?.nextRoundFocus && prep.nextRoundFocus.points.length > 0 && (
        <section className="glass-card p-5 border border-[var(--accent-border)]">
          <h3 className="text-sm font-semibold text-white mb-2">Focus for your next round</h3>
          <p className="text-xs text-slate-400 mb-3">From your notes after the {prep.nextRoundFocus.afterRound.toLowerCase()}.</p>
          <List items={prep.nextRoundFocus.points} />
        </section>
      )}

      {!prep ? (
        <section className="glass-card p-10 text-center text-sm text-slate-400">
          Build the prep pack to get a pitch, a sponsorship answer, technical topics from the job, STAR stories from your resume and questions for the hiring manager.
        </section>
      ) : (
        <>
          <div className="glass-card p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-hide" role="tablist">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 h-9 px-3 rounded-[10px] text-[12.5px] font-medium whitespace-nowrap transition-colors
                    ${tab === t.id ? 'bg-[var(--accent)] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}>
                  <Icon className="w-3.5 h-3.5" />{t.label}
                </button>
              );
            })}
          </div>
          {tab === 'recruiter' && <RecruiterTab {...{ application, pack }} stage={pack.authStage} />}
          {tab === 'technical' && <TechnicalTab {...{ application, pack }} />}
          {tab === 'behavioral' && <BehavioralTab {...{ application, pack, update }} />}
          {tab === 'manager' && <ManagerTab pack={pack} />}
        </>
      )}
      {tab === 'plan' && prep && <PlanTab {...{ application, pack, update }} />}
      {tab === 'after' && prep && <AfterRoundTab {...{ application, pack, onPack }} />}
    </div>
  );
}

// ─── Recruiter screen ────────────────────────────────────────────────────────

function RecruiterTab({ application, pack, stage }: Pick<ApplyStepProps, 'application' | 'pack'> & { stage: AuthStage | null }) {
  const r = pack.prep!.recruiter;
  const rec = pack.prep!.employerRecords;
  return (
    <div className="space-y-4">
      <Card title="Your 60-second pitch" icon={MessageSquare} action={r.pitch ? <button className="btn-secondary h-8" onClick={() => copyText(r.pitch)}><Copy className="w-3.5 h-3.5" /> Copy</button> : undefined}>
        {r.pitch
          ? <p className="text-[13.5px] text-slate-200 leading-relaxed whitespace-pre-wrap">{r.pitch}</p>
          : <p className="text-[13px] text-slate-400">The draft used a detail your resume does not contain, so it was left out. Rebuild, or write it yourself from your resume.</p>}
      </Card>
      <Card title={`Why ${application.company || 'this company'}`} icon={Lightbulb}>
        {r.whyCompany
          ? <p className="text-[13.5px] text-slate-200 leading-relaxed">{r.whyCompany}</p>
          : <p className="text-[13px] text-slate-400">Not drafted: it went beyond what the job description says. Use the posting and what you know about the company.</p>}
        <p className="text-[12px] text-slate-500 mt-3">Based on the job description. Add something specific you learned from the company yourself.</p>
      </Card>
      {r.salaryApproach.length > 0 && <Card title="If they ask about salary" icon={Briefcase}><List items={r.salaryApproach} /></Card>}

      <Card title="Will you need sponsorship now or in the future?" icon={ShieldCheck}>
        {!stage || !r.sponsorship ? (
          <p className="text-[13px] text-slate-400">Choose your work authorization above to get a ready answer.</p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13.5px] text-white leading-relaxed">{r.sponsorship.answer}</p>
                <button className="btn-secondary h-8 flex-shrink-0" onClick={() => copyText(r.sponsorship!.answer)}><Copy className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            {r.sponsorship.facts.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">The facts behind it</p>
                <ul className="space-y-1.5">
                  {r.sponsorship.facts.map((f, i) => (
                    <li key={i} className="text-[13px] text-slate-300 leading-relaxed">
                      {f.text}{' '}
                      <a href={SOURCES[f.source].url} target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline inline-flex items-center gap-0.5">{SOURCES[f.source].label}<ExternalLink className="w-3 h-3" /></a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {r.sponsorship.checks.length > 0 && <div><p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Check before you rely on it</p><List items={r.sponsorship.checks} /></div>}
            <EmployerRecords company={application.company} rec={rec} />
            <p className="text-[12px] text-slate-500 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> General information, not legal advice. Confirm your situation with your school&apos;s DSO.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function EmployerRecords({ company, rec }: { company: string; rec: NonNullable<ApplyStepProps['pack']['prep']>['employerRecords'] }) {
  const ev = rec.everify;
  const h = rec.h1b;
  const latest = h?.years.find(y => y.approvals > 0);
  const evText = !ev
    ? 'E-Verify status could not be checked.'
    : ev.state === 'enrolled' ? `${ev.employer ?? company} is enrolled in E-Verify${ev.enrolledOn ? ` since ${fmtDate(ev.enrolledOn)}` : ''} (employer-reported).`
    : ev.state === 'ending' ? `${ev.employer ?? company} is enrolled in E-Verify until ${fmtDate(ev.terminatesOn)}.`
    : ev.state === 'ended' ? `${ev.employer ?? company}'s E-Verify enrolment has ended. Confirm with the employer before relying on STEM OPT.`
    : 'No E-Verify enrolment found under this name. Companies sometimes enrol under a different legal name.';
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <a href={EVERIFY_SEARCH_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 hover:border-white/[0.12] transition-colors">
        <p className="text-xs font-medium text-white flex items-center gap-1.5 mb-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> E-Verify <InfoTip term="everified" /></p>
        <p className="text-[12px] text-slate-400 leading-relaxed">{evText}{rec.everifySyncedAt ? ` Checked ${fmtDate(rec.everifySyncedAt)}.` : ''}</p>
      </a>
      <a href={H1B_HUB_URL} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 hover:border-white/[0.12] transition-colors">
        <p className="text-xs font-medium text-white flex items-center gap-1.5 mb-1"><Landmark className="w-3.5 h-3.5 text-sky-300" /> H-1B history <InfoTip term="h1b" /></p>
        <p className="text-[12px] text-slate-400 leading-relaxed">
          {latest
            ? `${h!.employer}: ${latest.approvals.toLocaleString('en-US')} H-1B workers approved in FY${latest.year}, per USCIS. This shows past petitions, not whether they will sponsor you.`
            : 'No H-1B approvals on record under this name. Petitions are filed under the legal entity, so check the USCIS data hub.'}
        </p>
      </a>
    </div>
  );
}

// ─── Technical ───────────────────────────────────────────────────────────────

function TechnicalTab({ application, pack }: Pick<ApplyStepProps, 'application' | 'pack'>) {
  const topics = pack.prep!.technical.topics;
  return (
    <div className="space-y-4">
      <Card title="Topics from the job description" icon={Target}
        action={<Link href={`/interview/create?application=${application.id}&type=technical`} className="btn-primary h-8"><Mic className="w-3.5 h-3.5" /> Mock technical interview</Link>}>
        {topics.length === 0 ? <p className="text-[13px] text-slate-400">No topics could be tied to the job description. Rebuild the prep pack.</p> : (
          <ul className="space-y-3">
            {topics.map((t, i) => (
              <li key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="text-sm font-semibold text-white">{t.topic}</p>
                <p className="text-[12px] text-slate-500 mt-1">From the posting: &ldquo;{t.fromJob}&rdquo;</p>
                {t.questions.length > 0 && <div className="mt-3"><List items={t.questions} /></div>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[12px] text-slate-500 mt-4">The mock interview has an HR interviewer and a technical lead who speak, and scores communication, technical knowledge, problem-solving, cultural and role fit, and confidence.</p>
      </Card>
    </div>
  );
}

// ─── Behavioral ──────────────────────────────────────────────────────────────

function BehavioralTab({ application, pack, update }: Pick<ApplyStepProps, 'application' | 'pack' | 'update'>) {
  const [stories, setStories] = useState<StarStory[]>(pack.prep!.behavioral.stories);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStories(pack.prep!.behavioral.stories); }, [pack.prep]);
  const dirty = JSON.stringify(stories) !== JSON.stringify(pack.prep!.behavioral.stories);

  const edit = (id: string, field: 'situation' | 'task' | 'action' | 'result', value: string) =>
    setStories(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  const save = async () => {
    setSaving(true);
    const next = await update({ stories });
    setSaving(false);
    if (next) toast.success('Saved'); else toast.error('Could not save. Try again.');
  };

  return (
    <Card title="STAR stories from your resume" icon={Users}
      action={<div className="flex gap-2">
        <button onClick={save} disabled={!dirty || saving} className="btn-secondary h-8 disabled:opacity-40"><Save className="w-3.5 h-3.5" /> Save edits</button>
        <Link href={`/interview/create?application=${application.id}&type=behavioural`} className="btn-primary h-8"><Mic className="w-3.5 h-3.5" /> Practise</Link>
      </div>}>
      <p className="text-[12px] text-slate-500 mb-4">Each story is built on one line of your resume. Edit them so they are in your own words, and add detail only if it is true.</p>
      {stories.length === 0 ? <p className="text-[13px] text-slate-400">No stories passed the checks. Rebuild the prep pack.</p> : (
        <ol className="space-y-4">
          {stories.map(s => (
            <li key={s.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <p className="text-sm font-semibold text-white">{s.question}</p>
              <p className="text-[12px] text-slate-500 mt-1 mb-3">From your resume: &ldquo;{s.sourceLine}&rdquo;</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(['situation', 'task', 'action', 'result'] as const).map(f => (
                  <label key={f} className="block">
                    <span className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">{f}</span>
                    <textarea className="field w-full min-h-[84px] py-2 text-[13px] leading-relaxed" value={s[f]} onChange={e => edit(s.id, f, e.target.value)} />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ─── Hiring manager ──────────────────────────────────────────────────────────

function ManagerTab({ pack }: Pick<ApplyStepProps, 'pack'>) {
  const m = pack.prep!.hiringManager;
  return (
    <div className="space-y-4">
      <Card title="Impact stories" icon={Briefcase}>
        {m.impactStories.length === 0 ? <p className="text-[13px] text-slate-400">No impact stories passed the checks. Rebuild the prep pack.</p> : (
          <ul className="space-y-3">
            {m.impactStories.map((s, i) => (
              <li key={i} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="text-sm font-semibold text-white">{s.title}</p>
                <p className="text-[12px] text-slate-500 mt-1 mb-2">From your resume: &ldquo;{s.sourceLine}&rdquo;</p>
                <List items={s.talkingPoints} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Your first 90 days" icon={Target}><List items={m.first90Days} /></Card>
        <Card title="Questions to ask" icon={MessageSquare}><List items={m.questionsToAsk} /></Card>
      </div>
      <p className="text-[12px] text-slate-500 px-1">Mock interviews have an HR interviewer and a technical lead, not a hiring manager, so practise these answers out loud on your own.</p>
    </div>
  );
}

// ─── Study plan ──────────────────────────────────────────────────────────────

function PlanTab({ application, pack, update }: Pick<ApplyStepProps, 'application' | 'pack' | 'update'>) {
  const [date, setDate] = useState('');
  const [level, setLevel] = useState('intermediate');
  const [running, setRunning] = useState(false);

  // Default to the interview time saved on the tracker card, when there is one.
  useEffect(() => {
    fetch('/api/job-tracker/schedule')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const s = (j?.schedules ?? []).find((x: { applicationId: string }) => x.applicationId === application.id);
        if (s?.startsAt && new Date(s.startsAt) > new Date()) setDate(s.startsAt.slice(0, 10));
      })
      .catch(() => {});
  }, [application.id]);

  const days = useMemo(() => (date ? Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000) : 0), [date]);

  const create = async () => {
    if (days < 1) { toast.error('Pick an interview date in the future.'); return; }
    setRunning(true);
    try {
      const r = await fetch('/api/planner/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: application.jobTitle, company: application.company || undefined, interviewDate: date, daysUntilInterview: Math.min(days, 60), skillLevel: level }),
      });
      const j = await r.json();
      if (!r.ok || !j.planId) throw new Error(j.error || 'Could not create the plan');
      await update({ planId: j.planId });
      toast.success('Study plan created');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the plan');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card title="Study plan to your interview date" icon={Calendar}>
      {pack.planId && (
        <Link href={`/planner/${pack.planId}`} className="mb-4 flex items-center justify-between rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] p-3 text-sm text-indigo-100 hover:bg-[var(--accent)]/20 transition-colors">
          Open your study plan for this job <ExternalLink className="w-4 h-4" />
        </Link>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <label><span className="block text-xs text-slate-400 mb-1.5">Interview date</span><input type="date" className="field w-full" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label><span className="block text-xs text-slate-400 mb-1.5">Your level</span>
          <AppSelect value={level} onValueChange={setLevel} aria-label="Your level" options={[
            { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' },
          ]} />
        </label>
        <button onClick={create} disabled={running || !date} className="btn-primary justify-center disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />} {pack.planId ? 'New plan' : 'Create plan'}
        </button>
      </div>
      <p className="text-[12px] text-slate-500 mt-3">{days > 0 ? `${Math.min(days, 60)} days of prep, day by day, ending on your interview.` : 'A day-by-day plan that ends on your interview date.'}{days > 60 ? ' Plans cover at most the last 60 days.' : ''}</p>
    </Card>
  );
}

// ─── After a round ───────────────────────────────────────────────────────────

interface JournalEntry { id: string; companyName: string; jobTitle: string; stage: string | null; interviewDate: string | null; createdAt: string }

function AfterRoundTab({ application, pack, onPack }: Pick<ApplyStepProps, 'application' | 'pack' | 'onPack'>) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [round, setRound] = useState(ROUND_NAMES[0]);
  const [nextRound, setNextRound] = useState(ROUND_NAMES[1]);
  const [debriefId, setDebriefId] = useState('');
  const [notes, setNotes] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch('/api/debrief')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const company = application.company.trim().toLowerCase();
        setEntries(((j?.entries ?? []) as JournalEntry[]).filter(e => !company || e.companyName.trim().toLowerCase() === company));
      })
      .catch(() => {});
  }, [application.company]);

  const submit = async () => {
    if (!debriefId && notes.trim().length < 20) { toast.error('Pick the journal entry for this round, or add a few notes.'); return; }
    setRunning(true);
    try {
      const r = await fetch(`/api/apply/${application.id}/after-round`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, nextRound: nextRound || undefined, debriefId: debriefId || undefined, notes }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not process this round');
      onPack(j.pack);
      setNotes('');
      toast.success('Next round focus and thank-you email ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not process this round');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="After a round" icon={NotebookPen}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label><span className="block text-xs text-slate-400 mb-1.5">Round you just had</span>
            <AppSelect value={round} onValueChange={setRound} aria-label="Round you just had" options={ROUND_NAMES.map(n => ({ value: n, label: n }))} />
          </label>
          <label><span className="block text-xs text-slate-400 mb-1.5">Next round</span>
            <AppSelect value={nextRound} onValueChange={setNextRound} aria-label="Next round"
              options={[{ value: '', label: 'None or not known' }, ...ROUND_NAMES.map(n => ({ value: n, label: n }))]} />
          </label>
        </div>
        <label className="block mt-3"><span className="block text-xs text-slate-400 mb-1.5">Interview Journal entry</span>
          <AppSelect value={debriefId} onValueChange={setDebriefId} aria-label="Interview Journal entry" options={[
            { value: '', label: entries.length ? 'Choose an entry, or write notes below' : `No journal entries for ${application.company || 'this company'} yet` },
            ...entries.map(e => ({ value: e.id, label: `${e.stage || 'Interview'} · ${fmtDate(e.interviewDate || e.createdAt)}` })),
          ]} />
        </label>
        <textarea className="field w-full min-h-[110px] py-3 mt-3 leading-relaxed" placeholder="What they asked, what went well, what did not, anything to follow up on" value={notes} onChange={e => setNotes(e.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <Link href="/debrief" className="text-xs text-indigo-300 hover:underline">Write a full debrief in the Interview Journal</Link>
          <button onClick={submit} disabled={running} className="btn-primary disabled:opacity-50">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Update prep and draft thank-you
          </button>
        </div>
      </Card>

      {pack.rounds.map(r => (
        <Card key={r.id} title={`${r.round} · ${fmtDate(r.date)}`} icon={NotebookPen}>
          {r.nextRoundFocus.length > 0 && <div className="mb-4"><p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Focus next</p><List items={r.nextRoundFocus} /></div>}
          {r.thankYou && (
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[13px] font-medium text-white">Subject: {r.thankYou.subject}</p>
                <button className="btn-secondary h-8 flex-shrink-0" onClick={() => copyText(`Subject: ${r.thankYou!.subject}\n\n${r.thankYou!.body}`)}><Copy className="w-3.5 h-3.5" /> Copy</button>
              </div>
              <p className="text-[13px] text-slate-300 whitespace-pre-wrap leading-relaxed">{r.thankYou.body}</p>
              <p className="text-[12px] text-slate-500 mt-3">Fill in anything in [brackets] and send it within a day.</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
