'use client';
// components/contacts/SaveToContactsButton.tsx
// "Save to contacts" for a person found by Find Contacts in the job tracker.
// Links the contact to that application and marks the source, so the
// Contacts page can say where each person came from. Saving twice is safe:
// the API answers 409 with the existing row and this shows "Saved".
import React, { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { guessRelationship } from '@/lib/contacts/model';
import { ContactsApiError, createContact } from '@/lib/contacts/client';

export default function SaveToContactsButton({ person, company, applicationId }: {
  person: { fullName: string; position?: string | null; email?: string | null; linkedin?: string | null };
  company: string;
  applicationId?: string | null;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const save = async () => {
    setState('saving');
    try {
      await createContact({
        name: person.fullName,
        role: person.position || null,
        company,
        email: person.email || null,
        linkedinUrl: person.linkedin || null,
        relationship: guessRelationship(person.position),
        status: 'to_contact',
        source: 'find_contacts',
        applicationId: applicationId || null,
      });
      setState('saved');
      toast.success(`${person.fullName} saved to contacts`, { action: { label: 'Open', onClick: () => { window.location.href = '/contacts'; } } });
    } catch (e) {
      if (e instanceof ContactsApiError && e.status === 409) { setState('saved'); toast.message('Already in your contacts'); return; }
      // A LinkedIn link Hunter returns in an unusual shape should not block
      // saving the person; retry once without it.
      if (e instanceof ContactsApiError && e.field === 'linkedinUrl') {
        try {
          await createContact({ name: person.fullName, role: person.position || null, company, email: person.email || null, relationship: guessRelationship(person.position), source: 'find_contacts', applicationId: applicationId || null });
          setState('saved');
          toast.success(`${person.fullName} saved to contacts`);
          return;
        } catch { /* fall through to the error below */ }
      }
      setState('idle');
      toast.error(e instanceof Error ? e.message : 'Could not save the contact');
    }
  };

  if (state === 'saved') {
    return (
      <Link href="/contacts" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/[0.08] border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors flex-shrink-0">
        <Check className="w-3.5 h-3.5" /> Saved
      </Link>
    );
  }
  return (
    <button type="button" onClick={save} disabled={state === 'saving'} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-white/[0.04] border border-white/[0.08] hover:border-[var(--accent-border)] hover:bg-[var(--accent-subtle)] hover:text-white transition-colors disabled:opacity-60 flex-shrink-0">
      {state === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Save to contacts
    </button>
  );
}
