// middleware.ts
// Refreshes the Supabase auth session cookie on every request. This is
// required for @supabase/ssr - without it, users can get randomly logged
// out because Server Components can't write cookies themselves and rely on
// this middleware having already refreshed an expiring session.
// Pattern verified against supabase/supabase's official
// examples/auth/nextjs-full/lib/supabase/proxy.ts (Aug 2026).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { redis } from "@/lib/redis/redis-client";
import { revokedKey } from "@/lib/session/keys";
// PHONE_GATE_EXEMPT and the phone-verification imports were removed with the
// app-wide gate. See the note near the end of middleware() for why the gate
// moved to lib/ai/usage-guard.ts, and note that an exempt-list is no longer
// needed at all: gating at the quota boundary means every page, every auth
// route and every billing route is reachable by default, rather than reachable
// only if someone remembered to add it to a list.

// Only document navigations are checked for revocation. Enforcing on every
// request would add a Redis round trip to prefetches, API calls and data
// fetches, and eviction only needs to take effect on the evicted session's
// next page load. See supabase/migrations/0026_user_sessions.sql: this is a
// sharing deterrent, not a security boundary.
function isDocumentNavigation(request: NextRequest): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not add code between createServerClient and getClaims() - the
  // session refresh has to happen before anything else touches the client.
  const { data: claimsData } = await supabase.auth.getClaims();

  // ── Concurrent-session eviction ──────────────────────────────────────────
  // The heartbeat route decides who gets evicted and publishes the decision to
  // Redis; this only reads it. One GET, and only on page loads.
  const sessionId = (claimsData?.claims as { session_id?: string } | undefined)?.session_id;

  // Never act on /sign-in itself. signOut() below clears the cookie, but the
  // browser only drops it once this response lands - so without this guard a
  // revoked session bounces /sign-in -> /sign-in until the browser gives up
  // with ERR_TOO_MANY_REDIRECTS.
  const onSignIn = request.nextUrl.pathname.startsWith("/sign-in");

  if (sessionId && redis && !onSignIn && isDocumentNavigation(request)) {
    try {
      if (await redis.get(revokedKey(sessionId))) {
        // signOut() writes the cleared cookies through the setAll handler
        // above, which mutates `response`. Returning a fresh redirect would
        // throw those writes away and leave the session live, so the cookies
        // have to be carried across onto the redirect explicitly.
        await supabase.auth.signOut();

        const signInUrl = new URL("/sign-in", request.url);
        signInUrl.searchParams.set("reason", "session_limit");
        const redirect = NextResponse.redirect(signInUrl);
        for (const cookie of response.cookies.getAll()) {
          redirect.cookies.set(cookie);
        }
        return redirect;
      }
    } catch (err) {
      // Fails open, matching lib/session/registry.ts: a Redis outage must not
      // sign anyone out, and certainly must not break every page in the app.
      console.error("⚠️ Session revocation check failed (non-fatal):", err);
    }
  }

  // ── Phone verification is NOT gated here ─────────────────────────────────
  //
  // It used to be, reading the app_metadata claim off the JWT at zero cost and
  // redirecting every non-exempt navigation to /verify-phone. That was removed
  // because it gated the entire application surface, not quota consumption:
  //
  //   - `/` and `/pricing` were blocked, as were the Stripe subscription
  //     routes. An unverified user could not upgrade off the free tier, so an
  //     anti-free-farming measure blocked the exit from the free tier.
  //   - Non-quota APIs were blocked too - /api/usage, /api/profile, resume
  //     download and delete - none of which consume anything.
  //   - Server actions got a 403 JSON body no server-action client can render.
  //
  // The gate now lives in lib/ai/usage-guard.ts requirePhoneVerification(),
  // which is the quota-consumption boundary the spec actually names, and is
  // scoped to Free accounts. An unverified user can browse, pay, and manage
  // their account; they cannot spend free quota.
  //
  // REQUIRES_PHONE_CLAIM is still stamped at signup and cleared on
  // verification. Nothing reads it now that this gate is gone - the guard
  // reads profiles.phone_verified instead - so it is vestigial rather than
  // load-bearing. Left in place because removing it needs a backfill pass over
  // existing auth users.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
