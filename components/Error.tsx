// components/error/ErrorPage.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ArrowLeft,
  MessageSquare,
  Terminal,
  Shield,
  Wifi,
  Database,
  Code
} from 'lucide-react';

interface ErrorPageProps {
  errorCode?: string;
  errorTitle?: string;
  errorMessage?: string;
  errorDetails?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showRefreshButton?: boolean;
  showContactSupport?: boolean;
  onRetry?: () => void;
}

export default function ErrorPage({
  errorCode = '500',
  errorTitle = 'Something went wrong',
  errorMessage = 'We encountered an unexpected error. Please try again.',
  errorDetails,
  showBackButton = true,
  showHomeButton = true,
  showRefreshButton = true,
  showContactSupport = true,
  onRetry
}: ErrorPageProps) {
  const router = useRouter();

  const getErrorIcon = () => {
    switch (errorCode) {
      case '404':
        return <Code className="w-16 h-16 text-slate-400" />;
      case '403':
        return <Shield className="w-16 h-16 text-orange-400" />;
      case '401':
        return <Shield className="w-16 h-16 text-orange-400" />;
      case 'NETWORK':
        return <Wifi className="w-16 h-16 text-blue-400" />;
      case 'DATABASE':
        return <Database className="w-16 h-16 text-purple-400" />;
      default:
        return <AlertTriangle className="w-16 h-16 text-red-400" />;
    }
  };

  const getErrorIconBg = () => {
    switch (errorCode) {
      case '404':
        return 'bg-slate-500/10';
      case '403':
      case '401':
        return 'bg-orange-500/10';
      case 'NETWORK':
        return 'bg-blue-500/10';
      case 'DATABASE':
        return 'bg-purple-500/10';
      default:
        return 'bg-red-500/10';
    }
  };

  const handleRefresh = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Main Error Card */}
        <div className="glass-card hover-lift">
          <div className="text-center p-12">
            
            {/* Error Icon */}
            <div className={`w-20 h-20 ${getErrorIconBg()} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
              {getErrorIcon()}
            </div>

            {/* Error Code */}
            <div className="inline-flex items-center bg-slate-800/50 border border-white/5 px-4 py-2 rounded-lg mb-4">
              <Terminal className="w-4 h-4 text-slate-400 mr-2" />
              <span className="text-sm font-mono text-slate-300">ERROR {errorCode}</span>
            </div>

            {/* Error Title */}
            <h1 className="text-3xl font-semibold text-white mb-3">
              {errorTitle}
            </h1>

            {/* Error Message */}
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              {errorMessage}
            </p>

            {/* Error Details (if provided) */}
            {errorDetails && (
              <div className="glass-card p-4 mb-8 text-left max-w-lg mx-auto">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-300 mb-1">Technical Details:</p>
                    <p className="text-xs text-slate-400 font-mono break-all">
                      {errorDetails}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {showRefreshButton && (
                <button
                  onClick={handleRefresh}
                  className="glass-button-primary hover-lift px-6 py-3 rounded-lg font-medium flex items-center gap-2 w-full sm:w-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              )}

              {showHomeButton && (
                <Link
                  href="/"
                  className="glass-button hover-lift text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 w-full sm:w-auto justify-center"
                >
                  <Home className="w-4 h-4" />
                  Go Home
                </Link>
              )}

              {showBackButton && (
                <button
                  onClick={() => router.back()}
                  className="glass-button hover-lift text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 w-full sm:w-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go Back
                </button>
              )}
            </div>

            {/* Contact Support */}
            {showContactSupport && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="text-sm text-slate-400 mb-3">
                  Still having trouble?
                </p>
                <Link
                  href="/help"
                  className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium text-sm transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Contact Support
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Tips */}
        <div className="glass-card hover-lift mt-6">
          <div className="p-6">
            <h3 className="text-base font-semibold text-white mb-4">Quick Troubleshooting</h3>
            <div className="space-y-3 text-sm">
              {[
                'Check your internet connection',
                'Clear your browser cache and cookies',
                'Try using a different browser',
                'Contact support if the issue persists'
              ].map((tip, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-slate-800/50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-slate-400 text-xs">{index + 1}</span>
                  </div>
                  <p className="text-slate-400">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}