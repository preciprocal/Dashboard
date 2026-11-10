'use client';

// components/outcomes/InboundEmailPanel.tsx
// "Forward recruiter emails here and your tracker updates itself."
//
// Shows the user's private forwarding address, how to set up automatic
// forwarding, and what each forwarded email did, with undo. Data from
// /api/inbound; the work happens in lib/inbound/process.ts.
//
// Renders nothing until the feature is configured (INBOUND_EMAIL_DOMAIN) and
// migration 0057 is applied, so it can ship ahead of the DNS setup.

import { AppSelect } from '@/components/ui/select';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, Copy, Check, Inbox, RotateCcw } from 'lucide-react';

interface InboundEmail {
  id: string;
  subject: string | null;
  received_at: string;
  kind: string;
  company: string | null;
  job_title: string | null;
  evidence: string | null;
  confirmation: string | null;
  application_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  outcome: 'applied' | 'needs_review' | 'unmatched' | 'ignored' | 'undone';
}

interface AppOption { id: string; company: string; jobTitle: string }

const STATUS_LABEL: Record<string, string> = {
  applied: 'Applied', 'phone-screen': 'First interview', technical: 'Technical', final: 'Final round',
  offer: 'Offer', rejected: 'Rejected', ghosted: 'No reply', withdrew: 'Withdrawn', wishlist: 'Wishlist',
};
const label = (s: string | null) => (s ? STATUS_LABEL[s] ?? s : '');

const COLLAPSE_KEY = 'prc_inbound_collapsed';

const GMAIL_FILTER = 'from:(greenhouse.io OR lever.co OR myworkday.com OR ashbyhq.com OR icims.com OR smartrecruiters.com OR jobvite.com OR workable.com) OR subject:("your application" OR "interview")';

