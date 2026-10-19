import { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/actions/auth.action";
import { authDestination } from "@/lib/auth/destination";

const AuthLayout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (isUserAuthenticated) {
    // Already signed in: go where the sign-in/sign-up link was headed (e.g.
    // a mock interview from the landing site) rather than always to "/".
    // x-auth-search is set by middleware.ts on /sign-in and /sign-up only.
    const search = (await headers()).get("x-auth-search") ?? "";
    redirect(authDestination(new URLSearchParams(search)));
  }

  return <div className="auth-layout">{children}</div>;
};

export default AuthLayout;
