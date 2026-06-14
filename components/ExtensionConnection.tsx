// components/ExtensionConnection.tsx
'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/firebase/client';
import { Chrome, CheckCircle2, RefreshCw, Plug, PlugZap, Copy } from 'lucide-react';

type Status = 'idle' | 'loading' | 'connected' | 'error';

export default function ExtensionConnection() {
  const [status,      setStatus]      = useState<Status>('idle');
  const [error,       setError]       = useState<string | null>(null);
  const [email,       setEmail]       = useState<string | null>(null);
  const [manualToken, setManualToken] = useState<string | null>(null);
  const [copied,      setCopied]      = useState(false);

  const connect = async () => {
    setStatus('loading');
    setError(null);
    setManualToken(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      const token = await user.getIdToken(true);

      window.postMessage({
        type: 'PRECIPROCAL_AUTH_CHANGE',
        user: {
          uid:         user.uid,
          email:       user.email        ?? '',
          displayName: user.displayName  ?? '',
          photoURL:    user.photoURL      ?? '',
          token,
        },
      }, window.location.origin);

      setStatus('connected');
      setEmail(user.email);
    } catch (err: unknown) {
      console.error('Extension connect error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect automatically.');
      setStatus('error');
    }
  };

  // Generate a self-contained base64 token the user can copy and paste
  // into the extension popup manually if the auto-connect fails.
  const generateManualToken = async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');
      const token = await user.getIdToken(true);
      const payload = {
        uid:         user.uid,
        email:       user.email        ?? '',
        displayName: user.displayName  ?? '',
        photoURL:    user.photoURL      ?? '',
        token,
      };
      // Store as raw JSON — no encoding needed, clipboard preserves it exactly
      setManualToken(JSON.stringify(payload));
    } catch {
      setError('Could not generate token. Please reload and try again.');
    }
  };

  const copyToken = async () => {
    if (!manualToken) return;
    await navigator.clipboard.writeText(manualToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reconnect = () => {
    setStatus('idle');
    setError(null);
    setEmail(null);
    setManualToken(null);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 bg-linear-to-br from-indigo-500/20 to-purple-500/20 rounded-lg border border-indigo-500/20">
          <Chrome className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white mb-0.5">Chrome Extension</h3>
          <p className="text-sm text-slate-400">Connect the Preciprocal extension to auto-fill job applications</p>
        </div>
        {status === 'connected' && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        )}
      </div>

      {status === 'connected' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-300">Extension connected</p>
              {email && <p className="text-xs text-slate-500 mt-0.5">{email}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your session has been synced. Open the extension on any job portal to start auto-filling.
          </p>
          <button onClick={reconnect} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <RefreshCw className="w-3 h-3" />
            Re-connect with a different account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Primary auto-connect button */}
          <button
            onClick={connect}
            disabled={status === 'loading'}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            {status === 'loading' ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />Connecting…</>
            ) : (
              <><PlugZap className="w-4 h-4" />Connect Extension</>
            )}
          </button>

          {/* Error + manual fallback */}
          {status === 'error' && (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>

              <div className="border border-slate-700 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-0.5">Manual connection</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Generate a token here, copy it, then paste it inside the extension popup.
                  </p>
                </div>

                {!manualToken ? (
                  <button
                    onClick={generateManualToken}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <Plug className="w-3.5 h-3.5" />
                    Generate Token
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={copyToken}
                      className="w-full bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                      {copied
                        ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Token copied!</span></>
                        : <><Copy className="w-3.5 h-3.5" />Copy Token</>
                      }
                    </button>
                    <p className="text-[10px] text-slate-600 text-center leading-relaxed">
                      Click Copy above, then paste inside the extension popup → &quot;Having trouble?&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {status === 'idle' && (
            <p className="text-xs text-slate-500 leading-relaxed">
              Click above while the extension is installed. Your account syncs automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}