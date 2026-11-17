'use client';
// app/(root)/join/[token]/page.tsx
//
// A group pack invite (lib/packs/groups.ts). The (root) layout sends anyone
// signed out to sign in first, then back here. Joining gives this account its
// own full set of the pack's credits while seats are left.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Check, Loader2, Users } from 'lucide-react';
import { PACKS, type PackKey } from '@/lib/config/packs';
import { featureLabel } from '@/lib/config/plan-features';
import type { FeatureType } from '@/lib/config/usage-limits';
import { useSupabaseUser } from '@/lib/hooks/useSupabaseUser';

interface Invite { packKey: PackKey; name: string; ownerName: string; seatsLeft: number; closed: boolean }

export default function JoinGroupPack() {
  const { token } = useParams<{ token: string }>();
  const [user] = useSupabaseUser();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    fetch(`/api/packs/groups?token=${encodeURIComponent(token)}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'This invite link is not valid.'); setInvite(j.invite); })
      .catch(e => setError(e instanceof Error ? e.message : 'This invite link is not valid.'));
  }, [user, token]);

  const join = async () => {
    setJoining(true);
    try {
      const r = await fetch('/api/packs/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
      const j = await r.json();
      setResult({ ok: r.ok, message: j.message || j.error || 'Could not join right now.' });
    } catch {
      setResult({ ok: false, message: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setJoining(false);
    }
  };

  const pack = invite ? PACKS[invite.packKey] : null;
  const grants = pack ? (Object.entries(pack.grants) as [FeatureType, number][]) : [];

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded-2xl bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-16px_rgba(0,0,0,0.8)] p-6 sm:p-7 prc-fade">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] mb-5">
          <Users className="w-5 h-5 text-[var(--text-2)]" />
        </span>

        {error ? (
          <>
            <h1 className="font-display text-[19px] font-semibold text-white">Invite not found</h1>
            <p className="text-[13.5px] text-[var(--text-3)] mt-2">{error}</p>
            <Link href="/pricing" className="btn-secondary mt-6 inline-flex">See packs</Link>
          </>
        ) : !invite ? (
          <div className="flex items-center gap-2 text-[13.5px] text-[var(--text-3)]"><Loader2 className="w-4 h-4 animate-spin" /> Loading the invite</div>
        ) : result ? (
          <>
            <h1 className="font-display text-[19px] font-semibold text-white">{result.ok ? 'You joined the group' : 'Could not join'}</h1>
            <p className="text-[13.5px] text-[var(--text-3)] mt-2">{result.message}</p>
            <div className="flex gap-2 mt-6">
              {result.ok ? <Link href="/jobs" className="btn-primary">Start using it</Link> : <Link href="/pricing" className="btn-secondary">See packs</Link>}
            </div>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-[var(--text-4)]">{invite.ownerName} invited you</p>
            <h1 className="font-display text-[19px] font-semibold text-white mt-1">Join their {invite.name}</h1>
            <p className="text-[13.5px] text-[var(--text-3)] mt-2">You get your own full set of credits, free. They are used once your monthly allowance runs out, and they never expire.</p>
            <ul className="mt-5 space-y-2">
              {grants.map(([f, n]) => (
                <li key={f} className="flex items-center gap-2.5 text-[13.5px] text-[var(--text-2)]"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />{featureLabel(f, n)}</li>
              ))}
            </ul>
            <p className="text-[12px] text-[var(--text-5)] mt-5">
              {invite.closed ? 'This group pack was refunded.' : invite.seatsLeft > 0 ? `${invite.seatsLeft} of 3 seats left` : 'All seats are taken.'}
            </p>
            <button onClick={join} disabled={joining || invite.closed || invite.seatsLeft === 0} className="btn-primary w-full justify-center mt-4">
              {joining && <Loader2 className="w-4 h-4 animate-spin" />} Join and get the credits
            </button>
          </>
        )}
      </div>
    </div>
  );
}
