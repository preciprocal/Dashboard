// components/ExtensionConnection.tsx
'use client';

import { useState } from 'react';
import { auth } from '@/firebase/client';
import { Chrome, CheckCircle2, Copy, RefreshCw, ExternalLink } from 'lucide-react';

export default function ExtensionConnection() {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateToken = async () => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const idToken = await user.getIdToken();

      const response = await fetch('/api/extension/auth', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate token');
      }

      const data = await response.json();
      setToken(data.token);

      // Send token to extension if it's listening
      window.postMessage({
        type: 'PRECIPROCAL_AUTH_TOKEN',
        token: data.token,
        expiresAt: data.expiresAt
      }, '*');

    } catch (err) {
      console.error('Token generation error:', err);
      setError('Failed to connect extension. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg">
          <Chrome className="w-5 h-5 text-purple-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            Chrome Extension
          </h3>
          <p className="text-sm text-slate-400">
            Connect the extension to analyze jobs directly on LinkedIn
          </p>
        </div>
      </div>

      {!token ? (
        <button
          onClick={generateToken}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Chrome className="w-4 h-4" />
              Connect Extension
            </>
          )}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <p className="text-xs font-medium text-green-400">Token Generated</p>
            </div>
            <code className="text-xs text-slate-300 break-all block bg-slate-800/50 p-2 rounded">
              {token}
            </code>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={copyToken}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Token
                </>
              )}
            </button>
            <button
              onClick={() => setToken(null)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              New Token
            </button>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-400 flex items-start gap-2">
              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>
                Token automatically sent to extension. If not connected, manually paste in extension popup.
              </span>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}