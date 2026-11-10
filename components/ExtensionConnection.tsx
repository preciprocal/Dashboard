// components/ExtensionConnection.tsx
'use client';

import { ChromeIcon } from '@/components/icons/BrandIcons';
import { useState } from 'react';
import { supabase } from '@/supabase/client';
import { CheckCircle2, RefreshCw, Plug, PlugZap, Copy, Download, Loader2, AlertTriangle } from 'lucide-react';
import { useExtensionStatus, extensionStoreUrl } from '@/lib/extension';

type Status = 'idle' | 'loading' | 'connected' | 'error';

const ACK_TIMEOUT_MS = 2500;

async function currentAuthPayload() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You are signed out. Sign in again, then connect.');
  const { data: { session } } = await supabase.auth.getSession();
  return {
    uid:         user.id,
    email:       user.email ?? '',
    displayName: (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || '',
    photoURL:    (user.user_metadata?.avatar_url as string) || '',
    token:       session?.access_token ?? null,
  };
}

/**
 * Sends the session to the extension and waits for it to confirm. Extension
 * 1.5.3+ answers PRECIPROCAL_AUTH_ACK; 1.5.2 relays without answering, so a
 * silent bridge on an installed extension still counts as delivered.
 */
function sendToExtension(user: Awaited<ReturnType<typeof currentAuthPayload>>): Promise<'confirmed' | 'sent' | 'failed'> {
  return new Promise(resolve => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'PRECIPROCAL_AUTH_ACK') return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(e.data.ok ? 'confirmed' : 'failed');
    };
    const timer = setTimeout(() => { window.removeEventListener('message', onMessage); resolve('sent'); }, ACK_TIMEOUT_MS);
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'PRECIPROCAL_AUTH_CHANGE', user }, window.location.origin);
  });
}

export default function ExtensionConnection() {
  const ext = useExtensionStatus();
  const [status,      setStatus]      = useState<Status>('idle');
  const [error,       setError]       = useState<string | null>(null);
  const [email,       setEmail]       = useState<string | null>(null);
  const [manualToken, setManualToken] = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

  const installed = ext.status === 'installed';

  const connect = async () => {
    // The button is disabled until the extension is detected; this guards
    // against a stale click if it was removed meanwhile.
    if (!installed) return;
    setStatus('loading');
    setError(null);
    setManualToken(null);
    try {
      const user = await currentAuthPayload();
      const result = await sendToExtension(user);
      if (result === 'failed') throw new Error('The extension did not accept the connection. Reload this page and try again, or connect manually below.');
      setStatus('connected');
      setEmail(user.email || null);
    } catch (err: unknown) {
      console.error('Extension connect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect automatically.');
      setStatus('error');
    }
  };

  // A self-contained token the user can paste into the extension popup if
  // the automatic connection fails.
  const generateManualToken = async () => {
    try {
      setManualToken(JSON.stringify(await currentAuthPayload()));
    } catch {
      setError('Could not generate a token. Please reload and try again.');
    }
  };

  const copyToken = async () => {
    if (!manualToken) return;
    await navigator.clipboard.writeText(manualToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reconnect = () => { setStatus('idle'); setError(null); setEmail(null); setManualToken(null); };

  return (
    <div className="glass-card p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0">
          <ChromeIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-white">Chrome Extension</h3>
          <p className="text-[13px] text-slate-400 mt-0.5">Save jobs from LinkedIn and auto-fill applications</p>
        </div>
        <ExtensionBadge status={ext.status} version={ext.version} connected={status === 'connected'} />
      </div>

      {ext.status === 'checking' ? (
        <div className="flex items-center gap-2.5 h-11 px-3.5 rounded-[10px] bg-[var(--bg-subtle)] border border-white/[0.08] text-[13px] text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Looking for the extension in this browser…
        </div>
      ) : !installed ? (
        // Not installed: connecting would only send the session to nothing,
        // which used to report "Connected" anyway.
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3.5 rounded-[10px] bg-amber-500/[0.06] border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-amber-200">The extension is not installed in this browser</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">Install it from the Chrome Web Store, then come back and connect. It works in Chrome, Edge, Brave and Arc.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={extensionStoreUrl('app-settings')} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1">
              <Download /> Install from Chrome Web Store
            </a>
            <button onClick={ext.recheck} className="btn-secondary">
              <RefreshCw /> I&apos;ve installed it
            </button>
          </div>
          <button disabled className="btn-secondary w-full opacity-50 cursor-not-allowed" title="Install the extension first">
            <PlugZap /> Connect Extension
          </button>
        </div>
      ) : status === 'connected' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-[10px] bg-emerald-500/[0.06] border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-emerald-300">Extension connected</p>
              {email && <p className="text-xs text-slate-400 mt-0.5 truncate">{email}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your session is synced. Open the extension on LinkedIn or any job application to start.
          </p>
          <button onClick={reconnect} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="w-3 h-3" /> Re-connect with a different account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button onClick={connect} disabled={status === 'loading'} className="btn-primary w-full h-11">
            {status === 'loading' ? <><RefreshCw className="animate-spin" /> Connecting…</> : <><PlugZap /> Connect Extension</>}
          </button>

          {status === 'error' && (
            <div className="space-y-3">
              <div className="rounded-[10px] p-3 bg-red-500/[0.08] border border-red-500/20">
                <p className="text-xs text-red-300">{error}</p>
              </div>
              <div className="rounded-[10px] p-4 space-y-3 border border-white/[0.08] bg-[var(--bg-subtle)]">
                <div>
                  <p className="text-xs font-semibold text-slate-200 mb-0.5">Manual connection</p>
                  <p className="text-xs text-slate-400 leading-relaxed">Generate a token here, copy it, then paste it inside the extension popup.</p>
                </div>
                {!manualToken ? (
                  <button onClick={generateManualToken} className="btn-secondary w-full"><Plug /> Generate Token</button>
                ) : (
                  <div className="space-y-2">
                    <button onClick={copyToken} className="btn-secondary w-full">
                      {copied ? <><CheckCircle2 className="text-emerald-400" /><span className="text-emerald-400">Token copied</span></> : <><Copy /> Copy Token</>}
                    </button>
                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                      Paste it in the extension popup under &quot;Having trouble?&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <p className="text-xs text-slate-400 leading-relaxed">The extension is installed. Connect it and your account syncs automatically.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ExtensionBadge({ status, version, connected }: { status: string; version?: string; connected: boolean }) {
  if (status === 'checking') return null;
  if (status !== 'installed') {
    return <span className="flex-shrink-0 text-xs font-medium text-slate-400 bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 rounded-full">Not installed</span>;
  }
  return (
    <span className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      {connected ? 'Connected' : 'Installed'}{version ? ` · v${version}` : ''}
    </span>
  );
}
