"use client";
// components/billing/GroupPacksPanel.tsx
// The group packs this user bought: the invite link to share, and who has
// joined. Renders nothing when they have none.
import { useEffect, useState } from "react";
import { Check, Copy, Users } from "lucide-react";

interface Group {
  groupId: string;
  name: string;
  seats: number;
  inviteUrl: string;
  members: { name: string; joinedAt: string }[];
  refunded: boolean;
}

export default function GroupPacksPanel() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/packs/groups").then(r => (r.ok ? r.json() : { groups: [] })).then(j => setGroups(j.groups ?? [])).catch(() => setGroups([]));
  }, []);

  const copy = async (g: Group) => {
    try { await navigator.clipboard.writeText(g.inviteUrl); setCopied(g.groupId); setTimeout(() => setCopied(null), 1800); } catch { /* clipboard blocked */ }
  };

  if (!groups?.length) return null;

  return (
    <section className="glass-card p-5" aria-labelledby="group-packs-h">
      <h3 id="group-packs-h" className="text-[15px] font-semibold text-white">Group packs</h3>
      <p className="text-[12.5px] text-[var(--text-4)] mt-0.5 mb-4">Share the link with up to 3 friends. Each of them gets the full pack.</p>
      <div className="space-y-3">
      {groups.map(g => {
        const left = Math.max(0, g.seats - 1 - g.members.length);
        return (
          <div key={g.groupId} className="rounded-xl ring-1 ring-inset ring-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-white">{g.name}</p>
                <p className="text-[12.5px] text-[var(--text-4)] mt-0.5">
                  {g.refunded ? "Refunded" : left > 0 ? `${g.members.length} of ${g.seats - 1} friends joined, ${left} seat${left === 1 ? "" : "s"} left` : "All seats taken"}
                </p>
              </div>
              <Users className="w-4 h-4 text-[var(--text-4)] flex-shrink-0 mt-0.5" />
            </div>
            {!g.refunded && left > 0 && (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input readOnly value={g.inviteUrl} onFocus={e => e.currentTarget.select()} aria-label="Invite link"
                  className="field flex-1 min-w-0 !h-9 !text-[12.5px] text-[var(--text-2)]" />
                <button onClick={() => copy(g)} className="btn-secondary !h-9 !text-[13px] justify-center">
                  {copied === g.groupId ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy link</>}
                </button>
              </div>
            )}
            {g.members.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {g.members.map((m, i) => (
                  <li key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] text-[var(--text-2)] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]">
                    <Check className="w-3 h-3 text-emerald-400" /> {m.name}
                  </li>
                ))}
              </ul>
            )}
            {!g.refunded && left > 0 && <p className="text-[11.5px] text-[var(--text-5)] mt-3">Anyone with the link can join after signing in, until the seats are taken. Each person gets the full pack.</p>}
          </div>
        );
      })}
      </div>
    </section>
  );
}
