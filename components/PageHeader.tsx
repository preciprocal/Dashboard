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
  "/job-tracker": "Job Tracker",
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
      <ol className="flex items-center flex-wrap gap-0.5 -ml-1.5 text-[13px] leading-none">
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
                ? <Link href={c.href} className="inline-flex items-center gap-1.5 h-7 px-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors min-w-0">{content}</Link>
                : <span aria-current={last ? "page" : undefined} className="inline-flex items-center gap-1.5 h-7 px-1.5 text-white font-medium min-w-0">{content}</span>}
              {!last && <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" aria-hidden="true" />}
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
  return (
    <header className={`glass-card overflow-hidden animate-fade-in-up ${className}`}>
      {/* The trail gets its own row, divided from the title, at the same left
          edge as the icon below it. */}
      {trail.length > 0 && (
        <div className="px-5 py-2 border-b border-white/[0.06] bg-white/[0.015]">
          <Breadcrumbs crumbs={trail} className="" />
        </div>
      )}
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {icon && (
            <div className="w-10 h-10 rounded-[10px] bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center flex-shrink-0 text-indigo-200 [&>svg]:w-5 [&>svg]:h-5">
              {React.isValidElement(icon)
                ? icon
                : React.createElement(icon as LucideIcon, { strokeWidth: 1.75, "aria-hidden": true })}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold text-white tracking-tight leading-tight truncate">{title}</h1>
            {description && <p className="text-[13px] text-slate-400 mt-0.5 leading-snug">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
