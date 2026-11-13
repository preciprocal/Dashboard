'use client';

// components/calendar/GoogleCalendarSettings.tsx
// Settings > Integrations: connect or disconnect Google Calendar, see which
// Google account is connected, and read exactly what access that grants.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, Unplug } from 'lucide-react';
import { GoogleCalendarIcon } from '@/components/icons/BrandIcons';
import { callbackMessage, connectHref, NOT_CONFIGURED, type CalendarStatus } from '@/lib/calendar/status';

/** Status for the Settings tab bar, so the Integrations tab only appears when it can work. */
export function useCalendarStatus(enabled = true) {
  const [status, setStatus] = useState<CalendarStatus>(NOT_CONFIGURED);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/integrations/google-calendar/status');
      if (r.ok) setStatus((await r.json()) as CalendarStatus);
    } catch { /* stays hidden */ } finally { setLoaded(true); }
  }, []);
  useEffect(() => { if (enabled) reload(); }, [enabled, reload]);
  return { status, loaded, reload, setStatus };
}

const RETURN_TO = '/settings?section=integrations';

export default function GoogleCalendarSettings({ status, onChanged }: { status: CalendarStatus; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // The OAuth callback lands here with ?calendar=<result>. Say what happened
  // once, then drop the parameter so a refresh does not repeat it.
  useEffect(() => {
    const url = new URL(window.location.href);
    const msg = callbackMessage(url.searchParams.get('calendar'));
    if (!msg) return;
    if (msg.ok) toast.success(msg.text); else toast.error(msg.text);
    url.searchParams.delete('calendar');
    window.history.replaceState(null, '', url.toString());
  }, []);

  const disconnect = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/integrations/google-calendar/disconnect', { method: 'POST' });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || 'Could not disconnect');
      toast.success('Google Calendar disconnected');
      setConfirming(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-white/[0.04] border-white/[0.08]">
          <GoogleCalendarIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Google Calendar</h3>
          <p className="text-slate-400 text-xs mt-0.5">Put interviews from your job tracker on your calendar, with reminders</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {status.broken ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-[var(--r-md)] border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-200 font-medium">Reconnect needed</p>
              <p className="text-xs text-slate-300 mt-0.5">Google stopped accepting our access{status.email ? <> to {status.email}</> : null}. This happens when access is removed in your Google account or after a password change.</p>
            </div>
            <a href={connectHref(RETURN_TO)} className="btn-primary flex-shrink-0">Reconnect</a>
          </div>
        ) : status.connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">Connected{status.email ? <> as {status.email}</> : null}</p>
                {status.connectedAt && <p className="text-xs text-slate-400">Since {new Date(status.connectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
              </div>
            </div>
            <button type="button" onClick={disconnect} disabled={busy}
              className={`btn-secondary flex-shrink-0 ${confirming ? '!text-red-300 !border-red-500/30' : ''}`}>
              {busy ? <Loader2 className="animate-spin" /> : <Unplug />} {confirming ? 'Confirm disconnect' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-slate-300 flex-1">Not connected. When you add an interview time on a job tracker card, it becomes a Google Calendar event with a link back to practise for it.</p>
            <a href={connectHref(RETURN_TO)} className="btn-primary flex-shrink-0"><GoogleCalendarIcon /> Connect Google Calendar</a>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
          <ShieldCheck className="w-4 h-4 text-indigo-300 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed space-y-1.5">
            <p className="text-white font-medium">What we can access</p>
            <p>Google asks you to allow Preciprocal to see, create, change and delete events on calendars you own. We use that narrowly: we create, update and delete only the interview events you add here, and we read back only those events (to show upcoming interviews and follow any you move in Google). We never list, read or change your other events, and we have no access to Gmail.</p>
            <p className="text-slate-400">The Google access token we hold is encrypted at rest. Disconnecting revokes our access at Google; events already added stay on your calendar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
