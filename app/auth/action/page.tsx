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
import { 
  confirmPasswordReset, 
  verifyPasswordResetCode,
  applyActionCode,
  checkActionCode
} from "firebase/auth";

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

type ActionMode = "resetPassword" | "verifyEmail" | "recoverEmail" | null;

const AuthActionPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [isValidCode, setIsValidCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [mode, setMode] = useState<ActionMode>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const oobCode = searchParams.get("oobCode");
  const actionMode = searchParams.get("mode");

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const handleAction = async () => {
      if (!oobCode || !actionMode) {
        setErrorMessage("Invalid or missing action code");
        setIsVerifying(false);
        return;
      }

      setMode(actionMode as ActionMode);

      try {
        switch (actionMode) {
          case "resetPassword":
            await handleResetPasswordVerification();
            break;
          case "verifyEmail":
            await handleEmailVerification();
            break;
          case "recoverEmail":
            await handleRecoverEmail();
            break;
          default:
            setErrorMessage("Invalid action mode");
            setIsValidCode(false);
        }
      } catch (error) {
        console.error("Error handling action:", error);
        setIsValidCode(false);
      } finally {
        setIsVerifying(false);
      }
    };

    const handleResetPasswordVerification = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode!);
        setEmail(userEmail);
        setIsValidCode(true);
      } catch (error) {
        console.error("Error verifying reset code:", error);
        const err = error as { code?: string };
        
        if (err.code === "auth/expired-action-code") {
          setErrorMessage("This reset link has expired. Please request a new one.");
        } else if (err.code === "auth/invalid-action-code") {
          setErrorMessage("This reset link is invalid or has already been used.");
        } else {
          setErrorMessage("Invalid or expired reset link");
        }
        
        setIsValidCode(false);
      }
    };

    const handleEmailVerification = async () => {
      try {
        await applyActionCode(auth, oobCode!);
        setIsValidCode(true);
        toast.success("Email verified successfully!");
        
        // Redirect to home/dashboard after 2 seconds
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } catch (error) {
        console.error("Error verifying email:", error);
        const err = error as { code?: string };
        
        if (err.code === "auth/expired-action-code") {
          setErrorMessage("This verification link has expired.");
        } else if (err.code === "auth/invalid-action-code") {
          setErrorMessage("This verification link is invalid or has already been used.");
        } else {
          setErrorMessage("Failed to verify email");
        }
        
        setIsValidCode(false);
      }
    };

    const handleRecoverEmail = async () => {
      try {
        const info = await checkActionCode(auth, oobCode!);
        const restoredEmail = info.data.email;
        
        await applyActionCode(auth, oobCode!);
        setEmail(restoredEmail || "");
        setIsValidCode(true);
        toast.success("Email recovered successfully!");
        
        // Redirect to sign in after 2 seconds
        setTimeout(() => {
          router.push("/sign-in");
        }, 2000);
      } catch (error) {
        console.error("Error recovering email:", error);
        setErrorMessage("Failed to recover email");
        setIsValidCode(false);
      }
    };

    handleAction();
  }, [oobCode, actionMode, router]);

  const onSubmit = async (data: z.infer<typeof resetPasswordSchema>) => {
    if (!oobCode) {
      toast.error("Invalid reset code");
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      
      toast.success("Password reset successfully! You can now sign in with your new password.");
      
      setTimeout(() => {
        router.push("/sign-in");
      }, 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      const err = error as { code?: string };
      
      let errorMsg = "Failed to reset password";
      if (err.code === "auth/expired-action-code") {
        errorMsg = "This reset link has expired. Please request a new one.";
      } else if (err.code === "auth/invalid-action-code") {
        errorMsg = "This reset link is invalid or has already been used.";
      } else if (err.code === "auth/weak-password") {
        errorMsg = "Password is too weak. Please choose a stronger password.";
      }
      
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Verifying...</p>
        </div>
      </div>
    );
  }

  // Email Verification Success
  if (mode === "verifyEmail" && isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md w-full text-center">
          <Image 
            src={logo} 
            alt="Preciprocal" 
            width={64} 
            height={64} 
            className="rounded-2xl mx-auto mb-6"
            priority
          />
          
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 mb-6">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Email Verified!</h1>
            <p className="text-slate-400">
              Your email has been successfully verified. Redirecting you to your dashboard...
            </p>
          </div>

          <Link
            href="/"
            className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Email Recovery Success
  if (mode === "recoverEmail" && isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md w-full text-center">
          <Image 
            src={logo} 
            alt="Preciprocal" 
            width={64} 
            height={64} 
            className="rounded-2xl mx-auto mb-6"
            priority
          />
          
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 mb-6">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Email Recovered</h1>
            <p className="text-slate-400 mb-3">
              Your email has been successfully recovered.
            </p>
            {email && (
              <p className="text-sm text-purple-400 font-semibold">
                {email}
              </p>
            )}
          </div>

          <Link
            href="/sign-in"
            className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (!isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="max-w-md w-full text-center">
          <Image 
            src={logo} 
            alt="Preciprocal" 
            width={64} 
            height={64} 
            className="rounded-2xl mx-auto mb-6"
            priority
          />
          
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 mb-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
            <p className="text-slate-400">
              {errorMessage || "This link is invalid or has expired."}
            </p>
          </div>

          <div className="space-y-3">
            {mode === "resetPassword" && (
              <Link
                href="/forgot-password"
                className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Request new reset link
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

  // Reset Password Form
  if (mode === "resetPassword" && isValidCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <Image 
              src={logo} 
              alt="Preciprocal" 
              width={56} 
              height={56} 
              className="rounded-2xl mx-auto mb-4"
              priority
            />
            <h1 className="text-3xl font-bold text-white mb-2">
              Reset Password
            </h1>
            <p className="text-slate-400 mb-1">
              Enter your new password
            </p>
            {email && (
              <p className="text-sm text-purple-400 font-semibold">
                {email}
              </p>
            )}
          </div>

          {/* Form Card */}
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8">
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
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
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
                    Confirm Password
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
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
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
                      <span>Resetting...</span>
                    </div>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </Button>
              </form>
            </Form>

            {/* Password Requirements */}
            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-3">Password must contain:</p>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>At least 6 characters</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Mix of letters, numbers, and symbols recommended</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
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

          <p className="mt-6 text-center text-xs text-slate-500">
            Need help? Contact{" "}
            <a 
              href="mailto:support@preciprocal.com" 
              className="text-slate-400 hover:text-slate-300 underline"
            >
              support@preciprocal.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthActionPage;