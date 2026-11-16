'use client';
// components/ui/date-input.tsx
//
// The app's date picker, in place of <input type="date">, whose calendar the
// browser draws in its own grey and blue and cannot be themed. Same contract
// as the native input: the value is 'YYYY-MM-DD' or '' and onChange gets the
// same. The calendar opens in a portal above modals and flips upward when
// there is no room below.
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
};
const todayIso = () => { const t = new Date(); return toIso(t.getFullYear(), t.getMonth(), t.getDate()); };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateInput({ value, onChange, placeholder = 'Select a date', className = '', inputClassName = '', id, min, max, disabled, 'aria-label': ariaLabel, 'aria-invalid': ariaInvalid, required, clearable = true }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  /** Extra classes on the field itself (height, text size). */
  inputClassName?: string;
  id?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  /** Marks the field as required for assistive technology. */
  required?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sel = parse(value);
  const [view, setView] = useState(() => { const s = sel ?? parse(todayIso())!; return { y: s.y, m: s.m }; });
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const pop = useRef<HTMLDivElement | null>(null);
  const autoId = useId();

  // Open on the selected month.
  useEffect(() => { if (open) { const s = parse(value) ?? parse(todayIso())!; setView({ y: s.y, m: s.m }); } }, [open, value]);

  // Place the calendar under the field, or above it when there is no room.
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const h = 330, w = 284;
      const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      setPos({ left, top: up ? r.top - h - 6 : r.bottom + 6, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { const t = e.target as Node; if (!pop.current?.contains(t) && !btn.current?.contains(t)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay();
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const prevDays = new Date(view.y, view.m, 0).getDate();
    const out: { y: number; m: number; d: number; inMonth: boolean }[] = [];
    for (let i = first - 1; i >= 0; i--) { const m = view.m - 1; const y = m < 0 ? view.y - 1 : view.y; out.push({ y, m: (m + 12) % 12, d: prevDays - i, inMonth: false }); }
    for (let d = 1; d <= days; d++) out.push({ y: view.y, m: view.m, d, inMonth: true });
    while (out.length % 7 || out.length < 42) { const n = out.length - first - days + 1; const m = view.m + 1; const y = m > 11 ? view.y + 1 : view.y; out.push({ y, m: m % 12, d: n, inMonth: false }); }
    return out.slice(0, 42);
  }, [view]);

  const shift = (k: number) => setView(v => { const m = v.m + k; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const pick = (iso: string) => { onChange(iso); setOpen(false); btn.current?.focus(); };
  const out = (iso: string) => (min && iso < min) || (max && iso > max);
  const today = todayIso();
  const label = sel ? new Date(sel.y, sel.m, sel.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <>
      <div className={`relative ${className}`}>
        <button ref={btn} id={id} type="button" disabled={disabled} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open} aria-invalid={ariaInvalid || undefined} aria-required={required || undefined} aria-controls={open ? autoId : undefined} aria-label={ariaLabel ? `${ariaLabel}${label ? `: ${label}` : ''}` : undefined}
          className={`field flex items-center gap-2.5 text-left ${inputClassName} ${open ? '!border-[rgba(110,121,214,0.7)] shadow-[0_0_0_3px_rgba(110,121,214,0.25)]' : ''} ${clearable && value ? 'pr-9' : ''} disabled:opacity-50`}>
          <CalendarDays className="w-4 h-4 text-[var(--text-4)] flex-shrink-0" />
          <span className={`truncate ${label ? 'text-[var(--text-1)]' : 'text-[var(--text-5)]'}`}>{label || placeholder}</span>
        </button>
        {clearable && value && !disabled && (
          <button type="button" onClick={() => onChange('')} aria-label="Clear date"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-4)] hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && pos && createPortal(
        <div ref={pop} id={autoId} role="dialog" aria-label="Choose a date"
          className="prc-tip fixed z-[10001] w-[284px] rounded-xl bg-[#151618] p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_16px_40px_-12px_rgba(0,0,0,0.75),0_4px_12px_-4px_rgba(0,0,0,0.4)]"
          data-state="delayed-open" data-side={pos.up ? 'top' : 'bottom'} style={{ left: pos.left, top: pos.top }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-white pl-1">{MONTHS[view.m]} {view.y}</p>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06]"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={() => shift(1)} aria-label="Next month" className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-white hover:bg-white/[0.06]"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DAYS.map(d => <span key={d} className="h-7 flex items-center justify-center text-[11px] font-medium text-[var(--text-5)]">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map(c => {
              const iso = toIso(c.y, c.m, c.d);
              const isSel = iso === value, isToday = iso === today, disabledDay = !!out(iso);
              return (
                <button key={iso + (c.inMonth ? '' : 'x')} type="button" disabled={disabledDay} onClick={() => pick(iso)}
                  aria-label={new Date(c.y, c.m, c.d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} aria-pressed={isSel}
                  className={`relative h-8 rounded-lg text-[12.5px] tabular-nums transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${isSel ? 'bg-[var(--primary)] text-[var(--on-primary)] font-semibold' : c.inMonth ? 'text-[var(--text-1)] hover:bg-white/[0.07]' : 'text-[var(--text-5)] hover:bg-white/[0.04]'}`}>
                  {c.d}
                  {isToday && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
            {clearable ? <button type="button" onClick={() => pick('')} className="h-7 px-2 rounded-md text-[12px] text-[var(--text-3)] hover:text-white hover:bg-white/[0.05]">Clear</button> : <span />}
            <button type="button" onClick={() => pick(today)} disabled={!!out(today)} className="h-7 px-2 rounded-md text-[12px] font-medium text-[#a9b0f7] hover:text-white hover:bg-white/[0.05] disabled:opacity-40">Today</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
