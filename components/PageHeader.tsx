"use client";
// components/PageHeader.tsx
// The one header every signed-in page uses: a breadcrumb trail, an icon,
// the title and a one-line description, and the page's actions on the right.
// Pages used to build their own (a "Back to Dashboard" link here, an
// "AI-Powered" pill there, a title card elsewhere), so the same spot showed
// something different on every page.
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Crumb { label: string; href?: string }

// Section names for every route that has a header. The breadcrumb is built
// from this, so two pages under one section always show the same trail.
const SECTIONS: Record<string, string> = {
  "/resume": "Resume",
  "/interview": "Interviews",
  "/cover-letter": "Cover Letters",
  "/planner": "Planner",
  "/jobs": "Jobs",
  "/apply": "Apply",
  "/job-tracker": "Job Tracker",
  "/contacts": "Contacts",
  "/career-tools": "Career Tools",
  "/debrief": "Interview Journal",
  "/templates": "Templates",
  "/settings": "Settings",
  "/profile": "Profile",
  "/help": "Support",
  "/pricing": "Plans",
  "/job-application": "Job Application",
  "/job-tools": "Job Tools",
  "/extension": "Extension",
};

const SUBPAGES: Record<string, string> = {
  upload: "Upload",
  create: "New",
};

/** Home › Section › Sub-page, from the current path. */
export function crumbsFor(pathname: string, title: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return [];
  const sectionHref = `/${parts[0]}`;
  const section = SECTIONS[sectionHref] ?? title;
  const crumbs: Crumb[] = [{ label: "Home", href: "/" }];
  if (parts.length === 1) return [...crumbs, { label: section }];
  crumbs.push({ label: section, href: sectionHref });
  crumbs.push({ label: SUBPAGES[parts[1]] ?? title });
  return crumbs;
}

/**
 * Home › Section › Page. 13px, with a Home icon and the current page in
 * white, so it reads at a glance. Each item has a small hover pad; the -ml
 * cancels the first pad so the trail's text lines up with the content below.
 */
export function Breadcrumbs({ crumbs, className = "mb-3" }: { crumbs: Crumb[]; className?: string }) {
  if (!crumbs.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center flex-wrap gap-0.5 -ml-1.5 text-[12.5px] leading-none">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const content = (
            <>
              {i === 0 && <Home className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}
              <span className="truncate">{c.label}</span>
            </>
          );
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-0.5 min-w-0">
              {c.href && !last
                ? <Link href={c.href} className="inline-flex items-center gap-1.5 h-7 px-1.5 rounded-md text-[var(--text-4)] hover:text-[var(--text-1)] hover:bg-white/[0.05] transition-colors min-w-0">{content}</Link>
                : <span aria-current={last ? "page" : undefined} className="inline-flex items-center gap-1.5 h-7 px-1.5 text-[var(--text-2)] min-w-0">{content}</span>}
              {!last && <ChevronRight className="w-3.5 h-3.5 text-[var(--text-5)] flex-shrink-0" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function PageHeader({
  title, description, icon, actions, crumbs, className = "",
}: {
  title: string;
  description?: React.ReactNode;
  /** A lucide icon component, or an icon element when rendered from a server
   *  component (a component function cannot cross into a client component). */
  icon?: LucideIcon | React.ReactElement;
  /** Buttons/pills on the right. Use h-10 controls so every header lines up. */
  actions?: React.ReactNode;
  /** Override the trail derived from the URL (e.g. a resume's own name). */
  crumbs?: Crumb[];
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  const trail = crumbs ?? crumbsFor(pathname, title);
  // The Sectira header: no card, a quiet trail, a large title with its
  // description, and the page's actions on the right. The icon is kept as a
  // small accent mark beside the title.
  return (
    <header className={`mb-6 animate-fade-in-up ${className}`}>
      {trail.length > 1 && <Breadcrumbs crumbs={trail} className="mb-2.5" />}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="w-9 h-9 rounded-[10px] app-glass bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0 text-[var(--accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">
              {React.isValidElement(icon)
                ? icon
                : React.createElement(icon as LucideIcon, { strokeWidth: 1.75, "aria-hidden": true })}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold text-[var(--text-1)] tracking-[-0.024em] leading-tight truncate">{title}</h1>
            {description && <p className="text-[13px] text-[var(--text-3)] mt-1 leading-snug">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
