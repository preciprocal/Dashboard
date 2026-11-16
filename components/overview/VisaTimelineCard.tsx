'use client';
// components/overview/VisaTimelineCard.tsx
//
// The student's work authorization at a glance: OPT, STEM OPT and H-1B
// periods on one timeline with today marked, days left in the current one,
// and unemployment days used against the limit. Dates are the student's own
// (app/api/visa-timeline); nothing here is looked up or estimated.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Pencil, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import InfoTip from '@/components/ui/info-tip';
import { EMPTY_TIMELINE, PERIOD_LABEL, periods, summarize, type PeriodKind, type VisaTimeline } from '@/lib/visa/timeline';

const COLOR: Record<PeriodKind, string> = { opt: 'bg-indigo-400', stem: 'bg-sky-400', h1b: 'bg-emerald-400' };
const fmt = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export default function VisaTimelineCard() {
  const [t, setT] = useState<VisaTimeline | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VisaTimeline>(EMPTY_TIMELINE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/visa-timeline').then(r => (r.ok ? r.json() : null)).then(j => setT(j?.timeline ?? EMPTY_TIMELINE)).catch(() => setT(EMPTY_TIMELINE));
  }, []);

  const startEdit = () => { setDraft(t ?? EMPTY_TIMELINE); setEditing(true); };
  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/visa-timeline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Could not save');
      setT(j.timeline); setEditing(false); toast.success('Dates saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!t) return <div className="glass-card h-[148px] prc-skeleton" />;

  const ps = periods(t);
  const sum = summarize(t);

  return (
    <section className="glass-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[var(--accent)]" />Work authorization
          <InfoTip title="Work authorization" body="Your OPT, STEM OPT and H-1B dates, as you enter them from your EAD card and approval notices. Used only to count days for you." source="Your DSO and your documents are the authority on your dates." />
        </h2>
        {!editing && ps.length > 0 && (
          <button onClick={startEdit} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] text-[var(--text-3)] hover:text-white hover:bg-white/[0.05] transition-colors"><Pencil className="w-3.5 h-3.5" /> Edit dates</button>
        )}
      </div>

      {editing ? (
        <Editor draft={draft} setDraft={setDraft} saving={saving} onSave={save} onCancel={() => setEditing(false)} />
      ) : ps.length === 0 ? (
        <div className="px-5 pb-5 pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-[13px] text-[var(--text-3)] flex-1 leading-relaxed">Add your OPT, STEM OPT or H-1B dates to see how many days you have left and how many unemployment days you have used.</p>
          <button onClick={startEdit} className="btn-primary flex-shrink-0"><CalendarClock className="w-4 h-4" /> Add your dates</button>
        </div>
      ) : (
        <View t={t} sum={sum} />
      )}
    </section>
  );
}

