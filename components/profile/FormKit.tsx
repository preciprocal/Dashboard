'use client';
// components/profile/FormKit.tsx
//
// The building blocks of the Profile and Auto-apply forms: one continuous
// sheet where each section is a row (what it is on the left, its fields on
// the right), a section rail that shows how much of each part is filled in,
// and a save bar that floats in once something has changed.
import { useEffect, useState, type ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';

/** One part of the form: title and purpose beside its fields. */
export function FormSection({ id, title, desc, done, total, children }: {
  id: string; title: string; desc?: string; done?: number; total?: number; children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-x-10 gap-y-4 py-7 first:pt-1 border-t border-white/[0.06] first:border-t-0">
      <header className="lg:pt-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-white">{title}</h3>
          {total !== undefined && done !== undefined && <Progress done={done} total={total} />}
        </div>
        {desc && <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-4)]">{desc}</p>}
      </header>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** A small "3/5" count that turns into a check when the part is complete. */
export function Progress({ done, total }: { done: number; total: number }) {
  const full = total > 0 && done >= total;
  return full ? (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-400/15 text-emerald-300" aria-label="Complete">
      <Check className="w-2.5 h-2.5" strokeWidth={3} />
    </span>
  ) : (
    <span className="text-[11px] tabular-nums text-[var(--text-5)]">{done}/{total}</span>
  );
}

/** A label above a control, with an optional quiet hint. */
export function Field({ label, hint, span, htmlFor, children }: {
  label: string; hint?: string; span?: string; htmlFor?: string; children: ReactNode;
}) {
  return (
    <div className={span ?? ''}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-[12.5px] font-medium text-[var(--text-2)]">{label}</span>
        {hint && <span className="text-[11.5px] text-[var(--text-5)] truncate">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** A text input with something fixed at its start, such as a site's icon. */
export function AdornedInput({ lead, className = '', ...rest }: { lead: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center text-[var(--text-5)]">{lead}</span>
      <input {...rest} className={`field !pl-10 ${className}`} />
    </div>
  );
}

/** A switch on a row, for yes or no settings. */
export function SwitchRow({ value, onChange, label, desc }: { value: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className="group flex items-center justify-between gap-4 w-full h-11 px-3.5 rounded-[var(--r-md)] text-left ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
      <span className="min-w-0">
        <span className={`block text-[13.5px] ${value ? 'text-white' : 'text-[var(--text-2)]'}`}>{label}</span>
        {desc && <span className="block text-[11.5px] text-[var(--text-4)]">{desc}</span>}
      </span>
      <span className={`relative w-8 h-[18px] rounded-full flex-shrink-0 transition-colors ${value ? 'bg-emerald-400' : 'bg-white/[0.12]'}`}>
        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
      </span>
    </button>
  );
}

export interface RailItem { id: string; title: string; done: number; total: number }

/** The section list beside a long form: jump to a part and see what is left. */
export function SectionRail({ items }: { items: RailItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter((x): x is HTMLElement => !!x);
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label="Form sections" className="hidden xl:block self-stretch">
      <ul className="sticky top-[88px] space-y-0.5">
        {items.map(i => {
          const on = active === i.id;
          const full = i.total > 0 && i.done >= i.total;
          return (
            <li key={i.id}>
              <button type="button" onClick={() => { setActive(i.id); document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className={`relative w-full flex items-center gap-2.5 h-8 pl-3 pr-2 rounded-lg text-[12.5px] text-left transition-colors ${on ? 'bg-white/[0.06] text-white' : 'text-[var(--text-4)] hover:text-[var(--text-1)] hover:bg-white/[0.03]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${full ? 'bg-emerald-400' : i.done > 0 ? 'bg-sky-400' : 'bg-white/[0.15]'}`} aria-hidden="true" />
                <span className="flex-1 truncate">{i.title}</span>
                <span className="text-[11px] tabular-nums text-[var(--text-5)]">{i.done}/{i.total}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Floats at the bottom of the form while there are unsaved changes. */
export function SaveBar({ dirty, saving, saved, onSave, onDiscard, label = 'Save changes', alwaysShow }: {
  dirty: boolean; saving: boolean; saved?: boolean; onSave: () => void; onDiscard?: () => void; label?: string; alwaysShow?: boolean;
}) {
  const show = dirty || saving || saved || alwaysShow;
  return (
    <div aria-live="polite" className={`sticky bottom-4 z-20 flex justify-center pointer-events-none transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className={`flex items-center gap-3 pl-4 pr-1.5 h-12 rounded-xl bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75),0_4px_12px_-4px_rgba(0,0,0,0.4)] ${show ? 'pointer-events-auto' : ''}`}>
        <span className="flex items-center gap-2 text-[13px] text-[var(--text-2)] whitespace-nowrap">
          {saved && !dirty ? <><Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />All changes saved</>
            : dirty ? <><span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden="true" />Unsaved changes</>
            : 'No changes yet'}
        </span>
        {onDiscard && (
          <button type="button" onClick={onDiscard} disabled={saving} className="h-9 px-3 rounded-lg text-[13px] text-[var(--text-3)] hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50">
            {dirty ? 'Discard' : 'Cancel'}
          </button>
        )}
        <button type="button" onClick={onSave} disabled={saving || !dirty} className="btn-primary !h-9 !text-[13px] !px-4 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving' : label}
        </button>
      </div>
    </div>
  );
}
