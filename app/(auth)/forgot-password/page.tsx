"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import logo from "@/public/logo.png";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof forgotPasswordSchema>) => {
    setIsLoading(true);
    try {
      // Send password reset email via Firebase
      await sendPasswordResetEmail(auth, data.email, {
        url: `${window.location.origin}/sign-in`,
        handleCodeInApp: false,
      });
      
      setEmailSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      console.error("Password reset error:", error);
      const err = error as { code?: string };
      let errorMessage = "Failed to send password reset email.";

      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (err.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection.";
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

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
              Secure Password Recovery
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              We&apos;ll help you get back to your interview prep journey in no time.
            </p>
          </div>

          {/* Security Features with Modern Cards */}
          <div className="space-y-3 mt-8">
            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-all">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">Encrypted Email Delivery</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Your reset link is sent securely</p>
                </div>
              </div>
            </div>

            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-all">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">Time-Limited Link</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Reset link expires in 1 hour for security</p>
                </div>
              </div>
            </div>

            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-all">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">Account Protection</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">Your data remains safe throughout</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Illustration */}
          <div className="mt-12 p-6 bg-slate-800/20 backdrop-blur-sm rounded-xl border border-slate-700/30">
            <div className="flex items-center justify-center space-x-6">
              <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse"></div>
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
                <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
              </div>
              <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
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

          {!emailSent ? (
            <>
              {/* Form Header */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                  Reset your password
                </h2>
                <p className="text-slate-400">
                  Enter your email address and we&apos;ll send you a link to reset your password
                </p>
              </div>

              {/* Form */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email Address
                    </label>
                    <input
                      {...form.register("email")}
                      type="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500"
                      disabled={isLoading}
                    />
                    {form.formState.errors.email && (
                      <p className="text-red-400 text-sm mt-2">
                        {form.formState.errors.email.message}
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
                        <span>Sending reset link...</span>
                      </div>
                    ) : (
                      <span>Send reset link</span>
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
            </>
          ) : (
            /* Success State */
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Success Message */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white">
                  Check your email
                </h2>
                <p className="text-slate-400">
                  We&apos;ve sent a password reset link to
                </p>
                <p className="text-purple-400 font-semibold">
                  {form.getValues("email")}
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3 text-sm">
                  What&apos;s next?
                </h3>
                <ol className="text-slate-400 text-sm space-y-2">
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-400 font-semibold">1.</span>
                    <span>Check your email inbox (and spam folder)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-400 font-semibold">2.</span>
                    <span>Click the reset link in the email</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-400 font-semibold">3.</span>
                    <span>Create your new password</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-purple-400 font-semibold">4.</span>
                    <span>Sign in with your new credentials</span>
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setEmailSent(false);
                    form.reset();
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-semibold py-3 rounded-lg transition-all"
                >
                  Send another email
                </Button>

                <Link
                  href="/sign-in"
                  className="block w-full text-center py-3 text-slate-400 hover:text-slate-300 font-medium transition-colors"
                >
                  Back to sign in
                </Link>
              </div>

              {/* Didn't receive email? */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <p className="text-slate-400 text-sm mb-2">
                  Didn&apos;t receive the email?
                </p>
                <p className="text-slate-500 text-xs">
                  Check your spam folder or try again in a few minutes
                </p>
              </div>
            </div>
          )}

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

export default ForgotPasswordPage;