function View({ t, sum }: { t: VisaTimeline; sum: ReturnType<typeof summarize> }) {
  const ps = periods(t).filter(p => p.start && p.end);
  const c = sum.current;
  const warn = c && c.daysLeft !== null && c.daysUntilStart === null && c.daysLeft <= 90;
  // The timeline spans every dated period.
  const lo = ps.length ? Math.min(...ps.map(p => ms(p.start!))) : 0;
  const hi = ps.length ? Math.max(...ps.map(p => ms(p.end!))) : 1;
  const span = Math.max(1, hi - lo);
  const now = Date.now();
  const todayPct = Math.max(0, Math.min(100, ((now - lo) / span) * 100));
  const usedPct = sum.unemploymentLimit && t.unemploymentDaysUsed !== null ? Math.min(100, (t.unemploymentDaysUsed / sum.unemploymentLimit) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 px-5 pb-5 pt-3">
      {/* The KPI */}
      <div>
        {c ? (
          c.daysUntilStart !== null ? (
            <>
              <p className="font-display text-[34px] font-semibold tracking-[-0.03em] text-white tabular-nums leading-none">{c.daysUntilStart}</p>
              <p className="text-[12.5px] text-[var(--text-3)] mt-1.5">days until {PERIOD_LABEL[c.kind]} starts, {fmt(c.start)}</p>
            </>
          ) : c.daysLeft !== null ? (
            <>
              <p className={`font-display text-[34px] font-semibold tracking-[-0.03em] tabular-nums leading-none ${warn ? 'text-amber-300' : 'text-white'}`}>{c.daysLeft}</p>
              <p className="text-[12.5px] text-[var(--text-3)] mt-1.5">days left on {PERIOD_LABEL[c.kind]}, ends {fmt(c.end)}</p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--text-2)]">On {PERIOD_LABEL[c.kind]}. Add its end date to count the days left.</p>
          )
        ) : (
          <p className="text-[13px] text-[var(--text-2)]">{sum.lastEnd && ms(sum.lastEnd) < now ? `Your last period ended ${fmt(sum.lastEnd)}.` : 'No current period today.'}</p>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        {/* Timeline */}
        {ps.length > 0 && (
          <div>
            <div className="relative h-7 rounded-lg bg-white/[0.04] overflow-hidden">
              {ps.map(p => {
                const left = ((ms(p.start!) - lo) / span) * 100, width = Math.max(1.5, ((ms(p.end!) - ms(p.start!)) / span) * 100);
                return (
                  <div key={p.kind} className={`absolute top-1 bottom-1 rounded-md ${COLOR[p.kind]} opacity-80 flex items-center px-2 overflow-hidden`} style={{ left: `${left}%`, width: `${width}%` }} title={`${PERIOD_LABEL[p.kind]}: ${fmt(p.start)} to ${fmt(p.end)}`}>
                    <span className="text-[10.5px] font-semibold text-[#08090a] whitespace-nowrap">{PERIOD_LABEL[p.kind]}</span>
                  </div>
                );
              })}
              {now >= lo && now <= hi && <div className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.15)]" style={{ left: `${todayPct}%` }} aria-label="Today" />}
            </div>
            <div className="flex justify-between text-[11px] text-[var(--text-4)] mt-1.5 tabular-nums"><span>{fmt(new Date(lo).toISOString().slice(0, 10))}</span><span>Today</span><span>{fmt(new Date(hi).toISOString().slice(0, 10))}</span></div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Unemployment days */}
          {sum.unemploymentLimit !== null && (
            <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] px-3.5 py-3">
              <p className="text-[12px] text-[var(--text-3)] flex items-center gap-1.5">Unemployment days
                <InfoTip title="Unemployment days" body="Post-completion OPT allows up to 90 days without qualifying employment. The STEM OPT extension adds 60, for 150 in total across both. Enter the days you have used; the app does not track employment." source="8 CFR 214.2(f)(10)(ii)(E), Study in the States. Confirm your count with your DSO." />
              </p>
              {t.unemploymentDaysUsed !== null ? (
                <>
                  <p className="text-[13px] text-white mt-1"><span className="font-semibold tabular-nums">{sum.unemploymentLeft}</span> of {sum.unemploymentLimit} left</p>
                  <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full rounded-full ${usedPct >= 80 ? 'bg-rose-400' : usedPct >= 50 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(2, usedPct)}%` }} /></div>
                </>
              ) : <p className="text-[12.5px] text-[var(--text-4)] mt-1">Add the days you have used in Edit dates.</p>}
            </div>
          )}
          {/* A dated reminder */}
          {warn && c?.kind === 'opt' && !t.stemStart ? (
            <div className="rounded-xl ring-1 ring-inset ring-amber-400/20 bg-amber-400/[0.05] px-3.5 py-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-[var(--text-2)] leading-relaxed">If you qualify, the STEM OPT extension can be filed up to 90 days before your OPT ends. Talk to your DSO about timing.</p>
            </div>
          ) : (
            <div className="rounded-xl ring-1 ring-inset ring-white/[0.06] bg-white/[0.02] px-3.5 py-3 flex gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-300 flex-shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-[var(--text-3)] leading-relaxed">{sum.lastEnd ? `Covered through ${fmt(sum.lastEnd)} on the dates you entered.` : 'Add end dates to see how far you are covered.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Editor({ draft, setDraft, saving, onSave, onCancel }: { draft: VisaTimeline; setDraft: (t: VisaTimeline) => void; saving: boolean; onSave: () => void; onCancel: () => void }) {
  const rows: { kind: PeriodKind; s: keyof VisaTimeline; e: keyof VisaTimeline; hint: string }[] = [
    { kind: 'opt', s: 'optStart', e: 'optEnd', hint: 'From your EAD card' },
    { kind: 'stem', s: 'stemStart', e: 'stemEnd', hint: 'From your STEM OPT EAD card' },
    { kind: 'h1b', s: 'h1bStart', e: 'h1bEnd', hint: 'From your I-797 approval notice' },
  ];
  const set = (k: keyof VisaTimeline, v: string) => setDraft({ ...draft, [k]: v || null });
  return (
    <div className="px-5 pb-5 pt-3 space-y-3">
      {rows.map(r => (
        <div key={r.kind} className="grid grid-cols-1 sm:grid-cols-[140px_1fr_1fr] gap-2 sm:items-center">
          <div>
            <p className="text-[13px] font-medium text-white flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${COLOR[r.kind]}`} />{PERIOD_LABEL[r.kind]}</p>
            <p className="text-[11px] text-[var(--text-4)]">{r.hint}</p>
          </div>
          <label className="block"><span className="sr-only">{PERIOD_LABEL[r.kind]} start</span><input type="date" className="field !h-10" value={(draft[r.s] as string) ?? ''} onChange={e => set(r.s, e.target.value)} aria-label={`${PERIOD_LABEL[r.kind]} start date`} /></label>
          <label className="block"><span className="sr-only">{PERIOD_LABEL[r.kind]} end</span><input type="date" className="field !h-10" value={(draft[r.e] as string) ?? ''} onChange={e => set(r.e, e.target.value)} aria-label={`${PERIOD_LABEL[r.kind]} end date`} /></label>
        </div>
      ))}
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:items-center pt-1">
        <div><p className="text-[13px] font-medium text-white">Unemployment days</p><p className="text-[11px] text-[var(--text-4)]">Used so far on OPT</p></div>
        <input type="number" min={0} max={400} inputMode="numeric" className="field !h-10 sm:w-40" placeholder="e.g. 12"
          value={draft.unemploymentDaysUsed ?? ''} onChange={e => setDraft({ ...draft, unemploymentDaysUsed: e.target.value === '' ? null : Number(e.target.value) })} />
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onCancel} className="btn-secondary !h-9">Cancel</button>
        <button onClick={onSave} disabled={saving} className="btn-primary !h-9">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save dates</button>
      </div>
    </div>
  );
}
