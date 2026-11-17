"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, AlertCircle } from "lucide-react";

import { Form } from "@/components/ui/form";
import logo from "@/public/logo.png";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/** The page frame shared by every state: logo, one card, a way back. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[var(--bg)]">
      <div className="flex items-center gap-2.5 mb-8">
        <Image src={logo} alt="Preciprocal" width={32} height={32} className="w-8 h-8 rounded-[9px]" priority />
        <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-white">Preciprocal</span>
      </div>
      <div className="w-full max-w-[420px] rounded-2xl bg-[#151618] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-16px_rgba(0,0,0,0.8)] p-6 sm:p-8">
        {children}
      </div>
      <Link href="/sign-in" className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-3)] hover:text-white transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
      </Link>
    </div>
  );
}

const ResetPasswordPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState<string>("");
  // null = still checking; the recovery session is established by
  // app/auth/confirm/route.ts before the user ever reaches this page.
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const onSubmit = async (data: z.infer<typeof resetPasswordSchema>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });

      if (error) {
        toast.error(error.message || "Failed to reset password");
        return;
      }

      toast.success("Password reset. You can now sign in with your new password.");
      setTimeout(() => router.push("/sign-in"), 2000);
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (hasSession === null) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-6 text-[13.5px] text-[var(--text-3)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking your reset link
        </div>
      </Shell>
    );
  }

  if (!hasSession) {
    return (
      <Shell>
        <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-rose-500/10 ring-1 ring-inset ring-rose-500/20 mb-5">
          <AlertCircle className="w-5 h-5 text-rose-300" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-white">This link no longer works</h1>
        <p className="text-[13.5px] text-[var(--text-3)] mt-2">The reset link is invalid or has expired. Ask for a new one and use it soon after it arrives.</p>
        <Link href="/forgot-password" className="btn-primary w-full justify-center mt-6">Request a new link</Link>
      </Shell>
    );
  }

  const label = "block text-[12.5px] font-medium text-[var(--text-2)] mb-1.5";
  const eye = "absolute inset-y-0 right-0 px-3 flex items-center text-[var(--text-4)] hover:text-white transition-colors";

  return (
    <Shell>
      <span className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/[0.05] ring-1 ring-inset ring-white/[0.08] mb-5">
        <KeyRound className="w-5 h-5 text-[var(--text-2)]" />
      </span>
      <h1 className="font-display text-[22px] font-semibold tracking-[-0.02em] text-white">Create a new password</h1>
      <p className="text-[13.5px] text-[var(--text-3)] mt-1.5">
        {email ? <>For <span className="text-[var(--text-1)]">{email}</span>. At least 6 characters.</> : "At least 6 characters."}
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <div>
            <label htmlFor="rp-password" className={label}>New password</label>
            <div className="relative">
              <input id="rp-password" {...form.register("password")} type={showPassword ? "text" : "password"} autoComplete="new-password"
                className="field !pr-11" disabled={isLoading} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className={eye} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.password && <p className="text-rose-300 text-[12.5px] mt-1.5">{form.formState.errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="rp-confirm" className={label}>Confirm new password</label>
            <div className="relative">
              <input id="rp-confirm" {...form.register("confirmPassword")} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password"
                className="field !pr-11" disabled={isLoading} />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={eye} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.confirmPassword && <p className="text-rose-300 text-[12.5px] mt-1.5">{form.formState.errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full !h-11 justify-center">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving</> : "Reset password"}
          </button>
        </form>
      </Form>

      <p className="mt-6 text-center text-[12px] text-[var(--text-4)]">
        Having trouble? <Link href="/help" className="text-[var(--text-2)] underline underline-offset-2 decoration-white/25 hover:decoration-white/70">Contact support</Link>
      </p>
    </Shell>
  );
};

export default ResetPasswordPage;
