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

  const redirectUrl = searchParams.get("redirect") || "/";

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

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");

      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const result: UserCredential = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const signInResult = await signIn({
        email: user.email!,
        idToken,
        provider: "google",
      });

      if (!signInResult.success) {
        toast.error(signInResult.message);
        return;
      }

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", user.email!);
        localStorage.setItem("rememberMe", "true");
      }

      toast.success(
        type === "sign-up"
          ? "Account created successfully with Google!"
          : "Signed in successfully!"
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
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
        errorMessage = "This domain is not authorized for Google sign-in.";
      }

      toast.error(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleFacebookAuth = async () => {
    setIsFacebookLoading(true);
    try {
      const provider = new FacebookAuthProvider();
      provider.addScope("email");

      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const result: UserCredential = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const signInResult = await signIn({
        email: user.email!,
        idToken,
        provider: "facebook",
      });

      if (!signInResult.success) {
        toast.error(signInResult.message);
        return;
      }

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", user.email!);
        localStorage.setItem("rememberMe", "true");
      }

      toast.success(
        type === "sign-up"
          ? "Account created successfully with Facebook!"
          : "Signed in successfully!"
      );

      await new Promise((resolve) => setTimeout(resolve, 500));
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
        errorMessage = "This domain is not authorized for Facebook sign-in.";
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

        const userCredential: UserCredential =
          await createUserWithEmailAndPassword(auth, email, password);

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

        const signInUrl =
          redirectUrl !== "/"
            ? `/sign-in?redirect=${encodeURIComponent(redirectUrl)}`
            : "/sign-in";
        router.push(signInUrl);
        router.refresh();
      } else {
        const { email, password } = data;

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

        if (!signInResult.success) {
          toast.error(signInResult.message);
          return;
        }

        toast.success("Signed in successfully.");

        await new Promise((resolve) => setTimeout(resolve, 500));
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
        errorMessage =
          "Invalid credentials. Please check your email and password.";
      }

      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isSignIn = type === "sign-in";

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Subtle Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        ></div>

        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 w-64 h-64 bg-slate-700/10 rounded-full blur-2xl animate-pulse"
            style={{ animationDelay: "4s" }}
          ></div>
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
              <h1 className="text-5xl font-black tracking-tight text-white">
                Preciprocal
              </h1>
            </div>
            <h2 className="text-4xl font-bold mb-5 leading-tight tracking-tight text-white">
              Tired of AI Taking Your Job?
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                Use AI to Take It Back.
              </span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              Master interviews, perfect your resume, and land your dream role
              with AI-powered career prep that puts you ahead of the
              competition.
            </p>
          </div>

          {/* Feature List with Modern Cards */}
          <div className="space-y-3 mt-8">
            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/20 transition-all">
                  <svg
                    className="w-5 h-5 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">
                    AI-Powered Mock Interviews
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Practice with realistic AI interviewers
                  </p>
                </div>
              </div>
            </div>

            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-all">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">
                    Smart Resume Analysis
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Get personalized feedback and improvements
                  </p>
                </div>
              </div>
            </div>

            <div className="group p-5 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all duration-300 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-all">
                  <svg
                    className="w-5 h-5 text-cyan-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base text-white mb-1">
                    Personalized Study Plans
                  </h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Track your progress and stay organized
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
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
              {isSignIn ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-slate-400">
              {isSignIn
                ? "Enter your credentials to access your account"
                : "Start your journey to interview success"}
            </p>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGoogleLoading ? (
                <div className="w-5 h-5 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin"></div>
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
              <span className="text-white font-medium">
                {isGoogleLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </button>

            <button
              onClick={handleFacebookAuth}
              disabled={isFacebookLoading}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isFacebookLoading ? (
                <div className="w-5 h-5 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin"></div>
              ) : (
                <svg
                  className="w-5 h-5 text-[#1877F2]"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              )}
              <span className="text-white font-medium">
                {isFacebookLoading ? "Connecting..." : "Continue with Facebook"}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-950 text-slate-500 font-medium">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!isSignIn && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name
                  </label>
                  <input
                    {...form.register("name")}
                    type="text"
                    placeholder="John Doe"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  {...form.register("email")}
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    {...form.register("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-12 bg-slate-900 border border-slate-800 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-white placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
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
                  <p className="text-xs text-slate-500 mt-2">
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {isSignIn && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-slate-900 border-slate-700 rounded cursor-pointer accent-purple-600"
                      style={{
                        colorScheme: "dark",
                      }}
                    />
                    <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                      Remember me
                    </span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-purple-400 hover:text-purple-300 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>
                      {isSignIn ? "Signing in..." : "Creating account..."}
                    </span>
                  </div>
                ) : (
                  <span>{isSignIn ? "Sign in" : "Create account"}</span>
                )}
              </Button>
            </form>
          </Form>

          {/* Footer Link */}
          <p className="mt-6 text-center text-sm text-slate-400">
            {isSignIn ? "Don't have an account?" : "Already have an account?"}
            <Link
              href={
                !isSignIn
                  ? redirectUrl !== "/"
                    ? `/sign-in?redirect=${encodeURIComponent(redirectUrl)}`
                    : "/sign-in"
                  : redirectUrl !== "/"
                  ? `/sign-up?redirect=${encodeURIComponent(redirectUrl)}`
                  : "/sign-up"
              }
              className="ml-1 text-purple-400 hover:text-purple-300 font-semibold"
            >
              {!isSignIn ? "Sign in" : "Sign up"}
            </Link>
          </p>

          {/* Terms */}
          <p className="mt-8 text-center text-xs text-slate-500">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="text-slate-400 hover:text-slate-300 underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-slate-400 hover:text-slate-300 underline"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;