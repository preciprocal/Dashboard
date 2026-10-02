"use client";

// components/ActivityTracker.tsx
// Records what signed-in users do in the app, for the admin analytics page:
// page views, clicks on buttons and links, and engaged time per page.
// Batched to /api/activity; see migration 0046 for what is and is not stored.
//
// ─── Engaged time, not open time ────────────────────────────────────────────
// Time only accrues while the tab is visible AND the user has moved, clicked,
// typed or scrolled in the last minute. A tab left open in the background, or
// a laptop closed mid-session, adds nothing. Otherwise "time spent" would
// mostly measure how long people forget to close tabs.
//
// ─── Never in the way ───────────────────────────────────────────────────────
// Renders nothing, never throws, never blocks navigation. A failed batch is
// dropped rather than retried: analytics losing a few events is fine, a
// tracker that piles up retries in a slow tab is not.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type ActivityEvent = {
  event: "page_view" | "click" | "time";
  path: string;
  label?: string;
  target?: string;
  durationMs?: number;
  source?: string;
  at: number;
};

const TICK_MS = 5_000;
const IDLE_AFTER_MS = 60_000;
const FLUSH_EVERY_MS = 30_000;
const MAX_QUEUE = 50;
const ENDPOINT = "/api/activity";

/** Pages where nobody is signed in yet; the API would drop these anyway. */
const SKIP_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/auth"];

function labelOf(el: Element): string {
  const explicit = el.getAttribute("data-track") || el.getAttribute("aria-label") || el.getAttribute("title");
  const text = explicit || (el as HTMLElement).innerText || el.textContent || "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80) || "(unlabelled)";
}

/** Internal links keep their path; external ones keep only the host. */
function targetOf(el: Element): string | undefined {
  const href = el.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return undefined;
  try {
    const url = new URL(href, window.location.origin);
    if (url.protocol === "mailto:") return "mailto";
    return url.origin === window.location.origin ? url.pathname : url.host;
  } catch {
    return undefined;
  }
}

/** utm_campaign, only when the visit came from one of our emails. */
function emailSource(): string | undefined {
  const p = new URLSearchParams(window.location.search);
  return p.get("utm_source") === "email" ? (p.get("utm_campaign") ?? "email").slice(0, 60) : undefined;
}

export default function ActivityTracker() {
  const pathname = usePathname();

  const queue = useRef<ActivityEvent[]>([]);
  const currentPath = useRef<string | null>(null);
  const engagedMs = useRef(0);
  const lastTick = useRef(0);
  const lastActivity = useRef(0);

  // ── Sending ──────────────────────────────────────────────────────────────
  const send = useRef((useBeacon: boolean) => {
    if (queue.current.length === 0) return;
    const body = JSON.stringify({ events: queue.current.splice(0, MAX_QUEUE) });
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, body);
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => { /* dropped on purpose, see header */ });
      }
    } catch { /* never surface */ }
  });

  const push = useRef((e: Omit<ActivityEvent, "at">) => {
    if (!currentPath.current) return;
    queue.current.push({ ...e, at: Date.now() });
    if (queue.current.length >= MAX_QUEUE) send.current(false);
  });

  /** Turn accrued engaged time on the current page into a 'time' event. */
  const flushTime = useRef(() => {
    const ms = Math.round(engagedMs.current);
    engagedMs.current = 0;
    if (ms >= 1000 && currentPath.current) {
      push.current({ event: "time", path: currentPath.current, durationMs: Math.min(ms, 600_000) });
    }
  });

  // ── Page views, and closing out time on the page being left ───────────────
  useEffect(() => {
    if (!pathname) return;
    if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) {
      flushTime.current();
      currentPath.current = null;
      return;
    }
    flushTime.current();
    currentPath.current = pathname;
    const now = Date.now();
    lastTick.current = now;
    lastActivity.current = now;
    push.current({ event: "page_view", path: pathname, label: document.title.slice(0, 80), source: emailSource() });
  }, [pathname]);

  // ── Engaged-time clock, activity listeners, clicks, unload ────────────────
  useEffect(() => {
    const markActive = () => { lastActivity.current = Date.now(); };

    const tick = () => {
      const now = Date.now();
      const elapsed = Math.min(now - lastTick.current, TICK_MS * 2);
      lastTick.current = now;
      const visible = document.visibilityState === "visible";
      const recentlyActive = now - lastActivity.current < IDLE_AFTER_MS;
      if (visible && recentlyActive && currentPath.current) engagedMs.current += elapsed;
    };

    const onClick = (ev: MouseEvent) => {
      try {
        const el = (ev.target as Element | null)?.closest?.('a, button, [role="button"], [data-track]');
        if (!el || el.closest("[data-track-ignore]")) return;
        markActive();
        push.current({ event: "click", path: currentPath.current ?? window.location.pathname, label: labelOf(el), target: targetOf(el) });
      } catch { /* never surface */ }
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") {
        tick();
        flushTime.current();
        send.current(true);
      } else {
        // Coming back: do not count the time away.
        lastTick.current = Date.now();
        markActive();
      }
    };

    const onPageHide = () => {
      tick();
      flushTime.current();
      send.current(true);
    };

    const activityEvents = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    activityEvents.forEach(t => window.addEventListener(t, markActive, { passive: true, capture: true }));
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    const clock = window.setInterval(tick, TICK_MS);
    const flusher = window.setInterval(() => { tick(); flushTime.current(); send.current(false); }, FLUSH_EVERY_MS);

    return () => {
      activityEvents.forEach(t => window.removeEventListener(t, markActive, { capture: true }));
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(clock);
      window.clearInterval(flusher);
    };
  }, []);

  return null;
}
