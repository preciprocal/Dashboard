"use client";
// app/(auth)/forgot-password/page.tsx
// Ask for a password reset link. Same shell as sign-in (components/AuthForm).

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { ArrowLeft, Check, KeyRound, Mail, MousePointerClick } from "lucide-react";

import { Form } from "@/components/ui/form";
import logo from "@/public/logo.png";
import { SITE } from "@/lib/seo";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const STEPS = [
  { icon: Mail, title: "We email you a link", body: "To the address on your account. Check your spam folder if it is not there in a few minutes." },
  { icon: MousePointerClick, title: "Open the link", body: "It brings you back here to choose a new password." },
  { icon: KeyRound, title: "Sign in again", body: "Use your new password. If you signed up with Google, sign in with Google instead." },
];

const ForgotPasswordPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: z.infer<typeof forgotPasswordSchema>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast.error(error.message || "Failed to send password reset email.");
        return;
      }
      setEmailSent(true);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("Failed to send password reset email.");
    } finally {
      setIsLoading(false);
    }
  };

  const back = (
    <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-3)] hover:text-white transition-colors">
      <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
    </Link>
  );

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] bg-[var(--bg)]">
      {/* Left: how a reset works */}
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
          <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--text-4)]">Password reset</p>
          <h2 className="font-display mt-4 text-[38px] xl:text-[44px] leading-[1.06] font-semibold tracking-[-0.03em] text-white">
            Back into your account in three steps.
          </h2>
          <ol className="mt-10 space-y-5">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="relative flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] ring-1 ring-inset ring-white/[0.08]">
                  <Icon className="w-[17px] h-[17px] text-[var(--text-2)]" strokeWidth={1.75} />
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0d0e10] ring-1 ring-white/[0.12] text-[9.5px] font-semibold text-[var(--text-2)] flex items-center justify-center tabular-nums">{i + 1}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-white">{title}</span>
                  <span className="block mt-0.5 text-[13px] leading-relaxed text-[var(--text-4)]">{body}</span>
                </span>
              </li>
            ))}
          </ol>
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

          {!emailSent ? (
            <>
              <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em] text-white">Reset your password</h1>
              <p className="mt-1.5 text-[14px] text-[var(--text-3)]">Enter the email on your account and we will send you a link to choose a new password.</p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
                  <div>
                    <label htmlFor="fp-email" className="block text-[12.5px] font-medium text-[var(--text-2)] mb-1.5">Email</label>
                    <input id="fp-email" {...form.register("email")} type="email" autoComplete="email" placeholder="you@university.edu" className="field" disabled={isLoading} />
                    {form.formState.errors.email && <p className="text-[12.5px] text-rose-300 mt-1.5">{form.formState.errors.email.message}</p>}
                  </div>
                  <button type="submit" disabled={isLoading} className="btn-primary w-full !h-11 justify-center">
                    {isLoading && <span className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />}
                    {isLoading ? "Sending the link" : "Send reset link"}
                  </button>
                </form>
              </Form>

              <div className="mt-6 text-center">{back}</div>
            </>
          ) : (
            <>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-400/10 ring-1 ring-inset ring-emerald-400/25">
                <Check className="w-5 h-5 text-emerald-300" />
              </span>
              <h1 className="font-display mt-5 text-[26px] font-semibold tracking-[-0.02em] text-white">Check your email</h1>
              <p className="mt-1.5 text-[14px] text-[var(--text-3)]">
                If an account uses <span className="text-white font-medium break-all">{form.getValues("email")}</span>, a reset link is on its way. Open it on this device to choose a new password.
              </p>
              <p className="mt-4 text-[13px] text-[var(--text-4)]">Nothing after a few minutes? Check your spam folder, or send it again.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={() => { setEmailSent(false); form.reset(); }} className="btn-secondary !h-11 justify-center flex-1">Send another email</button>
                <Link href="/sign-in" className="btn-primary !h-11 justify-center flex-1">Back to sign in</Link>
              </div>
            </>
          )}

          <p className="mt-10 text-center text-[12.5px] text-[var(--text-4)]">
            Having trouble?{" "}
            <Link href="/help" className="text-[var(--text-1)] underline underline-offset-2 decoration-white/25 hover:decoration-white/70 transition-colors">Contact support</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
