'use client';
// components/contacts/ContactFormModal.tsx
// Add or edit a contact. Validates with the same parseContactInput the API
// uses, so the form flags a bad email or LinkedIn link before the round trip
// and the two can never disagree about what is allowed.
import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppSelect } from '@/components/ui/select';
import {
  CONTACT_STATUSES, RELATIONSHIPS, RELATIONSHIP_LABELS, STATUS_LABELS,
  isoToLocalDate, localDateToIso, parseContactInput,
  type Contact, type ContactStatus, type Relationship,
} from '@/lib/contacts/model';
import { ContactsApiError, createContact, tzOffset, updateContact } from '@/lib/contacts/client';
import { Overlay, FieldLabel, FieldError } from './ui';

interface FormState {
  name: string; role: string; company: string; email: string; linkedinUrl: string;
  relationship: Relationship; status: ContactStatus; nextFollowUp: string; notes: string;
}

function initialState(c: Contact | null): FormState {
  const tz = tzOffset();
  return {
    name: c?.name ?? '',
    role: c?.role ?? '',
    company: c?.company ?? '',
    email: c?.email ?? '',
    linkedinUrl: c?.linkedinUrl ?? '',
    relationship: c?.relationship ?? 'recruiter',
    status: c?.status ?? 'to_contact',
    nextFollowUp: isoToLocalDate(c?.nextFollowUpAt ?? null, tz),
    notes: c?.notes ?? '',
  };
}

export default function ContactFormModal({ contact, onClose, onSaved }: {
  /** null to add a new contact. */
  contact: Contact | null;
  onClose: () => void;
  onSaved: (c: Contact) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(contact));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const isEdit = !!contact;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextFollowUpAt = form.nextFollowUp ? localDateToIso(form.nextFollowUp, tzOffset()) : null;
    const body: Record<string, unknown> = {
      name: form.name, role: form.role, company: form.company, email: form.email,
      linkedinUrl: form.linkedinUrl, relationship: form.relationship, status: form.status,
      notes: form.notes, nextFollowUpAt,
    };
    const parsed = parseContactInput(body, isEdit ? 'update' : 'create');
    if (!parsed.ok) {
      setErrors({ [parsed.field === 'nextFollowUpAt' ? 'nextFollowUp' : parsed.field ?? 'form']: parsed.error });
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit ? await updateContact(contact.id, body) : await createContact({ ...body, source: 'manual' });
      toast.success(isEdit ? 'Contact updated' : 'Contact added');
      onSaved(saved);
    } catch (err) {
      if (err instanceof ContactsApiError && err.field) setErrors({ [err.field]: err.message });
      else toast.error(err instanceof Error ? err.message : 'Could not save the contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="fixed inset-0 z-[9500] flex items-end sm:items-center justify-center sm:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <form
          onSubmit={submit}
          noValidate
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-form-title"
          className="relative w-full sm:max-w-xl max-h-[92vh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-xl)] animate-fade-in-up"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
            <h2 id="contact-form-title" className="text-[15px] font-semibold text-white">{isEdit ? 'Edit contact' : 'Add contact'}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto glass-scrollbar px-5 py-5 space-y-4">
            <div>
              <FieldLabel htmlFor="c-name">Name</FieldLabel>
              <input id="c-name" className="field" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Priya Shah" autoFocus maxLength={120} aria-invalid={!!errors.name} />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="c-role" optional>Role</FieldLabel>
                <input id="c-role" className="field" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Technical Recruiter" maxLength={160} />
              </div>
              <div>
                <FieldLabel htmlFor="c-company" optional>Company</FieldLabel>
                <input id="c-company" className="field" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Stripe" maxLength={160} />
              </div>
              <div>
                <FieldLabel htmlFor="c-email" optional>Email</FieldLabel>
                <input id="c-email" type="email" inputMode="email" className="field" value={form.email} onChange={e => set('email', e.target.value)} placeholder="priya@stripe.com" maxLength={254} aria-invalid={!!errors.email} />
                <FieldError>{errors.email}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="c-linkedin" optional>LinkedIn</FieldLabel>
                <input id="c-linkedin" type="url" inputMode="url" className="field" value={form.linkedinUrl} onChange={e => set('linkedinUrl', e.target.value)} placeholder="linkedin.com/in/priyashah" maxLength={300} aria-invalid={!!errors.linkedinUrl} />
                <FieldError>{errors.linkedinUrl}</FieldError>
              </div>
              <div>
                <FieldLabel>Relationship</FieldLabel>
                <AppSelect
                  aria-label="Relationship"
                  value={form.relationship}
                  onValueChange={v => set('relationship', v as Relationship)}
                  options={RELATIONSHIPS.map(r => ({ value: r, label: RELATIONSHIP_LABELS[r] }))}
                />
              </div>
              <div>
                <FieldLabel>Status</FieldLabel>
                <AppSelect
                  aria-label="Status"
                  value={form.status}
                  onValueChange={v => set('status', v as ContactStatus)}
                  options={CONTACT_STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
                />
              </div>
              <div>
                <FieldLabel htmlFor="c-follow" optional>Next follow-up</FieldLabel>
                <input id="c-follow" type="date" className="field [color-scheme:dark]" value={form.nextFollowUp} onChange={e => set('nextFollowUp', e.target.value)} aria-invalid={!!errors.nextFollowUp} />
                <FieldError>{errors.nextFollowUp}</FieldError>
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="c-notes" optional>Notes</FieldLabel>
              <textarea id="c-notes" className="field" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="How you met, what you talked about, who introduced you" maxLength={4000} />
            </div>
            <FieldError>{errors.form || errors.applicationId || errors.source}</FieldError>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Add contact'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
