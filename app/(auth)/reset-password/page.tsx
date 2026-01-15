"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import logo from "@/public/logo.png";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ResetPasswordPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [isValidCode, setIsValidCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  const oobCode = searchParams.get("oobCode");

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        toast.error("Invalid or missing reset code");
        setIsVerifying(false);
        return;
      }

      try {
        // Verify the password reset code is valid
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
        setIsValidCode(true);
      } catch (error) {
        console.error("Error verifying reset code:", error);
        const err = error as { code?: string };
        
        let errorMessage = "Invalid or expired reset link";
        if (err.code === "auth/expired-action-code") {
          errorMessage = "This reset link has expired. Please request a new one.";
        } else if (err.code === "auth/invalid-action-code") {
          errorMessage = "This reset link is invalid or has already been used.";
        }
        
        toast.error(errorMessage);
        setIsValidCode(false);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const onSubmit = async (data: z.infer<typeof resetPasswordSchema>) => {
    if (!oobCode) {
      toast.error("Invalid reset code");
      return;
    }

    setIsLoading(true);
    try {
      // Reset the password
      await confirmPasswordReset(auth, oobCode, data.password);
      
      toast.success("Password reset successfully! You can now sign in with your new password.");
      
      // Redirect to sign in page after 2 seconds
      setTimeout(() => {
        router.push("/sign-in");
      }, 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      const err = error as { code?: string };
      
      let errorMessage = "Failed to reset password";
      if (err.code === "auth/expired-action-code") {
        errorMessage = "This reset link has expired. Please request a new one.";
      } else if (err.code === "auth/invalid-action-code") {
        errorMessage = "This reset link is invalid or has already been used.";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please choose a stronger password.";
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <Image 
              src={logo} 
              alt="Preciprocal" 
              width={64} 
              height={64} 
              className="rounded-2xl mx-auto mb-4"
              priority
            />
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Reset Link</h1>
            <p className="text-slate-400">
              This password reset link is invalid or has expired.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
            <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-400 text-sm">
              Password reset links expire after 1 hour for security reasons.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/forgot-password"
              className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Request new reset link
            </Link>
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

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-slate-700/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "4s" }}></div>
        </div>

        {/* Geometric Accents */}
        <div className="absolute top-20 right-20 w-32 h-32 border border-slate-700/20 rounded-2xl rotate-12 opacity-20"></div>
        <div className="absolute bottom-40 left-20 w-24 h-24 border border-slate-700/20 rounded-full opacity-20"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="mb-12">
            <div className="flex items-center space-x-4 mb-8">
              <Image 
                src={logo} 
                alt="Preciprocal" 
                width={56} 
                height={56} 
                className="rounded-2xl shadow-2xl"
                priority
              />
              <h1 className="text-5xl font-black tracking-tight text-white">Preciprocal</h1>
            </div>
            <h2 className="text-4xl font-bold mb-5 leading-tight tracking-tight text-white">
              Create a New Password
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              Choose a strong password to keep your account secure.
            </p>
          </div>

          {/* Security Tips */}
          <div className="space-y-3 mt-8">
            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-all">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">Minimum 6 Characters</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Use a strong, unique password</p>
                </div>
              </div>
            </div>

            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-all">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">Mix It Up</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Use letters, numbers, and symbols</p>
                </div>
              </div>
            </div>

            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-all">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">Avoid Common Passwords</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Don&apos;t use easily guessable words</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Image 
                src={logo} 
                alt="Preciprocal" 
                width={48} 
                height={48} 
                className="rounded-xl"
                priority
              />
              <h1 className="text-3xl font-black text-white">Preciprocal</h1>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Create new password
            </h2>
            <p className="text-slate-400 mb-1">
              Enter a new password for your account
            </p>
            {email && (
              <p className="text-sm text-purple-400 font-semibold">
                {email}
              </p>
            )}
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
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
                  <p className="text-red-400 text-sm mt-2">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
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
                  <p className="text-red-400 text-sm mt-2">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Resetting password...</span>
                  </div>
                ) : (
                  <span>Reset password</span>
                )}
              </Button>
            </form>
          </Form>

          {/* Back to Sign In */}
          <div className="mt-6">
            <Link
              href="/sign-in"
              className="flex items-center justify-center space-x-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to sign in</span>
            </Link>
          </div>

          {/* Help Text */}
          <p className="mt-8 text-center text-xs text-slate-500">
            Having trouble? Contact our{" "}
            <Link href="/support" className="text-slate-400 hover:text-slate-300 underline">
              support team
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;