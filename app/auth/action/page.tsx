"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  confirmPasswordReset,
  verifyPasswordResetCode,
  applyActionCode,
  checkActionCode,
} from "firebase/auth";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import logo from "@/public/logo.png";

export const dynamic = "force-dynamic";

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ActionMode = "resetPassword" | "verifyEmail" | "recoverEmail" | null;

export default function AuthActionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isLoading, setIsLoading]               = useState(false);
  const [showPassword, setShowPassword]         = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail]                       = useState<string>("");
  const [isValidCode, setIsValidCode]           = useState(false);
  const [isVerifying, setIsVerifying]           = useState(true);
  const [mode, setMode]                         = useState<ActionMode>(null);
  const [errorMessage, setErrorMessage]         = useState<string>("");

  const oobCode    = searchParams.get("oobCode");
  const actionMode = searchParams.get("mode");

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const handleAction = async () => {
      if (!oobCode || !actionMode) {
        setErrorMessage("Invalid or missing action code.");
        setIsVerifying(false);
        return;
      }

      setMode(actionMode as ActionMode);

      try {
        switch (actionMode) {
          case "resetPassword": {
            try {
              const userEmail = await verifyPasswordResetCode(auth, oobCode);
              setEmail(userEmail);
              setIsValidCode(true);
            } catch (error) {
              const err = error as { code?: string };
              if (err.code === "auth/expired-action-code")
                setErrorMessage("This reset link has expired. Please request a new one.");
              else if (err.code === "auth/invalid-action-code")
                setErrorMessage("This reset link is invalid or has already been used.");
              else
                setErrorMessage("Invalid or expired reset link.");
              setIsValidCode(false);
            }
            break;
          }

          case "verifyEmail": {
            try {
              await applyActionCode(auth, oobCode);
              // Reload current user if signed in so emailVerified updates
              if (auth.currentUser) {
                await auth.currentUser.reload();
              }
              setIsValidCode(true);
              toast.success("Email verified successfully!");
            } catch (error) {
              const err = error as { code?: string };
              if (err.code === "auth/expired-action-code")
                setErrorMessage("This verification link has expired. Please request a new one.");
              else if (err.code === "auth/invalid-action-code")
                setErrorMessage("This link is invalid or has already been used.");
              else
                setErrorMessage("Failed to verify email. Please try again.");
              setIsValidCode(false);
            }
            break;
          }

          case "recoverEmail": {
            try {
              const info = await checkActionCode(auth, oobCode);
              const restoredEmail = info.data.email;
              await applyActionCode(auth, oobCode);
              setEmail(restoredEmail || "");
              setIsValidCode(true);
              toast.success("Email recovered successfully!");
            } catch {
              setErrorMessage("Failed to recover email. The link may be invalid or expired.");
              setIsValidCode(false);
            }
            break;
          }

          default:
            setErrorMessage("Invalid action mode.");
            setIsValidCode(false);
        }
      } catch (error) {
        console.error("Error handling action:", error);
        setIsValidCode(false);
        setErrorMessage("Something went wrong. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    };

    handleAction();
  }, [oobCode, actionMode]);

  const onSubmit = async (data: z.infer<typeof resetPasswordSchema>) => {
    if (!oobCode) { toast.error("Invalid reset code."); return; }
    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      toast.success("Password reset! You can now sign in with your new password.");
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch (error) {
      const err = error as { code?: string };
      let msg = "Failed to reset password.";
      if (err.code === "auth/expired-action-code") msg = "This reset link has expired. Please request a new one.";
      else if (err.code === "auth/invalid-action-code") msg = "This link is invalid or has already been used.";
      else if (err.code === "auth/weak-password") msg = "Password is too weak. Please choose a stronger one.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Shared helpers ─────────────────────────────────────────────────────────
  const handleGoToSignIn = () => {
    // Always sign out first to clear any stale/partial session
    // This prevents the black screen caused by a stale server cookie
    auth.signOut().finally(() => {
      window.location.replace("/sign-in?verified=true");
    });
  };

  const handleGoToSignInRecovery = () => {
    auth.signOut().finally(() => {
      window.location.replace("/sign-in");
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Image src={logo} alt="Preciprocal" width={48} height={48} className="rounded-xl opacity-80 animate-pulse" priority />
          <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Verifying...</p>
        </div>
      </div>
    );
  }

  // ── Email Verification Success ─────────────────────────────────────────────
  if (mode === "verifyEmail" && isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-10 max-w-md w-full text-center">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Image src={logo} alt="Preciprocal" width={44} height={44} className="rounded-xl shadow-lg" priority />
            <span className="text-2xl font-black text-white">Preciprocal</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm shadow-2xl mb-6">
            <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your email has been verified. Sign in to access your dashboard.
            </p>
          </div>

          <button
            onClick={handleGoToSignIn}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            <span>Continue to Sign In</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Email Recovery Success ─────────────────────────────────────────────────
  if (mode === "recoverEmail" && isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Image src={logo} alt="Preciprocal" width={44} height={44} className="rounded-xl shadow-lg" priority />
            <span className="text-2xl font-black text-white">Preciprocal</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm shadow-2xl mb-6">
            <div className="w-20 h-20 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Email Recovered</h1>
            <p className="text-slate-400 text-sm mb-3">Your email has been successfully restored.</p>
            {email && <p className="text-purple-400 font-semibold text-sm break-all">{email}</p>}
          </div>

          <button
            onClick={handleGoToSignInRecovery}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (!isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="relative z-10 max-w-md w-full text-center">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Image src={logo} alt="Preciprocal" width={44} height={44} className="rounded-xl shadow-lg" priority />
            <span className="text-2xl font-black text-white">Preciprocal</span>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm shadow-2xl mb-6">
            <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-slate-400 text-sm">{errorMessage || "This link is invalid or has expired."}</p>
          </div>

          <div className="space-y-3">
            {mode === "resetPassword" && (
              <Link
                href="/forgot-password"
                className="block w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg text-center"
              >
                Request new reset link
              </Link>
            )}
            {mode === "verifyEmail" && (
              <Link
                href="/verify-email"
                className="block w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg text-center"
              >
                Resend verification email
              </Link>
            )}
            <Link
              href="/sign-in"
              className="block w-full text-center py-3 text-slate-400 hover:text-slate-300 font-medium transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Reset Password Form ────────────────────────────────────────────────────
  if (mode === "resetPassword" && isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="flex items-center justify-center space-x-3 mb-8">
            <Image src={logo} alt="Preciprocal" width={44} height={44} className="rounded-xl shadow-lg" priority />
            <span className="text-2xl font-black text-white">Preciprocal</span>
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-1">Reset Password</h1>
            <p className="text-slate-400 text-sm">Enter a new password for</p>
            {email && <p className="text-purple-400 font-semibold text-sm mt-0.5">{email}</p>}
          </div>

          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      {...form.register("password")}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 bg-slate-900 border border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-red-400 text-sm mt-2">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
                  <div className="relative">
                    <input
                      {...form.register("confirmPassword")}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 pr-12 bg-slate-900 border border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {form.formState.errors.confirmPassword && (
                    <p className="text-red-400 text-sm mt-2">{form.formState.errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Resetting...</span>
                    </div>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Password requirements</p>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>At least 6 characters</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Mix of letters, numbers, and symbols recommended</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/sign-in"
              className="inline-flex items-center space-x-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to sign in</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}