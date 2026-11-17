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
import { MessagesSquare, FileText, Briefcase, Eye, EyeOff } from "lucide-react";

import { Form } from "@/components/ui/form";

import { signIn, signUp } from "@/lib/actions/auth.action";
import { reloadIfStaleBuild } from "@/lib/auth/client-user";
import { authDestination } from "@/lib/auth/destination";
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
    // Required to submit the email form on both pages. Google sign-in skips
    // it and shows a "By continuing with Google, you agree..." notice instead.
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

  // Where to go after signing in (lib/auth/destination.ts). ?redirect= must
  // be a path inside the app; the landing site links here with ?plan= (Start
  // Pro / Go Premium) and ?tool= (each tool page, plus ?role= from the
  // question predictor), which open the plan's checkout or that tool.
  const redirectUrl = authDestination(searchParams);

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

  // No checkbox for Google: the notice under the button says continuing
  // means agreeing to the Terms and Privacy Policy. The checkbox is only for
  // the email form.
  const handleGoogleAuth = async () => {
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
          // Saved on the account, so the emailed confirmation link lands here
          // too (app/auth/confirm), on whichever device it is opened.
          next: redirectUrl,
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

        // A sign-in that never answers left the button spinning for good.
        const result = await Promise.race([
          signIn({ email, password }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 25_000)),
        ]);
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
      if (reloadIfStaleBuild(error)) return;
      console.error(error);
      toast.error((error as Error)?.message === "timeout"
        ? "Signing in is taking too long. Check your connection and try again."
        : "There was an error signing in.");
    } finally {
      setIsLoading(false);
    }
  };

  const isSignIn = type === "sign-in";
  const otherHref = !isSignIn
    ? redirectUrl !== "/" ? `/sign-in?redirect=${encodeURIComponent(redirectUrl)}` : "/sign-in"
    : redirectUrl !== "/" ? `/sign-up?redirect=${encodeURIComponent(redirectUrl)}` : "/sign-up";
  const link = "text-[var(--text-1)] underline underline-offset-2 decoration-white/25 hover:decoration-white/70 transition-colors";
  const checkbox = "mt-0.5 w-4 h-4 flex-shrink-0 rounded cursor-pointer accent-white";

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-[var(--bg)]">
      {/* Left: what the product does, in plain words */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between px-14 xl:px-20 py-12 border-r border-white/[0.06] bg-[#0d0e10]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 20% 30%, black 15%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 20% 30%, black 15%, transparent 70%)",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <Image src={logo} alt="Preciprocal" width={32} height={32} className="w-8 h-8 rounded-[9px]" priority />
          <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">Preciprocal</span>
        </div>

        <div className="relative max-w-[460px]">
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-4)]">For F-1 and OPT job seekers</p>
          <h2 className="font-display mt-4 text-[38px] xl:text-[44px] leading-[1.06] font-semibold tracking-[-0.03em] text-white">
            Find the jobs that can hire you. Apply ready.
          </h2>
          <p className="mt-5 text-[14.5px] leading-relaxed text-[var(--text-3)]">
            Live postings from employers&apos; own job boards, with their E-Verify and H-1B records beside each one, and the tools to apply and prepare.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              { icon: Briefcase, title: "Jobs you can actually take", body: "Filter by E-Verify enrollment and H-1B approvals from official USCIS directories." },
              { icon: FileText, title: "Tailored applications", body: "A resume and cover letter fitted to each posting, using only what your resume says." },
              { icon: MessagesSquare, title: "Mock interviews", body: "Practice with an AI interviewer for the role, then get feedback on every answer." },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]">
                  <Icon className="w-[17px] h-[17px] text-[var(--text-2)]" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-white">{title}</span>
                  <span className="block mt-0.5 text-[13px] leading-relaxed text-[var(--text-4)]">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[12px] text-[var(--text-5)]">
          <span>&copy; {new Date().getFullYear()} Preciprocal</span>
          <div className="flex items-center gap-5">
            <a href={`${SITE.marketing}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-2)] transition-colors">Terms</a>
            <a href={`${SITE.marketing}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-2)] transition-colors">Privacy</a>
          </div>
        </div>
      </aside>

      {/* Right: the form */}
      <main className="flex items-center justify-center px-4 sm:px-8 py-10 min-w-0">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Image src={logo} alt="Preciprocal" width={32} height={32} className="w-8 h-8 rounded-[9px]" priority />
            <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">Preciprocal</span>
          </div>

          <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-white">
            {isSignIn ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--text-3)]">
            {isSignIn ? "Sign in to pick up where you left off." : "Free to start. No card needed."}
          </p>

          <button
            onClick={handleGoogleAuth}
            type="button"
            disabled={isGoogleLoading}
            className="btn-secondary w-full !h-11 mt-8 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span className="font-medium">{isGoogleLoading ? "Connecting..." : "Continue with Google"}</span>
          </button>
          <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--text-4)] text-center">
            By continuing with Google, you agree to our{" "}
            <a href={`${SITE.marketing}/terms`} target="_blank" rel="noopener noreferrer" className={link}>Terms of Service</a>
            {" "}and{" "}
            <a href={`${SITE.marketing}/privacy`} target="_blank" rel="noopener noreferrer" className={link}>Privacy Policy</a>.
          </p>

          <div className="flex items-center gap-3 my-7" aria-hidden>
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[12px] text-[var(--text-5)]">or with email</span>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!isSignIn && (
                <div>
                  <label htmlFor="auth-name" className="block text-[12.5px] font-medium text-[var(--text-2)] mb-1.5">Full name</label>
                  <input id="auth-name" {...form.register("name")} type="text" autoComplete="name" placeholder="Your name" className="field" />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-[12.5px] font-medium text-[var(--text-2)] mb-1.5">Email</label>
                <input id="auth-email" {...form.register("email")} type="email" autoComplete="email" placeholder="you@university.edu" className="field" />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label htmlFor="auth-password" className="text-[12.5px] font-medium text-[var(--text-2)]">Password</label>
                  {isSignIn && (
                    <Link href="/forgot-password" className="text-[12.5px] text-[var(--text-3)] hover:text-white transition-colors">Forgot password?</Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="auth-password"
                    {...form.register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignIn ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    className="field !pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-[var(--text-4)] hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!isSignIn && <p className="text-[12px] text-[var(--text-5)] mt-1.5">At least 6 characters.</p>}
              </div>

              {isSignIn && (
                <label className="flex items-center gap-2 cursor-pointer w-fit">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className={checkbox.replace("mt-0.5 ", "")}
                    style={{ colorScheme: "dark" }}
                  />
                  <span className="text-[13px] text-[var(--text-3)]">Remember me</span>
                </label>
              )}

              {/* Unticked by default on purpose: consent has to be an action
                  the person takes, not a default they failed to undo. */}
              <div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" {...form.register("acceptedTerms")} className={checkbox} style={{ colorScheme: "dark" }} />
                  <span className="text-[13px] leading-snug text-[var(--text-3)]">
                    I agree to the{" "}
                    <a href={`${SITE.marketing}/terms`} target="_blank" rel="noopener noreferrer" className={link}>Terms of Service</a>
                    {" "}and{" "}
                    <a href={`${SITE.marketing}/privacy`} target="_blank" rel="noopener noreferrer" className={link}>Privacy Policy</a>
                  </span>
                </label>
                {termsError && <p role="alert" className="text-[12px] text-rose-300 mt-2">{termsError}</p>}
              </div>

              <button type="submit" disabled={isLoading || !acceptedTerms} className="btn-primary w-full !h-11 justify-center mt-2">
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    <span>{isSignIn ? "Signing in..." : "Creating account..."}</span>
                  </>
                ) : (
                  <span>{isSignIn ? "Sign in" : "Create account"}</span>
                )}
              </button>
            </form>
          </Form>

          <p className="mt-8 text-center text-[13.5px] text-[var(--text-3)]">
            {isSignIn ? "New to Preciprocal?" : "Already have an account?"}{" "}
            <Link href={otherHref} className="font-medium text-white hover:underline underline-offset-2">
              {isSignIn ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthForm;
