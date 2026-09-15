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
import { REQUIRES_PHONE_CLAIM, VERIFY_PHONE_PATH } from "@/lib/config/phone-verification";

// Paths an unverified account may still reach: the verification page itself and
// the endpoints it calls, plus auth routes so signing out always works. Without
// these the gate would redirect the verification page to itself.
const PHONE_GATE_EXEMPT = [
  VERIFY_PHONE_PATH,
  "/api/phone/",
  "/api/auth/",
  "/auth/",
  "/sign-in",
  "/sign-up",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

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

  // ── One-time phone verification gate ─────────────────────────────────────
  // Read straight off the JWT, so this costs nothing: no database call, no
  // Redis call. The claim is set at account creation and cleared by
  // app/api/phone/verify-code, which is why accounts that predate the feature
  // are never gated - they simply have no claim.
  const claims = claimsData?.claims as
    | { app_metadata?: Record<string, unknown> }
    | undefined;
  const needsPhone = claims?.app_metadata?.[REQUIRES_PHONE_CLAIM] === true;

  if (needsPhone) {
    const path = request.nextUrl.pathname;
    const exempt = PHONE_GATE_EXEMPT.some(p => path === p || path.startsWith(p));

    if (!exempt) {
      // Page loads are redirected so the user lands somewhere actionable.
      // Everything else (fetches, server actions) gets a 403 rather than a
      // redirect, because an API caller following a 302 to an HTML page just
      // fails confusingly further down.
      if (isDocumentNavigation(request)) {
        return NextResponse.redirect(new URL(VERIFY_PHONE_PATH, request.url));
      }
      return NextResponse.json(
        { error: "Verify your phone number to finish setting up your account." },
        { status: 403 },
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
