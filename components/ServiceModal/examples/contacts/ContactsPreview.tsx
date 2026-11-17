'use client';
// components/ServiceModal/examples/contacts/ContactsPreview.tsx
//
// The Contacts example: adding someone you met, setting when to follow up,
// logging what happened, and the reminder coming due. Sample people and
// companies, for the illustration.
import { Plus, Loader2, Mail, CalendarClock, Check, Send, MessageSquare, Users, Building2 } from 'lucide-react';
import { FadeIn, TypingText } from '../../primitives';
import { demoClick } from '../../DemoCursor';
import { FOLLOW_UP_PRESETS, RELATIONSHIP_LABELS, STATUS_LABELS } from '@/lib/contacts/model';

const avatar = (initials: string, tint: string) => (
  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0" style={{ background: tint }}>{initials}</span>
);

const OTHERS = [
  { initials: 'MJ', tint: '#0ea5e9', name: 'Marcus Johnson', role: 'Recruiter', company: 'Contoso', status: STATUS_LABELS.replied, due: 'Follow up in 5 days' },
  { initials: 'SL', tint: '#14b8a6', name: 'Sara Lee', role: 'Data Scientist', company: 'Fabrikam', status: STATUS_LABELS.meeting_set, due: 'Coffee chat Thursday' },
];

function Input({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[var(--text-4)] mb-1">{label}</p>
      <div className="h-8 px-2.5 rounded-lg bg-white/[0.03] ring-1 ring-inset ring-white/[0.08] flex items-center text-[11.5px] text-white">{children}</div>
    </div>
  );
}

