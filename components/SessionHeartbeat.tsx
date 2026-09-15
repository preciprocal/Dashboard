"use client";

import { useEffect } from "react";
import { getDeviceFingerprint } from "@/lib/fingerprint";

/**
 * Reports the current session to /api/session/heartbeat once per mount, which
 * is once per full page load - LayoutClient does not remount on client-side
 * navigation, so this is not per-route.
 *
 * Renders nothing and never surfaces an error. Session tracking is a
 * background concern; if it fails, the user should never find out, and the
 * server side fails open for the same reason.
 */
export default function SessionHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fingerprint = (await getDeviceFingerprint()) ?? undefined;
        if (cancelled) return;

        await fetch("/api/session/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint }),
          // Not critical enough to hold up anything else on the page.
          keepalive: true,
        });
      } catch {
        // Deliberately silent - see the component doc comment.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
