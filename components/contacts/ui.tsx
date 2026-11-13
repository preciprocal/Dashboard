'use client';
// components/contacts/ui.tsx
// Small pieces the Contacts page, drawer and modal share: the status pill,
// initials avatar, follow-up text, and a portalled overlay shell.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, Linkedin, Phone, Users, StickyNote } from 'lucide-react';
import {
  STATUS_LABELS, RELATIONSHIP_LABELS, followUpLabel, isDue, isOverdue,
  type Contact, type ContactStatus, type InteractionType, type Relationship,
} from '@/lib/contacts/model';

// Full literal class names per status (Tailwind cannot see built strings).
const STATUS_PILL: Record<ContactStatus, string> = {
  to_contact: 'bg-slate-500/10 text-slate-300 border-slate-500/25',
  contacted: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  replied: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  meeting_set: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
  referred: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  closed: 'bg-white/[0.03] text-slate-400 border-white/[0.08]',
};

const STATUS_DOT: Record<ContactStatus, string> = {
  to_contact: 'bg-slate-400',
  contacted: 'bg-indigo-400',
  replied: 'bg-sky-400',
  meeting_set: 'bg-violet-400',
  referred: 'bg-emerald-400',
  closed: 'bg-slate-500',
};

export function StatusDot({ status }: { status: ContactStatus }) {
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} aria-hidden="true" />;
}

export function StatusPill({ status }: { status: ContactStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-md border text-xs font-medium whitespace-nowrap ${STATUS_PILL[status]}`}>
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RelationshipText({ relationship }: { relationship: Relationship }) {
  return <span className="text-[13px] text-slate-300 whitespace-nowrap">{RELATIONSHIP_LABELS[relationship]}</span>;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
  return (
    <div className={`${size === 'lg' ? 'w-11 h-11 text-sm' : 'w-8 h-8 text-xs'} rounded-full bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-indigo-200 font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  );
}

/** Next follow-up text, amber when due today and red once overdue. */
export function FollowUpText({ contact, now, tz }: { contact: Contact; now: Date; tz: number }) {
  if (contact.status === 'closed' || !contact.nextFollowUpAt) return <span className="text-[13px] text-slate-400">Not set</span>;
  const label = followUpLabel(contact.nextFollowUpAt, now, tz);
  if (isOverdue(contact, now, tz)) return <span className="text-[13px] font-medium text-red-300 whitespace-nowrap">{label}</span>;
  if (isDue(contact, now, tz)) return <span className="text-[13px] font-medium text-amber-300 whitespace-nowrap">Due today</span>;
  return <span className="text-[13px] text-slate-300 whitespace-nowrap">{label}</span>;
}

export function InteractionIcon({ type, className = 'w-3.5 h-3.5' }: { type: InteractionType; className?: string }) {
  switch (type) {
    case 'email': return <Mail className={className} />;
    case 'linkedin': return <Linkedin className={className} />;
    case 'call': return <Phone className={className} />;
    case 'meeting': return <Users className={className} />;
    default: return <StickyNote className={className} />;
  }
}

/**
 * Portals children to <body>. The page sits under PageHeader-style fade-in
 * transforms, which make `position: fixed` resolve against the transformed
 * ancestor and clip the overlay (see components/ServiceModal). Also locks
 * page scroll while open and closes on Escape.
 */
// Open overlays, innermost last, so Escape closes only the top one (the edit
// modal opens over the drawer).
const overlayStack: symbol[] = [];

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const closeRef = React.useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    setMounted(true);
    const id = Symbol('overlay');
    overlayStack.push(id);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlayStack[overlayStack.length - 1] === id) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      overlayStack.splice(overlayStack.indexOf(id), 1);
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function FieldLabel({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-slate-300 mb-1.5">
      {children}{optional && <span className="text-slate-400 font-normal"> (optional)</span>}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-red-300 mt-1.5" role="alert">{children}</p>;
}