export function ContactsExamplePreview({ step }: { step: number }) {
  const saved = step >= 1;
  const followUp = step >= 3;
  const logged = step >= 4;
  const due = step >= 5;

  return (
    <div className="grid grid-cols-[1fr_300px] gap-3 min-h-[460px]">
      {/* List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-white flex items-center gap-1.5"><Users className="w-4 h-4 text-[var(--accent)]" />Contacts</p>
          <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[var(--on-primary)] bg-[var(--primary)]"><Plus className="w-3.5 h-3.5" />Add contact</span>
        </div>
        <div className="grid grid-cols-3 rounded-xl ring-1 ring-inset ring-white/[0.07] overflow-hidden">
          {[['Contacts', saved ? 3 : 2], ['Follow-ups due', due ? 1 : 0], ['Replied', 1]].map(([k, v], i) => (
            <div key={k as string} className={`px-3 py-2.5 ${i ? 'border-l border-white/[0.06]' : ''}`}>
              <p className="text-[17px] font-semibold text-white tabular-nums">{v}</p>
              <p className="text-[10px] text-[var(--text-3)]">{k}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] divide-y divide-white/[0.06] overflow-hidden">
          {saved && (
            <FadeIn>
              <div {...demoClick(1)} className={`flex items-center gap-3 px-3 py-2.5 ${step >= 2 ? 'bg-white/[0.03]' : ''}`}>
                {avatar('PR', '#a9b0f7')}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-white">Priya Raman</p>
                  <p className="text-[10.5px] text-[var(--text-3)] truncate">Engineering Manager at Northwind Labs</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-[var(--text-2)]">{logged ? STATUS_LABELS.contacted : STATUS_LABELS.to_contact}</span>
                  {followUp && (
                    <p className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${due ? 'text-amber-300' : 'text-[var(--text-4)]'}`}>
                      <CalendarClock className="w-3 h-3" />{due ? 'Follow up today' : 'Follow up in 1 week'}
                    </p>
                  )}
                </div>
              </div>
            </FadeIn>
          )}
          {OTHERS.map(o => (
            <div key={o.name} className="flex items-center gap-3 px-3 py-2.5">
              {avatar(o.initials, o.tint)}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-white">{o.name}</p>
                <p className="text-[10.5px] text-[var(--text-3)] truncate">{o.role} at {o.company}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-[var(--text-2)]">{o.status}</span>
                <p className="text-[10px] mt-1 text-[var(--text-4)]">{o.due}</p>
              </div>
            </div>
          ))}
        </div>
        {due && (
          <FadeIn>
            <div className="rounded-xl ring-1 ring-inset ring-amber-400/25 bg-amber-400/[0.06] px-3 py-2.5 flex items-center gap-2.5">
              <CalendarClock className="w-4 h-4 text-amber-300 flex-shrink-0" />
              <p className="text-[11.5px] text-white">Time to follow up with <span className="font-semibold">Priya Raman</span>. Your last email was a week ago.</p>
            </div>
          </FadeIn>
        )}
      </div>

      {/* Side: add form, then the contact */}
      <div className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-3.5">
        {!saved ? (
          <div className="space-y-2.5">
            <p className="text-[12.5px] font-semibold text-white">New contact</p>
            <Input label="Name">{step === 0 ? <TypingText text="Priya Raman" speed={60} delay={200} /> : 'Priya Raman'}</Input>
            <Input label="Company"><Building2 className="w-3.5 h-3.5 text-[var(--text-4)] mr-1.5" />{step === 0 ? <TypingText text="Northwind Labs" speed={55} delay={1000} /> : 'Northwind Labs'}</Input>
            <Input label="Role">{step === 0 ? <TypingText text="Engineering Manager" speed={45} delay={1900} /> : 'Engineering Manager'}</Input>
            <Input label="Relationship">{RELATIONSHIP_LABELS.hiring_manager}</Input>
            <span {...demoClick(0)} className="mt-1 w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[var(--on-primary)] bg-[var(--primary)]">
              <Check className="w-3.5 h-3.5" />Save contact
            </span>
          </div>
        ) : (
          <FadeIn>
            <div className="flex items-center gap-2.5">
              {avatar('PR', '#a9b0f7')}
              <div>
                <p className="text-[12.5px] font-semibold text-white">Priya Raman</p>
                <p className="text-[10.5px] text-[var(--text-3)]">Engineering Manager · Northwind Labs</p>
              </div>
            </div>

            <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">Follow up</p>
            <div className="mt-1.5 flex gap-1.5">
              {FOLLOW_UP_PRESETS.map(p => (
                <span key={p.days} {...(p.days === 7 ? demoClick(2) : {})}
                  className={`h-7 px-2.5 rounded-lg text-[11px] flex items-center ${followUp && p.days === 7 ? 'text-white bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]'}`}>
                  {p.label}
                </span>
              ))}
            </div>

            <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">Log what happened</p>
            <div className="mt-1.5 flex gap-1.5">
              <span {...demoClick(3)} className={`h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 ${logged ? 'text-white bg-[var(--accent-subtle)] ring-1 ring-inset ring-[var(--accent-border)]' : 'text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]'}`}><Mail className="w-3 h-3" />Email</span>
              <span className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]"><MessageSquare className="w-3 h-3" />LinkedIn</span>
            </div>

            <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-4)]">Timeline</p>
            <ul className="mt-2 space-y-2.5">
              {logged && (
                <FadeIn>
                  <li className="flex gap-2"><Send className="w-3.5 h-3.5 mt-0.5 text-[var(--accent)]" /><div><p className="text-[11px] text-white">Sent an intro email</p><p className="text-[10px] text-[var(--text-4)]">Today</p></div></li>
                </FadeIn>
              )}
              <li className="flex gap-2"><Plus className="w-3.5 h-3.5 mt-0.5 text-[var(--text-4)]" /><div><p className="text-[11px] text-[var(--text-2)]">Added from a career fair</p><p className="text-[10px] text-[var(--text-4)]">Today</p></div></li>
            </ul>
            {step === 1 && <p className="mt-3 text-[10.5px] text-[var(--text-3)] flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Saved. Pick when to follow up.</p>}
          </FadeIn>
        )}
      </div>
    </div>
  );
}