export default function InboundEmailPanel({ apps, onChanged }: { apps: AppOption[]; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(false);
  const [address, setAddress] = useState('');
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState<'address' | 'filter' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/inbound');
      if (!r.ok) return;
      const j = await r.json();
      setEnabled(!!j.enabled);
      if (j.enabled) { setAddress(j.address); setEmails(j.emails ?? []); }
    } catch { /* panel stays hidden */ }
  }, []);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* storage blocked */ }
    load();
  }, [load]);

  if (!enabled) return null;

  const copy = async (what: 'address' | 'filter', text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 1800); }
    catch { toast.error('Could not copy. Your browser blocked clipboard access.'); }
  };

  const act = async (body: Record<string, unknown>, success: string) => {
    setBusy(String(body.id ?? body.action));
    try {
      const r = await fetch('/api/inbound', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      if (j.address) setAddress(j.address);
      toast.success(success);
      await load();
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(null); }
  };

  const toggle = () => setCollapsed(c => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ } return !c; });

  const pending = emails.filter(e => e.outcome === 'needs_review' || e.outcome === 'unmatched').length;
  const visible = emails.filter(e => e.outcome !== 'ignored').slice(0, 8);

  return (
    <section className="glass-card p-4" aria-labelledby="inbound-email">
      <button type="button" onClick={toggle} className="w-full flex items-start justify-between gap-3 text-left" aria-expanded={!collapsed}>
        <div className="flex items-start gap-3 min-w-0">
          <Inbox className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 id="inbound-email" className="text-sm font-bold text-white">
              Update from email {pending > 0 && <span className="ml-1.5 text-amber-300 font-semibold">{pending} to check</span>}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Forward recruiter emails to your private address and the tracker moves the card for you.</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs text-slate-200 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 break-all">{address}</code>
            <button type="button" className="btn-pill" onClick={() => copy('address', address)}>
              {copied === 'address' ? <Check /> : <Copy />} {copied === 'address' ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn-pill" disabled={busy === 'rotate'}
              onClick={() => { if (window.confirm('Get a new address? Mail sent to the old one will stop being read, so update any forwarding rule.')) act({ action: 'rotate' }, 'New address ready'); }}>
              <RotateCcw /> New address
            </button>
            <button type="button" className="btn-pill" onClick={() => setShowSetup(s => !s)}>{showSetup ? 'Hide setup' : 'How to set it up'}</button>
          </div>

          {showSetup && (
            <ol className="text-xs text-slate-400 leading-relaxed list-decimal pl-4 space-y-1.5">
              <li>Quickest: forward any recruiter email to the address above.</li>
              <li>Automatic, in Gmail: Settings, See all settings, Forwarding and POP/IMAP, Add a forwarding address, and paste the address. Gmail sends a confirmation, which will appear right here with a link.</li>
              <li>
                Then create a filter (Settings, Filters, Create new filter) with this search, and choose &ldquo;Forward it to&rdquo; your address:
                <div className="mt-1 flex items-start gap-2">
                  <code className="text-[11px] text-slate-300 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 break-all">{GMAIL_FILTER}</code>
                  <button type="button" className="btn-pill shrink-0" onClick={() => copy('filter', GMAIL_FILTER)}>{copied === 'filter' ? <Check /> : <Copy />}</button>
                </div>
              </li>
              <li>Clear rejections, interview invites and offers update the card straight away and can be undone. Anything unclear waits for you here. We keep the subject line and what we found, never the email itself.</li>
            </ol>
          )}

          {visible.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing forwarded yet.</p>
          ) : (
            <ul className="space-y-2">
              {visible.map(e => (
                <li key={e.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-200 truncate">{e.company || e.subject || 'Email'}{e.job_title ? ` · ${e.job_title}` : ''}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{describe(e)}</p>
                      {e.evidence && e.kind !== 'forwarding_confirmation' && <p className="text-[11px] text-slate-600 mt-0.5 italic line-clamp-2">&ldquo;{e.evidence}&rdquo;</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {e.kind === 'forwarding_confirmation' && e.confirmation?.startsWith('https://') && (
                        <a href={e.confirmation} target="_blank" rel="noopener noreferrer" className="btn-pill">Confirm forwarding</a>
                      )}
                      {e.outcome === 'applied' && e.previous_status && (
                        <button type="button" className="btn-pill" disabled={busy === e.id} onClick={() => act({ action: 'undo', id: e.id }, 'Undone')}>Undo</button>
                      )}
                      {e.outcome === 'needs_review' && e.new_status && e.application_id && (
                        <button type="button" className="btn-pill" disabled={busy === e.id} onClick={() => act({ action: 'apply', id: e.id }, 'Updated')}>Move to {label(e.new_status)}</button>
                      )}
                    </div>
                  </div>
                  {e.outcome === 'unmatched' && e.new_status && apps.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AppSelect className="!h-9 !text-xs max-w-[260px]" value={assign[e.id] ?? ''} onValueChange={v => setAssign(a => ({ ...a, [e.id]: v }))}
                        aria-label="Application" placeholder="Which application is this?"
                        options={apps.map(a => ({ value: a.id, label: `${a.company} · ${a.jobTitle}` }))} />
                      <button type="button" className="btn-pill" disabled={!assign[e.id] || busy === e.id}
                        onClick={() => act({ action: 'apply', id: e.id, applicationId: assign[e.id] }, 'Updated')}>
                        Move to {label(e.new_status)}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function describe(e: InboundEmail): string {
  if (e.kind === 'forwarding_confirmation') return e.evidence ?? 'Confirm forwarding to finish setup.';
  switch (e.outcome) {
    case 'applied':      return `Moved from ${label(e.previous_status)} to ${label(e.new_status)}.`;
    case 'undone':       return `Undone. Left at ${label(e.previous_status)}.`;
    case 'needs_review': return e.new_status ? `Looks like ${label(e.new_status).toLowerCase()}. Check it, then confirm.` : (e.evidence ?? 'Needs a look.');
    case 'unmatched':    return `Looks like ${label(e.new_status).toLowerCase()}, but no application matched.`;
    default:             return 'No change needed.';
  }
}
