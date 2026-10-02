// components/settings/DevicesPanel.tsx
// Settings > Devices. Lists where the account is signed in and lets the user
// end any of those sessions. Backed by app/api/session/devices.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import { Laptop, Smartphone, Tablet, MapPin, Loader2, LogOut, MonitorSmartphone, RefreshCw } from 'lucide-react';

interface Device {
  id: string;
  label: string;
  kind: 'desktop' | 'phone' | 'tablet';
  location: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

const KIND_ICON = { desktop: Laptop, phone: Smartphone, tablet: Tablet } as const;

export default function DevicesPanel() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  /** Device id awaiting a second click, or 'others' for the sign-out-all button. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/session/devices', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setDevices((await res.json()).devices as Device[]);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (target: string) => {
    // Two clicks, not a browser confirm(): the second click lands where the
    // first one did, and nothing modal interrupts someone dealing with a
    // device they do not recognise.
    if (confirming !== target) { setConfirming(target); return; }

    setBusy(target);
    setConfirming(null);
    try {
      const res = await fetch('/api/session/devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(target === 'others' ? { allOthers: true } : { sessionId: target }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Something went wrong');

      setDevices(prev => (prev ?? []).filter(d => (target === 'others' ? d.current : d.id !== target)));
      toast.success(target === 'others' ? 'Signed out of all other devices' : 'Device removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const others = (devices ?? []).filter(d => !d.current);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-cyan-500/10 border-cyan-500/20">
          <MonitorSmartphone className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">Devices</h3>
          <p className="text-slate-500 text-xs mt-0.5">Where your account is signed in. Remove anything you do not recognise.</p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh devices"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-5 space-y-2">
        {loadError && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] text-sm text-red-300">
            Could not load your devices.{' '}
            <button type="button" onClick={load} className="underline cursor-pointer">Try again</button>
          </div>
        )}

        {!devices && !loadError && (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}

        {devices?.length === 0 && (
          <p className="text-sm text-slate-500 py-4 text-center">No devices yet. This one will appear after your next page load.</p>
        )}

        {devices?.map(d => {
          const Icon = KIND_ICON[d.kind];
          const isConfirming = confirming === d.id;
          return (
            <div key={d.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border border-white/[0.05] bg-slate-800/20">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-800/60 border border-white/[0.06] flex-shrink-0">
                  <Icon className="w-4 h-4 text-slate-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white text-sm font-medium">{d.label}</h4>
                    {d.current && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs mt-1 flex items-center gap-1 flex-wrap">
                    {d.location && (<><MapPin className="w-3 h-3" />{d.location}<span className="mx-1">&middot;</span></>)}
                    {d.current ? 'Active now' : `Active ${formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })}`}
                  </p>
                  <p className="text-slate-600 text-[11px] mt-0.5">Signed in {format(new Date(d.createdAt), 'd MMM yyyy')}</p>
                </div>
              </div>

              {!d.current && (
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  {isConfirming && (
                    <button type="button" onClick={() => setConfirming(null)}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 cursor-pointer">
                      Cancel
                    </button>
                  )}
                  <button type="button" onClick={() => remove(d.id)} disabled={busy !== null}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isConfirming
                        ? 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25'
                        : 'border-white/[0.08] text-slate-300 hover:border-red-500/30 hover:text-red-300'
                    }`}>
                    {busy === d.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                    {isConfirming ? 'Confirm remove' : 'Remove'}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {others.length > 1 && (
          <div className="pt-3 flex items-center justify-end gap-2">
            {confirming === 'others' && (
              <button type="button" onClick={() => setConfirming(null)}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 cursor-pointer">
                Cancel
              </button>
            )}
            <button type="button" onClick={() => remove('others')} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50">
              {busy === 'others' ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
              {confirming === 'others' ? `Confirm: sign out ${others.length} devices` : 'Sign out of all other devices'}
            </button>
          </div>
        )}

        <p className="text-slate-600 text-[11px] leading-relaxed pt-2">
          Removing a device signs it out straight away. If you do not recognise one, remove it and then change your password.
        </p>
      </div>
    </div>
  );
}
