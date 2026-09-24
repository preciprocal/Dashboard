// app/not-found.tsx
// 404, rendered for any unmatched route.
//
// Every colour, radius and font here comes from the design tokens in
// globals.css rather than a hardcoded hex. A one-off page is exactly where
// a stray literal hex goes unnoticed and quietly drifts from the rest of the
// app, and this one is seen rarely enough that nobody would catch it.
//
// It renders inside the root layout, so the nav and sidebar come with it.
// That is deliberate: someone who mistypes a URL should be able to carry on
// from where they landed rather than be dropped onto an island with a single
// "go home" link.
import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Mic, Briefcase, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found",
  // A 404 that gets indexed is worse than useless. Next.js already sends the
  // 404 status; this stops the page itself ranking for anything.
  robots: { index: false, follow: false },
};

// The three places someone is most likely to have been heading. A 404 that
// only offers "go home" makes the visitor do the work of finding their way
// back, which is the opposite of what a wrong turn needs.
const DESTINATIONS = [
  { href: "/resume/upload", icon: FileText, label: "Analyse a resume", hint: "ATS score and recruiter read" },
  { href: "/interview",     icon: Mic,      label: "Mock interview",   hint: "Practise out loud, get scored" },
  { href: "/job-tracker",   icon: Briefcase, label: "Job tracker",     hint: "Applications and follow-ups" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        {/* The code is set as a quiet label rather than the usual oversized
            numeral. The useful content is the routes below it, and a giant
            "404" pushes those under the fold on a laptop. */}
        <p
          className="mb-3 font-mono text-xs uppercase tracking-[0.35em]"
          style={{ color: "var(--text-4)" }}
        >
          Error 404
        </p>

        <h1
          className="mb-3 text-2xl font-semibold leading-tight sm:text-3xl"
          style={{ color: "var(--text-1)" }}
        >
          This page does not exist
        </h1>

        <p
          className="mb-8 text-sm leading-relaxed"
          style={{ color: "var(--text-3)" }}
        >
          The link may be out of date, or the address might have a typo in it.
          Nothing is wrong with your account.
        </p>

        <div
          className="mb-6 rounded-[var(--r-2xl)] border"
          style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
        >
          {DESTINATIONS.map(({ href, icon: Icon, label, hint }, i) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                // Hairlines between rows only, so the group reads as one card
                // rather than three stacked buttons.
                borderTop: i === 0 ? undefined : "1px solid var(--border)",
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] border"
                style={{
                  borderColor: "var(--accent-border)",
                  background: "var(--accent-subtle)",
                }}
              >
                <Icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: "var(--text-1)" }}>
                  {label}
                </span>
                <span className="block truncate text-xs" style={{ color: "var(--text-4)" }}>
                  {hint}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
          <Link
            href="/help"
            className="transition-colors hover:text-[var(--text-2)]"
            style={{ color: "var(--text-4)" }}
          >
            Get help
          </Link>
        </div>

      </div>
    </div>
  );
}
