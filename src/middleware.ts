import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // If logged in but not onboarded, redirect to onboarding
  // (except for onboarding page itself and APIs)
  if (
    req.auth?.user &&
    !req.auth.user.onboarded &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/login")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|api/cron|api/onboarding|_next/static|_next/image|favicon.ico|login).*)"],
};
