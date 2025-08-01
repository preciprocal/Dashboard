"use client";

import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const ForgotPasswordPage = () => {
  const router = useRouter();
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
      await sendPasswordResetEmail(auth, data.email);
      setEmailSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.log(error);
      let errorMessage = "Failed to send password reset email.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Illustration (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background with gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/50 to-purple-900/50"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse"></div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-center">
          {/* Logo */}
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/10">
              <span className="text-white text-2xl font-bold">P</span>
            </div>
            <h1 className="text-3xl font-black text-white">Preciprocal</h1>
          </div>

          {/* Illustration */}
          <div className="relative mb-8">
            <div className="w-80 h-80 relative">
              {/* Security Illustration */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl backdrop-blur-sm border border-white/10">
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  {/* Security/Lock Icon */}
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
                    <span className="text-white text-4xl">🔐</span>
                  </div>

                  {/* Reset Elements */}
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-2xl">📧</span>
                    </div>
                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-ping"
                      style={{ animationDelay: "0.5s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-white rounded-full animate-ping"
                      style={{ animationDelay: "1s" }}
                    ></div>
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-2xl">🔄</span>
                    </div>
                  </div>

                  {/* Security Indicators */}
                  <div className="flex space-x-3">
                    <div className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-semibold border border-green-500/30">
                      Secure Reset
                    </div>
                    <div className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-semibold border border-blue-500/30">
                      Email Verified
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4 max-w-md">
            <h2 className="text-2xl font-bold text-white">
              Secure Password Reset
            </h2>
            <p className="text-gray-300 leading-relaxed">
              Enter your email address and we'll send you a secure link to reset
              your password. Your account security is our priority.
            </p>

            {/* Security Features */}
            <div className="grid grid-cols-1 gap-3 pt-6">
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Encrypted email delivery</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Secure reset link expires in 1 hour</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-gray-300">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>Account protection maintained</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative min-h-screen">
        {/* Mobile Background */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-orange-600 via-red-600 to-pink-700">
          {/* Animated background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <div
            className="absolute bottom-20 left-0 w-40 h-40 bg-white/5 rounded-full blur-2xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
          <div
            className="absolute top-1/3 left-1/2 w-24 h-24 bg-yellow-400/20 rounded-full blur-xl animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        {/* Desktop Background */}
        <div className="hidden lg:block absolute inset-0 bg-white"></div>

        <div className="relative z-10 w-full max-w-md mx-4 lg:mx-0 lg:p-12">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8 pt-8">
            {/* Logo */}
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl border-2 border-white/20">
                <span className="text-white text-2xl font-bold">P</span>
              </div>
              <h1 className="text-4xl font-black text-white drop-shadow-lg">
                Preciprocal
              </h1>
            </div>

            {/* Welcome message */}
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl font-bold text-white">Reset Password</h2>
              <p className="text-white/80 text-sm leading-relaxed">
                We'll send you a secure reset link
              </p>
            </div>
          </div>

          {/* Desktop Form Header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Forgot Password?
            </h2>
            <p className="text-gray-600">
              No worries! Enter your email and we'll send you a reset link.
            </p>
          </div>

          {/* Form Container */}
          <div className="bg-white/95 lg:bg-transparent backdrop-blur-lg lg:backdrop-blur-none rounded-3xl lg:rounded-none p-6 lg:p-0 shadow-2xl lg:shadow-none border border-white/20 lg:border-0">
            {emailSent ? (
              /* Success State */
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-green-500 text-2xl">✉️</span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900 lg:text-gray-900">
                    Check Your Email
                  </h3>
                  <p className="text-gray-600 lg:text-gray-600">
                    We've sent a password reset link to{" "}
                    <span className="font-semibold text-blue-600">
                      {form.getValues("email")}
                    </span>
                  </p>
                </div>

                <div className="bg-blue-50 lg:bg-blue-50 rounded-2xl p-4 text-left">
                  <h4 className="font-semibold text-blue-900 mb-2 text-sm">
                    Next Steps:
                  </h4>
                  <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
                    <li>Check your email inbox (and spam folder)</li>
                    <li>Click the reset link in the email</li>
                    <li>Create your new password</li>
                    <li>Sign in with your new password</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => setEmailSent(false)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-2xl transition-all duration-300"
                  >
                    Send Another Email
                  </Button>

                  <Link
                    href="/sign-in"
                    className="block w-full text-center py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              /* Form State */
              <>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address
                      </label>
                      <input
                        {...form.register("email")}
                        type="email"
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 bg-white text-gray-900 placeholder-gray-400 shadow-sm hover:shadow-md text-base"
                      />
                      {form.formState.errors.email && (
                        <p className="text-red-500 text-sm mt-2 px-1">
                          {form.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 hover:from-orange-700 hover:via-red-700 hover:to-pink-700 text-white font-bold py-4 px-4 rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-0 text-base"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>Sending Reset Link...</span>
                        </div>
                      ) : (
                        <span>Send Reset Link</span>
                      )}
                    </Button>
                  </form>
                </Form>

                {/* Back to Sign In */}
                <div className="mt-6 text-center">
                  <Link
                    href="/sign-in"
                    className="text-blue-600 hover:text-blue-500 font-semibold hover:underline text-sm inline-flex items-center space-x-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    <span>Back to Sign In</span>
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Mobile Footer */}
          <div className="lg:hidden text-center mt-6 pb-8">
            <p className="text-white/60 text-xs">
              Need help? Contact our support team
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
