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
 *
 * ─── It is also the ONLY backstop for the device cap ─────────────────────────
 *
 * Session revocation is enforced in middleware.ts, gated on
 * `sessionId && redis && ...`. If Redis is unconfigured or down, that
 * short-circuits and revocation stops happening entirely - silently, with no
 * error path, because a missing cache is indistinguishable from a session that
 * was never revoked.
 *
 * A second, independent check already existed and was being thrown away.
 * lib/session/registry.ts computes `revoked` from the DATABASE, and the
 * heartbeat route returns it:
 *
 *   return NextResponse.json({ ok: true, tracked: true, revoked: result.revoked });
 *
 * This component awaited that fetch and never read the body. The signal was
 * computed, transmitted, and dropped - so the concurrent-session cap depended
 * entirely on Redis despite a working database check sitting one .json() call
 * away from being usable.
 */
export default function SessionHeartbeat() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fingerprint = (await getDeviceFingerprint()) ?? undefined;
        if (cancelled) return;

        const res = await fetch("/api/session/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint }),
          // NOT keepalive any more. keepalive lets the request outlive the
          // page, which is right for fire-and-forget telemetry and wrong once
          // the response matters: the browser is free to discard a keepalive
          // body, and we now need to read one.
        });

        if (cancelled) return;

        const data = (await res.json().catch(() => null)) as { revoked?: boolean } | null;
        if (!data?.revoked || cancelled) return;

        // Never bounce someone who is already there. middleware.ts carries the
        // same guard, for the same reason: signOut() clears the cookie but the
        // browser only drops it once the response lands, so without this a
        // revoked session ping-pongs /sign-in -> /sign-in until the browser
        // gives up with ERR_TOO_MANY_REDIRECTS.
        if (window.location.pathname.startsWith("/sign-in")) return;

        // This session was evicted by a newer sign-in elsewhere.
        //
        // A full navigation rather than router.push: the point is to land on a
        // server request that middleware sees, so the stale cookie is cleared
        // by the same path that handles the Redis-backed case. A client-side
        // route change would keep the revoked session alive in memory.
        //
        // `reason` matches what middleware.ts sets, so the sign-in page can
        // explain why they were signed out rather than appearing to log them
        // out at random.
        window.location.href = "/sign-in?reason=session_limit";
      } catch {
        // Deliberately silent - see the component doc comment. A heartbeat
        // that cannot reach the server must never sign anyone out; that would
        // turn a flaky connection into a logout loop.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
