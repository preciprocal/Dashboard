"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  sendEmailVerification,
  reload,
} from "firebase/auth";
import { auth } from "@/firebase/client";
import logo from "@/public/logo.png";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email") || "";
  const redirectUrl = searchParams.get("redirect") || "/";

  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [checkAttempts, setCheckAttempts] = useState(0);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Poll for verification every 4 seconds (up to 30 polls = 2 min)
  useEffect(() => {
    if (checkAttempts >= 30) return;

    const interval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        await reload(currentUser);
        if (currentUser.emailVerified) {
          clearInterval(interval);
          toast.success("Email verified! Redirecting...");
          setTimeout(() => {
            const finalUrl =
              redirectUrl === "/"
                ? `/?_t=${Date.now()}`
                : `${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`;
            window.location.replace(finalUrl);
          }, 1200);
        }
      } catch {
        // ignore reload errors silently
      }

      setCheckAttempts((n) => n + 1);
    }, 4000);

    return () => clearInterval(interval);
  }, [checkAttempts, redirectUrl]);

  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Session expired. Please go back and sign up again.");
      return;
    }

    setIsResending(true);
    try {
      await sendEmailVerification(currentUser);
      toast.success("Verification email sent!");
      setResendCooldown(60);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === "auth/too-many-requests") {
        toast.error("Too many requests. Please wait a few minutes before trying again.");
        setResendCooldown(120);
      } else {
        toast.error("Failed to resend email. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Session expired. Please sign in again.");
      router.push("/sign-in");
      return;
    }

    setIsChecking(true);
    try {
      await reload(currentUser);
      if (currentUser.emailVerified) {
        toast.success("Email verified! Redirecting...");
        setTimeout(() => {
          const finalUrl =
            redirectUrl === "/"
              ? `/?_t=${Date.now()}`
              : `${redirectUrl}${redirectUrl.includes("?") ? "&" : "?"}_t=${Date.now()}`;
          window.location.replace(finalUrl);
        }, 1000);
      } else {
        toast.error("Email not verified yet. Please check your inbox and click the link.");
      }
    } catch {
      toast.error("Failed to check verification status. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 items-center justify-center p-6">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center space-x-3 mb-10">
          <Image
            src={logo}
            alt="Preciprocal"
            width={44}
            height={44}
            className="rounded-xl shadow-lg"
            priority
          />
          <span className="text-2xl font-black text-white">Preciprocal</span>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          {/* Email icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Check your inbox
          </h1>
          <p className="text-slate-400 text-center text-sm leading-relaxed mb-1">
            We sent a verification link to
          </p>
          {email && (
            <p className="text-purple-400 font-semibold text-center text-sm mb-6 break-all">
              {email}
            </p>
          )}
          <p className="text-slate-500 text-center text-xs mb-8">
            Click the link in that email to activate your account. This page will redirect you automatically once verified.
          </p>

          {/* Primary CTA */}
          <button
            onClick={handleCheckVerification}
            disabled={isChecking}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-3"
          >
            {isChecking ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>I`&apos;`ve verified my email</span>
              </>
            )}
          </button>

          {/* Resend */}
          <button
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isResending ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
                <span>Sending...</span>
              </>
            ) : resendCooldown > 0 ? (
              <span>Resend in {resendCooldown}s</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Resend verification email</span>
              </>
            )}
          </button>

          {/* Tips */}
          <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/40 rounded-xl">
            <p className="text-xs text-slate-500 font-medium mb-2">
              Didn&apos;t receive it?
            </p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li className="flex items-start space-x-2">
                <span className="text-slate-600 mt-0.5">•</span>
                <span>Check your spam or junk folder</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-slate-600 mt-0.5">•</span>
                <span>Make sure {email ? `${email} is correct` : "the email address is correct"}</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-slate-600 mt-0.5">•</span>
                <span>Links expire after 24 hours — use the resend button above</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Back link */}
        <p className="text-center mt-6 text-sm text-slate-500">
          Wrong email?{" "}
          <Link
            href="/sign-up"
            className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Sign up again
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}