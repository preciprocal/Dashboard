"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { MessagesSquare, FileText, CalendarCheck } from "lucide-react";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { signIn, signUp } from "@/lib/actions/auth.action";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import logo from "@/public/logo.png";
import { SITE } from "@/lib/seo";

type FormType = "sign-in" | "sign-up";

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(3),
    rememberMe: z.boolean().optional(),
    // Required on both forms: Google sign-in creates an account on first use,
    // so the sign-in page is a sign-up page too.
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "Please agree to the Terms of Service and Privacy Policy." }),
    }),
  });
};

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const redirectUrl = searchParams.get("redirect") || "/";

  // Redirects into /sign-in carry a reason, and without this the user is
  // bounced here with no explanation at all - which for the signup guard would
  // be exactly the silent block it's meant not to be. `oauth_failed` predates
  // these and was silent too.
  useEffect(() => {
    const messages: Record<string, string> = {
      // Kept in step with SIGNUP_BLOCKED_MESSAGE in lib/config/abuse-guard.ts.
      // Both used to claim "one free account per person", which is not the
      // enforced rule - the IP limit is 3, so that sentence showed up on the
      // fourth attempt and contradicted what the reader had just watched
      // happen.
      signup_limit:
        "We've already seen several new accounts from this network in the last 30 days, so this one " +
        "has been held back. If you share a connection, email support@preciprocal.com and we'll sort it out.",
      session_limit:
        "You were signed out because your account reached its device limit. Sign in again to continue on this device.",
      oauth_failed:
        "We couldn't complete that sign-in. Please try again, or use your email and password.",
      // app/auth/confirm: an expired or already-used confirmation or reset link.
      link_invalid:
        "That link has expired or was already used. Sign in below, or use \"Forgot password?\" to get a new one.",
    };

    const key = searchParams.get("error") ?? searchParams.get("reason");
    if (key && messages[key]) toast.error(messages[key], { duration: 8000 });
  }, [searchParams]);

  const formSchema = authFormSchema(type);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      rememberMe: false,
      acceptedTerms: false as unknown as true,
    },
  });

  const acceptedTerms = form.watch("acceptedTerms") === true;
  const termsError = form.formState.errors.acceptedTerms?.message;

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
    if (!acceptedTerms) {
      form.setError("acceptedTerms", {
        message: "Please agree to the Terms of Service and Privacy Policy.",
      });
      return;
    }
    setIsGoogleLoading(true);
    try {
      const next = redirectUrl !== "/" ? redirectUrl : "/";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) {
        toast.error(error.message || "Failed to authenticate with Google.");
        setIsGoogleLoading(false);
      }
      // On success the browser navigates away to Google's consent screen -
      // nothing more to do here; app/auth/callback/route.ts handles the return.
    } catch (error) {
      console.error("Google auth error:", error);
      toast.error("Failed to authenticate with Google.");
      setIsGoogleLoading(false);
    }
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      if (type === "sign-up") {
        const { name, email, password } = data;

        // undefined when the browser blocks the APIs the fingerprint is built
        // from; the server treats that as "no device signal" and falls back to
        // the IP limit alone rather than rejecting.
        const fingerprint = (await getDeviceFingerprint()) ?? undefined;

        const result = await signUp({
          name: name!,
          email,
          password,
          fingerprint,
          acceptedTerms: data.acceptedTerms === true,
        });
        if (!result.success) {
          toast.error(result.message);
          return;
        }

        toast.success(result.message);

        const verifyUrl =
          redirectUrl !== "/"
            ? `/verify-email?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectUrl)}`
            : `/verify-email?email=${encodeURIComponent(email)}`;
        router.push(verifyUrl);
      } else {
        const { email, password } = data;

        const result = await signIn({ email, password });
        if (!result.success) {
          if (result.message.toLowerCase().includes("confirm")) {
            const verifyUrl =
              redirectUrl !== "/"
                ? `/verify-email?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectUrl)}`
                : `/verify-email?email=${encodeURIComponent(email)}`;
            router.push(verifyUrl);
            return;
          }
          toast.error(result.message);
          return;
        }

        localStorage.setItem("rememberedEmail", email);
        localStorage.setItem("rememberMe", "true");

        toast.success("Signed in successfully.");
        await new Promise((resolve) => setTimeout(resolve, 800));
        window.location.replace(redirectUrl === "/" ? `/?_t=${Date.now()}` : redirectUrl);
      }
    } catch (error) {
      console.error(error);
      toast.error("There was an error signing in.");
    } finally {
      setIsLoading(false);
    }
  };

  const isSignIn = type === "sign-in";

  return (
    <div className="min-h-screen flex bg-[#050810]">
      {/* Left Side - Branding, styled after the preciprocal.com hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#050810]">
        {/* Spotlight glows */}
        <div className="pointer-events-none absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-indigo-500/[0.12] blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -right-24 w-[520px] h-[520px] rounded-full bg-purple-500/[0.10] blur-[120px]" />

        {/* Hairline grid, faded out toward the edges */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%)",
          }}
        />

        {/* Fade the glows out before the panel edge so the split isn't visible */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-48 bg-gradient-to-r from-transparent to-[#050810]" />

        <div className="relative z-10 flex flex-col justify-between w-full px-14 xl:px-20 py-12">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Image
              src={logo}
              alt="Preciprocal"
              width={36}
              height={36}
              className="w-9 h-9 rounded-[10px]"
              priority
            />
            <span className="text-xl font-bold text-white tracking-tight">Preciprocal</span>
          </div>

          {/* Hero */}
          <div className="max-w-xl py-12">
            <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400/80">
              AI interview preparation
            </p>

            <h2 className="text-[44px] xl:text-[52px] font-black tracking-[-0.03em] leading-[1.02] text-white">
              Tired of AI taking your job?
              <br />
              <span className="inline-block pb-1 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Use AI to take it back.
              </span>
            </h2>

            <p className="mt-6 text-[15px] text-slate-400 leading-relaxed font-light max-w-md">
              Most candidates are qualified. Few are prepared. Preciprocal closes
              that gap with the tools, feedback, and confidence to walk into any
              interview and own the room.
            </p>

            <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm divide-y divide-white/[0.05]">
              {[
                {
                  icon: MessagesSquare,
                  title: "AI mock interviews",
                  body: "Realistic interviewers that adapt to your role, seniority, and target company, scored on communication, depth, and confidence.",
                },
                {
                  icon: FileText,
                  title: "Resume analysis",
                  body: "ATS scoring, keyword gap analysis, and a recruiter eye simulation so your resume clears every gate.",
                },
                {
                  icon: CalendarCheck,
                  title: "Personalized study plans",
                  body: "A day-by-day prep schedule built around your timeline, skill gaps, and target role.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="group flex items-start gap-4 p-5 transition-colors hover:bg-white/[0.02]">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-400/20 flex items-center justify-center transition-colors group-hover:border-indigo-400/40">
                    <Icon className="w-[18px] h-[18px] text-indigo-300" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-white tracking-tight">{title}</h3>
                    <p className="mt-1 text-[13px] text-slate-500 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-600 tracking-wide">
            <span>&copy; {new Date().getFullYear()} Preciprocal</span>
            <div className="flex items-center gap-5">
              <a href={`${SITE.marketing}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                Terms
              </a>
              <a href={`${SITE.marketing}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                Privacy
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#050810]">
        <div className="w-full max-w-md">
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

          <div className="space-y-3 mb-6">
            <button
              onClick={handleGoogleAuth}
              type="button"
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGoogleLoading ? (
                <div className="w-5 h-5 border-2 border-slate-700 border-t-purple-500 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span className="text-white font-medium">
                {isGoogleLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#050810] text-slate-500 font-medium">
                Or continue with email
              </span>
            </div>
          </div>

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
                    placeholder="Bruce Wayne"
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
                  placeholder="bruce@wayneenterprises.com"
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
                      style={{ colorScheme: "dark" }}
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

              {/* Unticked by default on purpose: consent has to be an action
                  the person takes, not a default they failed to undo. */}
              <div>
                <label className="flex items-start cursor-pointer group">
                  <input
                    type="checkbox"
                    {...form.register("acceptedTerms")}
                    className="mt-0.5 w-4 h-4 flex-shrink-0 bg-slate-900 border-slate-700 rounded cursor-pointer accent-purple-600"
                    style={{ colorScheme: "dark" }}
                  />
                  <span className="ml-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                    I agree to the{" "}
                    <a
                      href={`${SITE.marketing}/terms`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href={`${SITE.marketing}/privacy`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 underline"
                    >
                      Privacy Policy
                    </a>
                  </span>
                </label>
                {termsError && (
                  <p role="alert" className="text-xs text-red-400 mt-2">{termsError}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !acceptedTerms}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{isSignIn ? "Signing in..." : "Creating account..."}</span>
                  </div>
                ) : (
                  <span>{isSignIn ? "Sign in" : "Create account"}</span>
                )}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-center text-sm text-slate-400">
            {isSignIn ? "Don't have an account?" : "Already have an account?"}
            <Link
              href={
                !isSignIn
                  ? redirectUrl !== "/" ? `/sign-in?redirect=${encodeURIComponent(redirectUrl)}` : "/sign-in"
                  : redirectUrl !== "/" ? `/sign-up?redirect=${encodeURIComponent(redirectUrl)}` : "/sign-up"
              }
              className="ml-1 text-purple-400 hover:text-purple-300 font-semibold"
            >
              {!isSignIn ? "Sign in" : "Sign up"}
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};

export default AuthForm;