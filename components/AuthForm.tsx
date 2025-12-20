"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  UserCredential,
} from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { signIn, signUp } from "@/lib/actions/auth.action";
import logo from "@/public/logo.png";

type FormType = "sign-in" | "sign-up";

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(3),
    rememberMe: z.boolean().optional(),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Get redirect URL from query params, default to dashboard
  const redirectUrl = searchParams.get('redirect') || '/';

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  // Load remembered email on component mount
  useEffect(() => {
    if (type === "sign-in") {
      const rememberedEmail = localStorage.getItem("rememberedEmail");
      const wasRemembered = localStorage.getItem("rememberMe") === "true";

      if (rememberedEmail && wasRemembered) {
        form.setValue("email", rememberedEmail);
        setRememberMe(true);
      }
    }
  }, [type, form]);

  // Google OAuth Sign In
  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");

      // Set persistence for Google auth
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const result: UserCredential = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Handle Google sign in (this will create user if they don't exist)
      const signInResult = await signIn({
        email: user.email!,
        idToken,
        provider: "google",
      });

      // Check if sign in was successful
      if (!signInResult.success) {
        toast.error(signInResult.message);
        return;
      }

      // Handle remember me for OAuth
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", user.email!);
        localStorage.setItem("rememberMe", "true");
      }

      toast.success(
        type === "sign-up"
          ? "Account created and signed in successfully with Google!"
          : "Signed in successfully with Google!"
      );

      // Add a small delay to ensure session cookie is set
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redirect to the original page or dashboard
      console.log('✅ Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Google auth error:", error);
      const err = error as { code?: string };
      let errorMessage = "Failed to authenticate with Google.";

      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-in was cancelled.";
      } else if (err.code === "auth/popup-blocked") {
        errorMessage = "Popup was blocked. Please allow popups and try again.";
      } else if (err.code === "auth/account-exists-with-different-credential") {
        errorMessage =
          "An account already exists with this email using a different sign-in method.";
      } else if (err.code === "auth/unauthorized-domain") {
        errorMessage = "This domain is not authorized for Google sign-in. Please add your domain to Firebase Authorized Domains.";
      }

      toast.error(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Facebook OAuth Sign In
  const handleFacebookAuth = async () => {
    setIsFacebookLoading(true);
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope("email");

      // Set persistence for Facebook auth
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const result: UserCredential = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // Handle Facebook sign in (this will create user if they don't exist)
      const signInResult = await signIn({
        email: user.email!,
        idToken,
        provider: "facebook",
      });

      // Check if sign in was successful
      if (!signInResult.success) {
        toast.error(signInResult.message);
        return;
      }

      // Handle remember me for OAuth
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", user.email!);
        localStorage.setItem("rememberMe", "true");
      }

      toast.success(
        type === "sign-up"
          ? "Account created and signed in successfully with Facebook!"
          : "Signed in successfully with Facebook!"
      );

      // Add a small delay to ensure session cookie is set
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redirect to the original page or dashboard
      console.log('✅ Redirecting to:', redirectUrl);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("Facebook auth error:", error);
      const err = error as { code?: string };
      let errorMessage = "Failed to authenticate with Facebook.";

      if (err.code === "auth/popup-closed-by-user") {
        errorMessage = "Sign-in was cancelled.";
      } else if (err.code === "auth/popup-blocked") {
        errorMessage = "Popup was blocked. Please allow popups and try again.";
      } else if (err.code === "auth/account-exists-with-different-credential") {
        errorMessage =
          "An account already exists with this email using a different sign-in method.";
      } else if (err.code === "auth/unauthorized-domain") {
        errorMessage = "This domain is not authorized for Facebook sign-in. Please add your domain to Firebase Authorized Domains.";
      }

      toast.error(errorMessage);
    } finally {
      setIsFacebookLoading(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      if (type === "sign-up") {
        const { name, email, password } = data;

        const userCredential: UserCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // Password is not needed in signUp action - it's already handled by Firebase Auth
        const result = await signUp({
          uid: userCredential.user.uid,
          name: name!,
          email,
        });

        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success("Account created successfully. Please sign in.");
        
        // Redirect to sign-in with the same redirect parameter
        const signInUrl = redirectUrl !== '/' 
          ? `/sign-in?redirect=${encodeURIComponent(redirectUrl)}`
          : '/sign-in';
        router.push(signInUrl);
        router.refresh();
      } else {
        const { email, password } = data;

        // Set persistence based on remember me checkbox
        const persistence = rememberMe
          ? browserLocalPersistence
          : browserSessionPersistence;
        await setPersistence(auth, persistence);

        const userCredential: UserCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        const idToken = await userCredential.user.getIdToken();
        if (!idToken) {
          toast.error("Sign in Failed. Please try again.");
          return;
        }

        // Handle remember me functionality
        if (rememberMe) {
          localStorage.setItem("rememberedEmail", email);
          localStorage.setItem("rememberMe", "true");
        } else {
          localStorage.removeItem("rememberedEmail");
          localStorage.removeItem("rememberMe");
        }

        const signInResult = await signIn({
          email,
          idToken,
          provider: "email",
        });

        // Check if sign in was successful
        if (!signInResult.success) {
          toast.error(signInResult.message);
          return;
        }

        toast.success("Signed in successfully.");

        // Add a small delay to ensure session cookie is set
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Redirect to the original page or dashboard
        console.log('✅ Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
      }
    } catch (error) {
      console.log(error);
      const err = error as { code?: string };
      let errorMessage = "There was an error signing in.";

      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Invalid password. Please try again.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      } else if (err.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled.";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (err.code === "auth/invalid-credential") {
        errorMessage = "Invalid credentials. Please check your email and password.";
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isSignIn = type === "sign-in";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-md mx-4 py-12">
        {/* Header Section */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl">
              <Image 
                src={logo} 
                alt="Preciprocal" 
                width={56} 
                height={56} 
                className="rounded-2xl"
                priority
              />
            </div>
            <h1 className="text-4xl font-black text-white drop-shadow-lg">
              Preciprocal
            </h1>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-bold text-white">
              {isSignIn ? "Welcome Back!" : "Get Started"}
            </h2>
            <p className="text-slate-400 text-sm">
              {isSignIn
                ? "Sign in to continue your interview prep journey"
                : "Create your account and master interviews with AI"}
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8 backdrop-blur-xl border border-white/10 shadow-2xl">
          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            {/* Google Auth Button */}
            <button
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/20"
            >
              {isGoogleLoading ? (
                <div className="w-5 h-5 border-2 border-slate-600 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="text-white font-semibold">
                {isGoogleLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </button>

            {/* Facebook Auth Button */}
            <button
              onClick={handleFacebookAuth}
              disabled={isFacebookLoading}
              className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed hover:border-white/20"
            >
              {isFacebookLoading ? (
                <div className="w-5 h-5 border-2 border-slate-600 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg
                  className="w-5 h-5 text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )}
              <span className="text-white font-semibold">
                {isFacebookLoading
                  ? "Connecting..."
                  : "Continue with Facebook"}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-900 text-slate-400 font-medium">
                or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              {!isSignIn && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Full Name
                  </label>
                  <input
                    {...form.register("name")}
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200 text-white placeholder-slate-500 hover:bg-white/10"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  {...form.register("email")}
                  type="email"
                  placeholder="Enter your email address"
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200 text-white placeholder-slate-500 hover:bg-white/10"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...form.register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3.5 pr-12 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all duration-200 text-white placeholder-slate-500 hover:bg-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {!isSignIn && (
                  <p className="text-xs text-slate-400 mt-2 px-1">
                    Must be at least 6 characters long
                  </p>
                )}
              </div>

              {isSignIn && (
                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-white/5 border-white/20 rounded focus:ring-purple-500 focus:ring-2 transition-colors"
                    />
                    <span className="ml-2 text-sm text-slate-300 font-medium select-none">
                      Remember me
                    </span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-white hover:text-slate-200 font-semibold hover:underline transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border-0 mt-6"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>
                      {isSignIn ? "Signing In..." : "Creating Account..."}
                    </span>
                  </div>
                ) : (
                  <span>{isSignIn ? "Sign In" : "Create Account"}</span>
                )}
              </Button>
            </form>
          </Form>

          {/* Switch Auth Type */}
          <div className="mt-6 text-center">
            <p className="text-slate-300 text-sm">
              {isSignIn ? "New to Preciprocal?" : "Already have an account?"}
              <Link
                href={
                  !isSignIn 
                    ? redirectUrl !== '/' 
                      ? `/sign-in?redirect=${encodeURIComponent(redirectUrl)}`
                      : '/sign-in'
                    : redirectUrl !== '/'
                      ? `/sign-up?redirect=${encodeURIComponent(redirectUrl)}`
                      : '/sign-up'
                }
                className="ml-1 text-white hover:text-slate-200 font-semibold hover:underline transition-colors"
              >
                {!isSignIn ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-300 text-xs">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-white hover:text-slate-200 underline font-medium transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-white hover:text-slate-200 underline font-medium transition-colors">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;